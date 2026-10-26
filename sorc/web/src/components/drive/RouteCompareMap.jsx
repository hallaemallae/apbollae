// src/components/drive/RouteCompareMap.jsx — 1c 경로 비교 지도.
// 고른 경로는 구간마다 소통 색으로 굵게, 나머지 경로는 회색으로 깔고, 선을 누르면 그 경로를 고른다.
// 출발(내 위치)·도착 표시. 경로를 새로 받을 때만 전체가 보이게 맞추고, 고르기만 바꿀 때는 지도를 움직이지 않는다.
// 고른 경로는 출발 → 도착 쪽으로 그려 나간다(DRAW_MS). 기기에서 "동작 줄이기"를 켜면 바로 다 그린다.
// 카카오 지도 키가 없거나 SDK 를 못 받으면 SVG 로 선만 그린다.
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import styled, { keyframes, useTheme } from "styled-components";
import { loadKakaoMaps } from "../../utils/loadKakaoMaps";

const DRAW_MS = 600;
const drawIn = keyframes`from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; }`;

const Box = styled.div`
  position: relative;
  margin: 0 16px 12px;
  height: 240px;
  border-radius: 16px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => (theme.mode === "dark" ? theme.colors.border : "#E8EAEF")};
  /* 밤 지도 — KakaoMiniMap 과 같은 필터(로고 타일은 뺀다) */
  ${({ theme }) =>
    theme.mode === "dark"
      ? "img:not([src*='m_bi']) { filter: invert(0.92) hue-rotate(180deg) saturate(0.55) brightness(0.82) contrast(0.95); }"
      : ""}
  > div {
    width: 100%;
    height: 100%;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .draw {
    stroke-dasharray: 1;
    animation: ${drawIn} ${DRAW_MS}ms cubic-bezier(0.33, 1, 0.68, 1) both;
  }
`;

const easeOut = (t) => 1 - (1 - t) ** 3;
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const pin = (color, square) =>
  `<div style="width:14px;height:14px;border-radius:${square ? 3 : 7}px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`;

/**
 * @param {{ routes: Array<{key, raw:{roads}}>|null, pick, origin:{lat,lng}, dest:{lat,lng}, onPick(key) }} props
 */
export default function RouteCompareMap({ routes, pick, origin, dest, onPick }) {
  const theme = useTheme();
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef([]);
  const [state, setState] = useState("loading"); // loading | ready | fallback

  useEffect(() => {
    let alive = true;
    loadKakaoMaps()
      .then((kakao) => {
        if (!alive || !boxRef.current) return;
        const c = origin || dest;
        mapRef.current = new kakao.maps.Map(boxRef.current, { center: new kakao.maps.LatLng(c.lat, c.lng), level: 9 });
        setState("ready");
      })
      .catch(() => alive && setState("fallback"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 경로를 받으면 출발·도착·모든 경로가 보이게 맞춘다
  useEffect(() => {
    const map = mapRef.current;
    if (state !== "ready" || !map) return;
    const { kakao } = window;
    const bounds = new kakao.maps.LatLngBounds();
    [origin, dest].filter(Boolean).forEach((p) => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)));
    routes?.forEach((r) => r.raw.roads.forEach((road) => road.coords.forEach(([lat, lng]) => bounds.extend(new kakao.maps.LatLng(lat, lng)))));
    map.relayout();
    map.setBounds(bounds, 28, 28, 28, 28);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, routes]);

  // 선·표시 다시 그리기 — 고른 경로는 출발점부터 그려 나간다
  useEffect(() => {
    const map = mapRef.current;
    if (state !== "ready" || !map) return undefined;
    const { kakao } = window;
    layerRef.current.forEach((o) => o.setMap(null));
    const layer = [];
    const LL = ([lat, lng]) => new kakao.maps.LatLng(lat, lng);
    const add = (o) => {
      o.setMap(map);
      layer.push(o);
      return o;
    };
    const line = (path, opts, key) => {
      const o = add(new kakao.maps.Polyline({ path, strokeOpacity: 1, ...opts }));
      kakao.maps.event.addListener(o, "click", () => onPick(key));
      return o;
    };
    let raf = 0;
    (routes || []).forEach((r) => {
      if (r.key === pick) return;
      // 고르지 않은 경로 — 회색, 누르기 쉽게 굵게
      line(r.raw.roads.flatMap((road) => road.coords.map(LL)), { strokeWeight: 7, strokeColor: "#9AA1AD", strokeOpacity: 0.85, zIndex: 1 }, r.key);
    });
    const on = routes?.find((r) => r.key === pick);
    if (on) {
      const roads = on.raw.roads.map((road) => road.coords.map(LL));
      const flat = roads.flat();
      const base = line(flat, { strokeWeight: 11, strokeColor: "#FFFFFF", zIndex: 2 }, on.key); // 흰 테두리
      const lines = on.raw.roads.map((road, i) =>
        line(roads[i], { strokeWeight: 7, strokeColor: theme.colors.traffic[road.state] || theme.colors.traffic.unknown, zIndex: 3 }, on.key)
      );
      if (!reducedMotion() && flat.length > 1) {
        // k 번째 점까지만 보이게 — 다 지난 도로는 한 번만 끝까지 채우고, 지금 그리는 도로만 매 프레임 자른다
        const starts = [];
        roads.reduce((n, pts, i) => ((starts[i] = n), n + pts.length), 0);
        lines.forEach((l) => l.setPath([]));
        let done = 0; // 끝까지 채운 도로 수
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / DRAW_MS);
          const k = Math.max(2, Math.round(easeOut(t) * flat.length));
          base.setPath(flat.slice(0, k));
          while (done < roads.length && starts[done] + roads[done].length <= k) {
            lines[done].setPath(roads[done]);
            done += 1;
          }
          if (done < roads.length) lines[done].setPath(roads[done].slice(0, Math.max(0, k - starts[done])));
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      }
    }
    const mark = (p, html) => {
      if (!p) return;
      const el = document.createElement("div");
      el.innerHTML = html;
      add(new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: el, zIndex: 5, xAnchor: 0.5, yAnchor: 0.5 }));
    };
    mark(origin, pin(theme.colors.primary));
    mark(dest, pin(theme.colors.textStrong, true));
    layerRef.current = layer;
    return () => cancelAnimationFrame(raf);
  }, [state, routes, pick, origin, dest, theme, onPick]);

  if (state === "fallback") {
    return (
      <Box aria-hidden="true">
        <SvgRoutes routes={routes} pick={pick} origin={origin} dest={dest} onPick={onPick} theme={theme} />
      </Box>
    );
  }
  return (
    <Box aria-hidden="true">
      <div ref={boxRef} />
    </Box>
  );
}

