// 앞볼래 로컬 개발 프록시 — 내 PC(국내 IP)에서 ITS 를 부른다.
// ITS 가 Google Cloud IP 를 막아 Cloud Functions 로는 못 부르기 때문에, 개발·흐름 확인은 이걸로 한다.
//
//   실행: cd web && npm run proxy        (= node --env-file=../server/.env ../server/dev-proxy.cjs)
//   주소: http://localhost:8787/api/its/around?lat=&lng=   (웹앱 개발 서버가 /api 를 여기로 넘긴다)
//
// - 인증키는 server/.env 에서만 읽는다(커밋 안 됨).
// - 캐시는 메모리(CCTV 30분·돌발 60초). 재시작하면 비워진다.
// - 월 호출 수는 server/.its-usage.json 에 센다(커밋 안 됨). 한도(기본 900)에 닿으면 캐시만 돌려준다.
//   ※ 다른 사람·다른 PC 의 호출은 여기 안 잡힌다 — ITS 마이페이지 사용량도 가끔 확인할 것.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { inKorea, createLoaders, createAround } = require("./functions/itsCore");

const PORT = Number(process.env.PROXY_PORT || 8787);
const LIMIT = Number(process.env.ITS_MONTHLY_LIMIT || 900);
const USAGE_FILE = path.join(__dirname, ".its-usage.json");

if (!process.env.ITS_API_KEY) {
  console.error("server/.env 에 ITS_API_KEY 가 없어요.");
  process.exit(1);
}

const monthKey = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);

function readUsage() {
  try {
    return JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
  } catch {
    return {};
  }
}

const cache = new Map();
const around = createAround({
  loaders: createLoaders({
    apiKey: () => process.env.ITS_API_KEY,
    countCall: async () => {
      const u = readUsage();
      u[monthKey()] = (u[monthKey()] || 0) + 1;
      fs.writeFileSync(USAGE_FILE, JSON.stringify(u, null, 2));
      console.log(`[its] 호출 +1 (이번 달 ${u[monthKey()]}/${LIMIT})`);
    },
  }),
  store: { get: async (id) => cache.get(id) || null, set: async (id, v) => void cache.set(id, v) },
  usage: async () => readUsage()[monthKey()] || 0,
  limit: LIMIT,
});

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };

    if (req.method !== "GET" || !/\/its\/around\/?$/.test(url.pathname)) return send(404, { error: "not_found" });
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!inKorea(lat, lng)) return send(400, { error: "bad_position" });

    try {
      const data = await around(lat, lng);
      console.log(`[api] ${lat.toFixed(3)},${lng.toFixed(3)} → CCTV ${data.cctvs.length} · 돌발 ${data.events.length}${data.stale ? " (stale)" : ""}`);
      send(200, data);
    } catch (err) {
      send(503, { error: err.message === "QUOTA_EXCEEDED" ? "quota_exceeded" : "its_unavailable" });
    }
  })
  .listen(PORT, () => {
    const used = readUsage()[monthKey()] || 0;
    console.log(`앞볼래 로컬 프록시: http://localhost:${PORT}/api/its/around  (이번 달 ITS 호출 ${used}/${LIMIT})`);
  });
