// ITS 프록시 공통 로직 — 로컬 개발 프록시(server/dev-proxy.cjs)와 Cloud Functions(index.js)가 같이 쓴다.
// 저장소(캐시·사용량)는 바깥에서 넣어 준다: 로컬은 메모리+파일, 서버는 Firestore.
//
// 응답 모양: { cctvs:[{id,name,lat,lng,url,roadName}], events:[{id,type,label,lat,lng,roadName,direction,lanes,message,startedAt}], at, stale }

const ITS_BASE = "https://openapi.its.go.kr:9443";
const CELL = 0.1; // 격자 한 칸 ≈ 11km
const MARGIN = 0.06; // 칸 가장자리에서도 앞 5km 가 들어오도록 조회 범위를 넓힌다
// CCTV 목록은 전국을 한 번에 받는다(칸 하나와 호출 수가 같다 — ex·its 2건). 영상 주소는 120분 유효라 100분 캐시.
// 돌발은 칸 단위로 1분 캐시.
const TTL = { cctvAll: 100 * 60 * 1000, event: 60 * 1000 };
const CALLS = { cctvAll: 2, event: 1 };
const NATION = { key: "KR", box: "minX=124.5&maxX=131.95&minY=33.0&maxY=38.7" };
const RETRY_AFTER_MS = 60 * 1000; // 실패하면 이 시간 동안 같은 칸을 다시 부르지 않는다(월 한도 보호)

/** ITS 는 결과가 1건이면 배열 대신 객체 하나를 주기도 한다 */
const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

function cellOf(lat, lng) {
  const cy = Math.floor(lat / CELL);
  const cx = Math.floor(lng / CELL);
  const f = (n) => n.toFixed(3);
  return {
    key: `${cy}_${cx}`,
    box: `minX=${f(cx * CELL - MARGIN)}&maxX=${f((cx + 1) * CELL + MARGIN)}&minY=${f(cy * CELL - MARGIN)}&maxY=${f((cy + 1) * CELL + MARGIN)}`,
  };
}

/** 국내 좌표인지 */
const inKorea = (lat, lng) => lat >= 33 && lat <= 39.5 && lng >= 124 && lng <= 132;

function normCctv(c) {
  const name = String(c.cctvname || "").trim();
  const road = /^\[([^\]]+)\]/.exec(name);
  return {
    id: `${name}|${c.coordx}|${c.coordy}`,
    name,
    lat: Number(c.coordy),
    lng: Number(c.coordx),
    url: c.cctvurl,
    roadName: road ? road[1].trim() : null,
  };
}

const OTHER_LABEL = { 기상: "기상", 재난: "재난" };

/**
 * ITS 돌발 message 는 "<공사>::도로::시작지점::끝지점::차로::[공사] 설명 / 장소: … (부산방향) … / 부분통제::기관" 같은 모양이 많다.
 * → { text: "서초IC · 2026년 서초고가교 외 2개소 보수공사", lanes: "1차로", dirHint: "부산방향" }
 */
function parseMessage(raw) {
  const m = String(raw || "").trim();
  const dirHint = (/\(([^()]*방향)\)/.exec(m) || [])[1] || "";
  if (!m.includes("::")) return { text: m, lanes: "", dirHint };
  const body = m.split("::").map((x) => x.trim()).filter((x) => x && !/^<[^>]*>$/.test(x));
  const [, from = "", to = "", ...rest] = body; // body[0] 은 도로명(roadName 으로 따로 내려간다)
  const lanes = rest.find((x) => /^\d+차로|차로$|갓길/.test(x)) || "";
  const desc = rest.filter((x) => x !== lanes).sort((x, y) => y.length - x.length)[0] || "";
  const section = from && to && from !== to ? `${from}~${to}` : from;
  const summary = desc.replace(/^\[[^\]]*\]\s*/, "").split("/")[0].trim();
  return { text: [section, summary].filter(Boolean).join(" · "), lanes, dirHint };
}

