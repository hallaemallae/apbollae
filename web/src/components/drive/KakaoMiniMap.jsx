// src/components/drive/KakaoMiniMap.jsx
// F-06 미니맵 — 카카오 지도 위에 내 위치·전방 부채꼴(±30°, 5km)·선별 CCTV·돌발을 그린다.
// 카카오 지도는 회전이 안 돼 북쪽이 위다. 부채꼴과 내 위치 화살표가 진행 방향을 대신 보여 준다.
// fill: 주행 화면 아래 절반을 채우는 모드 — 내 위치를 따라가고(진행 방향 쪽을 더 보이게), 지도를 끌면 따라가기를 멈춘다.
//       선별되지 않은 CCTV 도 눌러서 볼 수 있다.
// 키가 없거나 SDK 를 못 받으면 간이 지도(MiniMap, SVG)로 대신 그린다.
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import MiniMap from "./MiniMap";
import { loadKakaoMaps } from "../../utils/loadKakaoMaps";
import { FiCrosshair } from "react-icons/fi";
import { AHEAD } from "../../utils/aheadFilter";

const Wrap = styled.figure`
  margin: 0;
  padding: ${({ $fill }) => ($fill ? "0" : "12px 16px 16px")};
  ${({ $fill }) => ($fill ? "position: relative; height: 100%;" : "")}
`;

const MapBox = styled.div`
  width: 100%;
  height: ${({ $fill }) => ($fill ? "100%" : "340px")};
  border-radius: ${({ theme, $fill }) => ($fill ? 0 : theme.radius.md)}px;
  overflow: hidden;
  border: ${({ theme, $fill }) => ($fill ? "none" : `1px solid ${theme.colors.border}`)};
  background: ${({ theme }) => theme.colors.surface};
  /* 카카오 로고·저작권·축척(지도 상자 왼쪽 아래 맨 끝에 붙는 칸)을 아래 검색창에 가리지 않게 그 위로 올린다.
     지도 자체는 검색창 뒤까지 채운다. 로고는 이용조건상 가리거나 바꾸면 안 된다(밤 필터에서도 뺀다). */
  & > div[style*="bottom: 0px"][style*="z-index: 1"] {
    bottom: var(--copy-bottom, 0px) !important;
  }
  /* 어두운 화면(해 진 뒤 자동 포함) — 카카오에는 야간 지도가 없어 바탕 지도 그림(img 타일)만 반전해 밤 지도로 만든다.
     CCTV·돌발 마커(CustomOverlay)와 경로·소통 선(SVG)은 img 가 아니라 색이 그대로 남는다. */
  /* 밤 모드 1a(미드나잇 네이비) 톤: 반전 → 세피아로 색을 모은 뒤 푸른 쪽으로 돌려 짙은 남색(#0E1422 근처)에 맞춘다 */
  ${({ theme }) =>
    theme.mode === "dark"
      ? "img:not([src*='m_bi']) { filter: invert(0.92) hue-rotate(180deg) saturate(0.55) brightness(0.82) contrast(0.95); }"
      : ""}
`;

const FillBox = styled.div`
  height: 100%;
  overflow: auto;
`;

// 내 위치 버튼 — 배경 카드 없이 흰 아이콘만(지도 위에서 보이게 어두운 그림자). 따라가는 중이면 또렷하게, 멈췄으면 흐리게
const FollowBtn = styled.button`
  position: absolute;
  right: 12px;
  z-index: 5;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #ffffff;
  opacity: ${({ $on }) => ($on ? 1 : 0.75)};
  svg {
    filter: drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.7)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
  }
`;

const Legend = styled.figcaption`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 10px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  ${({ $fill, theme }) =>
    $fill
      ? `position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 4; width: fit-content; margin: 0; padding: 5px 10px; border-radius: 999px; font-size: 11.5px; background: ${theme.colors.surface}; opacity: 0.92;`
      : ""}
  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
`;

