// 흐름 4~9 — 메인 화면(Claude Design "앞볼래 메인", 카카오내비 벤치마킹).
//  - 카카오 지도가 화면 전체를 채우고 내 위치를 따라간다. 주변 CCTV 가 모두 마커로 뜬다(누르면 그 영상).
//  - 위: 어두운 안내 카드 — 지금 도로·방향, 그 아래 바로 앞 CCTV 영상(없으면 "다시 찾기" 진행 막대).
//  - 왼쪽 아래 속도, 오른쪽 아래 "앞쪽 N"(목록 시트)·내 위치 버튼, 맨 아래 목적지 바.
//  - 옅은 색 면은 쓰지 않는다(흰 면 + 테두리, 어두운 카드 위에서는 구분선만).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import { FiFastForward, FiShare2, FiSearch, FiNavigation, FiCloudOff, FiFlag, FiSkipForward, FiSliders, FiVideoOff, FiChevronLeft, FiChevronRight, FiMaximize2, FiX } from "react-icons/fi";
import CctvPlayer from "../components/drive/CctvPlayer";
import CctvStrip from "../components/drive/CctvStrip";
import KakaoMiniMap from "../components/drive/KakaoMiniMap";
import useLocationStream from "../hooks/useLocationStream";
import useAheadCctvs from "../hooks/useAheadCctvs";
import useRoute from "../hooks/useRoute";
import useRoadMatch from "../hooks/useRoadMatch";
import DestinationSheet from "../components/drive/DestinationSheet";
import RecordSheet from "../components/drive/RecordSheet";
import DriverView from "../components/drive/DriverView";
import useProbeRoute from "../hooks/useProbeRoute";
import useTripRecorder from "../hooks/useTripRecorder";
import useWeather from "../hooks/useWeather";
import { captureFrame, shareImage } from "../utils/shareFrame";
import { buildSummary, eventsAhead, findJamEndCctv, jamAhead } from "../utils/situation";
import { useFlow } from "../context/FlowContext";
import { useDrivePublish } from "../context/DriveDataContext";
import { useScenario } from "../context/ScenarioContext";
import { ROUTE_ROAD } from "../mock/route";
import { routeNodes, setTripPath } from "../services/simulator";
import { applyReviewTripJump } from "../dev/reviewMock";
import { distanceKm, AHEAD, formatDistance, angleDiff, bearingDeg, travelDirection } from "../utils/aheadFilter";
import { locate, ROUTE_OPTS, TRAFFIC_LABEL } from "../utils/routeFilter";
import { showToast } from "../utils/toast";
import { fetchCctv, fetchNationCctvs } from "../services/itsApi";

// 안내 카드 색은 theme.colors.guide — 낮에는 어두운 카드, 밤에는 지도보다 한 단계 밝은 남색 카드

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
// 위 CCTV 카드 — 머리글 없이 영상과 조작 줄만(이름·실시간·시각은 영상 안에 있다)
const Guide = styled.div`
  position: absolute;
  top: calc(env(safe-area-inset-top) + 8px);
  left: 8px;
  right: 8px;
  z-index: 10;
  border-radius: 18px;
  color: ${({ theme }) => theme.colors.guide.text};
  /* 영상이 있으면 카드 면 없이(투명) 영상만 띄운다 — 아래 글자·아이콘은 지도 위에서 읽히게 어두운 그림자.
     영상이 없을 때(위치 확인·CCTV 없음·서버 장애 안내)는 글이 길어 카드 면을 둔다. */
  ${({ theme, $clear }) =>
    $clear
      ? `
    background: transparent;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75), 0 0 8px rgba(0, 0, 0, 0.55);
    svg { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7)); }
  `
      : `
    background: ${theme.colors.guide.bg};
    border: 1px solid ${theme.colors.guide.border};
    box-shadow: ${theme.mode === "dark" ? "0 12px 30px rgba(0, 0, 0, 0.6)" : "0 8px 24px rgba(0, 0, 0, 0.22)"};
    overflow: hidden;
  `}
`;

