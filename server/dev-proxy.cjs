// 앞볼래 로컬 개발 프록시 — 내 PC(국내 IP)에서 ITS 를 부른다.
// ITS 가 Google Cloud IP 를 막아 Cloud Functions 로는 못 부르기 때문에, 개발·흐름 확인은 이걸로 한다.
//
//   실행: cd web && npm run proxy   (= node --env-file=../server/.env.kakao --env-file-if-exists=../server/.env ../server/dev-proxy.cjs)
//   주소: http://localhost:8787/api/its/around?lat=&lng=   (웹앱 개발 서버가 /api 를 여기로 넘긴다)
//         http://localhost:8787/api/place?query=&lat=&lng=   카카오 장소 검색(목적지)
//         http://localhost:8787/api/route?olat=&olng=&dlat=&dlng=&heading=&opt=   카카오모빌리티 자동차 길찾기(opt: recommend|time|free)
//         http://localhost:8787/api/its/cctvs   전국 CCTV 가벼운 목록(지도 표시용 — 이름·좌표만, gzip). around 와 같은 100분 캐시
//         http://localhost:8787/api/its/cctv?id=  CCTV 한 대(영상 주소 포함) — 지도에서 선별 밖 CCTV 를 눌렀을 때
//           ↑ 세 주소 모두 UTIC_API_KEY 가 있으면 경찰청 UTIC 도시 CCTV 를 섞는다(source: "utic", 하루 1회 받아 server/.utic-cctvs.json 에 저장)
//         http://localhost:8787/api/links?tile=<ty>_<tx>   표준노드링크 타일(맵매칭용, ITS 호출 없음)
//           타일은 server/nodelink/build-tiles.py 로 data/nodelink/tiles 에 만들어 둔다
//
// - ITS_API_KEY(필수)는 server/.env 에서만 읽는다(커밋 안 됨). KAKAO_REST_KEY 는 팀 공유 server/.env.kakao(커밋됨), server/.env 에 있으면 그쪽이 우선
// - 캐시는 메모리(CCTV 전국 100분·돌발 칸별 60초). 재시작하면 비워진다.
// - 월 호출 수는 server/.its-usage.json 에 센다(커밋 안 됨). 한도(기본 900)에 닿으면 캐시만 돌려준다.
//   ※ 다른 사람·다른 PC 의 호출은 여기 안 잡힌다 — ITS 마이페이지 사용량도 가끔 확인할 것.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { inKorea, inBox, cellOf, createLoaders, createAround } = require("./functions/itsCore");
const { createUticList } = require("./functions/uticCore");
const { searchPlaces, getRoute } = require("./functions/kakaoCore");

const PORT = Number(process.env.PROXY_PORT || 8787);
const LIMIT = Number(process.env.ITS_MONTHLY_LIMIT || 900);
const USAGE_FILE = path.join(__dirname, ".its-usage.json");
const TILE_DIR = path.join(__dirname, "..", "data", "nodelink", "tiles");
const UTIC_FILE = path.join(__dirname, ".utic-cctvs.json");

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

// UTIC 도시 CCTV — 키가 없으면 ITS 만 쓴다. 허용 IP(학교 망) 밖에서는 저장본만 쓴다(uticCore.js 참고)
const utic = process.env.UTIC_API_KEY ? createUticList({ apiKey: () => process.env.UTIC_API_KEY, file: UTIC_FILE }) : null;
const noUtic = { cctvs: [], stale: false };

