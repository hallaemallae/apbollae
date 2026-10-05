// src/hooks/useAheadCctvs.js
// F-03 선별 + F-04 자동 갱신 + F-05 돌발 배지 + E4/E6.
// 30초가 지나거나 500m 이동하면(먼저 오는 쪽) ITS 목록을 다시 받아 재선별한다.
// 지나친 CCTV 는 재선별 때 부채꼴 밖(behind)으로 분류돼 자연히 빠진다.
import { useEffect, useRef, useState } from "react";
import { fetchAround } from "../services/itsApi";
import { useScenario } from "../context/ScenarioContext";
import { AHEAD, attachEvents, distanceKm, selectAhead, travelDirection } from "../utils/aheadFilter";
import { attachEventsAlong, selectAlongRoute } from "../utils/routeFilter";

const EMPTY = { selected: [], all: [], events: [], eventsByCctv: {}, refreshedAt: 0, refreshedPos: null, stale: false, error: null, mode: null };

/**
 * @param {{ fix, heading, road, nav, roadPath }} input
 *   road    : { names, downBearing } | null (모르면 2차 필터 중 도로 비교 생략)
 *   nav     : useRoute() 결과 — 경로가 준비돼 있으면 경로 기준으로 고른다
 *   roadPath: useRoadMatch() 의 예상 경로 — 목적지가 없을 때 "내 도로 앞쪽"으로 고른다
 */
export default function useAheadCctvs({ fix, heading, road, nav, roadPath = null }) {
  const { scenario } = useScenario();
  const [state, setState] = useState(EMPTY);
  const busyRef = useRef(false);
  const genRef = useRef(0); // 데이터 출처가 바뀐 뒤 도착한 이전 응답은 버린다

  const ready = !!fix;
  // route: 목적지 경로 기준 | road: 맵매칭한 내 도로를 따라 앞쪽 | ahead: 진행 방향 기준 전방 부채꼴 | nearby: 방향을 몰라 사방 5km
  const routeObj = nav?.route || null;
  const mode = routeObj ? "route" : heading == null ? "nearby" : roadPath ? "road" : "ahead";
  const navRef = useRef(nav);
  navRef.current = nav;
  const pathRef = useRef(roadPath);
  pathRef.current = roadPath;

  // 목업 ↔ 실제 데이터를 바꾸면 다음 틱에 곧바로 다시 받는다
  useEffect(() => {
    genRef.current += 1;
    busyRef.current = false;
    setState(EMPTY);
  }, [scenario.data]);

  useEffect(() => {
    if (!ready || busyRef.current) return;
    const elapsed = Date.now() - state.refreshedAt;
    const moved = state.refreshedPos ? distanceKm(state.refreshedPos, fix) : Infinity;
    const sameRoute = state.routeRef === routeObj;
    if (state.refreshedAt && state.mode === mode && sameRoute && elapsed < AHEAD.refreshMs && moved < AHEAD.refreshKm) return;

    busyRef.current = true;
    const gen = genRef.current;
    const position = { lat: fix.lat, lng: fix.lng };
    const ctx = { position, heading, roadNames: road?.names, direction: travelDirection(heading, road) };

    fetchAround(position, { apiDown: scenario.apiDown, data: scenario.data })
      .then((res) => {
        if (gen !== genRef.current) return;
        const n = navRef.current;
        const useRouteNow = mode === "route" && n?.route;
        // 예상 경로는 받은 시점의 내 위치에서 시작한다(s0 = 0)
        const path = mode === "road" ? pathRef.current : null;
        const line = useRouteNow ? { route: n.route, s0: n.s0 } : path ? { route: path, s0: 0 } : null;
        const { selected, all } = line ? selectAlongRoute(res.cctvs, line.route, line.s0, ctx.direction) : selectAhead(res.cctvs, ctx);
        setState({
          selected,
          all,
          events: res.events,
          eventsByCctv: line ? attachEventsAlong(res.events, selected, line.route, line.s0, ctx.direction) : attachEvents(res.events, selected, ctx),
          refreshedAt: Date.now(),
          refreshedPos: position,
          stale: res.stale,
          error: null,
          mode,
          routeRef: routeObj,
        });
      })
      .catch((e) => {
        if (gen !== genRef.current) return;
        // 캐시조차 없는 장애 — 목록은 비우고 다음 주기에 다시 시도
        setState({ ...EMPTY, refreshedAt: Date.now(), refreshedPos: position, error: e.message, mode, routeRef: routeObj });
      })
      .finally(() => {
        if (gen === genRef.current) busyRef.current = false;
      });
  }, [ready, mode, routeObj, fix, heading, road, scenario.apiDown, scenario.data, state.refreshedAt, state.refreshedPos, state.mode, state.routeRef]);

  const secondsLeft = state.refreshedAt ? Math.max(0, Math.ceil((AHEAD.refreshMs - (Date.now() - state.refreshedAt)) / 1000)) : null;
  const metersLeft =
    state.refreshedPos && fix ? Math.max(0, Math.round((AHEAD.refreshKm - distanceKm(state.refreshedPos, fix)) * 1000)) : null;

  return { ...state, secondsLeft, metersLeft, loading: !state.refreshedAt };
}
