// src/services/simulator.js
// 시뮬레이션 주행 — mock/route.js 경로를 따라 1초마다 GPS 한 점을 만든다.
// 화면을 오가도 위치가 이어지도록 모듈 싱글턴으로 둔다.
import { ROUTE } from "../mock/route";
import { bearingDeg, distanceKm } from "../utils/aheadFilter";

const nodes = ROUTE.map(([lat, lng, label]) => ({ lat, lng, label }));
const segKm = nodes.slice(1).map((n, i) => distanceKm(nodes[i], n));

export const SPEED_PRESETS = {
  jam: { label: "정체", kmh: 4, scale: 1 },
  slow: { label: "서행", kmh: 30, scale: 1 },
  normal: { label: "주행", kmh: 90, scale: 1 },
  fast: { label: "빨리 감기", kmh: 90, scale: 12 },
  rocket: { label: "아주 빨리(×60)", kmh: 90, scale: 60 },
};

const state = { seg: 0, km: 0 };

export function teleport(index) {
  state.seg = Math.min(Math.max(index, 0), segKm.length - 1);
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

/* ── 경로 주행(trip) ─────────────────────────────
 * 출발지(기본 한성대)에서 기다리다가, 목적지를 넣어 카카오 경로를 받으면 그 선을 따라 달린다.
 * 실제 차로 가 보기 전에 "경로 위 CCTV 가 차례로 바뀌는지"를 책상에서 확인하는 용도다.
 */
export const TRIP_START = { lat: 37.5826, lng: 127.0105, label: "한성대학교" };

const trip = { pts: null, segKm: [], seg: 0, km: 0, at: { ...TRIP_START } };

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
  trip.seg = 0;
  trip.km = 0;
  trip.at = { ...TRIP_START };
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
  // 경로가 없으면 출발지에 서 있는다(방향 모름 → 주변 CCTV)
  if (!trip.pts) return fix(trip.at, null, 0);

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
