// src/components/drive/GuideSign.jsx
// 고속도로 방향 안내 표지 모양의 "지금 어디를 어느 방향으로 가는가" 띠.
// E3: 방향을 GPS 가 아닌 궤적/마지막 값으로 잡고 있으면 아래 줄에 알린다.
import React from "react";
import styled from "styled-components";
import { FiArrowUp } from "react-icons/fi";

const Panel = styled.div`
  background: ${({ theme }) => theme.colors.sign};
  color: ${({ theme }) => theme.colors.signText};
  padding: 10px 16px 11px;
  border-bottom: 3px solid rgba(255, 255, 255, 0.85);
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

// 고속도로 노선 방패 — 위 빨강 띠 + 파랑 몸통
const Shield = styled.div`
  flex-shrink: 0;
  width: 34px;
  height: 36px;
  border-radius: 4px 4px 14px 14px;
  background: linear-gradient(#D6342A 0 28%, #1D4FA0 28% 100%);
  border: 2px solid #fff;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 3px;
  font-family: ${({ theme }) => theme.fonts.numeric};
  font-weight: 700;
  font-size: 17px;
  line-height: 1;
`;

const Arrow = styled(FiArrowUp)`
  flex-shrink: 0;
`;

const Names = styled.div`
  flex: 1;
  min-width: 0;
`;

const Road = styled.div`
  font-size: 13px;
  font-weight: 600;
  opacity: 0.85;
`;

const Dir = styled.div`
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.03em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Speed = styled.div`
  flex-shrink: 0;
  text-align: right;
  font-family: ${({ theme }) => theme.fonts.numeric};
  line-height: 1;
  b {
    font-size: 30px;
    font-weight: 700;
  }
  small {
    display: block;
    font-size: 12px;
    font-weight: 600;
    opacity: 0.8;
    margin-top: 2px;
  }
`;

const Note = styled.div`
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  font-size: 13px;
  font-weight: 600;
`;

const COMPASS = ["북쪽", "북동쪽", "동쪽", "남동쪽", "남쪽", "남서쪽", "서쪽", "북서쪽"];
export const compassLabel = (deg) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

const SOURCE_NOTE = {
  trail: "정체 중이라 최근 이동 경로로 방향을 잡고 있어요",
  hold: "GPS 신호가 끊겨 마지막 방향을 유지하고 있어요",
};

export default function GuideSign({ road, direction, heading, headingSource, speed }) {
  const dirLabel =
    road && direction ? (direction === "down" ? road.downLabel : road.upLabel) : heading != null ? `${compassLabel(heading)}으로 이동 중` : "방향 확인 중";

  return (
    <Panel>
      <Row>
        {road?.no != null ? <Shield aria-label={`${road.no}번 고속도로`}>{road.no}</Shield> : null}
        <Names>
          <Road>{road ? road.name : "현재 도로 확인 중"}</Road>
          <Dir>{dirLabel}</Dir>
        </Names>
        <Arrow size={26} aria-hidden="true" />
        <Speed>
          <b>{speed != null ? Math.round(speed) : "--"}</b>
          <small>km/h</small>
        </Speed>
      </Row>
      {SOURCE_NOTE[headingSource] ? <Note role="status">{SOURCE_NOTE[headingSource]}</Note> : null}
    </Panel>
  );
}
