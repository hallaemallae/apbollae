// src/services/simulator.js
// 시뮬레이션 주행 — mock/route.js 의 실제 도로 선(ROUTE_PATH)을 따라 1초마다 GPS 한 점을 만든다.
// 화면을 오가도 위치가 이어지도록 모듈 싱글턴으로 둔다.
import { ROUTE, ROUTE_PATH, ROUTE_PATH_AT } from "../mock/route";
import { bearingDeg, distanceKm } from "../utils/aheadFilter";

// 도로 선의 점마다 가장 가까운 지점(IC) 이름을 붙인다 — 화면의 "지금 ○○ 부근" 표시용
const nodes = ROUTE_PATH.map(([lat, lng], i) => {
  let k = 0;
  while (k + 1 < ROUTE_PATH_AT.length && i >= (ROUTE_PATH_AT[k] + ROUTE_PATH_AT[k + 1]) / 2) k += 1;
  return { lat, lng, label: ROUTE[k][2] };
});
const segKm = nodes.slice(1).map((n, i) => distanceKm(nodes[i], n));

export const SPEED_PRESETS = {
  jam: { label: "정체", kmh: 4, scale: 1 },
  slow: { label: "서행", kmh: 30, scale: 1 },
  normal: { label: "주행", kmh: 90, scale: 1 },
  fast: { label: "빨리 감기", kmh: 90, scale: 12 },
  rocket: { label: "아주 빨리(×60)", kmh: 90, scale: 60 },
};

const state = { seg: 0, km: 0 };

/** ROUTE 지점(IC) index 로 순간이동 */
export function teleport(index) {
  const at = ROUTE_PATH_AT[Math.min(Math.max(index, 0), ROUTE_PATH_AT.length - 1)];
  state.seg = Math.min(Math.max(at, 0), segKm.length - 1);
  state.km = 0;
}

function currentPoint() {
  const a = nodes[state.seg];
  const b = nodes[state.seg + 1];
  const r = segKm[state.seg] ? state.km / segKm[state.seg] : 0;
  return {
    lat: a.lat + (b.lat - a.lat) * r,
    lng: a.lng + (b.lng - a.lng) * r,
    heading: bearingDeg(a, b),
    near: r < 0.5 ? a.label : b.label,
  };
}

/** dtSec 만큼 전진하고 GPS 한 점을 돌려준다. 끝에 닿으면 처음으로 돌아간다. */
export function step(dtSec, presetKey) {
  const preset = SPEED_PRESETS[presetKey] || SPEED_PRESETS.normal;
  let move = (preset.kmh * preset.scale * dtSec) / 3600;
  while (move > 0) {
    const left = segKm[state.seg] - state.km;
    if (move < left) {
      state.km += move;
      move = 0;
    } else {
      move -= left;
      state.seg += 1;
      state.km = 0;
      if (state.seg >= segKm.length) teleport(0);
    }
  }
  const p = currentPoint();
  // 저속일수록 GPS heading 이 흔들린다 — 실제 기기처럼 잡음을 섞는다(E3 재현용)
  const jitter = preset.kmh < 10 ? (Math.random() - 0.5) * 140 : (Math.random() - 0.5) * 6;
  return {
    lat: p.lat,
    lng: p.lng,
    heading: (p.heading + jitter + 360) % 360,
    speed: preset.kmh + (Math.random() - 0.5) * (preset.kmh * 0.1),
    accuracy: 8,
    t: Date.now(),
    near: p.near,
  };
}

export const routeNodes = nodes;

/** 시뮬레이션 주행의 지금 위치 — 흐름 점검의 "목적지 입력" 단계에서 이 자리부터 경로 주행으로 이어 간다 */
export function simPoint() {
  const p = currentPoint();
  return { lat: p.lat, lng: p.lng, heading: p.heading };
}

/* ── 경로 주행(trip) ─────────────────────────────
 * 출발지(기본 한성대, 흐름 점검 패널에서 바꿀 수 있음)에서 기다리다가, 목적지를 넣어 카카오 경로를 받으면 그 선을 따라 달린다.
 * 실제 차로 가 보기 전에 "경로 위 CCTV 가 차례로 바뀌는지"를 책상에서 확인하는 용도다.
 */
export const TRIP_START = { lat: 37.5826, lng: 127.0105, label: "한성대학교" };

// 흐름 점검 패널에서 "내 위치"를 임시로 바꾼 출발지. 새로 고침해도 남도록 localStorage 에 둔다.
const START_KEY = "apb:tripStart";
function loadStart() {
  try {
    const v = JSON.parse(localStorage.getItem(START_KEY));
    if (Number.isFinite(v?.lat) && Number.isFinite(v?.lng)) return v;
  } catch {
    /* 저장값이 없거나 깨졌으면 기본 출발지 */
  }
  return TRIP_START;
}
let start = loadStart();

