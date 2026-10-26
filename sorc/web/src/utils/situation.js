// src/utils/situation.js — "왜 막히는지·어디까지 막히는지"를 한 줄로 만드는 순수 함수들.
//  ① 원인 한 줄 요약(buildSummary)  ② 정체 끝 CCTV(findJamEndCctv)
// 소통 정보가 있는 경로(목적지 경로 또는 앞 10km 임시 경로)를 기준으로 돌발·CCTV 를 경로 위에 놓는다.
import { congestionAhead, locate, TRAFFIC_LABEL } from "./routeFilter";
import { directionFromName, formatDistance } from "./aheadFilter";
import { EVENT_LABEL } from "../mock/events";

const ON_ROUTE_KM = 0.25; // 이 안이면 경로 위로 본다(routeFilter ROUTE_OPTS.onRouteKm 와 같다)
export const HORIZON_KM = 10;

const dist = (km) => {
  const d = formatDistance(Math.max(0, km));
  return `${d.value}${d.unit}`;
};

/**
 * 경로 앞 horizonKm 안의 돌발(가까운 순). traffic 이 없으면 fallback(부채꼴 선별에 붙은 돌발)을 쓴다.
 * @param {Array} events  fetchAround 의 돌발
 * @param {{ route, s0 } | null} traffic
 * @param {"up"|"down"|null} direction  지금 상·하행(모르면 null)
 * @param {Array} fallback  [{ ...event, km }]
 */
export function eventsAhead(events, traffic, direction, fallback = []) {
  if (!traffic?.route) return [...fallback].sort((a, b) => a.km - b.km);
  const out = [];
  events.forEach((ev) => {
    const loc = locate(traffic.route, ev);
    const km = loc.s - traffic.s0;
    if (loc.offKm > ON_ROUTE_KM || km <= 0 || km > HORIZON_KM) return;
    const evDir = ev.direction || directionFromName(ev.dirHint || "");
    if (direction && evDir && evDir !== direction) return; // 반대 방향 돌발
    out.push({ ...ev, km });
  });
  return out.sort((a, b) => a.km - b.km);
}

/** 앞 구간 첫 막힘 { startKm, lengthKm, state, speed } | null */
export function jamAhead(traffic) {
  if (!traffic?.route) return null;
  return congestionAhead(traffic.route, traffic.s0, HORIZON_KM);
}

/**
 * ① 원인 한 줄 요약
 * @returns {{ tone: "accident"|"work"|"control"|"jam"|"clear"|"unknown", title, sub, causeKnown }}
 *   title: 운전자에게 그대로 말해 줄 한 문장, sub: 덧붙임
 */
export function buildSummary({ events, jam, hasTraffic, weather = null }) {
  const wx = weather?.slow ? weather.text : null; // ⑧ 차를 느리게 만드는 날씨
  const ev = events[0] || null;
  const evText = ev ? `${dist(ev.km)} 앞 ${ev.label || EVENT_LABEL[ev.type]}${ev.lanes ? ` · ${ev.lanes}` : ""}` : null;
  const jamText = jam
    ? `${jam.startKm < 0.1 ? "지금부터" : `${dist(jam.startKm)} 앞부터`} ${dist(jam.lengthKm)} ${TRAFFIC_LABEL[jam.state]}`
    : null;
  const speedText = jam?.speed != null ? ` · 평균 ${jam.speed}km/h` : "";

  if (ev && jam) {
    // 돌발이 막힘 구간 안(또는 바로 끝)에 있으면 그게 원인이다
    const inside = ev.km >= jam.startKm - 0.3 && ev.km <= jam.startKm + jam.lengthKm + 0.5;
    return {
      tone: ev.type,
      title: evText,
      sub: inside ? `${jamText}${speedText}` : `${jamText}${speedText} — 막힘과 떨어져 있어 다른 원인일 수 있어요`,
      causeKnown: inside,
    };
  }
  if (jam) {
    if (wx) return { tone: "jam", title: jamText, sub: `사고·공사 정보 없음 — ${wx}, 날씨 탓에 느려진 것 같아요${speedText}`, causeKnown: true };
    return { tone: "jam", title: jamText, sub: `사고·공사 정보 없음 — 차가 많아 막히는 것 같아요${speedText}`, causeKnown: false };
  }
  if (ev) {
    return { tone: ev.type, title: evText, sub: hasTraffic ? "아직 막히지는 않아요" : ev.message || "", causeKnown: true };
  }
  if (hasTraffic) return { tone: "clear", title: `앞 ${HORIZON_KM}km 막힘 없음`, sub: wx ? `${wx} — 앞차와 거리를 넉넉히` : "사고·공사 정보도 없어요", causeKnown: true };
  return { tone: "unknown", title: "앞쪽 소통 정보를 확인하고 있어요", sub: "", causeKnown: false };
}

