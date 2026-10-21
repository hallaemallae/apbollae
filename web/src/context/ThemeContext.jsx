// src/context/ThemeContext.jsx — 할래말래 ThemeContext 이식.
// 화면 모드: auto(기본, 해가 지면 어두운 화면 — 저녁 CCTV 영상과 지도 밝기를 맞춘다) | light | dark. 앱 정보에서 고른다.
// mode 는 고른 값, resolved 는 지금 실제로 그리는 값(light | dark)이다.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isNight } from "../utils/sun";
import { REVIEW_MOCK } from "../dev/reviewMock";

const STORAGE_KEY = "apb.theme.mode";
const MODES = ["auto", "light", "dark"];

const ThemeModeContext = createContext({ mode: "auto", resolved: "light", setMode: () => {}, toggleMode: () => {} });

function readInitialMode() {
  if (REVIEW_MOCK?.theme) return REVIEW_MOCK.theme; // 리뷰 허브 — 시간과 상관없이 밝게/어둡게 고정해서 본다
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (MODES.includes(saved)) return saved;
  } catch (e) {}
  return "auto";
}

/** 1분마다 해가 졌는지 다시 본다 */
function useNight(enabled) {
  const [night, setNight] = useState(() => isNight());
  useEffect(() => {
    if (!enabled) return undefined;
    setNight(isNight());
    const t = setInterval(() => setNight(isNight()), 60 * 1000);
    return () => clearInterval(t);
  }, [enabled]);
  return night;
}

export function ThemeModeProvider({ children }) {
  const [mode, setModeState] = useState(readInitialMode);
  const night = useNight(mode === "auto");
  const resolved = mode === "auto" ? (night ? "dark" : "light") : mode;

  const setMode = useCallback((next) => {
    const v = MODES.includes(next) ? next : "auto";
    setModeState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch (e) {}
  }, []);

  // 자동 → 밝게 → 어둡게 → 자동
  const toggleMode = useCallback(() => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]), [mode, setMode]);

  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", resolved);
    } catch (e) {}
  }, [resolved]);

  const value = useMemo(() => ({ mode, resolved, setMode, toggleMode }), [mode, resolved, setMode, toggleMode]);
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
