// src/components/dev/ScenarioPanel.jsx
// 흐름 점검 패널 — 기능흐름도 1~9 단계 중 지금 위치, 발생 중인 예외(E1~E6)를 보여 주고
// 시나리오 스위치로 예외를 일부러 일으킨다. 출시 빌드에서는 빼거나 ?dev=0 으로 숨긴다.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiSliders, FiX } from "react-icons/fi";
import { useScenario } from "../../context/ScenarioContext";
import { useFlow } from "../../context/FlowContext";
import { useAuth } from "../../context/AuthContext";
import { SPEED_PRESETS, teleport } from "../../services/simulator";
import { NO_CCTV_INDEX } from "../../mock/route";

const LOGIN_STEPS = [
  ["L1", "로그인"],
  ["L2", "약관 동의"],
  ["L3", "가입 완료"],
];
const STEPS = ["앱 실행", "동승자 확인", "위치 권한", "위치·방향 산출", "전방 CCTV 선별", "목록·자동 재생", "돌발 배지", "카드 전환", "자동 갱신"];
const EXCEPTIONS = {
  E1: "동승자 미확인",
  E2: "위치 권한 거부",
  E3: "정차·저속·터널",
  E4: "전방 CCTV 없음",
  E5: "영상 재생 실패",
  E6: "ITS API 장애",
};

// 시뮬레이션 순간이동 — 서초IC 다음 양재IC, 판교IC 는 송출 중단 CCTV(E5)·사고 지점이다
const JUMPS = [
  [0, "한남IC"],
  [3, "서초IC(E5 직전)"],
  [6, "금토JC(사고 직전)"],
];

const Fab = styled.button`
  position: fixed;
  right: 0;
  top: 58%;
  z-index: 1800;
  height: 42px;
  padding: 0 12px 0 14px;
  border-radius: 999px 0 0 999px;
  border-right: none;
  border: 1px solid #4A5259;
  background: #F2F3F0;
  color: #15191C;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  b {
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 16px;
  }
`;

