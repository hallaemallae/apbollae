// src/context/ThemeContext.jsx — 할래말래 ThemeContext 이식. 기본은 밝은 화면(카카오내비 톤), 어두운 화면은 앱 정보에서 고른다.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "apb.theme.mode";

const ThemeModeContext = createContext({ mode: "light", setMode: () => {}, toggleMode: () => {} });

function readInitialMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) {}
  return "light";
}

export function ThemeModeProvider({ children }) {
  const [mode, setModeState] = useState(readInitialMode);

  const setMode = useCallback((next) => {
    const v = next === "light" ? "light" : "dark";
    setModeState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch (e) {}
  }, []);

  const toggleMode = useCallback(() => setMode(mode === "dark" ? "light" : "dark"), [mode, setMode]);

  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", mode);
    } catch (e) {}
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode, setMode, toggleMode]);
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
