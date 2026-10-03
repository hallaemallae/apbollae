// src/utils/aheadFilter.js
// F-03 전방 CCTV 자동 선별 — 차터의 "apbollae-ahead-filter" 모듈 자리.
// React 의존이 없는 순수 함수만 둔다(나중에 그대로 떼어 npm/GitHub 공개).
//
//  1차 선별: 진행 방향 기준 방위각 차 ±30°, 거리 5km 이내 (Turf.js)
//  2차 필터: CCTV 명칭의 방향 키워드(상행/하행·○○방향)가 반대면 제외, 다른 도로면 제외
//  정렬: 가까운 순 최대 5개
import turfDistance from "@turf/distance";
import turfBearing from "@turf/bearing";
import { point } from "@turf/helpers";

export const AHEAD = {
  halfAngle: 30,
  maxKm: 5,
  limit: 5,
  refreshMs: 30_000,
  refreshKm: 0.5,
};

const DOWN_WORDS = ["하행", "부산방향", "부산 방향"];
const UP_WORDS = ["상행", "서울방향", "서울 방향"];

const pt = (p) => point([p.lng, p.lat]);

export function distanceKm(a, b) {
  return turfDistance(pt(a), pt(b), { units: "kilometers" });
}

/** 0~360 방위 */
export function bearingDeg(a, b) {
  return (turfBearing(pt(a), pt(b)) + 360) % 360;
}

/** a 에서 b 를 뺀 각도 차, -180~180 */
export function angleDiff(a, b) {
  return ((a - b) % 360 + 540) % 360 - 180;
}

/** 진행 방위 → "down"(하행) | "up"(상행). road.downBearing 이 없으면 null */
export function travelDirection(heading, road) {
  if (heading == null || road?.downBearing == null) return null;
  return Math.abs(angleDiff(heading, road.downBearing)) < 90 ? "down" : "up";
}

/** CCTV 명칭에 적힌 방향 키워드 → "down" | "up" | null(표기 없음) */
export function directionFromName(name = "") {
  const n = name.replace(/\s/g, "");
  if (DOWN_WORDS.some((w) => n.includes(w.replace(/\s/g, "")))) return "down";
  if (UP_WORDS.some((w) => n.includes(w.replace(/\s/g, "")))) return "up";
  return null;
}

/**
 * 한 지점을 내 위치·진행 방향 기준으로 분류한다.
 * @returns {"ahead"|"far"|"behind"|"opposite"|"otherRoad"}
 */
function classify(target, ctx, opts, nameDirection) {
  const km = distanceKm(ctx.position, target);
  const diff = angleDiff(bearingDeg(ctx.position, target), ctx.heading);
  let status = "ahead";
  if (Math.abs(diff) > opts.halfAngle) status = "behind";
  else if (km > opts.maxKm) status = "far";
  else if (ctx.roadName && target.roadName && target.roadName !== ctx.roadName) status = "otherRoad";
  else if (ctx.direction && nameDirection && nameDirection !== ctx.direction) status = "opposite";
  return { km, diff, status };
}

/**
 * @param {Array} cctvs  [{ id, name, lat, lng, roadName? }]
 * @param {{ position:{lat,lng}, heading:number, roadName?:string, direction?:"up"|"down" }} ctx
 * @returns {{ selected: Array, all: Array }}  selected 는 가까운 순 최대 limit 개
 */
export function selectAhead(cctvs, ctx, opts = AHEAD) {
  const all = cctvs.map((c) => ({ ...c, ...classify(c, ctx, opts, directionFromName(c.name)) }));
  const selected = all
    .filter((c) => c.status === "ahead")
    .sort((a, b) => a.km - b.km)
    .slice(0, opts.limit);
  return { selected, all };
}

/**
 * F-05 돌발상황을 선별된 CCTV 카드에 붙인다.
 * 전방(같은 기준)에 있는 돌발만 고르고, 그 지점에서 가장 가까운 CCTV 카드에 배지로 붙인다.
 * @returns {Object<string, Array>} cctvId → [{ ...event, km }]
 */
export function attachEvents(events, selected, ctx, opts = AHEAD) {
  const byCctv = {};
  if (!selected.length) return byCctv;
  events.forEach((ev) => {
    const { km, status } = classify(ev, ctx, opts, ev.direction || null);
    if (status !== "ahead") return;
    let nearest = null;
    let best = Infinity;
    selected.forEach((c) => {
      const d = distanceKm(ev, c);
      if (d < best) {
        best = d;
        nearest = c;
      }
    });
    (byCctv[nearest.id] ||= []).push({ ...ev, km });
  });
  return byCctv;
}

/** 거리 표기: 1km 미만은 m, 이상은 소수 1자리 km */
export function formatDistance(km) {
  if (km < 1) return { value: String(Math.max(10, Math.round((km * 1000) / 10) * 10)), unit: "m" };
  return { value: km.toFixed(1), unit: "km" };
}
