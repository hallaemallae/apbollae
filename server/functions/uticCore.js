// 경찰청 도시교통정보센터(UTIC) CCTV 목록 — 로컬 개발 프록시(server/dev-proxy.cjs)와 점검 스크립트(server/check-utic.mjs)가 쓴다.
//
// UTIC 은 키 + 등록 IP(C클래스 대역) 인증이다. 허용 IP 는 학교 망으로 등록했다(2026-10-06).
// → 허용된 망에서 받은 목록을 파일(server/.utic-cctvs.json, 커밋 안 됨)에 저장해 두고, 망 밖에서는 저장본을 쓴다.
//   집 IP 에서 부르면 HTTP 200 + [{"resultCode":"04","resultMsg":"허용된 IP가 아닙니다."}] 가 온다.
//
// 이용 조건(「2026 도시교통정보센터 개방데이터 세부내용」):
//  - 같은 URL 초당 5회 이상, 10초에 50x 3회 이상이면 IP 차단 → 목록은 하루 한 번만, 실패하면 30분 동안 다시 부르지 않는다
//  - 목록은 지자체·유형별로 수시로 바뀐다 → 하루 1회 이상 확인
//  - 화면에 "경찰청 도시교통정보센터(UTIC) 제공" 표기(CctvPlayer 출처 줄)
//  - 고속도로·국도 CCTV 는 목록에 없다(ITS 로 채운다)
//
// ⚠️ 응답 필드 이름·영상 주소 형식은 아직 실제 응답으로 확인하지 못했다(학교 망에서 check-utic.mjs 로 확인할 것).
//    그래서 필드는 이름 후보를 넓게 받고, 영상 주소는 HLS(.m3u8)로 보이는 값만 url 로 쓴다.
//    url 이 없는 CCTV 는 저장만 하고 앱에는 내려보내지 않는다(목업 영상으로 잘못 재생되지 않게).
const fs = require("node:fs");

const LIST_URL = "https://www.utic.go.kr/guide/cctvOpenData.do";
const TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 30 * 60 * 1000;

/** 대소문자 상관없이 후보 이름 중 처음 있는 값 */
function pick(o, ...names) {
  const keys = Object.keys(o);
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase() === n.toLowerCase());
    if (k && o[k] != null && String(o[k]).trim() !== "") return o[k];
  }
  return undefined;
}

/** 값 중에 HLS 주소로 보이는 것 */
function findHls(o) {
  for (const v of Object.values(o)) {
    if (typeof v === "string" && /^https?:\/\/\S+\.m3u8(\?|$)/i.test(v.trim())) return v.trim();
  }
  return null;
}

function normUticCctv(c) {
  const name = String(pick(c, "CCTVNAME", "cctvname", "name") || "").trim();
  const lat = Number(pick(c, "YCOORD", "coordy", "lat", "y"));
  const lng = Number(pick(c, "XCOORD", "coordx", "lng", "lon", "x"));
  const cctvId = pick(c, "CCTVID", "cctvid", "id");
  return {
    id: `utic|${cctvId ?? `${name}|${lng}|${lat}`}`,
    name,
    lat,
    lng,
    url: findHls(c),
    roadName: null,
    center: String(pick(c, "CENTERNAME", "centername") || "").trim() || null,
    source: "utic",
  };
}

/** 응답 본문 → 원본 배열. 오류 코드면 던진다 */
function parseList(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`UTIC 응답 해석 실패: ${text.slice(0, 120)}`);
  }
  const list = Array.isArray(j) ? j : j?.data || j?.items || j?.list || [];
  const first = list[0];
  if (list.length <= 1 && first && first.resultCode && first.resultCode !== "00") {
    throw new Error(`UTIC ${first.resultCode} ${first.resultMsg || ""}`.trim());
  }
  return list;
}

/** 목록 한 번 받기(점검 스크립트도 쓴다). 키는 오류 메시지에 남기지 않는다 */
async function fetchUticList(apiKey) {
  const res = await fetch(`${LIST_URL}?key=${encodeURIComponent(apiKey)}`, {
    signal: AbortSignal.timeout(20000),
    headers: { "User-Agent": "Mozilla/5.0 (apbollae dev proxy)" },
  });
  if (!res.ok) throw new Error(`UTIC HTTP ${res.status}`);
  return parseList(await res.text());
}

/**
 * 하루 한 번 받아 파일에 저장하는 목록. list() 는 던지지 않는다 — 못 받으면 저장본(없으면 빈 목록)을 stale 로 준다.
 * @param {{ apiKey: () => string, file: string, log?: Console }} deps
 */
function createUticList({ apiKey, file, log = console }) {
  let saved = readFile(file);
  let failedAt = 0;
  let pending = null;
  let lastError = null;

  async function refresh() {
    try {
      const raw = await fetchUticList(apiKey());
      const items = raw.map(normUticCctv).filter((c) => c.name && Number.isFinite(c.lat) && Number.isFinite(c.lng));
      saved = { at: Date.now(), items, raw };
      fs.writeFileSync(file, JSON.stringify(saved));
      lastError = null;
      log.log?.(`[utic] 목록 ${items.length}개 저장 (HLS 주소 있음 ${items.filter((c) => c.url).length}개)`);
    } catch (err) {
      failedAt = Date.now();
      lastError = err.message;
      log.warn?.(`[utic] 목록 못 받음 — ${err.message}${saved ? " (저장본 사용)" : ""}`);
    }
  }

  async function list() {
    const now = Date.now();
    const fresh = saved && now - saved.at < TTL_MS;
    if (!fresh && now - failedAt >= RETRY_MS) {
      pending ||= refresh().finally(() => (pending = null));
      await pending;
    }
    const s = saved || { at: 0, items: [] };
    return { cctvs: s.items.filter((c) => c.url), all: s.items, at: s.at, stale: !(saved && Date.now() - saved.at < TTL_MS) };
  }

  list.status = () => ({ savedAt: saved?.at || 0, count: saved?.items.length || 0, playable: saved?.items.filter((c) => c.url).length || 0, lastError });
  return list;
}

function readFile(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(s.items) ? s : null;
  } catch {
    return null;
  }
}

module.exports = { normUticCctv, parseList, fetchUticList, createUticList };
