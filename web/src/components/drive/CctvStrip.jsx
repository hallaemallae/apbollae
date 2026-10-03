// src/components/drive/CctvStrip.jsx
// 가까운 순 CCTV 목록(F-04) — 도로 노선도(스트립맵)처럼 "현재 위치"에서 아래로 앞쪽 지점을 잇는다.
// 카드를 누르면 그 CCTV 로 영상이 바뀐다(흐름 8단계: 정체 범위 확인).
import React from "react";
import styled, { css } from "styled-components";
import { formatDistance } from "../../utils/aheadFilter";
import { EVENT_LABEL } from "../../mock/events";
import { TRAFFIC_LABEL } from "../../utils/routeFilter";

const RAIL_X = 22; // 도로 선의 가로 위치

const List = styled.ol`
  list-style: none;
  margin: 0;
  padding: 4px 0 8px;
  position: relative;
  &::before {
    content: "";
    position: absolute;
    left: ${RAIL_X - 2}px;
    top: 18px;
    bottom: 34px;
    width: 4px;
    border-radius: 2px;
    background: ${({ theme }) => theme.colors.road};
  }
`;

const Here = styled.li`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px 10px 0;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const HereMark = styled.span`
  width: ${RAIL_X * 2}px;
  display: flex;
  justify-content: center;
  &::before {
    content: "";
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 13px solid ${({ theme }) => theme.colors.textStrong};
  }
`;

const Item = styled.li`
  position: relative;
`;

const Stop = styled.button`
  position: relative;
  width: 100%;
  min-height: 68px;
  display: grid;
  grid-template-columns: ${RAIL_X * 2}px 76px 1fr;
  align-items: start;
  padding: 12px 16px 12px 0;
  border: none;
  background: transparent;
  text-align: left;
  color: ${({ theme }) => theme.colors.textStrong};

  ${({ $active, theme }) =>
    $active &&
    css`
      background: ${theme.mode === "dark" ? "rgba(242, 183, 5, 0.09)" : "rgba(217, 163, 0, 0.1)"};
    `}
`;

const Node = styled.span`
  justify-self: center;
  margin-top: 6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.bg};
  border: 4px solid ${({ theme, $active, $dead }) => ($dead ? theme.colors.textWeak : $active ? theme.colors.lane : theme.colors.textNormal)};
  ${({ $active }) => $active && "transform: scale(1.25);"}
`;

const Dist = styled.span`
  font-family: ${({ theme }) => theme.fonts.numeric};
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
  b {
    font-size: 28px;
    font-weight: 700;
  }
  small {
    font-size: 15px;
    font-weight: 600;
    margin-left: 2px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Body = styled.span`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
`;

const Name = styled.span`
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  color: ${({ theme, $dead }) => ($dead ? theme.colors.textWeak : theme.colors.textStrong)};
`;

const State = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme, $tone }) => ($tone === "live" ? theme.colors.lane : theme.colors.textWeak)};
`;

const Badge = styled.span`
  align-self: flex-start;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: ${({ theme, $type }) => theme.colors[$type]};
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  em {
    font-style: normal;
    font-weight: 600;
    font-size: 12.5px;
    opacity: 0.92;
    /* ITS 설명이 길 때 두 줄까지만 */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

const Traffic = styled.span`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textNormal};
  i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ theme, $state }) => theme.colors.traffic[$state] || theme.colors.traffic.unknown};
  }
`;

export function EventBadge({ ev, nearby = false }) {
  const d = formatDistance(ev.km);
  return (
    <Badge $type={ev.type}>
      {d.value}
      {d.unit} {nearby ? "거리" : "앞"} {ev.label || EVENT_LABEL[ev.type]}
      {ev.lanes ? `, ${ev.lanes}` : ""}
      {ev.message ? <em>{ev.message}</em> : null}
    </Badge>
  );
}

/**
 * @param {Array} items  [{ id, name, liveKm }]  가까운 순
 */
export default function CctvStrip({ hereLabel, items, activeId, failedIds, eventsByCctv, onSelect, nearby = false }) {
  return (
    <List aria-label={nearby ? "주변 CCTV, 가까운 순" : "내 앞 CCTV, 가까운 순"}>
      <Here>
        <HereMark aria-hidden="true" />
        현재 위치{hereLabel ? `, ${hereLabel} 부근` : ""}
      </Here>
      {items.map((c) => {
        const active = c.id === activeId;
        const dead = failedIds.has(c.id);
        const d = formatDistance(c.liveKm);
        const events = eventsByCctv[c.id] || [];
        return (
          <Item key={c.id}>
            <Stop type="button" $active={active} aria-current={active ? "true" : undefined} onClick={() => onSelect(c.id)}>
              <Node $active={active} $dead={dead} aria-hidden="true" />
              <Dist>
                <b>{d.value}</b>
                <small>{d.unit}</small>
              </Dist>
              <Body>
                <Name $dead={dead}>{c.name}</Name>
                {active && !dead ? <State $tone="live">재생 중</State> : null}
                {dead ? <State>영상 없음 · 눌러서 다시 시도</State> : null}
                {c.traffic && c.traffic.state !== "unknown" ? (
                  <Traffic $state={c.traffic.state}>
                    <i aria-hidden="true" />이 구간 {TRAFFIC_LABEL[c.traffic.state]}
                    {c.traffic.speed != null ? ` · ${c.traffic.speed}km/h` : ""}
                  </Traffic>
                ) : null}
                {events.map((ev) => (
                  <EventBadge key={ev.id} ev={ev} nearby={nearby} />
                ))}
              </Body>
            </Stop>
          </Item>
        );
      })}
    </List>
  );
}
