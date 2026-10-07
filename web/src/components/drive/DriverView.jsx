// src/components/drive/DriverView.jsx — ③ 운전자에게 보여 주기.
// 원인 한 줄 요약을 화면 가득 큰 글씨로 띄운다. 동승자가 화면을 잠깐 운전자 쪽으로 돌려 보여 주는 용도(음성 안내 대신).
// 어디를 눌러도 닫힌다.
import React, { useEffect } from "react";
import styled from "styled-components";

const TONE = {
  accident: "#E5483B",
  work: "#F08A24",
  control: "#3D7BE0",
  jam: "#D33A2C",
  clear: "#2E9E5B",
  unknown: "#6B7378",
};
const TONE_LABEL = { accident: "사고", work: "공사", control: "통제", jam: "정체", clear: "원활", unknown: "확인 중" };

const Screen = styled.button`
  position: fixed;
  inset: 0;
  z-index: 70;
  width: 100%;
  border: none;
  padding: calc(env(safe-area-inset-top) + 32px) 28px calc(env(safe-area-inset-bottom) + 32px);
  background: #0b0e14;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 20px;
  text-align: left;
  font-family: inherit;
`;

const Tag = styled.span`
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 22px;
  font-weight: 800;
  background: ${({ $c }) => $c};
`;

const Title = styled.b`
  font-size: clamp(40px, 11vw, 88px);
  line-height: 1.18;
  font-weight: 800;
  letter-spacing: -0.03em;
  word-break: keep-all;
`;

const Sub = styled.span`
  font-size: clamp(22px, 5.6vw, 40px);
  line-height: 1.35;
  font-weight: 600;
  color: #c3c9d4;
  word-break: keep-all;
`;

const Hint = styled.small`
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(env(safe-area-inset-bottom) + 18px);
  text-align: center;
  font-size: 14px;
  color: #7d8796;
`;

export default function DriverView({ summary, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Screen type="button" onClick={onClose} aria-label="운전자에게 보여 주기 화면, 누르면 닫혀요">
      <Tag $c={TONE[summary.tone]}>{TONE_LABEL[summary.tone]}</Tag>
      <Title>{summary.title}</Title>
      {summary.sub ? <Sub>{summary.sub}</Sub> : null}
      <Hint>아무 곳이나 누르면 닫혀요</Hint>
    </Screen>
  );
}
