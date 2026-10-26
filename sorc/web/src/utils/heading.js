// src/utils/heading.js
// F-02 / E3 — 진행 방향 확정.
//  - 속도가 충분하고 GPS heading 이 있으면 그대로 쓴다.
//  - 정차·저속이면 최근 이동 궤적(60초 안에서 50m 이상 떨어진 점 → 현재)으로 방향을 계산한다.
//  - 신호가 끊기면(터널) 마지막 유효 방향을 유지한다.
import { bearingDeg, distanceKm } from "./aheadFilter";

const MIN_SPEED_KMH = 10;
const TRAIL_WINDOW_MS = 60_000;
const TRAIL_MIN_KM = 0.05;
const TRAIL_MAX_ACC_M = 50; // 정확도가 이보다 나쁜 점은 궤적 방향 계산에 쓰지 않는다(제자리 GPS 흔들림이 방향으로 보이지 않게)
const precise = (p) => p.accuracy == null || p.accuracy <= TRAIL_MAX_ACC_M;

/**
 * @param {Array<{lat,lng,heading,speed,t}>} trail  오래된 것 → 최신 순
 * @param {{heading:number}|null} lastValid
 * @param {boolean} signalLost
 * @returns {{ heading: number|null, source: "gps"|"trail"|"hold"|null }}
 */
export function resolveHeading(trail, lastValid, signalLost) {
  const fix = trail[trail.length - 1];

  if (signalLost || !fix) {
    return lastValid ? { heading: lastValid.heading, source: "hold" } : { heading: null, source: null };
  }

  if (fix.speed != null && fix.speed >= MIN_SPEED_KMH && fix.heading != null && fix.heading >= 0) {
    return { heading: fix.heading, source: "gps" };
  }

  for (let i = trail.length - 2; i >= 0 && precise(fix); i -= 1) {
    const p = trail[i];
    if (fix.t - p.t > TRAIL_WINDOW_MS) break;
    if (precise(p) && distanceKm(p, fix) >= TRAIL_MIN_KM) {
      return { heading: bearingDeg(p, fix), source: "trail" };
    }
  }

  return lastValid ? { heading: lastValid.heading, source: "hold" } : { heading: null, source: null };
}
