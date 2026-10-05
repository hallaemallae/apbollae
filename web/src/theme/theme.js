// src/theme/theme.js
// 할래말래 theme.js 구조(sharedTokens + light/dark)를 그대로 따르고, 색만 앞볼래 것으로 바꿨다.
//
// 색의 출처는 한국 도로 표지다.
//  - asphalt  : 노면. 영상이 주인공이라 배경은 영상 주변이 튀지 않는 회색 아스팔트.
//  - sign     : 고속도로 방향 안내 표지의 녹색. "지금 어느 도로·어느 방향인가"에만 쓴다.
//  - lane     : 차선 황색. 선별된(내 앞) CCTV·재생 중 표시에만 쓴다.
//  - accident / work / control : 돌발 배지(사고·공사·통제) 전용.
//  - primary  : 버튼·체크·링크 같은 "누르는 것". 카카오내비처럼 흰 카드 위 파란 버튼으로 깔끔하게(2026-10-05).
//
// 화면 톤은 카카오내비를 참고했다 — 밝은 회색 바탕 + 흰 카드 + 옅은 그림자 + 큰 라운드. 기본은 밝은 화면, 어두운 화면은 설정에서.

const sharedTokens = {
  fonts: {
    body: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    // 거리·속도 숫자 — 표지판 숫자처럼 좁고 단단한 서체
    numeric: "'Barlow Semi Condensed', 'Pretendard Variable', sans-serif",
  },
  fontSizes: {
    caption: 12,
    body: 14,
    bodyLg: 16,
    title: 19,
    titleLg: 24,
    display: 30,
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 20,
    pill: 999,
  },
  layout: {
    maxWidth: 480,
    touch: 52, // 조수석에서 흔들리는 손으로 누르는 최소 높이
  },
};

const signal = {
  sign: "#0B6B4C",
  signText: "#FFFFFF",
  lane: "#F2B705",
  laneText: "#1A1A12",
  accident: "#E5483B",
  work: "#F08A24",
  control: "#3D7BE0",
  // 경로 소통 상태(카카오 길찾기) — 색과 함께 항상 글자(원활·서행·지체·정체)로도 표시한다
  traffic: { smooth: "#2E9E5B", slow: "#C9A100", delay: "#E57C23", jam: "#D33A2C", blocked: "#8E44AD", unknown: "#6B7378" },
};

export const darkTheme = {
  mode: "dark",
  ...sharedTokens,
  shadow: {
    card: "0 1px 3px rgba(0, 0, 0, 0.4)",
    float: "0 6px 20px rgba(0, 0, 0, 0.45)",
  },
  colors: {
    ...signal,
    primary: "#4C8DFF",
    primaryText: "#FFFFFF",
    primarySoft: "rgba(76, 141, 255, 0.16)",
    bg: "#131518",
    surface: "#1E2125",
    raised: "#2A2E33",
    textStrong: "#F2F3F5",
    textNormal: "#C3C7CC",
    textWeak: "#868C93",
    border: "#2E3237",
    road: "#3A4148", // 스트립맵의 도로 선
    danger: "#FF6B5E",
    overlay: "rgba(12, 14, 16, 0.72)",
  },
};

export const lightTheme = {
  mode: "light",
  ...sharedTokens,
  shadow: {
    card: "0 1px 3px rgba(20, 24, 28, 0.06), 0 2px 10px rgba(20, 24, 28, 0.04)",
    float: "0 4px 18px rgba(20, 24, 28, 0.14)",
  },
  colors: {
    ...signal,
    lane: "#E0A800",
    primary: "#2B6BF3",
    primaryText: "#FFFFFF",
    primarySoft: "#EAF1FE",
    bg: "#F3F4F6",
    surface: "#FFFFFF",
    raised: "#EEF0F2",
    textStrong: "#191B1E",
    textNormal: "#4B5157",
    textWeak: "#8B9198",
    border: "#E6E8EB",
    road: "#C9CED3",
    danger: "#E03A2F",
    overlay: "rgba(12, 14, 16, 0.5)",
  },
};

export default lightTheme;