const GuideNote = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 14px 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.guide.sub};
  i {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: ${({ $dot, theme }) => $dot || theme.colors.guide.sub};
  }
`;

const Video = styled.div`
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  text-shadow: none;
  /* 전체 화면 — 같은 플레이어를 그대로 키운다(다시 연결하지 않음) */
  ${({ $full }) =>
    $full &&
    `
    position: fixed;
    inset: 0;
    z-index: 40;
    margin: 0;
    border-radius: 0;
    box-shadow: none;
    background: #000;
  `}
`;

// 영상 칸 위 띄운 조작 — 반투명 검정 원(영상 위에서 늘 보이게)
const OverlayBtn = styled.button`
  position: absolute;
  z-index: 3;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  &:disabled {
    opacity: 0.3;
  }
`;

// "1.6km 앞 · 약 1분 후 통과" — 지금 영상이 언제 다음 CCTV 로 바뀌는지
const Eta = styled.div`
  position: absolute;
  left: 10px;
  top: ${({ $full }) => ($full ? "calc(env(safe-area-inset-top) + 44px)" : "38px")};
  z-index: 3;
  max-width: calc(100% - 20px);
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: ${({ $full }) => ($full ? 15 : 13)}px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  b {
    color: ${({ theme }) => theme.colors.lane};
  }
  small {
    margin-left: 6px;
    font-size: 12px;
    font-weight: 600;
    opacity: 0.75;
  }
`;

const BackToAuto = styled.button`
  position: absolute;
  right: 10px;
  top: 40px;
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

// ① 원인 한 줄 요약 띠 — 누르면 ③ 운전자에게 보여 주기, 오른쪽은 ② 정체 끝 CCTV
const SummaryBar = styled.div`
  display: flex;
  align-items: stretch;
  gap: 6px;
  margin: 2px 0 0;
  padding: 4px;
  /* 박스 없이 글자만 — 위 Guide 의 어두운 글자 그림자를 그대로 물려받아 지도 위에서 읽힌다 */
  background: transparent;
  > button {
    border: none;
    font-family: inherit;
    text-align: left;
    color: inherit;
  }
  > button:first-child {
    flex: 1;
    min-width: 0;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 12px;
    background: transparent;
  }
  i {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ $tone }) => $tone};
  }
  b {
    display: block;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  small {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.88);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  > button + button {
    flex: none;
    width: 76px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border-radius: 12px;
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    line-height: 1.25;
  }
`;

// 몇 번째 CCTV 인지 — 영상 아래쪽 가운데(시각·출처 줄 바로 위)
const Dots = styled.span`
  position: absolute;
  left: 50%;
  bottom: 30px;
  z-index: 3;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  pointer-events: none;
  i {
    height: 6px;
    width: 6px;
    border-radius: 3px;
    background: ${({ theme }) => theme.colors.dotOff};
    box-shadow: 0 0 3px rgba(0, 0, 0, 0.6);
    transition: width 0.2s ease;
  }
  i[data-on="true"] {
    width: 16px;
    background: #fff;
  }
`;

const None = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 12px;
  padding: 14px 2px;
  > svg {
    flex: none;
    color: ${({ theme }) => theme.colors.guide.muted};
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
    color: ${({ theme }) => theme.colors.guide.sub};
  }
  em {
    flex: none;
    font-style: normal;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    text-align: right;
    color: ${({ theme }) => theme.colors.guide.sub};
    font-variant-numeric: tabular-nums;
  }
`;

const Progress = styled.div`
  margin-top: 7px;
  height: 3px;
  border-radius: 2px;
  background: ${({ theme }) => theme.colors.guide.line};
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
  /* 밤에는 그림자가 안 보여 얇은 선으로 지도와 가른다 */
  border: ${({ theme }) => (theme.mode === "dark" ? `1px solid ${theme.colors.border}` : "none")};
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
  /* 배경 카드 없이 숫자만 — 지도 위에서 읽히게 반대색 테두리(halo) */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  --halo: ${({ theme }) => (theme.mode === "dark" ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 255, 255, 0.95)")};
  text-shadow: 0 0 2px var(--halo), 0 0 6px var(--halo), 0 0 10px var(--halo);
  b {
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 34px;
    line-height: 1;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textStrong};
  }
  small {
    margin-top: 2px;
    font-size: 11px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textNormal};
  }