/** ITS 결과에 UTIC CCTV 를 붙인다. UTIC 이 비어도 ITS 결과는 그대로 */
async function withUtic(data, pickItems) {
  if (!utic) return data;
  const u = await utic().catch(() => noUtic);
  return { ...data, cctvs: [...data.cctvs, ...pickItems(u.cctvs)] };
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };

    if (req.method !== "GET") return send(404, { error: "not_found" });

    // 표준노드링크 타일 — gzip 파일을 그대로 흘려보낸다(브라우저가 푼다)
    if (/\/links\/?$/.test(url.pathname)) {
      const tile = url.searchParams.get("tile") || "";
      if (!/^\d{1,4}_\d{1,4}$/.test(tile)) return send(400, { error: "bad_tile" });
      const file = path.join(TILE_DIR, `${tile}.json.gz`);
      if (!fs.existsSync(file)) {
        // 바다·국외처럼 링크가 없는 칸이거나, 타일을 아직 안 만든 경우
        return send(fs.existsSync(TILE_DIR) ? 200 : 503, fs.existsSync(TILE_DIR) ? { v: 1, links: [] } : { error: "no_nodelink_tiles" });
      }
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Encoding": "gzip",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      });
      return fs.createReadStream(file).pipe(res);
    }

    // 목적지 검색·경로 — 카카오 REST 키가 있을 때만
    if (/\/(place|route)\/?$/.test(url.pathname)) {
      const key = process.env.KAKAO_REST_KEY;
      if (!key) return send(503, { error: "no_kakao_key" });
      const n = (k) => Number(url.searchParams.get(k));
      try {
        if (url.pathname.endsWith("/place") || url.pathname.endsWith("/place/")) {
          const query = (url.searchParams.get("query") || "").trim();
          if (!query) return send(400, { error: "no_query" });
          const places = await searchPlaces(key, { query, lat: n("lat"), lng: n("lng") });
          console.log(`[place] "${query}" → ${places.length}건`);
          return send(200, { places });
        }
        const origin = { lat: n("olat"), lng: n("olng") };
        const destination = { lat: n("dlat"), lng: n("dlng") };
        if (!inKorea(origin.lat, origin.lng) || !inKorea(destination.lat, destination.lng)) return send(400, { error: "bad_position" });
        const opt = url.searchParams.get("opt") || "recommend";
        const route = await getRoute(key, { origin, destination, heading: n("heading"), opt });
        console.log(`[route:${opt}] ${(route.distance / 1000).toFixed(1)}km · 도로 ${route.roads.length}구간`);
        return send(200, route);
      } catch (err) {
        console.error("[kakao]", err.message);
        return send(err.message.startsWith("NO_ROUTE") ? 404 : 502, { error: err.message.startsWith("NO_ROUTE") ? "no_route" : "kakao_failed" });
      }
    }

    if (/\/its\/cctvs?\/?$/.test(url.pathname)) {
      try {
        const data = await withUtic(await around.all(), (x) => x);
        if (url.pathname.replace(/\/$/, "").endsWith("/cctv")) {
          const c = data.cctvs.find((x) => x.id === url.searchParams.get("id"));
          return c ? send(200, { cctv: c, stale: data.stale }) : send(404, { error: "no_cctv" });
        }
        // 영상 주소를 빼면 3.5MB → 수백 KB. [이름, 위도, 경도] (id 는 앱이 같은 규칙으로 만든다)
        const r5 = (n) => Math.round(n * 1e5) / 1e5;
        const slim = { at: data.at, stale: data.stale, cctvs: data.cctvs.map((c) => [c.name, r5(c.lat), r5(c.lng), c.id, c.source]) };
        const body = zlib.gzipSync(JSON.stringify(slim));
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Encoding": "gzip",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        });
        console.log(`[api] 전국 CCTV ${data.cctvs.length}개 · ${Math.round(body.length / 1024)}KB${data.stale ? " (stale)" : ""}`);
        return res.end(body);
      } catch (err) {
        return send(503, { error: err.message === "QUOTA_EXCEEDED" ? "quota_exceeded" : "its_unavailable" });
      }
    }

    if (!/\/its\/around\/?$/.test(url.pathname)) return send(404, { error: "not_found" });
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!inKorea(lat, lng)) return send(400, { error: "bad_position" });

    try {
      const data = await withUtic(await around(lat, lng), (x) => inBox(x, cellOf(lat, lng).box));
      console.log(`[api] ${lat.toFixed(3)},${lng.toFixed(3)} → CCTV ${data.cctvs.length} · 돌발 ${data.events.length}${data.stale ? " (stale)" : ""}`);
      send(200, data);
    } catch (err) {
      send(503, { error: err.message === "QUOTA_EXCEEDED" ? "quota_exceeded" : "its_unavailable" });
    }
  })
  .listen(PORT, () => {
    const used = readUsage()[monthKey()] || 0;
    console.log(`앞볼래 로컬 프록시: http://localhost:${PORT}/api/its/around  (이번 달 ITS 호출 ${used}/${LIMIT})`);
    console.log(`  표준노드링크 타일: ${fs.existsSync(TILE_DIR) ? "있음" : "없음 — python server/nodelink/build-tiles.py"}`);
    console.log(`  목적지·경로(카카오): ${process.env.KAKAO_REST_KEY ? "켜짐" : "꺼짐 — server/.env 에 KAKAO_REST_KEY 없음"}`);
    if (!utic) return console.log("  UTIC 도시 CCTV: 꺼짐 — server/.env 에 UTIC_API_KEY 없음");
    const st = utic.status();
    console.log(
      `  UTIC 도시 CCTV: ${st.savedAt ? `저장본 ${st.count}개(재생 가능 ${st.playable}) · ${new Date(st.savedAt).toLocaleString("ko-KR")}` : "저장본 없음 — 학교 망에서 node server/check-utic.mjs"}`
    );
  });
