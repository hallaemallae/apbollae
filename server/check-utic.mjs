// UTIC 키 점검 — 학교 망(허용 IP)에서 CCTV 목록을 딱 한 번 받아 저장하고, 연동에 필요한 것을 보여 준다.
//   실행: node --env-file=server/.env server/check-utic.mjs   (저장소 루트에서)
// - 받은 목록은 server/.utic-cctvs.json 에 저장된다(커밋 안 됨). 로컬 프록시는 이 저장본을 쓴다.
// - 같은 URL 을 연달아 부르면 IP 가 차단될 수 있다 → 이 스크립트는 목록 주소를 한 번만 부른다. 여러 번 돌리지 말 것.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { fetchUticList, normUticCctv } = require("./functions/uticCore.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, ".utic-cctvs.json");
const KEY = process.env.UTIC_API_KEY;
if (!KEY) {
  console.error("server/.env 에 UTIC_API_KEY 가 없어요.");
  process.exit(1);
}
const hide = (s) => String(s).split(KEY).join("<KEY>");

const HANSUNG = { lat: 37.5826, lng: 127.0106 }; // 테스트 경로 출발지
const km = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

let raw;
try {
  raw = await fetchUticList(KEY);
} catch (err) {
  console.error("[UTIC] 목록 못 받음:", hide(err.message));
  if (/04/.test(err.message)) console.error("  → 허용 IP 가 아니에요. 학교 망(유선·와이파이)에서 다시 실행하세요.");
  process.exit(1);
}

const items = raw.map(normUticCctv).filter((c) => c.name && Number.isFinite(c.lat) && Number.isFinite(c.lng));
fs.writeFileSync(FILE, JSON.stringify({ at: Date.now(), items, raw }));

console.log(`[UTIC] 원본 ${raw.length}건 → 좌표 있는 CCTV ${items.length}개 (저장: server/.utic-cctvs.json)`);
console.log("\n[필드 이름] 첫 항목:", Object.keys(raw[0] || {}).join(", "));
console.log("[첫 항목 값]", hide(JSON.stringify(raw[0], null, 1)).slice(0, 800));

const byCenter = {};
for (const c of items) byCenter[c.center || "(센터 없음)"] = (byCenter[c.center || "(센터 없음)"] || 0) + 1;
console.log("\n[센터별 개수]", Object.entries(byCenter).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "));

const near = items.map((c) => ({ ...c, d: km(HANSUNG, c) })).filter((c) => c.d <= 5).sort((a, b) => a.d - b.d);
console.log(`\n[한성대 5km 안] ${near.length}개`);
for (const c of near.slice(0, 10)) console.log(`  ${c.d.toFixed(1)}km  ${c.name}  ${c.url ? "(HLS)" : ""}`);

const hls = items.filter((c) => c.url);
console.log(`\n[영상 주소] HLS(.m3u8) 로 보이는 값이 있는 CCTV ${hls.length}/${items.length}`);
if (hls[0]) console.log("  예:", hide(hls[0].url));
if (hls[0]?.url.includes(KEY)) console.log("  ⚠️ 영상 주소에 키가 들어 있어요 — 앱에 그대로 내려보내면 키가 노출됩니다. 프록시로 감쌀 것.");
if (!hls.length) {
  console.log("  → HLS 주소가 목록에 바로 없어요. 위 [첫 항목 값]에서 영상 관련 필드(KIND·CCTVIP·CH·PORT 등)를 보고");
  console.log("    영상 주소 만드는 방법을 정해야 합니다(uticCore.js normUticCctv 의 url).");
}