/**
 * ② 정체 끝 CCTV — 막힘 구간이 끝나는 지점 근처(끝 0.5km 전 ~ 2km 뒤)에서 경로 위에 있는 CCTV 중 끝에 가장 가까운 것
 * @param {Array} cctvs  후보(주변 목록 + 전국 목록) [{ id, name, lat, lng }]
 * @returns {{ cctv, km } | null}  km: 지금부터 경로 거리
 */
export function findJamEndCctv(cctvs, traffic, jam, direction) {
  if (!traffic?.route || !jam) return null;
  const endKm = jam.startKm + jam.lengthKm;
  let best = null;
  const seen = new Set();
  cctvs.forEach((c) => {
    if (!c || seen.has(c.id)) return;
    seen.add(c.id);
    const loc = locate(traffic.route, c);
    if (loc.offKm > ON_ROUTE_KM) return;
    const km = loc.s - traffic.s0;
    if (km < endKm - 0.5 || km > endKm + 2) return;
    const nameDir = directionFromName(c.name);
    if (direction && nameDir && nameDir !== direction) return;
    const score = Math.abs(km - endKm);
    if (!best || score < best.score) best = { cctv: c, km, score };
  });
  return best ? { cctv: best.cctv, km: best.km } : null;
}

/**
 * ⑥ 소통 띠 — 지금부터 horizonKm 까지 소통 상태가 같은 구간끼리 묶는다
 * @returns {Array<{ fromKm, toKm, state, speed, name }>}
 */
export function trafficBands(traffic, horizonKm = HORIZON_KM) {
  if (!traffic?.route) return [];
  const { pts, roads } = traffic.route;
  const s0 = traffic.s0;
  const bands = [];
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b.s <= s0) continue;
    if (a.s >= s0 + horizonKm) break;
    const r = roads[a.road] || {};
    const fromKm = Math.max(0, a.s - s0);
    const toKm = Math.min(horizonKm, b.s - s0);
    const last = bands[bands.length - 1];
    if (last && last.state === (r.state || "unknown") && last.name === (r.name || "")) last.toKm = toKm;
    else bands.push({ fromKm, toKm, state: r.state || "unknown", speed: r.speed ?? null, name: r.name || "" });
  }
  return bands;
}

// 막히지 않을 때의 속도(추정) — 카카오가 구간 제한 속도를 주지 않아 도로 종류로 어림한다
const freeSpeed = (name = "") => (/고속|선$|JC|IC/.test(name) ? 90 : /대로|도시고속|순환/.test(name) ? 60 : 45);

/**
 * ⑤ 이 정체로 늦어지는 시간(분) — 서행·지체·정체 구간을 지금 속도로 지날 때와 평소 속도로 지날 때의 차이
 * @returns {number|null}  1분 미만이면 0, 소통 정보가 없으면 null
 */
export function delayMinutes(traffic, horizonKm = HORIZON_KM) {
  const bands = trafficBands(traffic, horizonKm);
  if (!bands.length) return null;
  let min = 0;
  bands.forEach((b) => {
    if (!["slow", "delay", "jam", "blocked"].includes(b.state)) return;
    const len = b.toKm - b.fromKm;
    const free = freeSpeed(b.name);
    const now = b.state === "blocked" ? 5 : b.speed && b.speed > 0 ? Math.min(b.speed, free) : { slow: 40, delay: 25, jam: 10 }[b.state];
    min += (len / now - len / free) * 60;
  });
  return Math.max(0, Math.round(min));
}

/** "2차로 통제", "1·2차로", "1,2차로 차단" → [1, 2] (못 읽으면 []) */
export function blockedLanes(text = "") {
  const m = String(text).match(/([\d,·\s~-]+)\s*차로/);
  if (!m) return [];
  const nums = [];
  m[1].split(/[,·\s]+/).forEach((part) => {
    const range = part.match(/^(\d+)[~-](\d+)$/);
    if (range) for (let n = +range[1]; n <= +range[2]; n += 1) nums.push(n);
    else if (/^\d+$/.test(part)) nums.push(+part);
  });
  return [...new Set(nums)].filter((n) => n > 0 && n < 10).sort((a, b) => a - b);
}
