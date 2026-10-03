// src/hooks/useAheadCctvs.js
// F-03 선별 + F-04 자동 갱신 + F-05 돌발 배지 + E4/E6.
// 30초가 지나거나 500m 이동하면(먼저 오는 쪽) ITS 목록을 다시 받아 재선별한다.
// 지나친 CCTV 는 재선별 때 부채꼴 밖(behind)으로 분류돼 자연히 빠진다.
import { useEffect, useRef, useState } from "react";
import { fetchAround } from "../services/itsApi";
import { useScenario } from "../context/ScenarioContext";
import { AHEAD, attachEvents, distanceKm, selectAhead, travelDirection } from "../utils/aheadFilter";

const EMPTY = { selected: [], all: [], events: [], eventsByCctv: {}, refreshedAt: 0, refreshedPos: null, stale: false, error: null };

/**
 * @param {{ fix, heading, road }} input  road: { name, downBearing } | null (모르면 2차 필터 중 도로 비교 생략)
 */
export default function useAheadCctvs({ fix, heading, road }) {
  const { scenario } = useScenario();
  const [state, setState] = useState(EMPTY);
  const busyRef = useRef(false);

  const ready = fix && heading != null;

  useEffect(() => {
    if (!ready || busyRef.current) return;
    const elapsed = Date.now() - state.refreshedAt;
    const moved = state.refreshedPos ? distanceKm(state.refreshedPos, fix) : Infinity;
    if (state.refreshedAt && elapsed < AHEAD.refreshMs && moved < AHEAD.refreshKm) return;

    busyRef.current = true;
    const position = { lat: fix.lat, lng: fix.lng };
    const ctx = { position, heading, roadName: road?.name, direction: travelDirection(heading, road) };

    fetchAround(position, { apiDown: scenario.apiDown })
      .then((res) => {
        const { selected, all } = selectAhead(res.cctvs, ctx);
        setState({
          selected,
          all,
          events: res.events,
          eventsByCctv: attachEvents(res.events, selected, ctx),
          refreshedAt: Date.now(),
          refreshedPos: position,
          stale: res.stale,
          error: null,
        });
      })
      .catch((e) => {
        // 캐시조차 없는 장애 — 목록은 비우고 다음 주기에 다시 시도
        setState({ ...EMPTY, refreshedAt: Date.now(), refreshedPos: position, error: e.message });
      })
      .finally(() => {
        busyRef.current = false;
      });
  }, [ready, fix, heading, road, scenario.apiDown, state.refreshedAt, state.refreshedPos]);

  const secondsLeft = state.refreshedAt ? Math.max(0, Math.ceil((AHEAD.refreshMs - (Date.now() - state.refreshedAt)) / 1000)) : null;
  const metersLeft =
    state.refreshedPos && fix ? Math.max(0, Math.round((AHEAD.refreshKm - distanceKm(state.refreshedPos, fix)) * 1000)) : null;

  return { ...state, secondsLeft, metersLeft, loading: !state.refreshedAt };
}
