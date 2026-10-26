// src/mock/cctvs.js
// ITS 국가교통정보센터 CCTV API(cctvInfo) 응답을 흉내 낸 목업.
// 실제 필드: cctvname, cctvurl, coordx(경도), coordy(위도), cctvformat, cctvresolution …
// 여기서는 앱이 쓰는 모양(id/name/lat/lng/url)으로 이미 변환된 상태라고 본다(services/itsApi.js 참고).
//
// mock 전용 필드
//  - flow   : 모의 영상의 차량 흐름(smooth/slow/jam). 실제 API에는 없다 — 영상으로 눈으로 보는 정보다.
//  - broken : 송출 중단 CCTV(E5 시나리오에서만 실패한다)

export const MOCK_CCTVS = [
  { id: "ex-001", name: "[경부선] 한남대교 남단", lat: 37.5205, lng: 127.0142, roadName: "경부선", flow: "slow" },
  { id: "ex-002", name: "[경부선] 잠원IC 부근", lat: 37.5118, lng: 127.0171, roadName: "경부선", flow: "slow" },
  { id: "ex-003", name: "[경부선] 반포IC", lat: 37.5021, lng: 127.0218, roadName: "경부선", flow: "jam" },
  { id: "ex-004", name: "[경부선] 서초IC(부산방향)", lat: 37.4893, lng: 127.0302, roadName: "경부선", flow: "jam" },
  { id: "ex-005", name: "[경부선] 서초IC(서울방향)", lat: 37.4897, lng: 127.0296, roadName: "경부선", flow: "smooth" },
  { id: "ex-006", name: "[경부선] 양재IC", lat: 37.4672, lng: 127.0414, roadName: "경부선", flow: "jam", broken: true },
  { id: "ex-007", name: "[경부선] 달래내고개", lat: 37.4431, lng: 127.0577, roadName: "경부선", flow: "slow" },
  { id: "ex-008", name: "[경부선] 금토JC", lat: 37.4183, lng: 127.0802, roadName: "경부선", flow: "jam" },
  { id: "ex-009", name: "[경부선] 판교IC(서울방향)", lat: 37.4006, lng: 127.0943, roadName: "경부선", flow: "smooth" },
  { id: "ex-010", name: "[경부선] 판교IC", lat: 37.3962, lng: 127.0962, roadName: "경부선", flow: "jam", broken: true },
  { id: "ex-011", name: "[경부선] 서울TG", lat: 37.3702, lng: 127.1043, roadName: "경부선", flow: "slow" },
  { id: "ex-012", name: "[경부선] 죽전휴게소", lat: 37.3311, lng: 127.1079, roadName: "경부선", flow: "smooth" },
  { id: "ex-013", name: "[경부선] 수지", lat: 37.2925, lng: 127.1061, roadName: "경부선", flow: "slow" },
  { id: "ex-014", name: "[경부선] 신갈JC", lat: 37.2805, lng: 127.1076, roadName: "경부선", flow: "jam" },
  { id: "ex-015", name: "[경부선] 수원신갈IC", lat: 37.2648, lng: 127.1057, roadName: "경부선", flow: "slow" },
  { id: "ex-016", name: "[경부선] 기흥IC", lat: 37.2361, lng: 127.1098, roadName: "경부선", flow: "smooth" },
  { id: "ex-017", name: "[경부선] 기흥동탄IC", lat: 37.2032, lng: 127.1027, roadName: "경부선", flow: "smooth" },

  // 경로 근처지만 다른 도로 — 2차 필터에서 빠져야 한다
  { id: "its-101", name: "[국도1호선] 양재역 사거리", lat: 37.4626, lng: 127.0355, roadName: "국도1호선", flow: "slow" },
  { id: "its-102", name: "[분당수서로] 판교 진입", lat: 37.3935, lng: 127.1035, roadName: "분당수서로", flow: "smooth" },
  { id: "ex-201", name: "[영동선] 신갈JC 부근", lat: 37.2842, lng: 127.1132, roadName: "영동선", flow: "smooth" },
];
