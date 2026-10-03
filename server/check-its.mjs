// ITS 인증키 동작 확인 — 실행: node --env-file=server/.env server/check-its.mjs
// 서초IC 부근 작은 범위로 CCTV·돌발을 1건씩 불러 키가 살아 있는지, 영상 주소가 https 인지 본다.
// (호출 2건 — 월 한도에서 차감된다)
const key = process.env.ITS_API_KEY;
if (!key) {
  console.error("server/.env 에 ITS_API_KEY 가 비어 있어요.");
  process.exit(1);
}

const BOX = "minX=126.98&maxX=127.12&minY=37.36&maxY=37.53";
const base = "https://openapi.its.go.kr:9443";

async function call(path) {
  const res = await fetch(`${base}/${path}&apiKey=${encodeURIComponent(key)}&getType=json`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

const cctv = await call(`cctvInfo?type=ex&cctvType=4&${BOX}`);
const list = cctv?.response?.data ?? cctv?.data ?? [];
console.log("[CCTV]", Array.isArray(list) ? `${list.length}건` : cctv);
if (Array.isArray(list) && list[0]) {
  const c = list[0];
  console.log("  예:", c.cctvname, c.coordy, c.coordx);
  console.log("  영상 주소:", String(c.cctvurl).slice(0, 80), String(c.cctvurl).startsWith("https") ? "(https OK)" : "(https 아님!)");
}

const ev = await call(`eventInfo?type=all&eventType=all&${BOX}`);
const evs = ev?.body?.items ?? ev?.response?.data ?? [];
console.log("[돌발]", Array.isArray(evs) ? `${evs.length}건` : ev);
if (Array.isArray(evs) && evs[0]) console.log("  예:", evs[0].eventType, evs[0].roadName, evs[0].lanesBlocked, evs[0].message);
