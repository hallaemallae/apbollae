// 흐름 2 — 동승자 확인(F-01). 체크 전에는 영상 화면으로 갈 수 없다(E1).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiAlertTriangle, FiSmartphone, FiVolumeX } from "react-icons/fi";
import Button from "../components/common/Button";
import CheckCircle from "../components/common/CheckCircle";
import { useFlow } from "../context/FlowContext";
import { useScenario } from "../context/ScenarioContext";

export const Screen = styled.main`
  min-height: 100%;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: calc(env(safe-area-inset-top) + 48px) 20px calc(env(safe-area-inset-bottom) + 20px);
  background: ${({ theme }) => theme.colors.surface};
`;

export const Title = styled.h1`
  margin: 0 0 10px;
  font-size: 25px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.03em;
`;

export const Lead = styled.p`
  margin: 0 0 28px;
  font-size: 15.5px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export const Bottom = styled.div`
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 24px;
`;

const Check = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 72px;
  padding: 0 18px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border: 1.5px solid ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme }) => theme.colors.surface};
  font-size: 18px;
  font-weight: 700;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease;
`;

const Rules = styled.ul`
  list-style: none;
  margin: 16px 0 0;
  padding: 18px 2px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  flex-direction: column;
  gap: 14px;
  li {
    display: flex;
    gap: 12px;
    font-size: 14.5px;
    line-height: 1.55;
    color: ${({ theme }) => theme.colors.textNormal};
  }
  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Hint = styled.p`
  margin: 0;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Stop = styled.div`
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  > svg {
    width: 64px;
    height: 64px;
    padding: 16px;
    margin-bottom: 20px;
    border-radius: 50%;
    background: ${({ theme }) => (theme.mode === "dark" ? "rgba(229, 72, 59, 0.18)" : "#FDEDEC")};
    color: ${({ theme }) => theme.colors.accident};
  }
`;

export default function PassengerPage() {
  const navigate = useNavigate();
  const { setPassenger, permission } = useFlow();
  const { reportFlow } = useScenario();
  const [checked, setChecked] = useState(false);
  const [driving, setDriving] = useState(false);

  useEffect(() => {
    reportFlow(2, driving ? ["E1"] : []);
  }, [reportFlow, driving]);

  const start = () => {
    setPassenger(true);
    navigate(permission === "granted" ? "/drive" : "/permission", { replace: true });
  };

  if (driving) {
    return (
      <Screen>
        <Stop role="alert">
          <FiAlertTriangle aria-hidden="true" />
          <Title>운전 중에는 쓸 수 없어요</Title>
          <Lead style={{ marginBottom: 0 }}>
            운전 중 영상 시청은 도로교통법 제49조 위반이에요. 동승자에게 휴대폰을 건네 주세요.
          </Lead>
        </Stop>
        <Bottom>
          <Button variant="secondary" fullWidth onClick={() => setDriving(false)}>
            동승자에게 건넸어요
          </Button>
        </Bottom>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>조수석에 앉아 계신가요?</Title>
      <Lead>앞볼래는 운전하지 않는 동승자를 위한 앱이에요. 확인해야 도로 영상이 재생돼요.</Lead>

      <Check type="button" role="checkbox" aria-checked={checked} $on={checked} onClick={() => setChecked((v) => !v)}>
        <CheckCircle on={checked} size={28} />
        저는 조수석 동승자입니다
      </Check>

      <Rules>
        <li>
          <FiSmartphone size={20} aria-hidden="true" />
          운전석 거치대에 두고 쓰지 마세요. 손에 들고 보는 것을 전제로 만들었어요.
        </li>
        <li>
          <FiVolumeX size={20} aria-hidden="true" />
          운전자 주의를 끌지 않도록 음성 안내와 자동 팝업이 없어요.
        </li>
      </Rules>

      <Bottom>
        {!checked ? <Hint>체크해야 시작할 수 있어요</Hint> : null}
        <Button fullWidth disabled={!checked} onClick={start}>
          확인하고 시작
        </Button>
        <Button variant="secondary" fullWidth onClick={() => setDriving(true)}>
          제가 운전 중이에요
        </Button>
      </Bottom>
    </Screen>
  );
}
