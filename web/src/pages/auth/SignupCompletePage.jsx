// 가입 완료 — 할래말래 SignupCompletePage 처럼 처음 한 번만. "시작하기"를 누르면 동승자 확인으로 이어진다.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import Button from "../../components/common/Button";
import { AuthScreen, BrandLogo } from "../../components/auth/AuthParts";
import { useAuth } from "../../context/AuthContext";
import { useScenario } from "../../context/ScenarioContext";
import { showToast } from "../../utils/toast";

const Center = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 14px;
  h1 {
    margin: 18px 0 0;
    font-size: 25px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  p {
    margin: 0;
    font-size: 15.5px;
    line-height: 1.65;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

export default function SignupCompletePage() {
  const { user, markWelcomeSeen } = useAuth();
  const { reportFlow } = useScenario();
  const [saving, setSaving] = useState(false);

  const start = async () => {
    setSaving(true);
    try {
      await markWelcomeSeen();
    } catch (err) {
      console.warn("[welcome] 저장 실패:", err);
      showToast("저장하지 못했어요. 다시 눌러 주세요.");
      setSaving(false);
    }
  };

  useEffect(() => {
    reportFlow("L3");
  }, [reportFlow]);

  return (
    <AuthScreen>
      <Center>
        <BrandLogo size={120} />
        <h1>가입을 마쳤어요</h1>
        <p>
          {user?.displayName}님, 반가워요.
          <br />
          차가 막히면 앱을 켜 보세요.
          <br />내 앞 CCTV를 가까운 순서로 바로 보여 드려요.
        </p>
      </Center>
      <Button fullWidth disabled={saving} onClick={start}>
        시작하기
      </Button>
    </AuthScreen>
  );
}
