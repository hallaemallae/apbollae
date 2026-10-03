// src/theme/theme.js
// 할래말래 theme.js 구조(sharedTokens + light/dark)를 그대로 따르고, 색만 앞볼래 것으로 바꿨다.
//
// 색의 출처는 한국 도로 표지다.
//  - asphalt  : 노면. 영상이 주인공이라 배경은 영상 주변이 튀지 않는 회색 아스팔트.
//  - sign     : 고속도로 방향 안내 표지의 녹색. "지금 어느 도로·어느 방향인가"에만 쓴다.
//  - lane     : 차선 황색. 선별된(내 앞) CCTV·재생 중 표시에만 쓴다.
//  - accident / work / control : 돌발 배지(사고·공사·통제) 전용.

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
    sm: 6,
    md: 12,
    lg: 18,
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
  colors: {
    ...signal,
    bg: "#1C2024",
    surface: "#252A2F",
    raised: "#2E343A",
    textStrong: "#F2F3F0",
    textNormal: "#C9CDD0",
    textWeak: "#8A9196",
    border: "#363D44",
    road: "#3A4148", // 스트립맵의 도로 선
    danger: "#FF6B5E",
    overlay: "rgba(12, 14, 16, 0.72)",
  },
};

export const lightTheme = {
  mode: "light",
  ...sharedTokens,
  colors: {
    ...signal,
    lane: "#D9A300",
    bg: "#EEF0EE",
    surface: "#FFFFFF",
    raised: "#F6F7F5",
    textStrong: "#15191C",
    textNormal: "#3A4146",
    textWeak: "#6B7378",
    border: "#D7DBD8",
    road: "#C3C8C5",
    danger: "#C8352A",
    overlay: "rgba(12, 14, 16, 0.6)",
  },
};

export default darkTheme;
