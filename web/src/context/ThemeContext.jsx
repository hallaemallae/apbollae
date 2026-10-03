// src/context/ThemeContext.jsx — 할래말래 ThemeContext 이식. 앞볼래는 차 안·영상 위주라 기본이 다크.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "apb.theme.mode";

const ThemeModeContext = createContext({ mode: "dark", setMode: () => {}, toggleMode: () => {} });

function readInitialMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) {}
  return "dark";
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
