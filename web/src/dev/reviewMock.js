// src/dev/reviewMock.js — 리뷰 허브(/review) 프레임 안에서만 쓰는 목업 세션.
// 할래말래 src/dev/boardData.js 의 ?mock=<시나리오>&freeze=1 규칙을 앞볼래 크기로 줄였다.
//  · mock   → 로그인·동승자·위치 권한 게이트를 시나리오대로 통과시키고, 주행은 시뮬레이션+목업 CCTV 로 띄운다
//             (ITS 월 한도를 쓰지 않는다). trip-live* 만 예외 — 실제 ITS + 목적지 경로 주행(로컬 프록시 필요, 한도 차감)
//  · freeze → 페이지가 스스로 navigate() 해도 진입한 화면에 머문다(스플래시 → /confirm 자동 이동 차단)
// 개발 서버 + iframe 안에서만 켜진다. 앱을 그냥 열면(RN WebView 포함) 아무 영향이 없다.
import { jumpTrip, teleport } from "../services/simulator";
import { NO_CCTV_INDEX } from "../mock/route";

const params = new URLSearchParams(window.location.search);
let inFrame = false;
try {
  inFrame = window.top !== window.self;
} catch {
  inFrame = true;
}

export const IN_REVIEW_FRAME = import.meta.env.DEV && inFrame;

const GUEST = { session: "guest" };
const READY = { ...GUEST, passenger: true, permission: "granted", notice: true };
const SIM = { source: "sim", data: "mock" };
// 실제 ITS + 경로 주행 — 출발지(흐름 점검 패널의 내 위치, 기본 한성대)에서 기흥IC 까지 카카오 경로를 받아 달린다
const LIVE_TRIP = { source: "trip", data: "live" };
const GIHEUNG_IC = { name: "기흥IC", address: "경기 용인시 기흥구 고매동", lat: 37.22223, lng: 127.101 };

// 기록 탭 견본 — 오늘·어제 정체/돌발 (services/tripLog 항목 모양)
const H = 3600 * 1000;
const day0 = new Date();
day0.setHours(18, 40, 0, 0);
const at = (hoursAgo) => day0.getTime() - hoursAgo * H;
const TRIP_SAMPLE = [
  { id: "s1", kind: "jam", startedAt: at(0.3), endedAt: at(0.1), road: "경부고속도로", lengthKm: 3.4, cause: { type: "accident", label: null, lanes: "2차로 통제", message: "승용차 2대 추돌, 견인 중" } },
  { id: "s2", kind: "event", startedAt: at(1.2), endedAt: at(1.2), road: "경부고속도로", cause: { type: "work", label: null, lanes: "1차로 통제", message: "포장 보수 공사" } },
  { id: "s3", kind: "jam", startedAt: at(2), endedAt: at(1.7), road: "경부고속도로", lengthKm: 1.8, cause: null },
  { id: "s4", kind: "jam", startedAt: at(25), endedAt: at(24.6), road: "영동고속도로", lengthKm: 5.2, cause: { type: "control", label: null, lanes: "전 차로 서행", message: "사고 처리 중" } },
];

// session: guest | user | consent(약관 동의 전) | welcome(가입 완료 전)
// theme(light | dark) → 화면 모드 고정 / tripLog → 기록 탭 견본(기기 기록 대신, 저장 안 함)
// passenger·permission·notice → FlowContext 초기값 / scenario → ScenarioContext 덮어쓰기 / start → 시뮬레이션 출발 지점
export const SCENARIOS = {
  guest: GUEST,
  user: { session: "user" },
  consent: { session: "consent" },
  welcome: { session: "welcome" },
  permission: { ...GUEST, passenger: true, scenario: SIM },
  "permission-denied": { ...GUEST, passenger: true, permission: "denied", scenario: SIM },
  drive: { ...READY, scenario: SIM },
  "drive-notice": { ...READY, notice: false, scenario: SIM },
  "drive-tunnel": { ...READY, scenario: { ...SIM, tunnel: true } },
  "drive-api-down": { ...READY, scenario: { ...SIM, apiDown: true } },
  "drive-broken": { ...READY, start: 3, scenario: { ...SIM, brokenFeeds: true } },
  "drive-accident": { ...READY, start: 6, scenario: SIM },
  "drive-no-cctv": { ...READY, start: NO_CCTV_INDEX, scenario: SIM },
  "drive-jam": { ...READY, start: 4, scenario: { ...SIM, speed: "jam" } },
  "drive-night": { ...READY, theme: "dark", scenario: SIM },
  "drive-day": { ...READY, theme: "light", scenario: SIM },
  "log-empty": { ...READY, scenario: SIM, tripLog: [] },
  "log-sample": { ...READY, scenario: SIM, tripLog: TRIP_SAMPLE },
  // destination → FlowContext 목적지 초기값 / tripJump → 경로를 받으면 그 비율 지점으로 건너뜀(?jump=0.4 로 바꿀 수 있음)
  "trip-live": { ...READY, scenario: LIVE_TRIP, destination: GIHEUNG_IC, tripJump: 0.5 },
  "trip-live-night": { ...READY, theme: "dark", scenario: LIVE_TRIP, destination: GIHEUNG_IC, tripJump: 0.5 },
};

const key = IN_REVIEW_FRAME ? params.get("mock") : null;
export const REVIEW_MOCK = (key && SCENARIOS[key]) || null;
export const REVIEW_FREEZE = IN_REVIEW_FRAME && params.get("freeze") === "1";

if (REVIEW_MOCK?.start != null) teleport(REVIEW_MOCK.start);

const jumpParam = Number(params.get("jump"));
const TRIP_JUMP = REVIEW_MOCK?.tripJump == null ? null : Number.isFinite(jumpParam) && params.has("jump") ? jumpParam : REVIEW_MOCK.tripJump;
let tripJumped = false;
/** 경로 주행 경로를 처음 받았을 때 한 번, 시나리오의 지점으로 건너뛴다(시내 구간을 건너뛰어 ITS 호출을 아낀다) */
export function applyReviewTripJump() {
  if (TRIP_JUMP == null || tripJumped) return;
  tripJumped = true;
  jumpTrip(TRIP_JUMP);
}

const MOCK_USER = { uid: "mock-review", provider: "kakao", displayName: "카카오 사용자" };

/** AuthContext 값 덮어쓰기 — 기기 저장소(localStorage)는 건드리지 않는다 */
export function mockAuthOverride() {
  const s = REVIEW_MOCK?.session;
  if (!s) return null;
  if (s === "guest") return { loading: false, user: null, isGuest: true, needsConsent: false, needsWelcome: false };
  return {
    loading: false,
    user: MOCK_USER,
    isGuest: false,
    needsConsent: s === "consent",
    needsWelcome: s === "welcome",
  };
}
