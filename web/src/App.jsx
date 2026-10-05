import React, { Suspense, lazy, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import GlobalStyle from "./theme/GlobalStyle";
import { darkTheme, lightTheme } from "./theme/theme";
import { ThemeModeProvider, useThemeMode } from "./context/ThemeContext";
import { WebviewBridgeProvider } from "./context/WebviewBridgeContext";
import { FlowProvider, useFlow } from "./context/FlowContext";
import { ScenarioProvider } from "./context/ScenarioContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import BridgeNavSync from "./components/common/BridgeNavSync";
import OfflineBanner from "./components/common/OfflineBanner";
import Toast from "./components/common/Toast";
import ScenarioPanel from "./components/dev/ScenarioPanel";
import SplashPage from "./pages/SplashPage";
import PassengerPage from "./pages/PassengerPage";
import PermissionPage from "./pages/PermissionPage";
import DrivePage from "./pages/DrivePage";
import InfoPage from "./pages/InfoPage";
import LoginPage from "./pages/auth/LoginPage";
import EmailLoginPage from "./pages/auth/EmailLoginPage";
import EmailSignupPage from "./pages/auth/EmailSignupPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AgreementGate from "./pages/auth/AgreementGate";
import SignupCompletePage from "./pages/auth/SignupCompletePage";
import LegalPage from "./pages/legal/LegalPage";
import { IN_REVIEW_FRAME, REVIEW_FREEZE } from "./dev/reviewMock";

// 개발용 화면 리뷰 허브 — 할래말래 /review 를 옮겨 왔다. 출시 빌드에는 들어가지 않는다.
const ReviewHub = import.meta.env.DEV ? lazy(() => import("./dev/ReviewHub")) : null;

// 흐름 점검 패널 — 개발 서버에서는 기본으로 보이고, ?dev=0 이면 숨긴다.
// 리뷰 허브(/review) 프레임 안에서도 숨긴다 — 목업 화면만 깔끔하게 보이도록
const SHOW_DEV = new URLSearchParams(window.location.search).get("dev") !== "0" && !IN_REVIEW_FRAME;

/**
 * 로그인 게이트 — 할래말래 RequireAuth → RequireConsent → RequireWelcome 를 한 컴포넌트로 줄였다.
 * 로그인은 선택: 로그인했거나 "로그인 없이 시작"을 골랐으면 통과. 로그인한 사람만 약관·가입 완료를 거친다.
 * 게이트 화면은 리다이렉트 없이 그 자리에 그린다(통과하면 원래 화면이 이어진다).
 */
function RequireEntry({ children }) {
  const { loading, user, isGuest, needsConsent, needsWelcome } = useAuth();
  if (loading) return null;
  if (!user && !isGuest) return <Navigate to="/login" replace />;
  if (needsConsent) return <AgreementGate />;
  if (needsWelcome) return <SignupCompletePage />;
  return children;
}

/** E1·E2 — 동승자 확인과 위치 권한 없이는 메인(영상) 화면에 못 들어간다 */
function RequireReady({ children }) {
  const { passenger, permission } = useFlow();
  if (!passenger) return <Navigate to="/confirm" replace />;
  if (permission !== "granted") return <Navigate to="/permission" replace />;
  return <RequireEntry>{children}</RequireEntry>;
}

function RequirePassenger({ children }) {
  const { passenger } = useFlow();
  return passenger ? <RequireEntry>{children}</RequireEntry> : <Navigate to="/confirm" replace />;
}

function ThemedApp() {
  const { mode } = useThemeMode();
  // 리뷰 허브의 "고정" 프레임 — 페이지가 navigate() 해도 처음 연 화면을 계속 그린다
  const location = useLocation();
  const entryLocation = useRef(location).current;
  return (
    <ThemeProvider theme={mode === "light" ? lightTheme : darkTheme}>
      <GlobalStyle />
      <WebviewBridgeProvider>
        <ScenarioProvider>
          <AuthProvider>
          <FlowProvider>
            <BridgeNavSync />
            <OfflineBanner />
            <Routes location={REVIEW_FREEZE ? entryLocation : location}>
              <Route path="/" element={<SplashPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/login/email" element={<EmailLoginPage />} />
              <Route path="/login/reset" element={<ResetPasswordPage />} />
              <Route path="/signup/email" element={<EmailSignupPage />} />
              <Route path="/terms" element={<LegalPage doc="terms" />} />
              <Route path="/privacy" element={<LegalPage doc="privacy" />} />
              <Route path="/location-terms" element={<LegalPage doc="location" />} />
              <Route
                path="/confirm"
                element={
                  <RequireEntry>
                    <PassengerPage />
                  </RequireEntry>
                }
              />
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
          </AuthProvider>
        </ScenarioProvider>
      </WebviewBridgeProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <Routes>
      {ReviewHub ? (
        <Route
          path="/review/:id?"
          element={
            <Suspense fallback={null}>
              <ReviewHub />
            </Suspense>
          }
        />
      ) : null}
      <Route
        path="*"
        element={
          <ThemeModeProvider>
            <ThemedApp />
          </ThemeModeProvider>
        }
      />
    </Routes>
  );
}
