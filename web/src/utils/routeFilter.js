// src/utils/routeFilter.js
// 목적지가 있을 때의 선별 — 카카오 길찾기 경로 선을 따라 "앞"을 판단한다(부채꼴보다 정확).
//  - 경로 위 내 위치를 구하고(경로 거리 s0), CCTV·돌발도 경로에 투영해 s0 앞 5km 안만 고른다.
//  - 경로에서 너무 먼(옆 도로·반대편 먼 곳) 지점은 뺀다.
//  - 경로 구간마다 소통 상태(원활·서행·지체·정체·통행 불가)가 있어 "어디까지 막히는지"를 구한다.
// React 의존 없는 순수 함수만 둔다.
import { directionFromName, distanceKm } from "./aheadFilter";

export const ROUTE_OPTS = {
  maxKm: 5,
  limit: 5,
  onRouteKm: 0.25, // CCTV 좌표는 도로 중심선에서 조금 떨어져 있다 — 이 안이면 경로 위로 본다
  attachKm: 2,
  offRouteKm: 0.3, // 내가 경로에서 이만큼 벗어나면 경로를 다시 찾는다
  arriveKm: 0.3,
};

export const TRAFFIC_LABEL = { smooth: "원활", slow: "서행", delay: "지체", jam: "정체", blocked: "통행 불가", unknown: "정보 없음" };

/** 카카오 roads → 거리 누적 점 목록 */
export function buildRoute(raw) {
  const pts = [];
  let s = 0;
  raw.roads.forEach((r, ri) =>
    r.coords.forEach(([lat, lng]) => {
      const p = { lat, lng };
      const prev = pts[pts.length - 1];
      if (prev) {
        if (prev.lat === lat && prev.lng === lng) return;
        s += distanceKm(prev, p);
      }
      pts.push({ lat, lng, s, road: ri });
    })
  );
  return { ...raw, pts, total: s };
}

/** 점을 경로에 투영 → { s: 경로상 거리(km), offKm: 경로까지 거리, road: 구간 번호 } */
export function locate(route, p) {
  const kx = 111.32 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 111.32;
  let best = { s: 0, offKm: Infinity, road: 0 };
  const { pts } = route;
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const ax = (a.lng - p.lng) * kx;
    const ay = (a.lat - p.lat) * ky;
    const dx = (b.lng - a.lng) * kx;
    const dy = (b.lat - a.lat) * ky;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const x = ax + t * dx;
    const y = ay + t * dy;
    const d = Math.sqrt(x * x + y * y);
    if (d < best.offKm) best = { s: a.s + t * (b.s - a.s), offKm: d, road: a.road };
  }
  return best;
}

/** 경로 위 s 지점의 도로(이름·소통) */
export const roadAt = (route, roadIndex) => route.roads[roadIndex] || null;

/** direction: 지금 상·하행("up"|"down", 모르면 null). 이름·표기의 방향이 반대면 뺀다(같은 지점 반대편 CCTV) */
function placeOnRoute(target, route, s0, opts, direction, targetDirection) {
  const loc = locate(route, target);
  const km = loc.s - s0;
  let status = "ahead";
  if (loc.offKm > opts.onRouteKm) status = "offRoute";
  else if (km <= 0) status = "behind";
  else if (km > opts.maxKm) status = "far";
  else if (direction && targetDirection && direction !== targetDirection) status = "opposite";
  const r = roadAt(route, loc.road);
  return { km, s: loc.s, status, traffic: r ? { state: r.state, speed: r.speed } : null };
}

/** 경로 앞 5km 안 CCTV, 경로 거리 가까운 순 */
export function selectAlongRoute(cctvs, route, s0, direction = null, opts = ROUTE_OPTS) {
  const all = cctvs.map((c) => ({ ...c, ...placeOnRoute(c, route, s0, opts, direction, directionFromName(c.name)) }));
  const selected = all
    .filter((c) => c.status === "ahead")
    .sort((a, b) => a.km - b.km)
    .slice(0, opts.limit);
  return { selected, all };
}

/** 경로 위 앞쪽 돌발을 가장 가까운(경로 거리 기준) CCTV 카드에 붙인다 */
export function attachEventsAlong(events, selected, route, s0, direction = null, opts = ROUTE_OPTS) {
  const byCctv = {};
  events.forEach((ev) => {
    const e = placeOnRoute(ev, route, s0, opts, direction, ev.direction || directionFromName(ev.dirHint || ""));
    if (e.status !== "ahead") return;
    let nearest = null;
    let best = Infinity;
    selected.forEach((c) => {
      const d = Math.abs(c.s - e.s);
      if (d < best) {
        best = d;
        nearest = c;
      }
    });
    if (!nearest || best > opts.attachKm) return;
    (byCctv[nearest.id] ||= []).push({ ...ev, km: e.km });
  });
  return byCctv;
}

/**
 * s0 앞 horizonKm 안에서 처음 나오는 막힘(정체·지체·통행 불가) 구간
 * @returns {{ startKm, lengthKm, state, speed } | null}  speed 는 구간 평균(km/h, 모르면 null)
 */
export function congestionAhead(route, s0, horizonKm = 10) {
  const BAD = new Set(["jam", "delay", "blocked"]);
  const { pts } = route;
  let start = null;
  let end = null;
  let worst = null;
  let speedSum = 0;
  let speedLen = 0;
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b.s <= s0) continue;
    if (a.s > s0 + horizonKm && start == null) break;
    const r = route.roads[a.road];
    const bad = r && BAD.has(r.state);
    if (bad) {
      if (start == null) start = Math.max(a.s, s0);
      end = b.s;
      if (!worst || r.state === "blocked" || (r.state === "jam" && worst !== "blocked")) worst = r.state;
      if (r.speed != null) {
        speedSum += r.speed * (b.s - a.s);
        speedLen += b.s - a.s;
      }
    } else if (start != null) {
      break;
    }
  }
  if (start == null) return null;
  return { startKm: start - s0, lengthKm: end - start, state: worst, speed: speedLen ? Math.round(speedSum / speedLen) : null };
}
