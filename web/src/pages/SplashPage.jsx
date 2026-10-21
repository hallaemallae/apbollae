// 흐름 1 — 앱 실행. RN 셸의 네이티브 스플래시 다음에 잠깐 보이는 웹 첫 화면.
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { BrandLogo } from "../components/auth/AuthParts";
import { useBridge } from "../context/WebviewBridgeContext";
import { useScenario } from "../context/ScenarioContext";
import { useAuth } from "../context/AuthContext";

const Screen = styled.main`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 24px;
  background: #0a0a0b; /* 로고 바탕색과 같게 — RN 네이티브 스플래시에서 넘어올 때 튀지 않게 */
`;

const rise = keyframes`
  from { transform: scale(0.94); opacity: 0; }
`;

const Logo = styled.div`
  animation: ${rise} 0.45s ease-out;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 15px;
  color: #9a9ca0;
`;

export default function SplashPage() {
  const navigate = useNavigate();
  const bridge = useBridge();
  const { reportFlow } = useScenario();
  const { loading } = useAuth();

  useEffect(() => {
    reportFlow(1);
    bridge?.signalWebReady("splash");
  }, [bridge, reportFlow]);

  // 로그인 복원이 끝나면 이동 — 로그인 화면으로 갈지는 /confirm 의 RequireEntry 가 정한다
  useEffect(() => {
    if (loading) return undefined;
    const t = setTimeout(() => navigate("/confirm", { replace: true }), 500); // 화면 전환은 1초 안에
    return () => clearTimeout(t);
  }, [loading, navigate]);

  return (
    <Screen>
      <Logo>
        <BrandLogo size={168} />
      </Logo>
      <Sub>조수석에서 보는 내 앞 도로</Sub>
    </Screen>
  );
}
