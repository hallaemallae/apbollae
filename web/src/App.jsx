import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import GlobalStyle from "./theme/GlobalStyle";
import { darkTheme, lightTheme } from "./theme/theme";
import { ThemeModeProvider, useThemeMode } from "./context/ThemeContext";
import { WebviewBridgeProvider } from "./context/WebviewBridgeContext";
import { FlowProvider, useFlow } from "./context/FlowContext";
import { ScenarioProvider } from "./context/ScenarioContext";
import BridgeNavSync from "./components/common/BridgeNavSync";
import OfflineBanner from "./components/common/OfflineBanner";
import Toast from "./components/common/Toast";
import ScenarioPanel from "./components/dev/ScenarioPanel";
import SplashPage from "./pages/SplashPage";
import PassengerPage from "./pages/PassengerPage";
import PermissionPage from "./pages/PermissionPage";
import DrivePage from "./pages/DrivePage";
import InfoPage from "./pages/InfoPage";

// 흐름 점검 패널 — 개발 서버에서는 기본으로 보이고, ?dev=0 이면 숨긴다
const SHOW_DEV = new URLSearchParams(window.location.search).get("dev") !== "0";

/** E1·E2 — 동승자 확인과 위치 권한 없이는 메인(영상) 화면에 못 들어간다 */
function RequireReady({ children }) {
  const { passenger, permission } = useFlow();
  if (!passenger) return <Navigate to="/confirm" replace />;
  if (permission !== "granted") return <Navigate to="/permission" replace />;
  return children;
}

function RequirePassenger({ children }) {
  const { passenger } = useFlow();
  return passenger ? children : <Navigate to="/confirm" replace />;
}

function ThemedApp() {
  const { mode } = useThemeMode();
  return (
    <ThemeProvider theme={mode === "light" ? lightTheme : darkTheme}>
      <GlobalStyle />
      <WebviewBridgeProvider>
        <ScenarioProvider>
          <FlowProvider>
            <BridgeNavSync />
            <OfflineBanner />
            <Routes>
              <Route path="/" element={<SplashPage />} />
              <Route path="/confirm" element={<PassengerPage />} />
              <Route
                path="/permission"
                element={
                  <RequirePassenger>
                    <PermissionPage />
                  </RequirePassenger>
                }
              />
              <Route
                path="/drive"
                element={
                  <RequireReady>
                    <DrivePage />
                  </RequireReady>
                }
              />
              <Route path="/info" element={<InfoPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toast />
            {SHOW_DEV ? <ScenarioPanel /> : null}
          </FlowProvider>
        </ScenarioProvider>
      </WebviewBridgeProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ThemeModeProvider>
      <ThemedApp />
    </ThemeModeProvider>
  );
}