function normEvent(e) {
  const t = String(e.eventType || "");
  const type = t.includes("사고") ? "accident" : t.includes("공사") || t.includes("작업") ? "work" : "control";
  const label = type === "accident" ? "사고" : type === "work" ? "공사" : OTHER_LABEL[t] || "돌발";
  const drc = String(e.roadDrcType || "");
  const sd = String(e.startDate || "");
  const msg = parseMessage(e.message);
  const lanes = String(e.lanesBlocked || "").trim() || msg.lanes;
  return {
    id: `${e.linkId}|${sd}|${e.coordX}|${e.coordY}`,
    type,
    label,
    lat: Number(e.coordY),
    lng: Number(e.coordX),
    roadName: e.roadName || null,
    direction: drc.includes("상행") ? "up" : drc.includes("하행") ? "down" : null,
    lanes: lanes && !/(통제|차단)/.test(lanes) ? `${lanes} 통제` : lanes,
    message: msg.text,
    dirHint: msg.dirHint, // "부산방향" 같은 표기 — 앱이 진행 방향과 비교한다
    startedAt: sd.length >= 12 ? `${sd.slice(8, 10)}:${sd.slice(10, 12)}` : "",
  };
}

/**
 * @param {{ apiKey: () => string, countCall: () => Promise<void> }} deps
 */
function createLoaders({ apiKey, countCall }) {
  async function itsGet(path) {
    await countCall();
    const url = `${ITS_BASE}/${path}&apiKey=${encodeURIComponent(apiKey())}&getType=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`ITS HTTP ${res.status}`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      // 인증키 오류·사용량 초과는 JSON 이 아닌 본문으로 올 수 있다
      throw new Error(`ITS 응답 해석 실패: ${text.slice(0, 120)}`);
    }
  }

  return {
    // 고속도로(ex) + 국도(its), HTTPS·HLS 실시간(cctvType=4)
    cctvAll: async (box) => {
      const [ex, its] = await Promise.all([itsGet(`cctvInfo?type=ex&cctvType=4&${box}`), itsGet(`cctvInfo?type=its&cctvType=4&${box}`)]);
      const list = [...toArray(ex?.response?.data), ...toArray(its?.response?.data)];
      return list.map(normCctv).filter((c) => c.url && Number.isFinite(c.lat) && Number.isFinite(c.lng));
    },
    event: async (box) => {
      const j = await itsGet(`eventInfo?type=all&eventType=all&${box}`);
      return toArray(j?.body?.items).map(normEvent).filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng));
    },
  };
}

/**
 * 캐시 → 월 한도 확인 → ITS. 실패하면 남아 있는 캐시를 stale 로 돌려준다(E6).
 * @param {{ loaders, store:{ get(id), set(id,val) }, usage:() => Promise<number>, limit:number, log? }} deps
 */
function createAround({ loaders, store, usage, limit, log = console }) {
  const failedAt = new Map();

  async function cached(kind, cell) {
    const id = `${kind}_${cell.key}`;
    const now = Date.now();
    const stored = await store.get(id);
    if (stored && now - stored.at < TTL[kind]) return { ...stored, stale: false };

    if (now - (failedAt.get(id) || 0) < RETRY_AFTER_MS) {
      if (stored) return { ...stored, stale: true };
      throw new Error("ITS_RETRY_LATER");
    }

    if ((await usage()) + CALLS[kind] > limit) {
      log.warn?.("[its] 월 한도 도달 — 캐시로 응답", kind, cell.key);
      if (stored) return { ...stored, stale: true };
      throw new Error("QUOTA_EXCEEDED");
    }

    try {
      const fresh = { items: await loaders[kind](cell.box), at: now };
      await store.set(id, fresh);
      return { ...fresh, stale: false };
    } catch (err) {
      failedAt.set(id, now);
      log.error?.("[its] 호출 실패", kind, cell.key, err.message);
      if (stored) return { ...stored, stale: true };
      throw err;
    }
  }

  /** 칸 조회 범위(box 문자열) 안의 CCTV 만 */
  function inBox(items, box) {
    const q = Object.fromEntries(box.split("&").map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)]));
    return items.filter((c) => c.lng >= q.minX && c.lng <= q.maxX && c.lat >= q.minY && c.lat <= q.maxY);
  }

  async function around(lat, lng) {
    const cell = cellOf(lat, lng);
    const [c, e] = await Promise.all([cached("cctvAll", NATION), cached("event", cell)]);
    return { cctvs: inBox(c.items, cell.box), events: e.items, at: Math.min(c.at, e.at), stale: c.stale || e.stale };
  }

  /** 전국 CCTV(지도 표시용) — around 와 같은 캐시를 쓴다 */
  around.all = async () => {
    const c = await cached("cctvAll", NATION);
    return { cctvs: c.items, at: c.at, stale: c.stale };
  };

  return around;
}

module.exports = { cellOf, inKorea, normCctv, normEvent, createLoaders, createAround, TTL, CALLS };
