// 흐름 1 — 앱 실행. RN 셸의 네이티브 스플래시 다음에 잠깐 보이는 웹 첫 화면.
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { FiArrowUp } from "react-icons/fi";
import { useBridge } from "../context/WebviewBridgeContext";
import { useScenario } from "../context/ScenarioContext";

const Screen = styled.main`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 24px;
  background: ${({ theme }) => theme.colors.bg};
`;

const rise = keyframes`
  from { transform: translateY(14px); opacity: 0; }
`;

const Sign = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 26px 18px 22px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.sign};
  color: #fff;
  border: 3px solid #fff;
  box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.sign};
  animation: ${rise} 0.5s ease-out;
`;

const Word = styled.h1`
  margin: 0;
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.04em;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export default function SplashPage() {
  const navigate = useNavigate();
  const bridge = useBridge();
  const { reportFlow } = useScenario();

  useEffect(() => {
    reportFlow(1);
    bridge?.signalWebReady("splash");
    const t = setTimeout(() => navigate("/confirm", { replace: true }), 1300);
    return () => clearTimeout(t);
  }, [navigate, bridge, reportFlow]);

  return (
    <Screen>
      <Sign>
        <FiArrowUp size={40} strokeWidth={3} aria-hidden="true" />
        <Word>앞볼래</Word>
      </Sign>
      <Sub>조수석에서 보는 내 앞 도로</Sub>
    </Screen>
  );
}