`;

/* ── 맨 아래 목적지 바 ── */
const BottomBar = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 8;
  padding: 12px; /* 아래 안전 영역은 탭바가 맡는다 */
  /* 배경 면 없이 목적지 카드만 지도 위에 띄운다 */
  pointer-events: none;
  > * {
    pointer-events: auto;
  }
`;

// 목적지 검색창 — 카카오내비 첫 화면 검색창처럼: 돋보기 + "어디로 가세요?". 누르면 장소 검색 시트.
// 목적지가 있으면 같은 자리에 목적지 이름·남은 거리, 오른쪽 X 로 취소 — 이때는 카드 면 없이 글자만 띄운다.
const SearchBar = styled.div`
  display: flex;
  align-items: center;
  min-height: 54px;
  border-radius: 14px;
  /* 검색 전에는 입력창 카드, 목적지를 고르면 카드 면 없이 글자만 — 속도 숫자처럼 반대색 테두리(halo)로 지도 위에서 읽히게 */
  ${({ theme, $set }) =>
    $set
      ? `
    --halo: ${theme.mode === "dark" ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 255, 255, 0.95)"};
    text-shadow: 0 0 2px var(--halo), 0 0 6px var(--halo), 0 0 10px var(--halo);
    svg { filter: drop-shadow(0 0 2px var(--halo)) drop-shadow(0 0 4px var(--halo)); }
  `
      : `
    background: ${theme.colors.surface};
    border: 1px solid ${theme.mode === "dark" ? theme.colors.border : "#E8EAEF"};
    box-shadow: ${theme.mode === "dark" ? "0 6px 16px rgba(0, 0, 0, 0.4)" : "0 6px 16px rgba(15, 23, 42, 0.12)"};
  `}
  > button:first-child {
    flex: 1;
    min-width: 0;
    min-height: 54px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 8px 0 16px;
    border: none;
    background: transparent;
    font-family: inherit;
    text-align: left;
  }
  > button:first-child > svg {
    flex: none;
    color: ${({ theme, $set }) => ($set ? theme.colors.primary : theme.colors.textStrong)};
  }
  .ph {
    font-size: 17px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
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
    margin-top: 1px;
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textNormal};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  > button + button {
    flex: none;
    width: 48px;
    height: 48px;
    margin-right: 3px;
    border: none;
    border-radius: 50%;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textStrong};
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

const SUMMARY_TONE = {
  accident: (t) => t.colors.accident,
  work: (t) => t.colors.work,
  control: (t) => t.colors.control,
  jam: (t) => t.colors.traffic.jam,
  clear: (t) => t.colors.traffic.smooth,
  unknown: (t) => t.colors.textWeak,
};

/** visible: 홈 탭이 보이는 중인가(다른 탭이면 숨긴 채 계산만 계속하고 영상은 내린다) */
export default function DrivePage({ visible = true }) {
  const theme = useTheme();
  const { dataNoticeSeen, setDataNoticeSeen, setDestination } = useFlow();
  const { scenario, reportFlow } = useScenario();

  const loc = useLocationStream(true);
  // 목업 시뮬레이션은 도로를 안다. 그 밖(실제 GPS·경로 주행)은 표준노드링크로 맵매칭해 지금 도로와 앞쪽 길을 구한다.
  const sim = scenario.source === "sim";
  const matched = useRoadMatch(loc.fix, loc.heading, !sim);
  // 매칭 도로는 표지판 표시용이다 — 노드링크 도로명은 CCTV 이름 표기([경부선] 등)와 달라 names(2차 도로명 필터)는 넣지 않는다
  const road = sim ? ROUTE_ROAD : matched.road ? { name: matched.road.name, no: matched.road.rank === 101 && matched.road.no ? Number(matched.road.no) : null } : null;
  const nav = useRoute(loc.fix, loc.heading);
  const ahead = useAheadCctvs({ fix: loc.fix, heading: loc.heading, road, nav, roadPath: matched.path });
  // 앞 구간 소통 — 목적지 경로가 있으면 그것, 없으면 앞 몇 km 임시 경로(카카오 길찾기)
  const probe = useProbeRoute({ fix: loc.fix, heading: loc.heading, path: matched.path, enabled: !nav.route && !!loc.fix, data: scenario.data });
  const traffic = useMemo(() => (nav.route ? { route: nav.route, s0: nav.s0 } : probe), [nav.route, nav.s0, probe]);
  const direction = travelDirection(loc.heading, road);
  const [driverView, setDriverView] = useState(false); // ③ 운전자에게 보여 주기
  // 경로 주행 시뮬레이션 — 경로를 받으면 그 선을 따라 달린다
  useEffect(() => {
    if (scenario.source === "trip" && nav.route) {
      setTripPath(nav.route.pts);
      applyReviewTripJump();
    }
  }, [scenario.source, nav.route]);
  const routeMode = ahead.mode === "route";
  const [sheetOpen, setSheetOpen] = useState(false);

  const [listOpen, setListOpen] = useState(false); // 오른쪽 "앞쪽 N" 버튼 → CCTV 목록 시트
  const [record, setRecord] = useState(null); // 기록 시트를 연 순간의 선별 결과

  // 전체 화면 — 영상을 누르면 켜지고, 폰을 가로로 돌리면 자동으로 켜진다(닫으면 다시 돌릴 때까지 세로 화면)
  const [fullTap, setFullTap] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [landDismissed, setLandDismissed] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    // 폰 가로(높이가 낮은 가로 화면)만 — PC 의 넓은 창은 해당하지 않게
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 540px)");
    const on = () => {
      setLandscape(mq.matches);
      setLandDismissed(false);
    };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

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

  // 목적지가 있으면 지도에도 경로 위 CCTV 만 — 전국 목록에서 경로 선 가까이 있는 것을 경로 거리(s)와 함께 한 번 구해 둔다
  const routeNation = useMemo(() => {
    if (!nav.route || !nation) return null;
    const pad = ROUTE_OPTS.onRouteKm / 100; // 위경도 여유(넉넉히)
    let n = -90, s = 90, e = -180, w = 180;
    nav.route.pts.forEach((p) => {
      n = Math.max(n, p.lat); s = Math.min(s, p.lat); e = Math.max(e, p.lng); w = Math.min(w, p.lng);
    });
    return nation
      .filter((c) => c.lat < n + pad && c.lat > s - pad && c.lng < e + pad && c.lng > w - pad)
      .map((c) => ({ c, at: locate(nav.route, c) }))
      .filter(({ at }) => at.offKm <= ROUTE_OPTS.onRouteKm)
      .map(({ c, at }) => ({ ...c, s: at.s }));
  }, [nav.route, nation]);
  // 지나온 것은 빼고, 경로 밖·반대 방향 CCTV 도 지도에서 뺀다
  const mapNation = routeNation ? routeNation.filter((c) => c.s > nav.s0) : routeMode ? null : nation;
  const mapAll = useMemo(
    () => (routeMode ? ahead.all.filter((c) => c.status === "ahead" || c.status === "far") : ahead.all),
    [routeMode, ahead.all]
  );
  const [extra, setExtra] = useState(null); // 지도에서 고른, 주변 목록 밖 CCTV(영상 주소 포함)
  const [activeId, setActiveId] = useState(null);
  const [failedIds, setFailedIds] = useState(() => new Set());
  const [pickedByUser, setPickedByUser] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  // 지나침 판정 — 목록은 30초·500m 마다만 다시 고르므로, 그 사이에 지나친 CCTV 는 위치가 들어올 때마다 여기서 뺀다.
  //  경로 모드: 경로를 따라 남은 거리가 0 이하. 그 밖: 300m 안에서 내 진행 방향 뒤쪽(방위 차 90° 넘음).
  const isPassed = useCallback(
    (c) => {
      if (!loc.fix) return false;
      if (routeMode && c.s != null) return c.s - nav.s0 <= 0;
      if (loc.heading == null) return false;
      return distanceKm(loc.fix, c) < 0.3 && Math.abs(angleDiff(bearingDeg(loc.fix, c), loc.heading)) > 90;
    },
    [loc.fix, loc.heading, routeMode, nav.s0]
  );
  // 한 번 지나친 CCTV 는 다음 재선별까지 계속 뺀다(GPS 흔들림으로 다시 나타나지 않게)
  const [passedIds, setPassedIds] = useState(() => new Set());
  useEffect(() => setPassedIds(new Set()), [ahead.refreshedAt]);
  useEffect(() => {
    if (ahead.mode === "nearby") return;
    const fresh = ahead.selected.filter((c) => !passedIds.has(c.id) && isPassed(c));
    if (!fresh.length) return;
    setPassedIds((s) => new Set([...s, ...fresh.map((c) => c.id)]));
    ahead.refresh(); // 지나쳤으니 바로 다시 골라 뒤에 있던 CCTV 를 목록에 채운다
  }, [ahead.selected, ahead.mode, ahead.refresh, passedIds, isPassed]);

  const items = useMemo(
    () =>
      ahead.selected
        .filter((c) => !passedIds.has(c.id))
        .map((c) => ({
          ...c,
          // 경로 모드는 경로를 따라 남은 거리, 그 밖은 직선거리
          liveKm: routeMode && c.s != null ? Math.max(0.01, c.s - nav.s0) : loc.fix ? distanceKm(loc.fix, c) : c.km,
        })),
    [ahead.selected, passedIds, loc.fix, routeMode, nav.s0]
  );

  // 바로 앞(지나치지 않은 1순위부터) 영상이 나오는 CCTV
  const firstPlayable = useMemo(() => items.find((c) => !failedIds.has(c.id)) || null, [items, failedIds]);

  // 자동 모드: 늘 바로 앞 CCTV 를 튼다(지나치면 다음 것으로).
  // 지도에서 고른 CCTV(수동)는 지나치기 전까지 유지하고, 지나치거나 목록에서 사라지면 자동으로 돌아간다.
  // 지나침: 경로 모드는 behind, 부채꼴 모드는 뒤쪽(방위 차 90° 넘음) — 옆 도로 CCTV 를 골라 둔 건 유지한다.
  useEffect(() => {
    const picked = pickedByUser ? ahead.all.find((c) => c.id === activeId) || (extra?.id === activeId ? extra : null) : null;
    const passed = picked && ((picked.status === "behind" && (picked.diff == null || Math.abs(picked.diff) > 90)) || passedIds.has(picked.id) || isPassed(picked));
    if (picked && !passed) return;
    const nextId = firstPlayable ? firstPlayable.id : null;
    if (nextId !== activeId) setActiveId(nextId);
    if (pickedByUser) setPickedByUser(false);
  }, [ahead.all, firstPlayable, activeId, pickedByUser, extra, passedIds, isPassed]);

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

  const full = visible && !!active && (fullTap || (landscape && !landDismissed));
  const closeFull = useCallback(() => {
    setFullTap(false);
    setLandDismissed(true);
  }, []);
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => e.key === "Escape" && closeFull();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full, closeFull]);

  // 지금 영상을 언제 지나치는지(지나치면 자동으로 다음 CCTV) — 거리 ÷ 지금 속도
  const eta = useMemo(() => {
    if (!active || active.liveKm == null) return null;
    const d = formatDistance(active.liveKm);
    const dist = `${d.value}${d.unit}`;
    // 주변 모드·지도에서 고른 옆 도로 CCTV 는 지나칠 시각을 말할 수 없다
    if (ahead.mode === "nearby" || !items.some((c) => c.id === active.id)) return { dist, label: "거리", when: null };
    const v = loc.signalLost ? null : loc.fix?.speed;
    if (v == null || v < 5) return { dist, label: "앞", when: "정차 중" };
    const sec = (active.liveKm / v) * 3600;
    const when = sec < 15 ? "곧 통과" : sec < 55 ? `약 ${Math.round(sec / 10) * 10}초 후 통과` : `약 ${Math.max(1, Math.round(sec / 60))}분 후 통과`;
    return { dist, label: "앞", when };
  }, [active, items, ahead.mode, loc.fix, loc.signalLost]);

  // 다른 CCTV 로 전환 — 고른 목록(가까운 순) 안에서 앞뒤로, 영상 없는 CCTV 는 건너뛴다
  const playable = items.filter((c) => !failedIds.has(c.id));
  const activeIdx = playable.findIndex((c) => c.id === activeId);
  const step = (dir) => {
    if (!playable.length) return;
    const i = activeIdx < 0 ? (dir > 0 ? 0 : playable.length - 1) : (activeIdx + dir + playable.length) % playable.length;
    select(playable[i].id);
  };
  const canStep = playable.length > (activeIdx < 0 ? 0 : 1);

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
      const idx = items.findIndex((c) => c.id === cctv.id);
      const next = [...items.slice(idx + 1), ...items.slice(0, idx)].find((c) => !failed.has(c.id));
      setActiveId(next ? next.id : null);
      setPickedByUser(false);
      showToast(next ? "영상이 나오지 않아 다음 CCTV로 넘어갔어요" : "지금 볼 수 있는 영상이 없어요");
    },
    [items, failedIds]
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

  // 정확도 기록 — 누른 순간의 선별 결과를 얼려 시트로 넘긴다(시트가 열린 동안 갱신돼도 판정 대상은 그대로)
  const openRecord = () =>
    setRecord({
      t: Date.now(),
      lat: loc.fix?.lat,
      lng: loc.fix?.lng,
      heading: loc.heading,
      headingSource: loc.headingSource || null,
      speed: loc.fix?.speed ?? null,
      mode: ahead.mode,
      road: (nav.route ? nav.road?.name : road?.name) || "",
      destination: nav.destination?.name || "",
      items: items.map((c) => ({ id: c.id, name: c.name, source: c.source || "", km: c.liveKm })),
    });
  // ⑦ 지금 장면을 이미지로 공유(카톡 등) — 원인 요약과 출처를 얹는다
  const videoRef = useRef(null);
  const shareScene = async () => {
    try {
      const blob = await captureFrame(videoRef.current, { cctv: active, summary });
      const r = await shareImage(blob, `${active?.name || "CCTV"} — ${summary.title}`);
      if (r === "downloaded") showToast("장면을 이미지로 저장했어요");
    } catch (e) {
      console.warn("[share]", e);
      showToast("이 영상은 장면을 저장할 수 없어요");
    }
  };

  // 다른 탭에서 CCTV 를 고르면 그 영상으로
  const selectRef = useRef(null);
  selectRef.current = (id, item) => select(id, item);
  useEffect(() => {
    const on = (e) => selectRef.current?.(e.detail.id, e.detail.item);
    window.addEventListener("apb:select", on);
    return () => window.removeEventListener("apb:select", on);
  }, []);

  // 흐름 패널의 "이 지점 기록" 버튼이 보내는 신호(주행 화면에는 기록 버튼을 두지 않는다)
  const openRecordRef = useRef(openRecord);
  openRecordRef.current = openRecord;
  useEffect(() => {
    const on = () => openRecordRef.current();
    window.addEventListener("apb:record", on);
    return () => window.removeEventListener("apb:record", on);
  }, []);

  const backToAuto = () => {
    setPickedByUser(false);
    setActiveId(firstPlayable ? firstPlayable.id : null);
  };

  const activeEvents = (active && ahead.eventsByCctv[active.id]) || [];

  // ① 원인 한 줄 요약 · ② 정체 끝 CCTV
  const evAhead = useMemo(
    () => eventsAhead(ahead.events, traffic, direction, Object.values(ahead.eventsByCctv).flat()),
    [ahead.events, ahead.eventsByCctv, traffic, direction]
  );
  const jamInfo = useMemo(() => jamAhead(traffic), [traffic]);
  const weather = useWeather(loc.fix, scenario.data === "live"); // ⑧ 목업 주행에서는 부르지 않는다
  const summary = useMemo(() => buildSummary({ events: evAhead, jam: jamInfo, hasTraffic: !!traffic, weather }), [evAhead, jamInfo, traffic, weather]);
  const jamEnd = useMemo(
    () => findJamEndCctv([...ahead.all, ...(nation || [])], traffic, jamInfo, direction),
    [ahead.all, nation, traffic, jamInfo, direction]
  );
  const showJamEnd = jamEnd && jamEnd.cctv.id !== activeId;
  // ⑩ 정체·돌발을 지나면 기록 탭에 남긴다
  useTripRecorder({ fix: loc.fix, jam: jamInfo, events: evAhead, hasTraffic: !!traffic, road: (nav.route ? nav.road?.name : road?.name) || "" });

  // 다른 탭(앞길·기록)과 나눌 "앞 상황"
  const publish = useDrivePublish();
  useEffect(() => {
    publish({
      summary,
      weather,
      events: evAhead,
      jam: jamInfo,
      jamEnd,
      items,
      activeId,
      mode: ahead.mode,
      traffic,
      speed: loc.signalLost ? null : loc.fix?.speed ?? null,
      destination: nav.destination || null,
      remainingKm: nav.remainingKm,
      routeDurationMin: nav.route?.duration != null ? Math.round(nav.route.duration / 60) : null,
      updatedAt: ahead.refreshedAt,
    });
  }, [publish, summary, weather, evAhead, jamInfo, jamEnd, items, activeId, ahead.mode, traffic, loc.fix, loc.signalLost, nav.destination, nav.remainingKm, nav.route, ahead.refreshedAt]);
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
      heading={loc.heading}
      cctvs={nation || ahead.all}
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
            all={mapAll}
            selected={ahead.selected}
            events={ahead.events}
            activeId={activeId}
            onSelect={select}
            recenterKey={ahead.refreshedAt}
            routeRoads={nav.route?.roads || (ahead.mode === "road" ? matched.path?.roads : null)}
            nation={mapNation}
            theme={theme}
          />
        )}
      </MapLayer>

      <Guide ref={guideRef} $clear={!!active}>

        {ahead.stale ? <GuideNote role="status">교통정보를 새로 받지 못해 {staleSec}초 전 목록을 보여 드려요.</GuideNote> : null}

        {active ? (
          <>
          <Video
            ref={videoRef}
            $full={full}
            role={full ? "dialog" : undefined}
            aria-label={full ? "CCTV 전체 화면" : undefined}
            // 영상을 누르면 전체 화면(위에 띄운 버튼은 각자 동작)
            onClick={(e) => !full && !e.target.closest("button") && setFullTap(true)}
          >
            <CctvPlayer
              cctv={visible ? active : null}
              full={full}
              reserveRight={!full}
              willFail={scenario.brokenFeeds && !!active?.broken}
              blocked={activeEvents.some((e) => e.type === "accident")}
              onError={handleError}
            />
            {/* 통과 시각·전환 버튼은 영상 위에 띄운다(일반 화면·전체 화면 같음) */}
            {eta ? (
              <Eta $full aria-live="polite">
                {eta.dist} {eta.label}
                {eta.when ? (
                  <>
                    {" · "}
                    <b>{eta.when}</b>
                  </>
                ) : null}
                {activeIdx >= 0 ? <small>{activeIdx + 1}/{playable.length}</small> : null}
              </Eta>
            ) : null}
            {canStep ? (
              <>
                <OverlayBtn type="button" aria-label="이전 CCTV" style={{ left: 8, top: "50%", marginTop: -22 }} onClick={() => step(-1)}>
                  <FiChevronLeft size={24} />
                </OverlayBtn>
                <OverlayBtn type="button" aria-label="다음 CCTV" style={{ right: 8, top: "50%", marginTop: -22 }} onClick={() => step(1)}>
                  <FiChevronRight size={24} />
                </OverlayBtn>
              </>
            ) : null}
            {/* 몇 번째 CCTV 인지 — 영상 아래쪽 가운데 점 */}
            {!full && playable.length > 1 ? (
              <Dots aria-label={activeIdx >= 0 ? `${playable.length}곳 중 ${activeIdx + 1}번째` : undefined}>
                {playable.map((c) => (
                  <i key={c.id} data-on={c.id === activeId} />
                ))}
              </Dots>
            ) : null}
            {/* 공유 · 전체 화면(닫기) — 일반 화면은 영상 오른쪽 아래, 전체 화면은 오른쪽 위 */}
            <OverlayBtn
              type="button"
              aria-label="이 장면 공유"
              style={full ? { right: 62, top: "calc(env(safe-area-inset-top) + 42px)" } : { right: 50, bottom: 6, width: 36, height: 36, borderRadius: 10 }}
              onClick={shareScene}
            >
              <FiShare2 size={full ? 20 : 16} />
            </OverlayBtn>
            {full ? (
              <OverlayBtn type="button" aria-label="전체 화면 닫기" style={{ right: 10, top: "calc(env(safe-area-inset-top) + 42px)" }} onClick={closeFull}>
                <FiX size={22} />
              </OverlayBtn>
            ) : (
              <OverlayBtn type="button" aria-label="전체 화면으로 보기" style={{ right: 8, bottom: 6, width: 36, height: 36, borderRadius: 10 }} onClick={() => setFullTap(true)}>
                <FiMaximize2 size={16} />
              </OverlayBtn>
            )}
            {pickedByUser && firstPlayable ? (
              <BackToAuto type="button" onClick={backToAuto}>
                <FiSkipForward size={16} aria-hidden="true" />
                바로 앞 CCTV로
              </BackToAuto>
            ) : null}
          </Video>
          {!full && summary.tone !== "unknown" ? (
            <SummaryBar $tone={SUMMARY_TONE[summary.tone](theme)}>
              <button type="button" onClick={() => setDriverView(true)} aria-label={`${summary.title}. ${summary.sub}. 누르면 운전자에게 크게 보여 줘요`}>
                <i aria-hidden="true" />
                <span style={{ minWidth: 0 }}>
                  <b>{summary.title}</b>
                  {summary.sub ? <small>{summary.sub}</small> : null}
                </span>
              </button>
              {showJamEnd ? (
                <button type="button" onClick={() => select(jamEnd.cctv.id, jamEnd.cctv)} aria-label={`정체가 풀리는 곳 CCTV 보기, ${jamEnd.cctv.name}`}>
                  <FiFastForward size={18} aria-hidden="true" />
                  풀리는 곳
                </button>
              ) : null}
            </SummaryBar>
          ) : null}
          </>
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
          <Speed style={{ bottom: sideBottom + 26 }} aria-label={speed != null ? `시속 ${Math.round(speed)}킬로미터` : "속도 확인 중"}>
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
        <SearchBar $set={!!nav.destination}>
          <button type="button" onClick={() => setSheetOpen(true)} aria-label={nav.destination ? `목적지 ${nav.destination.name}, 바꾸기` : "목적지 검색"}>
            {nav.destination ? <FiFlag size={20} aria-hidden="true" /> : <FiSearch size={21} strokeWidth={2.4} aria-hidden="true" />}
            {nav.destination ? (
              <span style={{ minWidth: 0 }}>
                <b>{nav.destination.name}</b>
                <small>
                  {nav.status === "loading"
                    ? "경로 찾는 중"
                    : nav.status === "error"
                      ? "경로를 찾지 못해 진행 방향 기준으로 골라요"
                      : nav.remainingKm != null
                        ? `${nav.remainingKm.toFixed(1)}km 남음 · 경로 위 CCTV만 보여 드려요`
                        : "경로 위 CCTV만 보여 드려요"}
                </small>
              </span>
            ) : (
              <span className="ph">어디로 가세요?</span>
            )}
          </button>
          {nav.destination ? (
            <button type="button" aria-label="목적지 취소" onClick={() => setDestination(null)}>
              <FiX size={20} />
            </button>
          ) : null}
        </SearchBar>
      </BottomBar>

      {driverView ? <DriverView summary={summary} onClose={() => setDriverView(false)} /> : null}

      {record ? <RecordSheet snapshot={record} onClose={() => setRecord(null)} /> : null}

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