const Note = styled.p`
  margin: 0 16px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const FOLLOW_ZOOM = 4; // 내 위치 버튼을 누르면 이 단계까지 확대(카카오 지도 레벨, 작을수록 가까이)

const NATION_MAX = 400; // 한 화면에 그릴 전국 CCTV 마커 상한

// CCTV 아이콘(lucide "cctv") — 지도 마커는 점 대신 이 아이콘으로 그린다
const cctvSvg = (color, size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.75 12h3.632a1 1 0 0 1 .894 1.447l-2.034 4.069a1 1 0 0 1-1.708.134l-2.124-2.97"/><path d="M17.106 9.053a1 1 0 0 1 .447 1.341l-3.106 6.211a1 1 0 0 1-1.342.447L3.61 12.3a2.92 2.92 0 0 1-1.3-3.91L3.69 5.6a2.92 2.92 0 0 1 3.92-1.3z"/><path d="M2 19h3.76a2 2 0 0 0 1.8-1.1L9 15"/><path d="M2 21v-4"/></svg>`;
/** 동그란 CCTV 마커 — on: 지금 재생 중(어두운 면·흰 아이콘), dim: 범위 밖·반대 방향 */
const cctvPin = ({ on = false, dim = false, size = 26 } = {}) =>
  `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${on ? "#151A22" : "#fff"};border:${on ? "2px solid #fff" : "1px solid #E1E4EA"};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25);opacity:${dim ? 0.75 : 1}">${cctvSvg(on ? "#fff" : dim ? "#8A9196" : "#F08A24", Math.round(size * 0.58))}</div>`;

const EVENT_COLOR = { accident: "#E5483B", work: "#F08A24", control: "#3D7BE0" };