/** 키가 없을 때 — 위경도를 그대로 평면에 펴서 선만 그린다 */
function SvgRoutes({ routes, pick, origin, dest, onPick, theme }) {
  const maskId = useId();
  const W = 400;
  const H = 240;
  const view = useMemo(() => {
    const pts = [origin, dest].filter(Boolean).map((p) => [p.lat, p.lng]);
    routes?.forEach((r) => r.raw.roads.forEach((road) => pts.push(...road.coords)));
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    const s = Math.min(...lats);
    const n = Math.max(...lats);
    const w = Math.min(...lngs);
    const e = Math.max(...lngs);
    const kx = Math.cos(((s + n) / 2) * (Math.PI / 180)); // 경도 1도는 위도 1도보다 짧다
    const scale = Math.min((W - 40) / Math.max((e - w) * kx, 1e-6), (H - 40) / Math.max(n - s, 1e-6));
    const ox = (W - (e - w) * kx * scale) / 2;
    const oy = (H - (n - s) * scale) / 2;
    return ([lat, lng]) => [ox + (lng - w) * kx * scale, oy + (n - lat) * scale];
  }, [routes, origin, dest]);
  const line = (coords) => coords.map((c) => view(c).map((v) => v.toFixed(1)).join(",")).join(" ");
  const ordered = [...(routes || [])].sort((a, b) => (a.key === pick) - (b.key === pick));
  const dot = (p) => (p ? view([p.lat, p.lng]) : null);
  const o = dot(origin);
  const d = dot(dest);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {ordered.map((r) =>
        r.key === pick ? (
          <g key={r.key} onClick={() => onPick(r.key)}>
            {/* 가림판을 출발점부터 열어 고른 경로가 그려져 나가게 한다(pick 이 바뀌면 key 로 다시 시작) */}
            <mask id={maskId} key={pick} maskUnits="userSpaceOnUse">
              <polyline className="draw" pathLength="1" points={line(r.raw.roads.flatMap((x) => x.coords))} fill="none" stroke="#fff" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round" />
            </mask>
            <g mask={`url(#${maskId})`}>
              <polyline points={line(r.raw.roads.flatMap((x) => x.coords))} fill="none" stroke="#fff" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
              {r.raw.roads.map((road, i) => (
                <polyline key={i} points={line(road.coords)} fill="none" stroke={theme.colors.traffic[road.state] || theme.colors.traffic.unknown} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
              ))}
            </g>
          </g>
        ) : (
          <polyline key={r.key} onClick={() => onPick(r.key)} points={line(r.raw.roads.flatMap((x) => x.coords))} fill="none" stroke="#9AA1AD" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
        )
      )}
      {o ? <circle cx={o[0]} cy={o[1]} r="7" fill={theme.colors.primary} stroke="#fff" strokeWidth="3" /> : null}
      {d ? <rect x={d[0] - 7} y={d[1] - 7} width="14" height="14" rx="3" fill={theme.colors.textStrong} stroke="#fff" strokeWidth="3" /> : null}
    </svg>
  );
}
