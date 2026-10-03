// src/theme/GlobalStyle.js — 할래말래 GlobalStyle 기반 (#root 단일 스크롤러 구조 유지)
import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  html, body, #root {
    margin: 0;
    padding: 0;
    height: 100%;
  }

  /* #root 를 유일한 스크롤 컨테이너로 — sticky 헤더가 #root 기준으로 붙는다 */
  #root {
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  html { -webkit-text-size-adjust: 100%; }

  body {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 15px;
    font-weight: 500;
    line-height: 1.45;
    letter-spacing: -0.015em;
    word-break: keep-all; /* 한국어는 어절 단위로 줄바꿈 */
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.textStrong};
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior: none;
  }

  button, input { font-family: inherit; color: inherit; }
  button { cursor: pointer; }
  a { color: inherit; text-decoration: none; }

  :focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.lane};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default GlobalStyle;
