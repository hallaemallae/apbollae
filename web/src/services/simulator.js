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