/** 지금 출발지(임시 내 위치) */
export function tripStart() {
  return start;
}

/** 출발지를 바꾸고 그 자리로 옮긴다. null 이면 기본(한성대)으로 */
export function setTripStart(p) {
  start = p ? { lat: p.lat, lng: p.lng, label: p.label || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` } : TRIP_START;
  try {
    if (p) localStorage.setItem(START_KEY, JSON.stringify(start));
    else localStorage.removeItem(START_KEY);
  } catch {
    /* 저장 못 해도 이번 실행에서는 쓴다 */
  }
  resetTrip();
}

const trip = { pts: null, segKm: [], seg: 0, km: 0, at: { ...start } };

/** 경로 점 목록을 받는다. 지금 위치에서 가장 가까운 점부터 이어 달린다(재탐색해도 위치가 튀지 않게). */
export function setTripPath(pts) {
  if (!pts || pts.length < 2) return;
  if (trip.pts === pts) return;
  trip.pts = pts;
  trip.segKm = pts.slice(1).map((n, i) => distanceKm(pts[i], n));
  let best = 0;
  pts.forEach((p, i) => {
    if (distanceKm(p, trip.at) < distanceKm(pts[best], trip.at)) best = i;
  });
  trip.seg = Math.min(best, trip.segKm.length - 1);
  trip.km = 0;
}

/** 경로를 잊고 출발지로 돌아간다 */
export function resetTrip() {
  trip.pts = null;
  trip.heading = null;
  trip.seg = 0;
  trip.km = 0;
  trip.at = { ...start };
}

/** 저장된 출발지는 그대로 두고 지금 위치만 p 로 옮긴다(경로는 잊는다).
 *  p.heading 을 주면 경로를 받기 전까지 그 방향을 보고 서 있는다(주변 원으로 잠깐 바뀌지 않게) */
export function placeTrip(p) {
  trip.pts = null;
  trip.seg = 0;
  trip.km = 0;
  trip.at = { lat: p.lat, lng: p.lng };
  trip.heading = p.heading ?? null;
}

/** 경로의 fraction(0~1) 지점으로 건너뛴다 — ITS 호출을 아끼려고 구간만 골라 볼 때 */
export function jumpTrip(fraction) {
  if (!trip.pts) return;
  const total = trip.segKm.reduce((a, b) => a + b, 0);
  let goal = total * Math.min(Math.max(fraction, 0), 0.999);
  for (let i = 0; i < trip.segKm.length; i += 1) {
    if (goal <= trip.segKm[i]) {
      trip.seg = i;
      trip.km = goal;
      return;
    }
    goal -= trip.segKm[i];
  }
}

/** 지금까지 간 비율(0~1). 경로가 없으면 null */
export function tripProgress() {
  if (!trip.pts) return null;
  const total = trip.segKm.reduce((a, b) => a + b, 0);
  const done = trip.segKm.slice(0, trip.seg).reduce((a, b) => a + b, 0) + trip.km;
  return total ? done / total : 0;
}

export function stepTrip(dtSec, presetKey) {
  const preset = SPEED_PRESETS[presetKey] || SPEED_PRESETS.normal;
  const fix = (p, heading, kmh) => ({
    lat: p.lat,
    lng: p.lng,
    heading,
    speed: kmh,
    accuracy: 8,
    t: Date.now(),
    near: p.label || null,
  });
  // 경로가 없으면 출발지에 서 있는다(방향 모름 → 주변 CCTV). 시연 흐름에서 넘어왔으면 경로를 받을 때까지 그 방향을 유지한다
  if (!trip.pts) return trip.heading != null ? fix(trip.at, trip.heading, preset.kmh) : fix(trip.at, null, 0);

  let move = (preset.kmh * preset.scale * dtSec) / 3600;
  while (move > 0 && trip.seg < trip.segKm.length) {
    const left = trip.segKm[trip.seg] - trip.km;
    if (move < left) {
      trip.km += move;
      move = 0;
    } else {
      move -= left;
      trip.seg += 1;
      trip.km = 0;
    }
  }
  // 끝에 닿으면 마지막 점에 멈춘다
  if (trip.seg >= trip.segKm.length) {
    trip.seg = trip.segKm.length - 1;
    trip.km = trip.segKm[trip.seg];
  }
  const a = trip.pts[trip.seg];
  const b = trip.pts[trip.seg + 1];
  const r = trip.segKm[trip.seg] ? trip.km / trip.segKm[trip.seg] : 0;
  trip.at = { lat: a.lat + (b.lat - a.lat) * r, lng: a.lng + (b.lng - a.lng) * r };
  const jitter = (Math.random() - 0.5) * 6;
  return fix(trip.at, (bearingDeg(a, b) + jitter + 360) % 360, preset.kmh + (Math.random() - 0.5) * (preset.kmh * 0.1));
}