/** 위치에서 bearing(도) 방향으로 km 떨어진 점 — 5km 안에서는 평면 근사로 충분하다 */
function offset(p, bearing, km) {
  const b = (bearing * Math.PI) / 180;
  return {
    lat: p.lat + (km * Math.cos(b)) / 111.32,
    lng: p.lng + (km * Math.sin(b)) / (111.32 * Math.cos((p.lat * Math.PI) / 180)),
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export default function KakaoMiniMap(props) {
  const { position, heading, all, selected, events, activeId, onSelect, theme, recenterKey, routeRoads, fill = false, insetTop = 0, insetBottom = 0, controlsBottom = 44, nation = null } = props;
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef([]); // 다시 그릴 때 지울 오버레이들
  const nationLayerRef = useRef([]); // 전국 CCTV 마커(화면에 보이는 범위만)
  const [view, setView] = useState(null); // 지도 범위 { s, w, n, e, level } — 움직임이 멈출 때마다
  const [state, setState] = useState("loading"); // loading | ready | fallback
  const [following, setFollowing] = useState(true); // fill 모드: 내 위치 따라가기
  const [zoomTick, setZoomTick] = useState(0); // 내 위치 버튼으로 확대한 뒤 다시 자리 잡기
  const rank = useMemo(() => Object.fromEntries(selected.map((c, i) => [c.id, i + 1])), [selected]);

  // SDK 로드 + 지도 생성(한 번)
  useEffect(() => {
    let alive = true;
    loadKakaoMaps()
      .then((kakao) => {
        if (!alive || !boxRef.current) return;
        const center = position ? new kakao.maps.LatLng(position.lat, position.lng) : new kakao.maps.LatLng(37.5665, 126.978);
        const map = new kakao.maps.Map(boxRef.current, { center, level: fill ? 6 : 8 });
        // 손으로 끌면 따라가기를 멈춘다("내 위치" 버튼으로 다시 켠다)
        kakao.maps.event.addListener(map, "dragstart", () => setFollowing(false));
        // 움직임이 멈추면 보이는 범위를 기록 — 전국 CCTV 중 이 범위만 그린다
        kakao.maps.event.addListener(map, "idle", () => {
          const b = map.getBounds();
          setView({ s: b.getSouthWest().getLat(), w: b.getSouthWest().getLng(), n: b.getNorthEast().getLat(), e: b.getNorthEast().getLng(), level: map.getLevel() });
        });
        mapRef.current = map;
        setState("ready");
      })
      .catch((e) => {
        console.warn("[map] 카카오 지도 대신 간이 지도:", e.message);
        if (alive) setState("fallback");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 새로 고를 때마다 5km 반경이 다 보이게 맞춘다(사용자가 끌어 놓은 지도를 매초 되돌리지 않게)
  useEffect(() => {
    const map = mapRef.current;
    if (fill || state !== "ready" || !map || !position) return;
    const { kakao } = window;
    const bounds = new kakao.maps.LatLngBounds();
    [0, 90, 180, 270].forEach((b) => {
      const p = offset(position, b, AHEAD.maxKm);
      bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
    });
    map.setBounds(bounds, 8, 8, 8, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, recenterKey]);

  // fill 모드 따라가기 — 지도는 북쪽이 위라서, 내 위치를 진행 방향 반대쪽으로 밀어 앞이 더 보이게 한다.
  // 위·아래에 겹쳐 띄운 안내(insetTop·insetBottom, px)를 뺀 "보이는 영역" 안에서 자리를 잡는다.
  useEffect(() => {
    const map = mapRef.current;
    const box = boxRef.current;
    if (!fill || !following || state !== "ready" || !map || !box || !position) return;
    const { kakao } = window;
    const W = box.clientWidth;
    const H = box.clientHeight;
    const visH = Math.max(40, H - insetTop - insetBottom);
    const k = heading != null ? 0.3 * Math.min(W, visH) : 0;
    const h = ((heading || 0) * Math.PI) / 180;
    const want = { x: W / 2 - Math.sin(h) * k, y: insetTop + visH / 2 + Math.cos(h) * k };
    const proj = map.getProjection();
    const now = proj.containerPointFromCoords(new kakao.maps.LatLng(position.lat, position.lng));
    const center = proj.coordsFromContainerPoint(new kakao.maps.Point(W / 2 + now.x - want.x, H / 2 + now.y - want.y));
    map.panTo(center);
  }, [fill, following, state, position, heading, insetTop, insetBottom, zoomTick]);

  // 내 위치 버튼 — 따라가기를 켜고 내 위치 근처로 확대한다(CCTV 마커에 묻혀 안 보일 때)
  const goMine = () => {
    const map = mapRef.current;
    setFollowing(true);
    if (map && position && window.kakao) {
      if (map.getLevel() > FOLLOW_ZOOM) map.setLevel(FOLLOW_ZOOM, { anchor: new window.kakao.maps.LatLng(position.lat, position.lng), animate: { duration: 300 } });
      setTimeout(() => setZoomTick((n) => n + 1), 320);
    }
  };

  // 영역 크기가 바뀌면(화면 회전·목록 열고 닫기) 지도를 다시 맞춘다
  useEffect(() => {
    const map = mapRef.current;
    if (!fill || state !== "ready" || !map || !boxRef.current || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => map.relayout());
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [fill, state]);

  // 전국 CCTV — 선별·주변 목록(all)에 없는 것만, 보이는 범위 안에서 최대 NATION_MAX 개. 누르면 그 영상으로
  const allIds = useMemo(() => new Set(all.map((c) => c.id)), [all]);
  useEffect(() => {
    const map = mapRef.current;
    nationLayerRef.current.forEach((o) => o.setMap(null));
    nationLayerRef.current = [];
    if (!fill || state !== "ready" || !map || !view || !nation?.length) return;
    const { kakao } = window;
    const pad = 0.1; // 가장자리 마커가 끊기지 않게 범위를 조금 넓힌다
    const dLat = (view.n - view.s) * pad;
    const dLng = (view.e - view.w) * pad;
    const inView = nation.filter(
      (c) => !allIds.has(c.id) && c.lat > view.s - dLat && c.lat < view.n + dLat && c.lng > view.w - dLng && c.lng < view.e + dLng
    );
    if (inView.length > NATION_MAX) return; // 너무 넓게 축소하면 그리지 않는다(지도가 무거워진다)
    inView.forEach((c) => {
      const on = c.id === activeId;
      const el = document.createElement("div");
      el.title = c.name;
      el.style.cssText = "padding:6px;cursor:pointer";
      el.innerHTML = cctvPin({ on, size: on ? 30 : 24 });
      el.addEventListener("click", () => onSelect?.(c.id, c));
      const o = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(c.lat, c.lng), content: el, zIndex: on ? 5 : 1, yAnchor: 0.5, xAnchor: 0.5 });
      o.setMap(map);
      nationLayerRef.current.push(o);
    });
  }, [fill, state, view, nation, allIds, activeId, onSelect]);

  // 오버레이 다시 그리기
  useEffect(() => {
    const map = mapRef.current;
    if (state !== "ready" || !map || !position) return;
    const { kakao } = window;
    layerRef.current.forEach((o) => o.setMap(null));
    const layer = [];
    const LL = (p) => new kakao.maps.LatLng(p.lat, p.lng);
    const html = (content, z = 1) => ({ content, z });
    const overlay = (p, { content, z, yAnchor = 0.5 }, onClick) => {
      const el = document.createElement("div");
      el.innerHTML = content;
      if (onClick) {
        el.style.cursor = "pointer";
        el.addEventListener("click", onClick);
      }
      const o = new kakao.maps.CustomOverlay({ position: LL(p), content: el, zIndex: z, yAnchor, xAnchor: 0.5 });
      o.setMap(map);
      layer.push(o);
    };

    // 목적지 경로 — 구간마다 소통 색
    if (routeRoads?.length) {
      routeRoads.forEach((r) => {
        const line = new kakao.maps.Polyline({
          path: r.coords.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng)),
          strokeWeight: 7,
          strokeColor: theme.colors.traffic[r.state] || theme.colors.traffic.unknown,
          strokeOpacity: 0.9,
        });
        line.setMap(map);
        layer.push(line);
      });
    }

    // 전방 부채꼴(방향을 알 때, 경로가 없을 때) / 반경 원(방향을 모를 때)
    if (routeRoads?.length) {
      // 경로가 있으면 부채꼴 대신 경로 선이 "앞"을 보여 준다
    } else if (heading != null) {
      const path = [LL(position)];
      for (let a = -AHEAD.halfAngle; a <= AHEAD.halfAngle; a += 5) path.push(LL(offset(position, heading + a, AHEAD.maxKm)));
      const poly = new kakao.maps.Polygon({ path, strokeWeight: 2, strokeColor: theme.colors.lane, strokeOpacity: 0.8, strokeStyle: "dash", fillColor: theme.colors.lane, fillOpacity: 0.15 });
      poly.setMap(map);
      layer.push(poly);
    } else {
      const circle = new kakao.maps.Circle({ center: LL(position), radius: AHEAD.maxKm * 1000, strokeWeight: 2, strokeColor: theme.colors.lane, strokeOpacity: 0.7, strokeStyle: "dash", fillColor: theme.colors.lane, fillOpacity: 0.08 });
      circle.setMap(map);
      layer.push(circle);
    }

    // 범위 밖·제외된 CCTV — fill 모드에서는 눌러서 그 영상을 볼 수 있다(손가락으로 누르기 쉽게 투명 여백을 둔다)
    all.forEach((c) => {
      if (rank[c.id]) return;
      const hollow = c.status === "opposite" || c.status === "otherRoad";
      const on = c.id === activeId;
      const dot = cctvPin({ on, dim: !on && hollow, size: on ? 30 : fill ? 24 : 18 });
      overlay(
        c,
        html(`<div title="${esc(c.name)}" style="padding:${fill ? 6 : 0}px">${dot}</div>`, on ? 4 : 2),
        fill ? () => onSelect?.(c.id) : undefined
      );
    });

    // 돌발
    events.forEach((ev) => {
      overlay(
        ev,
        html(
          `<div title="${esc(ev.label || "")} ${esc(ev.message || "")}" style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:15px solid ${EVENT_COLOR[ev.type]};filter:drop-shadow(0 0 1px #fff) drop-shadow(0 1px 2px rgba(0,0,0,.5))"></div>`,
          3
        )
      );
    });

    // 선별된 CCTV — 번호(가까운 순). 누르면 그 영상으로
    selected.forEach((c) => {
      const on = c.id === activeId;
      if (fill) {
        const km = c.km < 1 ? `${Math.max(10, Math.round((c.km * 1000) / 10) * 10)}m` : `${c.km.toFixed(1)}km`;
        overlay(
          c,
          {
            content: `<div title="${esc(c.name)}" style="display:flex;flex-direction:column;align-items:center"><div style="display:flex;align-items:center;gap:5px;padding:4px 9px 4px 4px;border-radius:999px;background:${on ? "#151A22" : "#fff"};color:${on ? "#fff" : "#151A22"};font:700 12px/1 Pretendard,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.18);white-space:nowrap"><span style="width:20px;height:20px;border-radius:50%;background:#F08A24;display:flex;align-items:center;justify-content:center">${cctvSvg("#fff", 13)}</span>${km}</div><div style="width:2px;height:6px;background:#F08A24"></div></div>`,
            z: on ? 6 : 4,
            yAnchor: 1,
          },
          () => onSelect?.(c.id)
        );
        return;
      }
      overlay(
        c,
        html(
          `<div title="${esc(c.name)}" style="width:${on ? 30 : 24}px;height:${on ? 30 : 24}px;border-radius:50%;background:${theme.colors.lane};color:${theme.colors.laneText};border:2px solid ${on ? "#fff" : "#1C2024"};display:flex;align-items:center;justify-content:center;font:700 13px/1 sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.45)">${rank[c.id]}</div>`,
          4
        ),
        () => onSelect?.(c.id)
      );
    });

    // 위치 정확도 원 — 오차가 크면(실내·와이파이 기반 위치) 실제 위치가 이 원 안 어딘가임을 보여 준다
    if (position.accuracy != null && position.accuracy > 20) {
      const acc = new kakao.maps.Circle({ center: LL(position), radius: position.accuracy, strokeWeight: 1, strokeColor: "#3D7BE0", strokeOpacity: 0.5, fillColor: "#3D7BE0", fillOpacity: 0.12 });
      acc.setMap(map);
      layer.push(acc);
    }

    // 내 위치 — 진행 방향 화살표(방향을 모르면 점)
    overlay(
      position,
      html(
        heading != null
          ? `<div style="transform:rotate(${heading}deg);width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:24px solid #fff;filter:drop-shadow(0 0 2px #000)"></div>`
          : `<div style="width:16px;height:16px;border-radius:50%;background:#3D7BE0;border:3px solid #fff;box-shadow:0 0 0 6px rgba(61,123,224,.25)"></div>`,
        10 // CCTV 마커(최대 6)보다 위 — 내 위치가 마커에 묻히지 않게
      )
    );

    layerRef.current = layer;
  }, [state, position, heading, all, selected, events, activeId, rank, onSelect, theme, routeRoads, fill]);

  if (state === "fallback") {
    const note = import.meta.env.DEV ? <Note>카카오 지도 키(VITE_KAKAO_JS_KEY)가 없거나 도메인이 등록되지 않아 간이 지도로 보여 드려요.</Note> : null;
    const map = (
      <>
        <MiniMap {...props} />
        {note}
      </>
    );
    return fill ? <FillBox>{map}</FillBox> : map;
  }

  return (
    <Wrap $fill={fill}>
      <MapBox $fill={fill} ref={boxRef} style={fill ? { "--copy-bottom": `${insetBottom}px` } : undefined} role="img" aria-label={heading != null ? "진행 방향 기준 전방 지도" : "내 주변 지도"} />
      {fill && position ? (
        <FollowBtn type="button" $on={following} style={{ bottom: controlsBottom }} aria-label="내 위치로" aria-pressed={following} onClick={goMine}>
          <FiCrosshair size={28} strokeWidth={2.4} aria-hidden="true" />
        </FollowBtn>
      ) : null}
      {fill ? null : (
      <Legend>
        <span>
          <i style={{ background: theme.colors.lane }} />
          {heading != null ? "내 앞 CCTV(가까운 순)" : "주변 CCTV(가까운 순)"}
        </span>
        <span>
          <i style={{ background: "#8A9196" }} />
          범위 밖
        </span>
        <span>
          <i style={{ border: "1.5px solid #8A9196" }} />
          반대 방향·다른 도로
        </span>
      </Legend>
      )}
    </Wrap>
  );
}
