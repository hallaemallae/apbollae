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
// 실제 응답(2026-10-07 학교 망 확인):
//  - 목록(cctvOpenData.do)은 JSON 이 아니라 HTML 표(#cctvListTb)다. 행마다 test('CCTVID') 링크·이름·센터가 있고 좌표는 없다.
//  - 좌표는 엑셀(/excel/download/OpenDataCCTV)에 있다. 엑셀의 한글은 깨져 있어 이름은 HTML 표에서 CCTVID 로 맞춰 붙인다.
//  - 목록에 영상 주소가 없다. 스트림 번호(ID)는 UTIC 지도가 쓰는 getCctvInfoById.do 로 CCTV 마다 따로 받아야 한다(키·허용 IP 필요 없음).
//    → 재생할 때만 프록시 /api/utic/stream?id= 가 한 대씩 조회하고(createUticStreams), 받은 번호는 파일에 저장해 다시 부르지 않는다.
//    크롤링 금지 조항 때문에 미리 몰아서 조회하지 않는다.
//  - 영상 주소 형식은 서울(L01, KIND "MODE" → strm2.spatic.go.kr/live/{ID}.stream/playlist.m3u8)만 확인했다.
//    다른 센터는 KIND 가 달라(예: 거제 "t") 플레이어 방식부터 확인해야 해서, 지금은 서울 CCTV 만 영상 주소를 붙인다.
const fs = require("node:fs");
const zlib = require("node:zlib");

const LIST_URL = "https://www.utic.go.kr/guide/cctvOpenData.do";
const EXCEL_URL = "https://www.utic.go.kr/excel/download/OpenDataCCTV";
const INFO_URL = "https://www.utic.go.kr/map/getCctvInfoById.do";
const TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 30 * 60 * 1000;
const LOOKUP_GAP_MS = 1500; // 스트림 번호 조회 사이 간격(초당 5회 제한보다 넉넉히)
const PLAYABLE = /^L01/; // 영상 방식을 확인한 센터(서울교통정보센터)
const UA = "Mozilla/5.0 (apbollae dev proxy)";

const decodeHtml = (t) =>
  t.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();

/** 목록 HTML → [{ CCTVID, CCTVNAME, CENTERNAME }]. 오류 코드(JSON)면 던진다 */
function parseList(text) {
  const t = String(text).trim();
  if (t.startsWith("[") || t.startsWith("{")) {
    let first;
    try {
      const j = JSON.parse(t);
      first = Array.isArray(j) ? j[0] : j;
    } catch {}
    throw new Error(`UTIC ${first?.resultCode || "?"} ${first?.resultMsg || ""}`.trim());
  }
  const at = t.indexOf('id="cctvListTb"');
  if (at < 0) throw new Error(`UTIC 응답 해석 실패: ${t.slice(0, 120)}`);
  const rows = [];
  // <a href="javascript:test('L010325')">12989.한성대입구</a></td> <td ...> <a ...>센터</a>  (이름 앞 "번호." 는 표 순번이라 뗀다)
  const re = /test\('([A-Z0-9]+)'\)">([^<]*)<\/a><\/td>\s*<td[^>]*>\s*<a[^>]*>([^<]*)<\/a>/g;
  const table = t.slice(at);
  for (let m; (m = re.exec(table)); ) rows.push({ CCTVID: m[1], CCTVNAME: decodeHtml(m[2]).replace(/^\d+\./, ""), CENTERNAME: decodeHtml(m[3]) });
  return rows;
}

/** 아주 작은 zip 읽기 — 엑셀(xlsx)에서 파일 하나를 꺼낸다(중앙 디렉터리 기준) */
function unzipEntry(buf, name) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("엑셀(zip) 형식이 아니에요");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (buf.toString("utf8", p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** 좌표 엑셀 → Map(CCTVID → { lng, lat }). 열: RN, CCTVID, CCTVNAME, CENTERNAME, XCOORD(경도), YCOORD(위도) */
function parseCoords(xlsx) {
  const strings = [];
  for (const m of (unzipEntry(xlsx, "xl/sharedStrings.xml") || "").matchAll(/<si>(?:<t[^>]*>([^<]*)<\/t>)?/g)) strings.push(m[1] ?? "");
  const sheet = unzipEntry(xlsx, "xl/worksheets/sheet1.xml") || "";
  const out = new Map();
  for (const row of sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<v>([^<]*)<\/v>)?/g)) {
      cells[c[1]] = /t="s"/.test(c[2]) ? strings[Number(c[3])] : c[3];
    }
    const lng = Number(cells.E);
    const lat = Number(cells.F);
    if (cells.B && Number.isFinite(lat) && Number.isFinite(lng) && lat > 30) out.set(cells.B, { lng, lat });
  }
  return out;
}

function normUticCctv(c) {
  const cctvId = String(c.CCTVID);
  return {
    id: `utic|${cctvId}`,
    name: String(c.CCTVNAME || "").trim(),
    lat: Number(c.YCOORD),
    lng: Number(c.XCOORD),
    // 영상은 재생할 때 프록시가 스트림 번호를 조회해 HLS 주소로 넘긴다(302)
    url: PLAYABLE.test(cctvId) ? `/api/utic/stream?id=${encodeURIComponent(cctvId)}` : null,
    roadName: null,
    center: String(c.CENTERNAME || "").trim() || null,
    source: "utic",
  };
}

