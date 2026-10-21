// UTIC 키 점검 — 학교 망(허용 IP)에서 CCTV 목록을 딱 한 번 받아 저장하고, 연동에 필요한 것을 보여 준다.
//   실행: node --env-file=server/.env server/check-utic.mjs   (저장소 루트에서)
// - 받은 목록은 server/.utic-cctvs.json 에 저장된다(커밋 안 됨). 로컬 프록시는 이 저장본을 쓴다.
// - 같은 URL 을 연달아 부르면 IP 가 차단될 수 있다 → 이 스크립트는 목록 주소를 한 번만 부른다. 여러 번 돌리지 말 것.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { fetchUticList } = require("./functions/uticCore.js");

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

let got;
try {
  got = await fetchUticList(KEY);
} catch (err) {
  console.error("[UTIC] 목록 못 받음:", hide(err.message));
  if (/04/.test(err.message)) console.error("  → 허용 IP 가 아니에요. 학교 망(유선·와이파이)에서 다시 실행하세요.");
  process.exit(1);
}

const { rows, items, html, xlsx } = got;
fs.writeFileSync(FILE, JSON.stringify({ at: Date.now(), items }));
// 원본도 남겨 둔다 — 망 밖에서 저장본이 없을 때 프록시가 이걸로 다시 만든다
fs.writeFileSync(path.join(here, ".utic-list.html"), html);
fs.writeFileSync(path.join(here, ".utic-cctvs.xlsx"), xlsx);

console.log(`[UTIC] 목록 ${rows.length}건 → 좌표 있는 CCTV ${items.length}개 (저장: server/.utic-cctvs.json)`);

const byCenter = {};
for (const c of items) byCenter[c.center || "(센터 없음)"] = (byCenter[c.center || "(센터 없음)"] || 0) + 1;
console.log("\n[센터별 개수]", Object.entries(byCenter).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "));

const near = items.map((c) => ({ ...c, d: km(HANSUNG, c) })).filter((c) => c.d <= 5).sort((a, b) => a.d - b.d);
console.log(`\n[한성대 5km 안] ${near.length}개`);
for (const c of near.slice(0, 10)) console.log(`  ${c.d.toFixed(1)}km  ${c.name}  ${c.url ? "(HLS)" : ""}`);

console.log(`
[영상] 서울(L01)만 연결 — ${items.filter((c) => c.url).length}/${items.length}. 재생할 때 프록시가 한 대씩 스트림 번호를 조회한다.`);
