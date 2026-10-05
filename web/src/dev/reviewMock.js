// src/dev/reviewMock.js — 리뷰 허브(/review) 프레임 안에서만 쓰는 목업 세션.
// 할래말래 src/dev/boardData.js 의 ?mock=<시나리오>&freeze=1 규칙을 앞볼래 크기로 줄였다.
//  · mock   → 로그인·동승자·위치 권한 게이트를 시나리오대로 통과시키고, 주행은 시뮬레이션+목업 CCTV 로 띄운다
//             (ITS 월 한도를 쓰지 않는다)
//  · freeze → 페이지가 스스로 navigate() 해도 진입한 화면에 머문다(스플래시 → /confirm 자동 이동 차단)
// 개발 서버 + iframe 안에서만 켜진다. 앱을 그냥 열면(RN WebView 포함) 아무 영향이 없다.
import { teleport } from "../services/simulator";
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

// session: guest | user | consent(약관 동의 전) | welcome(가입 완료 전)
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
};

const key = IN_REVIEW_FRAME ? params.get("mock") : null;
export const REVIEW_MOCK = (key && SCENARIOS[key]) || null;
export const REVIEW_FREEZE = IN_REVIEW_FRAME && params.get("freeze") === "1";

if (REVIEW_MOCK?.start != null) teleport(REVIEW_MOCK.start);

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