/** HTML 목록 + 엑셀 좌표 → 앱 CCTV */
function buildItems(rows, coords) {
  const items = [];
  for (const r of rows) {
    const xy = coords.get(r.CCTVID);
    if (xy && r.CCTVNAME) items.push(normUticCctv({ ...r, XCOORD: xy.lng, YCOORD: xy.lat }));
  }
  return items;
}

async function get(url, asBuffer) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`UTIC HTTP ${res.status}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

/** 목록·좌표를 한 번씩 받는다(점검 스크립트도 쓴다). 키는 오류 메시지에 남기지 않는다 */
async function fetchUticList(apiKey) {
  const key = encodeURIComponent(apiKey);
  const html = await get(`${LIST_URL}?key=${key}`);
  const rows = parseList(html);
  const xlsx = await get(`${EXCEL_URL}?key=${key}`, true);
  return { rows, items: buildItems(rows, parseCoords(xlsx)), html, xlsx };
}

/**
 * 하루 한 번 받아 파일에 저장하는 목록. list() 는 던지지 않는다 — 못 받으면 저장본(없으면 빈 목록)을 stale 로 준다.
 * 저장본(json)이 없고 학교 망에서 받아 둔 원본(seed: HTML·엑셀)이 있으면 그것으로 저장본을 만든다.
 * @param {{ apiKey: () => string, file: string, seed?: { html: string, xlsx: string }, log?: Console }} deps
 */
function createUticList({ apiKey, file, seed, log = console }) {
  let saved = readFile(file) || fromSeed(seed, file, log);
  let failedAt = 0;
  let pending = null;
  let lastError = null;

  async function refresh() {
    try {
      const { items } = await fetchUticList(apiKey());
      saved = { at: Date.now(), items };
      fs.writeFileSync(file, JSON.stringify(saved));
      lastError = null;
      log.log?.(`[utic] 목록 ${items.length}개 저장 (영상 연결 가능 ${items.filter((c) => c.url).length}개)`);
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

/** 받아 둔 원본 HTML·엑셀 → 저장본. 시각은 원본 파일 시각으로 둔다(하루 지나면 허용 망에서 새로 받는다) */
function fromSeed(seed, file, log) {
  if (!seed || !fs.existsSync(seed.html) || !fs.existsSync(seed.xlsx)) return null;
  try {
    const items = buildItems(parseList(fs.readFileSync(seed.html, "utf8")), parseCoords(fs.readFileSync(seed.xlsx)));
    const s = { at: fs.statSync(seed.html).mtimeMs, items };
    fs.writeFileSync(file, JSON.stringify(s));
    log.log?.(`[utic] 받아 둔 원본으로 저장본 ${items.length}개 만듦`);
    return s;
  } catch (err) {
    log.warn?.(`[utic] 원본 해석 실패 — ${err.message}`);
    return null;
  }
}

/**
 * 스트림 번호 조회 — 재생할 때 한 대씩만. 번호는 파일에 저장해 두고 다시 부르지 않는다.
 * 조회 사이는 LOOKUP_GAP_MS 이상 띄운다(같은 주소 초당 5회 이상이면 IP 차단).
 * @param {{ file: string, log?: Console }} deps
 * @returns {(cctvId: string) => Promise<string|null>} HLS 주소(없으면 null)
 */
function createUticStreams({ file, log = console }) {
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  const pending = new Map();
  let last = 0;
  let chain = Promise.resolve();

  const lookup = (cctvId) => {
    const run = chain.then(async () => {
      const wait = last + LOOKUP_GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
      const res = await fetch(`${INFO_URL}?cctvId=${encodeURIComponent(cctvId)}`, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": UA, Referer: "https://www.utic.go.kr/map/map.do" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      return { id: j.ID ? String(j.ID) : null, kind: j.KIND || null, at: Date.now() };
    });
    chain = run.catch(() => {});
    return run;
  };

  return async function streamUrl(cctvId) {
    if (!PLAYABLE.test(cctvId)) return null;
    let info = cache[cctvId];
    if (!info) {
      if (!pending.has(cctvId)) pending.set(cctvId, lookup(cctvId).finally(() => pending.delete(cctvId)));
      try {
        info = await pending.get(cctvId);
      } catch (err) {
        log.warn?.(`[utic] ${cctvId} 영상 정보 못 받음 — ${err.message}`);
        return null;
      }
      cache[cctvId] = info;
      fs.writeFileSync(file, JSON.stringify(cache));
      log.log?.(`[utic] ${cctvId} 스트림 번호 ${info.id} (${info.kind}) 저장`);
    }
    return info.id && info.kind === "MODE" ? `https://strm2.spatic.go.kr/live/${info.id}.stream/playlist.m3u8` : null;
  };
}

function readFile(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(s.items) ? s : null;
  } catch {
    return null;
  }
}

module.exports = { normUticCctv, parseList, parseCoords, buildItems, fetchUticList, createUticList, createUticStreams };
