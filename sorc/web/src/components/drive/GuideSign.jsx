// src/components/drive/GuideSign.jsx
// 고속도로 방향 안내 표지 모양의 "지금 어디를 어느 방향으로 가는가" 띠.
// E3: 방향을 GPS 가 아닌 궤적/마지막 값으로 잡고 있으면 아래 줄에 알린다.
import React from "react";
import styled, { useTheme } from "styled-components";
import { TRAFFIC_LABEL } from "../../utils/routeFilter";
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

const Jam = styled.div`
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  font-size: 13.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  i {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
  }
`;

const fmtKm = (km) => (km < 1 ? `${Math.max(100, Math.round(km * 10) * 100)}m` : `${km.toFixed(1)}km`);

/**
 * @param nav  useRoute() 결과 — 경로가 있으면 도로명은 경로의 현재 도로, 방향은 "○○ 방향(목적지)"
 */
export default function GuideSign({ road, direction, heading, headingSource, speed, nav }) {
  const theme = useTheme();
  const onRoute = !!nav?.route;
  const dirLabel = onRoute
    ? `${nav.destination.name} 방향`
    : road && direction
      ? direction === "down"
        ? road.downLabel
        : road.upLabel
      : heading != null
        ? `${compassLabel(heading)}으로 이동 중`
        : "방향 확인 중";
  const roadName = onRoute ? nav.road?.name || "경로 위" : road ? road.name : "현재 도로 확인 중";
  const jam = nav?.congestion;

  return (
    <Panel>
      <Row>
        {!onRoute && road?.no != null ? <Shield aria-label={`${road.no}번 고속도로`}>{road.no}</Shield> : null}
        <Names>
          <Road>{roadName}</Road>
          <Dir>{dirLabel}</Dir>
        </Names>
        <Arrow size={26} aria-hidden="true" />
        <Speed>
          <b>{speed != null ? Math.round(speed) : "--"}</b>
          <small>km/h</small>
        </Speed>
      </Row>
      {onRoute ? (
        jam ? (
          <Jam $color={theme.colors.traffic[jam.state]} role="status">
            <i aria-hidden="true" />
            {jam.startKm < 0.1 ? "지금부터" : `${fmtKm(jam.startKm)} 앞부터`} {fmtKm(jam.lengthKm)} {TRAFFIC_LABEL[jam.state]}
            {jam.speed != null ? ` · 평균 ${jam.speed}km/h` : ""}
          </Jam>
        ) : (
          <Jam $color={theme.colors.traffic.smooth} role="status">
            <i aria-hidden="true" />앞 10km 안에 막히는 구간이 없어요
          </Jam>
        )
      ) : null}
      {SOURCE_NOTE[headingSource] ? <Note role="status">{SOURCE_NOTE[headingSource]}</Note> : null}
    </Panel>
  );
}
