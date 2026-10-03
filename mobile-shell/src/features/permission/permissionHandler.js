// src/features/permission/permissionHandler.js
// 할래말래 permissionHandler 에서 위치만 남겼다(푸시 권한 없음 — 앞볼래는 알림·자동 팝업을 쓰지 않는다).
import { Platform, PermissionsAndroid, Linking } from "react-native";
import Geolocation from "@react-native-community/geolocation";

async function checkLocationGranted() {
  if (Platform.OS === "android") {
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  }
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      () => resolve(true),
      (err) => resolve(err?.code !== 1), // 1 = PERMISSION_DENIED
      { timeout: 3000, enableHighAccuracy: false }
    );
  });
}

async function requestLocation() {
  if (Platform.OS === "android") {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: "위치 권한",
      message: "현재 위치와 진행 방향으로 앞쪽 CCTV를 고르려면 위치 권한이 필요해요.",
      buttonPositive: "허용",
      buttonNegative: "거부",
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return new Promise((resolve) => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false)
    );
  });
}

export async function handleRequestLocationPermission(sendToWeb) {
  try {
    sendToWeb("PERMISSION_RESULT", { granted: await requestLocation() });
  } catch (e) {
    sendToWeb("PERMISSION_RESULT", { granted: false, error: e?.message || String(e) });
  }
}

export async function handleCheckLocationPermission(sendToWeb) {
  try {
    sendToWeb("PERMISSION_STATUS", { granted: await checkLocationGranted() });
  } catch {
    sendToWeb("PERMISSION_STATUS", { granted: false });
  }
}

export function handleOpenSettings() {
  if (Platform.OS === "ios") Linking.openURL("app-settings:");
  else Linking.openSettings();
}
