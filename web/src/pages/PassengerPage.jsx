// 흐름 2 — 동승자 확인(F-01). 체크 전에는 영상 화면으로 갈 수 없다(E1).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiCheck, FiSmartphone, FiVolumeX } from "react-icons/fi";
import Button from "../components/common/Button";
import { useFlow } from "../context/FlowContext";
import { useScenario } from "../context/ScenarioContext";

export const Screen = styled.main`
  min-height: 100%;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: calc(env(safe-area-inset-top) + 48px) 20px calc(env(safe-area-inset-bottom) + 20px);
`;

export const Title = styled.h1`
  margin: 0 0 12px;
  font-size: ${({ theme }) => theme.fontSizes.titleLg + 2}px;
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.035em;
`;

export const Lead = styled.p`
  margin: 0 0 28px;
  font-size: 16px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textNormal};
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
  min-height: 68px;
  padding: 0 18px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: 2px solid ${({ theme, $on }) => ($on ? theme.colors.lane : theme.colors.border)};
  background: ${({ theme }) => theme.colors.surface};
  font-size: 18px;
  font-weight: 700;
  text-align: left;
`;

const Box = styled.span`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme, $on }) => ($on ? theme.colors.lane : "transparent")};
  border: 2px solid ${({ theme, $on }) => ($on ? theme.colors.lane : theme.colors.textWeak)};
  color: ${({ theme }) => theme.colors.laneText};
`;

const Rules = styled.ul`
  list-style: none;
  margin: 24px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  li {
    display: flex;
    gap: 12px;
    font-size: 15px;
    line-height: 1.5;
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
  padding: 28px 22px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  background: ${({ theme }) => theme.colors.surface};
  border-left: 6px solid ${({ theme }) => theme.colors.accident};
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
          <Title>운전 중에는 쓸 수 없어요</Title>
          <Lead style={{ marginBottom: 20 }}>
            운전 중 영상 시청은 도로교통법 제49조 위반이에요. 동승자에게 휴대폰을 건네 주세요.
          </Lead>
          <Button variant="secondary" fullWidth onClick={() => setDriving(false)}>
            동승자에게 건넸어요
          </Button>
        </Stop>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>조수석에 앉아 계신가요?</Title>
      <Lead>앞볼래는 운전하지 않는 동승자를 위한 앱이에요. 확인해야 도로 영상이 재생돼요.</Lead>

      <Check type="button" role="checkbox" aria-checked={checked} $on={checked} onClick={() => setChecked((v) => !v)}>
        <Box $on={checked} aria-hidden="true">
          {checked ? <FiCheck size={20} strokeWidth={3.5} /> : null}
        </Box>
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
