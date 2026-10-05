// 흐름 4~9 — 메인 화면(Claude Design "앞볼래 메인", 카카오내비 벤치마킹).
//  - 카카오 지도가 화면 전체를 채우고 내 위치를 따라간다. 주변 CCTV 가 모두 마커로 뜬다(누르면 그 영상).
//  - 위: 어두운 안내 카드 — 지금 도로·방향, 그 아래 바로 앞 CCTV 영상(없으면 "다시 찾기" 진행 막대).
//  - 왼쪽 아래 속도, 오른쪽 아래 "앞쪽 N"(목록 시트)·내 위치 버튼, 맨 아래 목적지 바.
//  - 옅은 색 면은 쓰지 않는다(흰 면 + 테두리, 어두운 카드 위에서는 구분선만).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { useTheme } from "styled-components";
import { FiInfo, FiNavigation, FiCloudOff, FiFlag, FiSkipForward, FiSliders, FiVideoOff, FiArrowUp } from "react-icons/fi";
import CctvPlayer from "../components/drive/CctvPlayer";
import CctvStrip from "../components/drive/CctvStrip";
import KakaoMiniMap from "../components/drive/KakaoMiniMap";
import { compassLabel } from "../components/drive/GuideSign";
import useLocationStream from "../hooks/useLocationStream";
import useAheadCctvs from "../hooks/useAheadCctvs";
import useRoute from "../hooks/useRoute";
import useRoadMatch from "../hooks/useRoadMatch";
import DestinationSheet from "../components/drive/DestinationSheet";
import { useFlow } from "../context/FlowContext";
import { useScenario } from "../context/ScenarioContext";
import { ROUTE_ROAD } from "../mock/route";
import { routeNodes, setTripPath } from "../services/simulator";
import { distanceKm, travelDirection, AHEAD } from "../utils/aheadFilter";
import { TRAFFIC_LABEL } from "../utils/routeFilter";
import { showToast } from "../utils/toast";
import { fetchCctv, fetchNationCctvs } from "../services/itsApi";

// 안내 카드는 밝은/어두운 화면 모두 같은 어두운 색이다(카카오내비 안내 카드처럼)
const CARD = { bg: "#151A22", text: "#FFFFFF", sub: "#9AA3B2", line: "rgba(255,255,255,0.1)", muted: "#7D8796" };

const Page = styled.div`
  position: relative;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  height: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
`;

const MapLayer = styled.div`
  position: absolute;
  inset: 0;
`;

const Center = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/* ── 위 안내 카드 ── */
const Guide = styled.div`
  position: absolute;
  top: calc(env(safe-area-inset-top) + 8px);
  left: 12px;
  right: 12px;
  z-index: 10;
  border-radius: 22px;
  background: ${CARD.bg};
  color: ${CARD.text};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  overflow: hidden;
`;

const GuideHead = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 12px 12px 14px;
`;

const DirTile = styled.div`
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const GuideText = styled.div`
  flex: 1;
  min-width: 0;
  small {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: ${CARD.sub};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  b {
    display: block;
    font-size: 22px;
    line-height: 1.25;
    font-weight: 700;
    letter-spacing: -0.3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const RoundBtn = styled.button`
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid ${CARD.line};
  background: transparent;
  color: #c9cfd8;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const GuideNote = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 14px 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
  color: ${CARD.sub};
  i {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: ${({ $dot }) => $dot || CARD.sub};
  }
`;

const Video = styled.div`
  position: relative;
  margin: 0 12px 12px;
  border-radius: 14px;
  overflow: hidden;
`;

const BackToAuto = styled.button`
  position: absolute;
  right: 10px;
  bottom: 30px;
  z-index: 3;
  min-height: 40px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryText};
  font-size: 14px;
  font-weight: 800;
`;

const None = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 12px 12px;
  padding: 12px 2px 2px;
  border-top: 1px solid ${CARD.line};
  > svg {
    flex: none;
    color: ${CARD.muted};
  }
  > div {
    flex: 1;
    min-width: 0;
  }
  b {
    display: block;
    font-size: 14px;
    font-weight: 600;
  }
  small {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-line;
    color: ${CARD.sub};
  }
  em {
    flex: none;
    font-style: normal;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    text-align: right;
    color: ${CARD.sub};
    font-variant-numeric: tabular-nums;
  }
`;

