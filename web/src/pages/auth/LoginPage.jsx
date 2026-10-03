// 로그인 — 할래말래 LoginPage 구성(소셜 버튼 + 이메일 + 로딩 오버레이)을 따른다.
// 앞볼래는 로그인이 선택이라 "로그인 없이 시작"이 함께 있다.
// 카카오·구글·Apple 은 아직 목업: 누르면 바로 다음 화면(약관 동의)으로 간다.
import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FaApple } from "react-icons/fa";
import { FiMail } from "react-icons/fi";
import { AuthScreen, BrandLogo, BusyOverlay, TextLink } from "../../components/auth/AuthParts";
import { useAuth } from "../../context/AuthContext";
import { useScenario } from "../../context/ScenarioContext";
import { showToast } from "../../utils/toast";

const Hero = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: calc(env(safe-area-inset-top) + 40px) 0 24px;
  text-align: center;
  p {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.textNormal};
  }
`;

const Buttons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Social = styled.button`
  position: relative;
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: ${({ $border, theme }) => ($border ? `1.5px solid ${theme.colors.border}` : "none")};
  background: ${({ $bg }) => $bg};
  color: ${({ $fg }) => $fg};
  font-size: 16px;
  font-weight: 700;
  svg {
    position: absolute;
    left: 20px;
  }
  &:disabled {
    opacity: 0.6;
  }
`;

const Note = styled.p`
  margin: 6px 0 0;
  text-align: center;
  font-size: 12.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 1.5C4.86 1.5 1.5 4.14 1.5 7.39c0 2.08 1.38 3.9 3.46 4.95-.15.53-.55 1.98-.63 2.29-.1.38.14.38.29.27.12-.08 1.86-1.26 2.62-1.78.41.06.83.09 1.26.09 4.14 0 7.5-2.64 7.5-5.89S13.14 1.5 9 1.5Z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, signInMock, continueAsGuest } = useAuth();
  const { reportFlow } = useScenario();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    reportFlow("L1");
  }, [reportFlow]);

  if (!loading && user) return <Navigate to="/confirm" replace />;

  // 목업 소셜 로그인 — 실제 연동 전이라 잠깐 로딩만 보여 주고 다음 화면으로
  const mockLogin = (provider) => {
    setBusy(true);
    setTimeout(() => {
      signInMock(provider);
      setBusy(false);
      showToast("목업 로그인이에요. 실제 연동 전이에요.");
      navigate("/confirm", { replace: true });
    }, 600);
  };

  const guest = () => {
    continueAsGuest();
    navigate("/confirm", { replace: true });
  };

  return (
    <AuthScreen>
      {busy ? <BusyOverlay /> : null}
      <Hero>
        <BrandLogo size={144} />
        <p>
          차가 막힐 때, 내 앞 도로 CCTV를
          <br />
          가까운 순서로 바로 보여 드려요.
        </p>
      </Hero>

      <Buttons>
        <Social type="button" $bg="#FEE500" $fg="#191919" disabled={busy} onClick={() => mockLogin("kakao")}>
          <KakaoIcon />
          카카오로 시작하기
        </Social>
        <Social type="button" $bg="#FFFFFF" $fg="#1F1F1F" disabled={busy} onClick={() => mockLogin("google")}>
          <GoogleIcon />
          구글로 시작하기
        </Social>
        <Social type="button" $bg="#000000" $fg="#FFFFFF" $border disabled={busy} onClick={() => mockLogin("apple")}>
          <FaApple size={21} aria-hidden="true" />
          Apple로 시작하기
        </Social>
        <Social type="button" $bg="transparent" $fg="inherit" $border disabled={busy} onClick={() => navigate("/login/email")}>
          <FiMail size={20} aria-hidden="true" />
          이메일로 시작하기
        </Social>
        <TextLink type="button" onClick={guest} disabled={busy}>
          로그인 없이 시작하기
        </TextLink>
        <Note>로그인하지 않아도 내 앞 CCTV는 모두 볼 수 있어요.</Note>
      </Buttons>
    </AuthScreen>
  );
}
