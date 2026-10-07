// src/hooks/useProbeRoute.js — 목적지가 없을 때 "앞 구간 소통"을 얻는 임시 경로.
// 지금 달리는 도로를 따라 몇 km 앞(맵매칭 예상 경로의 끝, 없으면 진행 방향 8km 앞)을 임시 목적지로 잡아
// 카카오 길찾기를 조용히 부른다 — 구간마다 소통 상태(원활·서행·지체·정체)가 와서 원인 요약·정체 끝·소통 띠에 쓴다.
// 1분에 한 번, 또는 1km 움직였을 때만 다시 부른다(카카오 무료 한도 하루 10,000건 안).
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchRoute } from "../services/routeApi";
import { buildRoute, locate } from "../utils/routeFilter";
import { distanceKm } from "../utils/aheadFilter";

const REFRESH_MS = 60_000;
const REFRESH_KM = 1;
const FALLBACK_KM = 8;
const OFF_ROUTE_KM = 0.4; // 임시 경로에서 이만큼 벗어나면(다른 길로 들어섬) 바로 다시 부른다

/** 위치에서 bearing 방향으로 km 떨어진 점(평면 근사) */
function offset(p, bearing, km) {
  const b = (bearing * Math.PI) / 180;
  return {
    lat: p.lat + (km * Math.cos(b)) / 111.32,
    lng: p.lng + (km * Math.sin(b)) / (111.32 * Math.cos((p.lat * Math.PI) / 180)),
  };
}

/**
 * @param {{ fix, heading, path, enabled, data }} input
 *   path: useRoadMatch 의 예상 경로(buildRoute 결과) | null
 * @returns {{ route, s0 } | null}
 */
export default function useProbeRoute({ fix, heading, path, enabled, data }) {
  const [route, setRoute] = useState(null);
  const lastRef = useRef({ at: 0, pos: null });
  const busyRef = useRef(false);

  const here = useMemo(() => (route && fix ? locate(route, fix) : null), [route, fix]);

  useEffect(() => {
    if (!enabled) {
      if (route) setRoute(null);
      lastRef.current = { at: 0, pos: null };
      return;
    }
    if (!fix || heading == null || busyRef.current) return;
    const last = lastRef.current;
    const off = here && here.offKm > OFF_ROUTE_KM;
    const moved = last.pos ? distanceKm(last.pos, fix) : Infinity;
    if (last.at && !off && Date.now() - last.at < REFRESH_MS && moved < REFRESH_KM) return;

    const end = path?.pts?.length && path.total > 2 ? path.pts[path.pts.length - 1] : offset(fix, heading, FALLBACK_KM);
    busyRef.current = true;
    lastRef.current = { at: Date.now(), pos: { lat: fix.lat, lng: fix.lng } };
    fetchRoute(fix, { lat: end.lat, lng: end.lng, name: "앞쪽" }, heading, { data })
      .then((raw) => setRoute(buildRoute(raw)))
      .catch(() => {}) // 실패하면 이전 경로를 그대로 쓰고 다음 주기에 다시 부른다
      .finally(() => {
        busyRef.current = false;
      });
  }, [enabled, fix, heading, path, data, here, route]);

  const ok = enabled && route && here && here.offKm <= OFF_ROUTE_KM;
  const s0 = here?.s;
  return useMemo(() => (ok ? { route, s0 } : null), [ok, route, s0]);
}
