/**
 * 앞볼래 RN Shell — 할래말래 RN Shell(App.js)에서 앞볼래에 필요한 것만 남겼다.
 *   남김: WebView + 브릿지 큐, WEB_READY 스플래시 해제, 부팅 타임아웃, 안드로이드 뒤로가기 위임,
 *         위치 권한, 외부 링크
 *   뺌  : 소셜 로그인, 푸시(FCM), 헬스, 결제창 뒤로가기, 공유
 *   추가: START_LOCATION / STOP_LOCATION → LOCATION_UPDATE(1초, heading·speed 포함)
 *
 * 새 앱 생성 루틴(할래말래와 동일 — 프로젝트 통째 복사 금지, init 후 JS Shell 만 가져온다)은 README.md 참고.
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, BackHandler, Image, Platform, SafeAreaView, StatusBar, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { AppConfig } from "./src/config/AppConfig";
import { createBridge } from "./src/bridge/bridge";
import { useBootGuard } from "./src/features/guard/useBootGuard";
import { handleShouldStartLoadRequest, openExternal } from "./src/features/linking/linkingPolicy";
import {
  handleRequestLocationPermission,
  handleCheckLocationPermission,
  handleOpenSettings,
} from "./src/features/permission/permissionHandler";
import { startLocationTracker } from "./src/features/location/locationTracker";

const BG = "#0A0A0B"; // 로고 바탕색 = 웹 스플래시 배경 — 스플래시→웹 전환 때 배경이 튀지 않게
const logoImg = require("./src/assets/logo-512.png");

export default function App() {
  const webViewRef = useRef(null);
  const bridge = useMemo(() => createBridge({ webViewRef, debugTag: "[ApbBridge]" }), []);

  const lastNavStateRef = useRef({ isRoot: true, path: "" });
  const didHideSplashRef = useRef(false);
  const didInitialBootRef = useRef(false);
  const stopLocationRef = useRef(null);

  const sendToWeb = useCallback((type, payload = {}) => bridge.send(type, payload), [bridge]);

  const guard = useBootGuard({
    bootTimeoutMs: AppConfig.guard.bootTimeoutMs,
    minSplashMs: AppConfig.splash.minMs,
    fadeDurationMs: AppConfig.splash.effect.durationMs,
    onBootTimeout: () => {
      sendToWeb("OFFLINE_FALLBACK", { reason: "timeout", at: Date.now() });
      hideSplashOnce("timeout");
    },
  });

  const hideSplashOnce = useCallback(
    (reason) => {
      if (didHideSplashRef.current) return;
      didHideSplashRef.current = true;
      guard.clearBootTimeout();
      guard.hideSplashRespectingMin();
      sendToWeb("SPLASH_HIDDEN", { reason, at: Date.now() });
    },
    [guard, sendToWeb]
  );

  const stopLocation = useCallback(() => {
    try {
      stopLocationRef.current?.();
    } catch {}
    stopLocationRef.current = null;
  }, []);

  useEffect(() => stopLocation, [stopLocation]);

  // Android HW Back → Web 에 위임 (웹 BridgeNavSync 가 뒤로/두 번 눌러 종료를 결정)
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const nav = lastNavStateRef.current;
      sendToWeb(nav.isRoot ? "APP_EXIT_REQUEST" : "BACK_REQUEST", { nav, at: Date.now() });
      return true;
    });
    return () => sub.remove();
  }, [sendToWeb]);

  const onMessage = useCallback(
    async (event) => {
      const raw = event?.nativeEvent?.data;
      if (!raw || typeof raw !== "string") return;

      // 메시지가 왔다 = 웹이 살아 있다 → 큐 flush (할래말래 Android 데드락 대응 유지)
      bridge.setWebReady(true);
      bridge.flushQueue();

      if (raw.startsWith("open::")) {
        if (AppConfig.features.enableExternalLinking) openExternal(decodeURI(raw.slice(6)));
        return;
      }

      const msg = bridge.parseIncoming(raw);
      if (!msg) return;
      const payload = msg.payload || {};

      switch (msg.type) {
        case "WEB_READY":
          sendToWeb("WEB_READY_ACK", { at: Date.now() });
          hideSplashOnce("webReady");
          return;

        case "WEB_ERROR":
          hideSplashOnce("webError");
          return;

        case "NAV_STATE":
          lastNavStateRef.current = { isRoot: !!payload.isRoot, path: payload.path ?? "" };
          return;

        case "REQUEST_LOCATION_PERMISSION":
          await handleRequestLocationPermission(sendToWeb);
          return;

        case "CHECK_LOCATION_PERMISSION":
          await handleCheckLocationPermission(sendToWeb);
          return;

        case "OPEN_SETTINGS":
          handleOpenSettings();
          return;

        case "START_LOCATION":
          if (!AppConfig.features.enableLocation) return;
          stopLocation();
          stopLocationRef.current = startLocationTracker({
            sendToWeb,
            intervalMs: payload.intervalMs || AppConfig.location.intervalMs,
          });
          return;

        case "STOP_LOCATION":
          stopLocation();
          return;

        case "EXIT_APP":
          stopLocation();
          if (Platform.OS === "android") BackHandler.exitApp();
          return;

        default:
          return;
      }
    },
    [bridge, sendToWeb, hideSplashOnce, stopLocation]
  );

  const onLoadStart = useCallback(() => {
    bridge.setWebReady(false);
    if (didInitialBootRef.current) return;
    didInitialBootRef.current = true;
    guard.showSplash();
    guard.startBootTimeout();
  }, [bridge, guard]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <WebView
          ref={webViewRef}
          source={{ uri: AppConfig.webUrl }}
          onMessage={onMessage}
          onLoadStart={onLoadStart}
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={(req) =>
            AppConfig.features.enableExternalLinking ? handleShouldStartLoadRequest(req) : true
          }
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          overScrollMode="never"
          style={styles.webview}
        />
      </SafeAreaView>

      {guard.splashVisible ? (
        <Animated.View style={[styles.splash, { opacity: guard.splashOpacity }]}>
          <Image source={logoImg} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  webview: { flex: 1, backgroundColor: "transparent" },
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 168, height: 168 },
});
