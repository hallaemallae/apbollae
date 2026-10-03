// 흐름 4~9 — 메인 화면: 영상 + 방향 표지 + 가까운 순 CCTV 목록(또는 미니맵).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { useTheme } from "styled-components";
import { FiInfo, FiNavigation, FiVideoOff, FiCloudOff, FiFlag, FiX } from "react-icons/fi";
import CctvPlayer from "../components/drive/CctvPlayer";
import GuideSign from "../components/drive/GuideSign";
import CctvStrip from "../components/drive/CctvStrip";
import KakaoMiniMap from "../components/drive/KakaoMiniMap";
import EmptyState from "../components/common/EmptyState";
import useLocationStream from "../hooks/useLocationStream";
import useAheadCctvs from "../hooks/useAheadCctvs";
import useRoute from "../hooks/useRoute";
import DestinationSheet from "../components/drive/DestinationSheet";
import { useFlow } from "../context/FlowContext";
import { useScenario } from "../context/ScenarioContext";
import { ROUTE_ROAD } from "../mock/route";
import { routeNodes } from "../services/simulator";
import { distanceKm, travelDirection } from "../utils/aheadFilter";
import { showToast } from "../utils/toast";

const Page = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  min-height: 100%;
  display: flex;
  flex-direction: column;
`;

const Sticky = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
  background: ${({ theme }) => theme.colors.bg};
  padding-top: env(safe-area-inset-top);
`;

const Bar = styled.header`
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px 0 16px;
`;

const Word = styled.span`
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.04em;
  img {
    width: 30px;
    height: 30px;
    border-radius: 8px;
  }
`;

const IconBtn = styled.button`
  width: 48px;
  height: 48px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const DestRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 12px 16px 0;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  > button:first-child {
    flex: 1;
    min-width: 0;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border: none;
    background: transparent;
    text-align: left;
    font-size: 15px;
    font-weight: 700;
  }
  > button:first-child svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.lane};
  }
  small {
    display: block;
    font-size: 12.5px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  > button + button {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.textWeak};
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const Tabs = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 14px 16px 6px;
  padding: 4px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surface};
`;

const Tab = styled.button`
  min-height: 42px;
  border: none;
  border-radius: 9px;
  font-size: 15px;
  font-weight: 700;
  background: ${({ theme, $on }) => ($on ? theme.colors.raised : "transparent")};
  color: ${({ theme, $on }) => ($on ? theme.colors.textStrong : theme.colors.textWeak)};
  box-shadow: ${({ $on }) => ($on ? "0 1px 3px rgba(0,0,0,0.25)" : "none")};
`;

const Warn = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin: 12px 16px 0;
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surface};
  border-left: 4px solid ${({ theme }) => theme.colors.work};
  font-size: 14px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textNormal};
  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${({ theme }) => theme.colors.work};
  }
