// src/config/AppConfig.js — 앱별 값은 이 파일 하나만 고친다(할래말래 RN Shell 규칙 동일)

export const AppConfig = {
  appVersion: "0.1.0",

  // 개발: PC 에서 `npm run dev`(web/) 로 띄운 주소. 실기기는 localhost 대신 PC 의 내부 IP 를 넣는다.
  //   Android 에뮬레이터: http://10.0.2.2:3000
  webUrl: __DEV__ ? "http://10.0.2.2:3000" : "https://apbollae.web.app",

  features: {
    enableLocation: true,
    enableExternalLinking: true,
  },

  location: {
    intervalMs: 1000, // F-02: 1초 주기
  },

  guard: {
    bootTimeoutMs: 8000,
  },

  splash: {
    minMs: 900,
    effect: { durationMs: 180 },
  },
};