const Progress = styled.div`
  margin-top: 7px;
  height: 3px;
  border-radius: 2px;
  background: ${CARD.line};
  overflow: hidden;
  > div {
    height: 100%;
    background: ${({ theme }) => theme.colors.primary};
    transition: width 1s linear;
  }
`;

/* ── 지도 위 띄운 버튼 ── */
const SideBtns = styled.div`
  position: absolute;
  right: 12px;
  z-index: 6;
`;

const PillBtn = styled.button`
  height: 48px;
  padding: 0 14px;
  border-radius: 24px;
  border: none;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.float};
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Speed = styled.div`
  position: absolute;
  left: 12px;
  z-index: 6;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.float};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  b {
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 28px;
    line-height: 1;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textStrong};
  }
  small {
    margin-top: 3px;
    font-size: 10px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

/* ── 맨 아래 목적지 바 ── */
const BottomBar = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 8;
  padding: 14px 12px calc(env(safe-area-inset-bottom) + 14px);
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
`;

const DestBtn = styled.div`
  display: flex;
  align-items: center;
  min-height: 56px;
  border-radius: 16px;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  > button:first-child {
    flex: 1;
    min-width: 0;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    border: none;
    background: transparent;
    text-align: left;
  }
  > button:first-child > svg {
    flex: none;
    color: ${({ theme }) => theme.colors.primary};
  }
  b {
    display: block;
    font-size: 16px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textStrong};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  > button + button {
    flex: none;
    min-height: 48px;
    padding: 0 14px;
    border: none;
    background: transparent;
    font-size: 14px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

/* ── 목록 시트 ── */
const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(10, 14, 20, 0.4);
`;

const Sheet = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 21;
  max-height: 72%;
  display: flex;
  flex-direction: column;
  padding: 10px 0 calc(env(safe-area-inset-bottom) + 16px);
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 24px 24px 0 0;
  > i {
    display: block;
    width: 36px;
    height: 4px;
    margin: 0 auto 14px;
    border-radius: 2px;
    background: ${({ theme }) => theme.colors.border};
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0 20px 6px;
    b {
      font-size: 19px;
      font-weight: 700;
    }
    small {
      font-size: 13px;
      color: ${({ theme }) => theme.colors.textWeak};
    }
  }
  > div {
    overflow-y: auto;
  }
`;

export default function DrivePage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { dataNoticeSeen, setDataNoticeSeen, setDestination } = useFlow();
  const { scenario, reportFlow } = useScenario();

  const loc = useLocationStream(true);
  // 목업 시뮬레이션은 도로를 안다. 그 밖(실제 GPS·경로 주행)은 표준노드링크로 맵매칭해 지금 도로와 앞쪽 길을 구한다.
  const sim = scenario.source === "sim";
  const matched = useRoadMatch(loc.fix, loc.heading, !sim);
  // 매칭 도로는 표지판 표시용이다 — 노드링크 도로명은 CCTV 이름 표기([경부선] 등)와 달라 names(2차 도로명 필터)는 넣지 않는다
  const road = sim ? ROUTE_ROAD : matched.road ? { name: matched.road.name, no: matched.road.rank === 101 && matched.road.no ? Number(matched.road.no) : null } : null;
  const direction = travelDirection(loc.heading, road);
  const nav = useRoute(loc.fix, loc.heading);
  const ahead = useAheadCctvs({ fix: loc.fix, heading: loc.heading, road, nav, roadPath: matched.path });
  // 경로 주행 시뮬레이션 — 경로를 받으면 그 선을 따라 달린다
  useEffect(() => {
    if (scenario.source === "trip" && nav.route) setTripPath(nav.route.pts);
  }, [scenario.source, nav.route]);
  const routeMode = ahead.mode === "route";
  const [sheetOpen, setSheetOpen] = useState(false);

  const [listOpen, setListOpen] = useState(false); // 오른쪽 "앞쪽 N" 버튼 → CCTV 목록 시트

  // 전국 CCTV(지도 표시용) — 프록시가 100분 캐시한 목록을 30분마다 다시 받는다(ITS 호출은 프록시 캐시가 막는다)
  const [nation, setNation] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchNationCctvs({ data: scenario.data })
        .then((list) => alive && setNation(list))
        .catch((e) => console.warn("[cctv] 전국 목록을 받지 못했어요:", e.message));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [scenario.data]);
  const [extra, setExtra] = useState(null); // 지도에서 고른, 주변 목록 밖 CCTV(영상 주소 포함)
  const [activeId, setActiveId] = useState(null);
  const [failedIds, setFailedIds] = useState(() => new Set());
  const [pickedByUser, setPickedByUser] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  const items = useMemo(
    () =>
      ahead.selected.map((c) => ({
        ...c,
        // 경로 모드는 경로를 따라 남은 거리, 그 밖은 직선거리
        liveKm: routeMode && c.s != null ? Math.max(0.01, c.s - nav.s0) : loc.fix ? distanceKm(loc.fix, c) : c.km,
      })),
    [ahead.selected, loc.fix, routeMode, nav.s0]
  );

  // 바로 앞(선별 1순위부터) 영상이 나오는 CCTV
  const firstPlayable = useMemo(() => ahead.selected.find((c) => !failedIds.has(c.id)) || null, [ahead.selected, failedIds]);

  // 자동 모드: 늘 바로 앞 CCTV 를 튼다(지나치면 다음 것으로).
  // 지도에서 고른 CCTV(수동)는 지나치기 전까지 유지하고, 지나치거나 목록에서 사라지면 자동으로 돌아간다.
  // 지나침: 경로 모드는 behind, 부채꼴 모드는 뒤쪽(방위 차 90° 넘음) — 옆 도로 CCTV 를 골라 둔 건 유지한다.
  useEffect(() => {
    const picked = pickedByUser ? ahead.all.find((c) => c.id === activeId) || (extra?.id === activeId ? extra : null) : null;
    const passed = picked && picked.status === "behind" && (picked.diff == null || Math.abs(picked.diff) > 90);
    if (picked && !passed) return;
    const nextId = firstPlayable ? firstPlayable.id : null;
    if (nextId !== activeId) setActiveId(nextId);
    if (pickedByUser) setPickedByUser(false);
  }, [ahead.all, firstPlayable, activeId, pickedByUser, extra]);

  // 첫 선별 이후의 재선별은 흐름 9단계(자동 갱신)로 잠깐 표시
  const firstRefreshRef = useRef(0);
  useEffect(() => {
    if (!ahead.refreshedAt) return undefined;
    if (!firstRefreshRef.current) {
      firstRefreshRef.current = ahead.refreshedAt;
      return undefined;
    }
    setJustRefreshed(true);
    const t = setTimeout(() => setJustRefreshed(false), 2500);
    return () => clearTimeout(t);
  }, [ahead.refreshedAt]);

  const active = useMemo(() => {
    const hit = items.find((c) => c.id === activeId);
    if (hit) return hit;
    // 지도에서 고른, 선별 밖 CCTV
    const other = ahead.all.find((c) => c.id === activeId) || (extra?.id === activeId ? extra : null);
    return other ? { ...other, liveKm: loc.fix ? distanceKm(loc.fix, other) : other.km } : null;
  }, [items, ahead.all, activeId, loc.fix, extra]);

  // 첫 재생 때 한 번 — 데이터 사용 안내
  useEffect(() => {
    if (!active || dataNoticeSeen) return;
    setDataNoticeSeen(true);
    showToast("모바일 데이터로 영상을 재생해요. 영상은 한 번에 하나만 재생돼요.", 4000);
  }, [active, dataNoticeSeen, setDataNoticeSeen]);

  // E5 — 재생 실패: 표시하고 다음 CCTV 로
  const handleError = useCallback(
    (cctv) => {
      const failed = new Set(failedIds).add(cctv.id);
      setFailedIds(failed);
      const idx = ahead.selected.findIndex((c) => c.id === cctv.id);
      const next = [...ahead.selected.slice(idx + 1), ...ahead.selected.slice(0, idx)].find((c) => !failed.has(c.id));
      setActiveId(next ? next.id : null);
      setPickedByUser(false);
      showToast(next ? "영상이 나오지 않아 다음 CCTV로 넘어갔어요" : "지금 볼 수 있는 영상이 없어요");
    },
    [ahead.selected, failedIds]
  );

  const select = (id, item) => {
    // 주변 목록 밖(전국 마커) — 영상 주소를 받아 온 뒤 튼다
    if (item && !ahead.all.some((c) => c.id === id)) {
      fetchCctv(id, { data: scenario.data })
        .then((c) => {
          if (!c) throw new Error("no_cctv");
          setExtra(c);
          setActiveId(c.id);
          setPickedByUser(true);
        })
        .catch(() => showToast("이 CCTV 영상을 불러오지 못했어요"));
      return;
    }
    if (failedIds.has(id)) {
      const s = new Set(failedIds);
      s.delete(id);
      setFailedIds(s);
    }
    setActiveId(id);
    // 바로 앞 CCTV 를 고르면 자동 모드 그대로
    setPickedByUser(id !== firstPlayable?.id);
  };

  const backToAuto = () => {
    setPickedByUser(false);
    setActiveId(firstPlayable ? firstPlayable.id : null);
  };

  const activeEvents = (active && ahead.eventsByCctv[active.id]) || [];
  const hasEvents = Object.keys(ahead.eventsByCctv).length > 0;
  const noHeading = !loc.fix; // 위치 자체가 아직 없음(흐름 4단계)
  const nearby = ahead.mode === "nearby";
  const empty = !noHeading && !ahead.loading && !ahead.error && items.length === 0;

  // 기능흐름도 단계 보고(개발 패널 표시용)
  useEffect(() => {
    const ex = [];
    if (loc.headingSource === "trail" || loc.headingSource === "hold" || (loc.fix && loc.heading == null)) ex.push("E3");
    if (empty) ex.push("E4");
    if (items.some((c) => failedIds.has(c.id))) ex.push("E5");
    if (ahead.stale || ahead.error) ex.push("E6");
    const step = noHeading ? 4 : ahead.loading || empty || ahead.error ? 5 : justRefreshed ? 9 : pickedByUser ? 8 : hasEvents ? 7 : 6;
    reportFlow(step, ex);
  }, [reportFlow, loc.headingSource, empty, items, failedIds, ahead.stale, ahead.error, ahead.loading, noHeading, pickedByUser, hasEvents, justRefreshed]);

  const staleSec = ahead.stale ? Math.round((Date.now() - (ahead.refreshedAt || Date.now())) / 1000) : 0;

  // ── 안내 카드 문구 ──
  const speed = loc.signalLost ? null : loc.fix?.speed;
  const onRoute = !!nav.route;
  const roadName = onRoute ? nav.road?.name : road?.name;
  const dirText = onRoute
    ? `${nav.destination.name}까지 ${nav.remainingKm != null ? nav.remainingKm.toFixed(1) : "-"}km`
    : road && direction
      ? direction === "down"
        ? road.downLabel
        : road.upLabel
      : loc.heading != null
        ? `${compassLabel(loc.heading)}으로 이동 중`
        : null;
  const guideSub = [roadName || "현재 도로 확인 중", dirText].filter(Boolean).join(" · ");
  const guideTitle = noHeading
    ? "내 위치 확인 중"
    : ahead.error
      ? "교통정보 연결 안 됨"
      : nearby
        ? "방향 확인 중"
        : active
          ? onRoute
            ? `경로 위 CCTV ${items.length}곳`
            : "앞쪽 CCTV 보는 중"
          : empty
            ? "앞쪽 CCTV 없음"
            : "CCTV 찾는 중";
  const jam = onRoute ? nav.congestion : null;
  const secs = ahead.secondsLeft ?? Math.round(AHEAD.refreshMs / 1000);
  const progress = Math.round((1 - secs / (AHEAD.refreshMs / 1000)) * 100);
  const scope = nearby ? "주변" : onRoute ? "경로 위" : "앞쪽";

  // CCTV 가 없을 때 카드 안 안내(위치 없음·서버 장애·CCTV 없음·찾는 중)
  let none = null;
  if (!active) {
    if (noHeading) none = { icon: <FiNavigation size={22} />, title: "내 위치를 확인하고 있어요", sub: "위치가 잡히면 가까운 CCTV를 바로 보여 드려요." };
    else if (ahead.error) {
      // 개발 중에는 원인을 바로 알 수 있게 — 로컬 프록시가 꺼져 있는 경우가 대부분이다
      const devHint = import.meta.env.DEV && scenario.data === "live" ? "로컬 프록시(web 폴더에서 npm run proxy)가 켜져 있는지 확인해 주세요." : "";
      none = { icon: <FiCloudOff size={22} />, title: "교통정보 서버에 연결하지 못했어요", sub: devHint, retry: true };
    } else if (empty) none = { icon: <FiVideoOff size={22} />, title: `${scope} 5km 안에 CCTV가 없어요`, sub: `또는 ${ahead.metersLeft ?? 500}m 더 가면 다시 찾아요`, retry: true };
    else none = { icon: <FiVideoOff size={22} />, title: "CCTV를 찾고 있어요", sub: "" };
  }

  // 지도가 카드·아래 바에 가리지 않는 영역 안에서 내 위치를 잡도록 높이를 잰다
  const guideRef = useRef(null);
  const barRef = useRef(null);
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const g = guideRef.current;
      const b = barRef.current;
      setInsets({ top: g ? g.offsetTop + g.offsetHeight + 8 : 0, bottom: b ? b.offsetHeight + 8 : 0 });
    };
    const ro = new ResizeObserver(measure);
    if (guideRef.current) ro.observe(guideRef.current);
    if (barRef.current) ro.observe(barRef.current);
    measure();
    return () => ro.disconnect();
  }, []);
  const sideBottom = insets.bottom + 12; // 속도·버튼은 아래 바 바로 위

  const sheet = sheetOpen ? (
    <DestinationSheet
      near={loc.fix}
      data={scenario.data}
      onClose={() => setSheetOpen(false)}
      onPick={(d) => {
        setDestination(d);
        setSheetOpen(false);
      }}
    />
  ) : null;

  return (
    <Page>
      {sheet}

      <MapLayer>
        {noHeading ? (
          <Center />
        ) : (
          <KakaoMiniMap
            fill
            insetTop={insets.top}
            insetBottom={insets.bottom}
            controlsBottom={sideBottom}
            position={loc.fix}
            heading={loc.heading}
            route={scenario.source === "sim" ? routeNodes : []}
            all={ahead.all}
            selected={ahead.selected}
            events={ahead.events}
            activeId={activeId}
            onSelect={select}
            recenterKey={ahead.refreshedAt}
            routeRoads={nav.route?.roads || (ahead.mode === "road" ? matched.path?.roads : null)}
            nation={nation}
            theme={theme}
          />
        )}
      </MapLayer>

      <Guide ref={guideRef}>
        <GuideHead>
          <DirTile aria-hidden="true">
            {nearby || noHeading ? <FiNavigation size={26} color="#fff" /> : <FiArrowUp size={30} color="#fff" strokeWidth={2.6} />}
          </DirTile>
          <GuideText>
            <small>{guideSub}</small>
            <b>{guideTitle}</b>
          </GuideText>
          <RoundBtn type="button" aria-label="앱 정보와 설정" onClick={() => navigate("/info")}>
            <FiInfo size={20} />
          </RoundBtn>
        </GuideHead>

        {jam ? (
          <GuideNote $dot={theme.colors.traffic[jam.state]} role="status">
            <i aria-hidden="true" />
            {jam.startKm < 0.1 ? "지금부터" : `${jam.startKm < 1 ? `${Math.round(jam.startKm * 10) * 100}m` : `${jam.startKm.toFixed(1)}km`} 앞부터`}{" "}
            {jam.lengthKm < 1 ? `${Math.max(100, Math.round(jam.lengthKm * 10) * 100)}m` : `${jam.lengthKm.toFixed(1)}km`} {TRAFFIC_LABEL[jam.state]}
            {jam.speed != null ? ` · 평균 ${jam.speed}km/h` : ""}
          </GuideNote>
        ) : null}
        {nearby && !noHeading ? <GuideNote role="status">아직 진행 방향을 몰라 주변 CCTV를 가까운 순으로 보여 드려요. 차가 움직이면 앞쪽 CCTV만 골라요.</GuideNote> : null}
        {ahead.stale ? <GuideNote role="status">교통정보를 새로 받지 못해 {staleSec}초 전 목록을 보여 드려요.</GuideNote> : null}

        {active ? (
          <Video>
            <CctvPlayer
              cctv={active}
              willFail={scenario.brokenFeeds && !!active?.broken}
              blocked={activeEvents.some((e) => e.type === "accident")}
              onError={handleError}
            />
            {pickedByUser && firstPlayable ? (
              <BackToAuto type="button" onClick={backToAuto}>
                <FiSkipForward size={16} aria-hidden="true" />
                바로 앞 CCTV로
              </BackToAuto>
            ) : null}
          </Video>
        ) : (
          <None role="status">
            {none.icon}
            <div>
              <b>{none.title}</b>
              {none.sub ? <small>{none.sub}</small> : null}
              {none.retry ? (
                <Progress aria-hidden="true">
                  <div style={{ width: `${progress}%` }} />
                </Progress>
              ) : null}
            </div>
            {none.retry ? (
              <em>
                {secs}초 뒤
                <br />
                다시 찾기
              </em>
            ) : null}
          </None>
        )}
      </Guide>

      {!noHeading ? (
        <>
          <Speed style={{ bottom: sideBottom }} aria-label={speed != null ? `시속 ${Math.round(speed)}킬로미터` : "속도 확인 중"}>
            <b>{speed != null ? Math.round(speed) : "--"}</b>
            <small>km/h</small>
          </Speed>
          {ahead.all.length ? (
            <SideBtns style={{ bottom: sideBottom + 58 }}>
              <PillBtn type="button" onClick={() => setListOpen(true)}>
                <FiSliders size={18} aria-hidden="true" />
                {scope} {items.length}
              </PillBtn>
            </SideBtns>
          ) : null}
        </>
      ) : null}

      <BottomBar ref={barRef}>
        <DestBtn>
          <button type="button" onClick={() => setSheetOpen(true)}>
            <FiFlag size={20} aria-hidden="true" />
            <span style={{ minWidth: 0 }}>
              <b>{nav.destination ? nav.destination.name : "목적지 넣기"}</b>
              <small>
                {!nav.destination
                  ? "선택 · 경로 위 CCTV만 정확하게 골라요"
                  : nav.status === "loading"
                    ? "경로 찾는 중"
                    : nav.status === "error"
                      ? "경로를 찾지 못해 진행 방향 기준으로 골라요"
                      : "경로 위 CCTV만 보여 드려요"}
              </small>
            </span>
          </button>
          {nav.destination ? (
            <button type="button" onClick={() => setDestination(null)}>
              취소
            </button>
          ) : null}
        </DestBtn>
      </BottomBar>

      {listOpen ? (
        <>
          <Backdrop onClick={() => setListOpen(false)} />
          <Sheet role="dialog" aria-label={`${scope} CCTV 목록`}>
            <i aria-hidden="true" />
            <header>
              <b>{scope} CCTV</b>
              <small>가까운 순</small>
            </header>
            <div>
              <CctvStrip
                hereLabel={scenario.source === "sim" ? loc.fix?.near : null}
                items={items}
                activeId={activeId}
                failedIds={failedIds}
                eventsByCctv={ahead.eventsByCctv}
                onSelect={(id) => {
                  select(id);
                  setListOpen(false);
                }}
                nearby={nearby}
              />
            </div>
          </Sheet>
        </>
      ) : null}
    </Page>
  );
}