`;

const Refresh = styled.p`
  margin: 0;
  padding: 6px 16px calc(env(safe-area-inset-bottom) + 84px);
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  font-variant-numeric: tabular-nums;
`;

export default function DrivePage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { dataNoticeSeen, setDataNoticeSeen, setDestination } = useFlow();
  const { scenario, reportFlow } = useScenario();

  const loc = useLocationStream(true);
  // 시뮬레이션은 도로를 안다. 실제 GPS 는 표준노드링크 매칭 전까지 도로를 모른다(2차 도로 필터 생략).
  const road = scenario.source === "sim" ? ROUTE_ROAD : null;
  const direction = travelDirection(loc.heading, road);
  const nav = useRoute(loc.fix, loc.heading);
  const ahead = useAheadCctvs({ fix: loc.fix, heading: loc.heading, road, nav });
  const routeMode = ahead.mode === "route";
  const [sheetOpen, setSheetOpen] = useState(false);

  const [view, setView] = useState("list");
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

  // 재선별되면 재생 중인 CCTV 가 목록에 남아 있는지 보고, 없으면 영상이 나오는 가장 가까운 것으로
  useEffect(() => {
    if (ahead.selected.some((c) => c.id === activeId)) return;
    const next = ahead.selected.find((c) => !failedIds.has(c.id));
    setActiveId(next ? next.id : null);
    setPickedByUser(false);
  }, [ahead.selected, activeId, failedIds]);

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

  const active = items.find((c) => c.id === activeId) || null;

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
      showToast(next ? "영상이 나오지 않아 다음 CCTV로 넘어갔어요" : "지금 볼 수 있는 영상이 없어요");
    },
    [ahead.selected, failedIds]
  );

  const select = (id) => {
    if (failedIds.has(id)) {
      const s = new Set(failedIds);
      s.delete(id);
      setFailedIds(s);
    }
    setActiveId(id);
    setPickedByUser(true);
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

  let body;
  if (noHeading) {
    body = <EmptyState icon={<FiNavigation />} text="내 위치를 확인하고 있어요" sub="위치가 잡히면 가까운 CCTV를 바로 보여 드려요." />;
  } else if (ahead.error) {
    // 개발 중에는 원인을 바로 알 수 있게 — 로컬 프록시가 꺼져 있는 경우가 대부분이다
    const devHint = import.meta.env.DEV && scenario.data === "live" ? "\n로컬 프록시(web 폴더에서 npm run proxy)가 켜져 있는지 확인해 주세요." : "";
    body = <EmptyState icon={<FiCloudOff />} text="교통정보 서버에 연결하지 못했어요" sub={`${ahead.secondsLeft ?? 30}초 뒤에 다시 시도해요.${devHint}`} />;
  } else if (empty) {
    body = (
      <EmptyState
        icon={<FiVideoOff />}
        text={nearby ? "주변 5km 안에 CCTV가 없어요" : "앞쪽 5km 안에 CCTV가 없어요"}
        sub={`조금 더 가면 다시 찾아볼게요.\n${ahead.secondsLeft ?? 30}초 뒤 또는 ${ahead.metersLeft ?? 500}m 이동 후`}
      />
    );
  } else if (view === "map") {
    body = (
      <KakaoMiniMap
        position={loc.fix}
        heading={loc.heading}
        route={scenario.source === "sim" ? routeNodes : []}
        all={ahead.all}
        selected={ahead.selected}
        events={ahead.events}
        activeId={activeId}
        onSelect={select}
        recenterKey={ahead.refreshedAt}
        routeRoads={nav.route?.roads}
        theme={theme}
      />
    );
  } else {
    body = (
      <CctvStrip
        hereLabel={scenario.source === "sim" ? loc.fix?.near : null}
        items={items}
        activeId={activeId}
        failedIds={failedIds}
        eventsByCctv={ahead.eventsByCctv}
        onSelect={select}
        nearby={nearby}
      />
    );
  }
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
      <Sticky>
        <Bar>
          <Word>
            <img src="/logo-192.png" alt="" />
            앞볼래
          </Word>
          <IconBtn type="button" aria-label="앱 정보와 설정" onClick={() => navigate("/info")}>
            <FiInfo size={22} />
          </IconBtn>
        </Bar>
        <CctvPlayer
          cctv={active}
          willFail={scenario.brokenFeeds && !!active?.broken}
          blocked={activeEvents.some((e) => e.type === "accident")}
          onError={handleError}
        />
        <GuideSign road={road} direction={direction} heading={loc.heading} headingSource={loc.headingSource} speed={loc.signalLost ? null : loc.fix?.speed} nav={nav} />
      </Sticky>

      {!noHeading ? (
        <DestRow>
          <button type="button" onClick={() => setSheetOpen(true)}>
            <FiFlag size={20} aria-hidden="true" />
            <span>
              {nav.destination ? (
                <>
                  {nav.destination.name}
                  <small>
                    {nav.status === "loading"
                      ? "경로 찾는 중"
                      : nav.status === "error"
                        ? "경로를 찾지 못해 진행 방향 기준으로 골라요 · 눌러서 바꾸기"
                        : `남은 거리 ${nav.remainingKm != null ? nav.remainingKm.toFixed(1) : "-"}km · 경로 위 CCTV만 골라요`}
                  </small>
                </>
              ) : (
                <>
                  목적지 넣기
                  <small>경로 위 CCTV만 더 정확하게 골라요 (선택)</small>
                </>
              )}
            </span>
          </button>
          {nav.destination ? (
            <button type="button" aria-label="목적지 지우기" onClick={() => setDestination(null)}>
              <FiX size={20} />
            </button>
          ) : null}
        </DestRow>
      ) : null}

      {nearby && !noHeading ? (
        <Warn role="status">
          <FiNavigation size={18} />
          아직 진행 방향을 몰라 주변 CCTV를 가까운 순으로 보여 드려요. 차가 움직이면 앞쪽 CCTV만 골라요.
        </Warn>
      ) : null}

      {ahead.stale ? (
        <Warn role="status">
          <FiCloudOff size={18} />
          교통정보를 새로 받지 못했어요. {staleSec}초 전에 받은 목록을 보여 드려요.
        </Warn>
      ) : null}

      {!noHeading && !ahead.error ? (
        <Tabs role="tablist">
          <Tab type="button" role="tab" aria-selected={view === "list"} $on={view === "list"} onClick={() => setView("list")}>
            목록
          </Tab>
          <Tab type="button" role="tab" aria-selected={view === "map"} $on={view === "map"} onClick={() => setView("map")}>
            지도
          </Tab>
        </Tabs>
      ) : null}

      {body}

      {!noHeading && ahead.secondsLeft != null ? (
        <Refresh>
          {ahead.secondsLeft}초 뒤 또는 {ahead.metersLeft}m 더 가면 {nearby ? "주변" : routeMode ? "경로 앞" : "앞쪽"} CCTV를 다시 찾아요.
        </Refresh>
      ) : null}
    </Page>
  );
}
