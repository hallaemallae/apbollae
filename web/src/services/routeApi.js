// src/services/routeApi.js
// 목적지 검색·자동차 경로. 실제는 로컬 프록시(/api/place, /api/route → 카카오), 목업은 경부선 시뮬레이션 경로.
import { ROUTE } from "../mock/route";
import { distanceKm } from "../utils/aheadFilter";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 목업 ─────────────────────────────────────── */

const MOCK_PLACES = ROUTE.slice(2).map(([lat, lng, label], i) => ({
  id: `mock-${i}`,
  name: label,
  address: "경부고속도로 (목업)",
  category: "교통시설",
  lat,
  lng,
}));

// 목업 소통 상태 — 금토JC~서울TG 정체, 신갈 부근 서행, 나머지 원활
const MOCK_STATE = { 금토JC: "jam", 판교IC: "jam", 서울TG: "delay", 수지: "slow", 신갈JC: "slow" };
const MOCK_SPEED = { jam: 12, delay: 28, slow: 45, smooth: 88 };

function mockRoute(origin, destination) {
  const nodes = ROUTE.map(([lat, lng, label]) => ({ lat, lng, label }));
  const near = (p) => nodes.reduce((bi, n, i) => (distanceKm(n, p) < distanceKm(nodes[bi], p) ? i : bi), 0);
  const a = near(origin);
  const b = near(destination);
  if (b <= a) throw new Error("NO_ROUTE");
  const roads = [];
  for (let i = a; i < b; i += 1) {
    const state = MOCK_STATE[nodes[i + 1].label] || "smooth";
    roads.push({
      name: "경부고속도로",
      state,
      speed: MOCK_SPEED[state],
      coords: [
        [i === a ? origin.lat : nodes[i].lat, i === a ? origin.lng : nodes[i].lng],
        [nodes[i + 1].lat, nodes[i + 1].lng],
      ],
    });
  }
  const distance = roads.reduce((s, r) => s + distanceKm({ lat: r.coords[0][0], lng: r.coords[0][1] }, { lat: r.coords[1][0], lng: r.coords[1][1] }), 0);
  return { distance: Math.round(distance * 1000), duration: Math.round((distance / 60) * 3600), roads };
}

// 목업 경로 옵션 — 같은 경부선 선에 시간·통행료만 다르게(화면 확인용)
function mockRouteOpt(r, opt) {
  const toll = Math.round((r.distance / 1000) * 45 / 100) * 100;
  if (opt === "time") return { ...r, duration: Math.round(r.duration * 0.96), toll: toll + 1700 };
  if (opt === "free") return { ...r, distance: Math.round(r.distance * 1.12), duration: Math.round(r.duration * 1.45), toll: 0 };
  return { ...r, toll };
}

/* ── 공개 함수 ────────────────────────────────── */

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.code = body.error;
    throw err;
  }
  return body;
}

/** @returns {Promise<Array<{id,name,address,category,lat,lng,distanceM}>>} */
export async function searchPlaces(query, near, { data = "live" } = {}) {
  if (data === "mock") {
    await wait(200);
    const q = query.trim();
    return MOCK_PLACES.filter((p) => !q || p.name.includes(q)).map((p) => ({ ...p, distanceM: near ? Math.round(distanceKm(near, p) * 1000) : null }));
  }
  const q = new URLSearchParams({ query });
  if (near) {
    q.set("lat", near.lat.toFixed(5));
    q.set("lng", near.lng.toFixed(5));
  }
  return (await getJson(`/api/place?${q}`)).places;
}

/** @returns {Promise<{ distance, duration, roads:[{name,state,speed,coords}] }>} */
export async function fetchRoute(origin, destination, heading, { data = "live", opt = "recommend" } = {}) {
  if (data === "mock") {
    await wait(300);
    return mockRouteOpt(mockRoute(origin, destination), opt);
  }
  const q = new URLSearchParams({
    olat: origin.lat.toFixed(6),
    olng: origin.lng.toFixed(6),
    dlat: destination.lat.toFixed(6),
    dlng: destination.lng.toFixed(6),
  });
  if (heading != null) q.set("heading", String(Math.round(heading)));
  if (opt !== "recommend") q.set("opt", opt);
  return getJson(`/api/route?${q}`);
}