const Sheet = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1900;
  max-height: 78vh;
  overflow-y: auto;
  padding: 16px 16px calc(env(safe-area-inset-bottom) + 20px);
  border-radius: 18px 18px 0 0;
  background: #F2F3F0;
  color: #15191C;
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.45);
  font-size: 14px;
  @media (min-width: 520px) {
    left: auto;
    right: 16px;
    bottom: 16px;
    width: 380px;
    border-radius: 18px;
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  h2 {
    margin: 0;
    font-size: 17px;
  }
  button {
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
  }
`;

const Label = styled.h3`
  margin: 16px 0 8px;
  font-size: 13px;
  color: #5D666C;
`;

const Steps = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  li {
    padding: 7px 8px;
    border-radius: 8px;
    background: #E2E5E2;
    font-size: 12.5px;
    font-weight: 600;
    color: #5D666C;
  }
  li[data-on="true"] {
    background: #0B6B4C;
    color: #fff;
  }
  li b {
    font-family: ${({ theme }) => theme.fonts.numeric};
    margin-right: 4px;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.button`
  min-height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1.5px solid ${({ $on }) => ($on ? "#15191C" : "#C9CEC9")};
  background: ${({ $on }) => ($on ? "#15191C" : "transparent")};
  color: ${({ $on }) => ($on ? "#fff" : "#15191C")};
  font-size: 13.5px;
  font-weight: 700;
`;

const Ex = styled.span`
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 8px;
  background: ${({ $on }) => ($on ? "#E5483B" : "#E2E5E2")};
  color: ${({ $on }) => ($on ? "#fff" : "#8A9196")};
  font-size: 12.5px;
  font-weight: 700;
`;

export default function ScenarioPanel() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { scenario, set, flowStatus } = useScenario();
  const { resetDrive, setPermission } = useFlow();
  const auth = useAuth();

  if (!open) {
    return (
      <Fab type="button" onClick={() => setOpen(true)} aria-label="흐름 점검 패널 열기">
        <FiSliders size={17} />
        흐름 <b>{flowStatus.step}</b>
        {flowStatus.exceptions.length ? <span style={{ color: "#E5483B" }}>{flowStatus.exceptions.join(" ")}</span> : null}
      </Fab>
    );
  }

  const Toggle = ({ k, children }) => (
    <Chip type="button" $on={scenario[k]} aria-pressed={scenario[k]} onClick={() => set({ [k]: !scenario[k] })}>
      {children}
    </Chip>
  );

  return (
    <Sheet role="dialog" aria-label="흐름 점검 패널">
      <Head>
        <h2>흐름 점검</h2>
        <button type="button" aria-label="닫기" onClick={() => setOpen(false)}>
          <FiX size={22} />
        </button>
      </Head>

      <Label>
        로그인 흐름 {auth.user ? `· ${auth.user.email || auth.user.displayName}` : auth.isGuest ? "· 로그인 없이 사용 중" : ""}
      </Label>
      <Steps>
        {LOGIN_STEPS.map(([code, s]) => (
          <li key={code} data-on={flowStatus.step === code}>
            <b>{code}</b>
            {s}
          </li>
        ))}
      </Steps>

      <Label>기능흐름도 단계</Label>
      <Steps>
        {STEPS.map((s, i) => (
          <li key={s} data-on={flowStatus.step === i + 1}>
            <b>{i + 1}</b>
            {s}
          </li>
        ))}
      </Steps>

      <Label>예외 상황</Label>
      <Chips>
        {Object.entries(EXCEPTIONS).map(([code, name]) => (
          <Ex key={code} $on={flowStatus.exceptions.includes(code)}>
            {code} {name}
          </Ex>
        ))}
      </Chips>

      <Label>교통 데이터</Label>
      <Chips>
        <Chip type="button" $on={scenario.data === "mock"} onClick={() => set({ data: "mock" })}>
          목업
        </Chip>
        <Chip type="button" $on={scenario.data === "live"} onClick={() => set({ data: "live" })}>
          실제 ITS (npm run proxy)
        </Chip>
      </Chips>

      <Label>위치 출처</Label>
      <Chips>
        <Chip type="button" $on={scenario.source === "sim"} onClick={() => set({ source: "sim" })}>
          시뮬레이션 주행
        </Chip>
        <Chip type="button" $on={scenario.source === "device"} onClick={() => set({ source: "device" })}>
          실제 GPS
        </Chip>
      </Chips>

      {scenario.source === "sim" ? (
        <>
          <Label>주행 속도</Label>
          <Chips>
            {Object.entries(SPEED_PRESETS).map(([k, p]) => (
              <Chip key={k} type="button" $on={scenario.speed === k} onClick={() => set({ speed: k })}>
                {p.label}
              </Chip>
            ))}
          </Chips>
          <Label>이동</Label>
          <Chips>
            {JUMPS.map(([idx, label]) => (
              <Chip key={idx} type="button" onClick={() => teleport(idx)}>
                {label}
              </Chip>
            ))}
            <Chip type="button" onClick={() => teleport(NO_CCTV_INDEX)}>
              CCTV 없는 구간으로(E4)
            </Chip>
          </Chips>
        </>
      ) : null}

      <Label>예외 일으키기</Label>
      <Chips>
        <Toggle k="tunnel">터널, GPS 끊김(E3)</Toggle>
        <Toggle k="brokenFeeds">송출 중단 CCTV(E5)</Toggle>
        <Toggle k="apiDown">ITS 장애(E6)</Toggle>
        <Toggle k="denyPermission">권한 거부(E2)</Toggle>
      </Chips>

      <Label>처음부터</Label>
      <Chips>
        <Chip
          type="button"
          onClick={() => {
            resetDrive();
            navigate("/", { replace: true });
          }}
        >
          앱 다시 실행
        </Chip>
        <Chip
          type="button"
          onClick={async () => {
            await auth.resetEntry();
            resetDrive();
            navigate("/", { replace: true });
          }}
        >
          첫 설치 상태로(로그인부터)
        </Chip>
        <Chip
          type="button"
          onClick={() => {
            setPermission("unknown");
            navigate("/permission", { replace: true });
          }}
        >
          권한 화면 다시 보기
        </Chip>
      </Chips>
    </Sheet>
  );
}
