// src/features/location/locationTracker.js
// F-02 — 할래말래 locationTracker(50m·30초, 좌표만)를 앞볼래용으로 바꿨다:
// 1초 주기, 고정밀, heading(진행 방위)·speed(m/s)·accuracy 까지 웹에 보낸다.
import Geolocation from "@react-native-community/geolocation";

export function startLocationTracker({ sendToWeb, intervalMs = 1000 }) {
  const watchId = Geolocation.watchPosition(
    (pos) => {
      sendToWeb("LOCATION_UPDATE", {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        heading: pos.coords.heading, // 0~360, 정지 시 -1 또는 null
        speed: pos.coords.speed, // m/s
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      });
    },
    (err) => sendToWeb("LOCATION_ERROR", { code: err?.code, message: err?.message }),
    {
      enableHighAccuracy: true,
      distanceFilter: 0,
      interval: intervalMs, // Android
      fastestInterval: intervalMs,
    }
  );

  return () => {
    try {
      Geolocation.clearWatch(watchId);
    } catch {}
  };
}
