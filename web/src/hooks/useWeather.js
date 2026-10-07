// src/hooks/useWeather.js — ⑧ 날씨·노면 원인. 비·눈·안개처럼 차를 느리게 만드는 날씨를 알려 준다.
// Open-Meteo(open-meteo.com, 키 없음, CC BY 4.0 — 출처 표기 필요)의 현재 날씨를 15분마다 받는다.
// 위치는 소수 둘째 자리(약 1km)로 줄여 보낸다. 목업 데이터일 때는 부르지 않는다.
import { useEffect, useRef, useState } from "react";

const REFRESH_MS = 15 * 60 * 1000;

// WMO 날씨 코드 → 운전에 영향 있는 것만
function describe(cur) {
  const code = cur.weather_code;
  const rain = cur.rain ?? 0;
  const snow = cur.snowfall ?? 0;
  const vis = cur.visibility; // m
  if (snow > 0 || (code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: "snow", text: snow > 0 ? `눈 오는 중(시간당 ${snow}cm)` : "눈 오는 중", slow: true };
  if (code >= 95) return { kind: "storm", text: "뇌우", slow: true };
  if (rain >= 0.5 || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { kind: "rain", text: rain > 0 ? `비 오는 중(시간당 ${rain}mm)` : "비 오는 중", slow: rain >= 2 || code >= 63 };
  if (code === 45 || code === 48 || (vis != null && vis < 1000)) return { kind: "fog", text: vis != null ? `안개 · 가시거리 ${vis < 1000 ? `${Math.round(vis / 10) * 10}m` : `${(vis / 1000).toFixed(1)}km`}` : "안개", slow: true };
  if (code >= 51 && code <= 57) return { kind: "drizzle", text: "이슬비", slow: false };
  if ((cur.temperature_2m ?? 10) <= 0 && (cur.precipitation ?? 0) > 0) return { kind: "ice", text: "영하 · 노면 결빙 주의", slow: true };
  return { kind: "clear", text: code <= 1 ? "맑음" : code <= 3 ? "구름" : "날씨 특이 사항 없음", slow: false };
}

/** @returns {{ kind, text, slow, tempC } | null} */
export default function useWeather(fix, enabled = true) {
  const [weather, setWeather] = useState(null);
  const lastRef = useRef(0);
  const has = !!fix;
  const lat = fix ? Math.round(fix.lat * 100) / 100 : null;
  const lng = fix ? Math.round(fix.lng * 100) / 100 : null;

  useEffect(() => {
    if (!enabled || !has) return undefined;
    let alive = true;
    const load = () => {
      lastRef.current = Date.now();
      const q = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        current: "temperature_2m,precipitation,rain,snowfall,weather_code,visibility",
        timezone: "Asia/Seoul",
      });
      fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(8000) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
        .then((j) => alive && j.current && setWeather({ ...describe(j.current), tempC: j.current.temperature_2m }))
        .catch(() => {}); // 날씨는 덤 — 실패하면 조용히 넘어간다
    };
    if (Date.now() - lastRef.current > REFRESH_MS) load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // 1km 넘게 움직였을 때만(반올림 좌표가 바뀔 때) 다시 맞춘다
  }, [enabled, has, lat, lng]);

  return enabled ? weather : null;
}
