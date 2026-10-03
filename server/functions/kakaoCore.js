// 카카오 REST 공통 로직 — 장소 검색(카카오 로컬)·자동차 길찾기(카카오모빌리티).
// 로컬 개발 프록시(server/dev-proxy.cjs)가 쓴다. 키는 카카오 디벨로퍼스 앱의 REST API 키(KAKAO_REST_KEY).
//
// 길찾기: GET https://apis-navi.kakaomobility.com/v1/directions  (Authorization: KakaoAK {REST_KEY})
//   비상업 용도는 무료 쿼터(자동차 길찾기 하루 10,000건) 안에서 별도 제휴 없이 사용 가능.
//   traffic_state: 0 정보 없음, 1 정체, 2 지체, 3 서행, 4 원활, 6 사고(통행 불가)
// 장소 검색: GET https://dapi.kakao.com/v2/local/search/keyword.json

const TRAFFIC = { 0: "unknown", 1: "jam", 2: "delay", 3: "slow", 4: "smooth", 6: "blocked" };

async function kakaoGet(url, restKey) {
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${restKey}` }, signal: AbortSignal.timeout(8000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Kakao HTTP ${res.status} ${body.msg || body.message || ""}`.trim());
  return body;
}

/** 키워드로 장소 찾기. x,y(경도·위도)가 있으면 가까운 순 */
async function searchPlaces(restKey, { query, lat, lng }) {
  const q = new URLSearchParams({ query, size: "10" });
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    q.set("x", String(lng));
    q.set("y", String(lat));
    q.set("sort", "accuracy"); // 정확도순으로 받고 거리는 함께 표시
  }
  const j = await kakaoGet(`https://dapi.kakao.com/v2/local/search/keyword.json?${q}`, restKey);
  return (j.documents || []).map((d) => ({
    id: d.id,
    name: d.place_name,
    address: d.road_address_name || d.address_name || "",
    category: d.category_group_name || "",
    lat: Number(d.y),
    lng: Number(d.x),
    distanceM: d.distance ? Number(d.distance) : null,
  }));
}

/**
 * 자동차 길찾기 → 앱이 쓰는 모양으로 줄인다.
 * @returns {{ distance:number, duration:number, roads:[{ name, state, speed, coords:[[lat,lng],...] }] }}
 */
async function getRoute(restKey, { origin, destination, heading }) {
  const o = `${origin.lng},${origin.lat}${Number.isFinite(heading) ? `,angle=${Math.round(heading)}` : ""}`;
  const q = new URLSearchParams({ origin: o, destination: `${destination.lng},${destination.lat}`, priority: "RECOMMEND", summary: "false" });
  const j = await kakaoGet(`https://apis-navi.kakaomobility.com/v1/directions?${q}`, restKey);
  const r = j.routes?.[0];
  if (!r || r.result_code !== 0) throw new Error(`NO_ROUTE ${r?.result_code ?? ""} ${r?.result_msg || ""}`.trim());
  const roads = [];
  (r.sections || []).forEach((sec) =>
    (sec.roads || []).forEach((rd) => {
      const coords = [];
      for (let i = 0; i + 1 < rd.vertexes.length; i += 2) coords.push([rd.vertexes[i + 1], rd.vertexes[i]]); // [x,y,...] → [lat,lng]
      roads.push({ name: rd.name || "", state: TRAFFIC[rd.traffic_state] || "unknown", speed: rd.traffic_speed ?? null, coords });
    })
  );
  return { distance: r.summary.distance, duration: r.summary.duration, roads };
}

module.exports = { searchPlaces, getRoute };
