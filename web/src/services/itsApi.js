// src/services/itsApi.js
// ITS 데이터 조회 창구. 지금은 목업을 돌려주고, 서버가 생기면 fetchAround 안쪽만 바꾼다.
//
// 실제 연결 시 (기능흐름도 5번 슬라이드):
//   앱 → Firebase Functions 프록시 GET /its/around?lat=&lng=&radiusKm=6
//       → (60초 캐시 미스면) ITS cctvInfo + eventInfo 호출, 인증키는 서버에만
//   응답: { cctvs:[{id,name,lat,lng,url}], events:[…], at, stale }
//   cctvInfo 는 cctvType=4(HLS·HTTPS) 로 부른다. coordx=경도, coordy=위도.
//   eventInfo 의 eventType 은 한글이다 → 앱 분류로 바꿀 때 넉넉히 받는다:
//     "교통사고" → accident, "공사"·"작업" → work, 그 외(기상·재난·기타돌발) → control
//   lanesBlocked("2차로 차단") → lanes, roadDrcType(상행/하행) → direction(up/down)
import { MOCK_CCTVS } from "../mock/cctvs";
import { MOCK_EVENTS } from "../mock/events";

const RADIUS_DEG = 0.06; // 약 6km — 전방 5km 판정에 여유를 둔 조회 범위

let lastGood = null; // E6: 장애 시 보여 줄 직전 목록(서버 60초 캐시 역할)

const inBox = (p, c) => Math.abs(p.lat - c.lat) <= RADIUS_DEG && Math.abs(p.lng - c.lng) <= RADIUS_DEG;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let lastLive = null; // 실제 데이터 모드에서 서버에 못 닿을 때 보여 줄 직전 응답

/** 실제 ITS — 같은 출처의 /api 로 부른다(개발: vite → 로컬 프록시, 운영: 프록시 서버) */
async function fetchLive(position) {
  const q = `lat=${position.lat.toFixed(5)}&lng=${position.lng.toFixed(5)}`;
  try {
    const res = await fetch(`/api/its/around?${q}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lastLive = data;
    return data;
  } catch (err) {
    if (lastLive) return { ...lastLive, stale: true };
    throw err;
  }
}

/**
 * @param {{lat:number,lng:number}} position
 * @param {{ apiDown?: boolean, data?: "mock"|"live" }} scenario
 * @returns {Promise<{ cctvs:Array, events:Array, at:number, stale:boolean }>}
 */
export async function fetchAround(position, { apiDown = false, data = "mock" } = {}) {
  if (data === "live") return fetchLive(position);
  await wait(250);

  if (apiDown) {
    if (lastGood) return { ...lastGood, stale: true };
    throw new Error("ITS_UNAVAILABLE");
  }

  lastGood = {
    cctvs: MOCK_CCTVS.filter((c) => inBox(position, c)),
    events: MOCK_EVENTS.filter((e) => inBox(position, e)),
    at: Date.now(),
  };
  return { ...lastGood, stale: false };
}
