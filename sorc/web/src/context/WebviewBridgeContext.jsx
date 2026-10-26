// src/context/WebviewBridgeContext.jsx — 할래말래 WebviewBridgeContext 이식 (구조·메시지 규약 동일)
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { isInWebView, postToApp, parseAppMessage } from "../bridge/webviewBridge";

const WebviewBridgeContext = createContext(null);

export function WebviewBridgeProvider({ children }) {
  const listenersRef = useRef({});
  const didSendWebReady = useRef(false);

  const sendToApp = useCallback((type, payload = {}) => postToApp(type, payload), []);

  /** RN → Web 메시지 타입별 구독. 반환값은 unsubscribe */
  const subscribe = useCallback((type, callback) => {
    if (!listenersRef.current[type]) listenersRef.current[type] = new Set();
    listenersRef.current[type].add(callback);
    return () => listenersRef.current[type]?.delete(callback);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const msg = parseAppMessage(event.data);
      if (!msg) return;
      const cbs = listenersRef.current[msg.type];
      cbs?.forEach((cb) => {
        try {
          cb(msg.payload);
        } catch (e) {
          console.warn("[Bridge] listener error:", msg.type, e);
        }
      });
    };
    // RN WebView: iOS는 window에, Android는 document에 message가 dispatch됨
    window.addEventListener("message", handler);
    document.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      document.removeEventListener("message", handler);
    };
  }, []);

  /** WEB_READY 1회 — RN 셸은 이 신호로 네이티브 스플래시를 내린다 */
  const signalWebReady = useCallback((reason = "unknown") => {
    if (!isInWebView() || didSendWebReady.current) return;
    didSendWebReady.current = true;
    postToApp("WEB_READY", { at: Date.now(), reason });
  }, []);

  // 안전망 — RN 부팅 타임아웃(8초)보다 앞에서 핸드셰이크를 끝낸다
  useEffect(() => {
    if (!isInWebView()) return;
    const t = setTimeout(() => signalWebReady("timeout"), 4000);
    return () => clearTimeout(t);
  }, [signalWebReady]);

  const value = useMemo(
    () => ({ sendToApp, subscribe, signalWebReady, isWebView: isInWebView() }),
    [sendToApp, subscribe, signalWebReady]
  );

  return <WebviewBridgeContext.Provider value={value}>{children}</WebviewBridgeContext.Provider>;
}

export function useBridge() {
  return useContext(WebviewBridgeContext);
}
