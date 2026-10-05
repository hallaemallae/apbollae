// web/scripts/check-mapmatch.mjs
// 맵매칭 점검 — 카카오 경로(실제 도로 위 좌표)를 200m 간격으로 따라가며 매칭이 되는지,
// 매칭된 링크 방향이 진행 방향과 맞는지, 예상 경로가 실제 경로와 겹치는지 센다. ITS 호출 없음.
//   실행(로컬 프록시가 켜져 있어야 함): node scripts/check-mapmatch.mjs [출발lat,lng] [도착lat,lng]
//   기본: 한성대 → 부산역
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph, decodeLink, matchLink, pathAhead, tileKeysAround, linkName } from "../src/utils/mapMatch.js";
import { buildRoute, locate } from "../src/utils/routeFilter.js";
import { bearingDeg, distanceKm } from "../src/utils/aheadFilter.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const TILE_DIR = path.join(here, "..", "..", "data", "nodelink", "tiles");
const parse = (s, d) => (s ? s.split(",").map(Number) : d);
const [olat, olng] = parse(process.argv[2], [37.5826, 127.0105]);
const [dlat, dlng] = parse(process.argv[3], [35.1152, 129.0415]);

const tiles = new Map();
function graphAround(p) {
  const links = [];
  for (const k of tileKeysAround(p, 1)) {
    if (!tiles.has(k)) {
      const f = path.join(TILE_DIR, `${k}.json.gz`);
      tiles.set(k, fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f))).links.map(decodeLink) : []);
    }
    links.push(...tiles.get(k));
  }
  return buildGraph(links);
}

const res = await fetch(`http://localhost:8787/api/route?olat=${olat}&olng=${olng}&dlat=${dlat}&dlng=${dlng}`);
if (!res.ok) throw new Error(`route HTTP ${res.status}`);
const route = buildRoute(await res.json());
console.log(`경로 ${route.total.toFixed(1)}km, 점 ${route.pts.length}개`);

// 200m 간격 표본(경로 위 점 + 진행 방향)
const samples = [];
for (let s = 0.05; s < route.total - 0.05; s += 0.2) {
  let i = route.pts.findIndex((p) => p.s >= s);
  if (i <= 0) i = 1;
  const a = route.pts[i - 1];
  const b = route.pts[i];
  const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
  samples.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, heading: bearingDeg(a, b), s });
}

let graph = null;
let graphKey = "";
let prev = null;
let matched = 0;
let wrongDir = 0;
let pathChecks = 0;
let pathGood = 0;
const misses = [];
const t0 = Date.now();
samples.forEach((p, idx) => {
  const key = tileKeysAround(p, 0)[0];
  if (key !== graphKey) {
    graph = graphAround(p);
    graphKey = key;
  }
  // GPS 잡음: 위치 ±8m, 방향 ±6°
  const noisy = { lat: p.lat + (Math.random() - 0.5) * 0.00014, lng: p.lng + (Math.random() - 0.5) * 0.00018 };
  const heading = (p.heading + (Math.random() - 0.5) * 12 + 360) % 360;
  const m = matchLink(graph, noisy, heading, prev);
  prev = m;
  if (!m) {
    misses.push(p);
    return;
  }
  matched += 1;
  const diff = Math.abs(((heading - m.bearing + 540) % 360) - 180);
  if (diff > 90) wrongDir += 1;
  // 예상 경로가 실제 경로를 얼마나 따라가는지 — 1km 마다, 예상 경로 위 점들이 실제 경로에서 50m 안인 비율
  if (idx % 5 === 0) {
    const pa = pathAhead(graph, m, 3);
    if (pa) {
      const pts = pa.roads.flatMap((r) => r.coords).map(([lat, lng]) => ({ lat, lng }));
      const step = Math.max(1, Math.floor(pts.length / 15));
      const probe = pts.filter((_, i) => i % step === 0);
      const ok = probe.filter((q) => locate(route, q).offKm < 0.05).length / probe.length;
      pathChecks += 1;
      if (ok >= 0.8) pathGood += 1;
    }
  }
});
const ms = (Date.now() - t0) / samples.length;

console.log(`표본 ${samples.length}개 · 매칭 ${matched} (${((matched / samples.length) * 100).toFixed(1)}%) · 반대 방향 ${wrongDir}`);
console.log(`예상 경로 3km 가 실제 경로를 80% 이상 따라감: ${pathGood}/${pathChecks} (${((pathGood / pathChecks) * 100).toFixed(1)}%)`);
console.log(`한 점 매칭 평균 ${ms.toFixed(1)}ms (타일 읽기 포함)`);
if (misses.length) {
  console.log("매칭 실패 예(최대 5):");
  misses.slice(0, 5).forEach((p) => console.log(`  ${p.s.toFixed(1)}km ${p.lat.toFixed(5)},${p.lng.toFixed(5)}`));
}
// 지나간 도로 이름(바뀔 때만)
let lastName = "";
const names = [];
prev = null;
samples.filter((_, i) => i % 10 === 0).forEach((p) => {
  const g = graphAround(p);
  const m = matchLink(g, p, p.heading, null);
  const n = m ? linkName(m.link) : "(매칭 없음)";
  if (n !== lastName) names.push(`${p.s.toFixed(0)}km ${n}`);
  lastName = n;
});
console.log("지나간 도로:", names.slice(0, 25).join(" → "));
