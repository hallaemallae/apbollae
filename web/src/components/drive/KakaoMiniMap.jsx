// src/components/drive/KakaoMiniMap.jsx
// F-06 미니맵 — 카카오 지도 위에 내 위치·전방 부채꼴(±30°, 5km)·선별 CCTV·돌발을 그린다.
// 카카오 지도는 회전이 안 돼 북쪽이 위다. 부채꼴과 내 위치 화살표가 진행 방향을 대신 보여 준다.
// 키가 없거나 SDK 를 못 받으면 간이 지도(MiniMap, SVG)로 대신 그린다.
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import MiniMap from "./MiniMap";
import { loadKakaoMaps } from "../../utils/loadKakaoMaps";
import { AHEAD } from "../../utils/aheadFilter";

const Wrap = styled.figure`
  margin: 0;
  padding: 12px 16px 16px;
`;

const MapBox = styled.div`
  width: 100%;
  height: 340px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
`;

const Legend = styled.figcaption`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 10px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
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
  const { position, heading, all, selected, events, activeId, onSelect, theme, recenterKey, routeRoads } = props;
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef([]); // 다시 그릴 때 지울 오버레이들
  const [state, setState] = useState("loading"); // loading | ready | fallback
  const rank = useMemo(() => Object.fromEntries(selected.map((c, i) => [c.id, i + 1])), [selected]);

  // SDK 로드 + 지도 생성(한 번)
  useEffect(() => {
    let alive = true;
    loadKakaoMaps()
      .then((kakao) => {
        if (!alive || !boxRef.current) return;
        const center = position ? new kakao.maps.LatLng(position.lat, position.lng) : new kakao.maps.LatLng(37.5665, 126.978);
        mapRef.current = new kakao.maps.Map(boxRef.current, { center, level: 8 });
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
    if (state !== "ready" || !map || !position) return;
    const { kakao } = window;
    const bounds = new kakao.maps.LatLngBounds();
    [0, 90, 180, 270].forEach((b) => {
      const p = offset(position, b, AHEAD.maxKm);
      bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
    });
    map.setBounds(bounds, 8, 8, 8, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, recenterKey]);

  // 오버레이 다시 그리기
  useEffect(() => {
    const map = mapRef.current;
    if (state !== "ready" || !map || !position) return;
    const { kakao } = window;
    layerRef.current.forEach((o) => o.setMap(null));
    const layer = [];
    const LL = (p) => new kakao.maps.LatLng(p.lat, p.lng);
    const html = (content, z = 1) => ({ content, z });
    const overlay = (p, { content, z }, onClick) => {
      const el = document.createElement("div");
      el.innerHTML = content;
      if (onClick) {
        el.style.cursor = "pointer";
        el.addEventListener("click", onClick);
      }
      const o = new kakao.maps.CustomOverlay({ position: LL(p), content: el, zIndex: z, yAnchor: 0.5, xAnchor: 0.5 });
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

    // 범위 밖·제외된 CCTV
    all.forEach((c) => {
      if (rank[c.id]) return;
      const hollow = c.status === "opposite" || c.status === "otherRoad";
      overlay(
        c,
        html(`<div title="${esc(c.name)}" style="width:9px;height:9px;border-radius:50%;border:2px solid #8A9196;background:${hollow ? "transparent" : "#8A9196"};opacity:.85"></div>`)
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
      overlay(
        c,
        html(
          `<div title="${esc(c.name)}" style="width:${on ? 30 : 24}px;height:${on ? 30 : 24}px;border-radius:50%;background:${theme.colors.lane};color:${theme.colors.laneText};border:2px solid ${on ? "#fff" : "#1C2024"};display:flex;align-items:center;justify-content:center;font:700 13px/1 sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.45)">${rank[c.id]}</div>`,
          4
        ),
        () => onSelect?.(c.id)
      );
    });

    // 내 위치 — 진행 방향 화살표(방향을 모르면 점)
    overlay(
      position,
      html(
        heading != null
          ? `<div style="transform:rotate(${heading}deg);width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:24px solid #fff;filter:drop-shadow(0 0 2px #000)"></div>`
          : `<div style="width:16px;height:16px;border-radius:50%;background:#3D7BE0;border:3px solid #fff;box-shadow:0 0 0 6px rgba(61,123,224,.25)"></div>`,
        5
      )
    );

    layerRef.current = layer;
  }, [state, position, heading, all, selected, events, activeId, rank, onSelect, theme, routeRoads]);

  if (state === "fallback") {
    return (
      <>
        {import.meta.env.DEV ? <Note>카카오 지도 키(VITE_KAKAO_JS_KEY)가 없거나 도메인이 등록되지 않아 간이 지도로 보여 드려요.</Note> : null}
        <MiniMap {...props} />
      </>
    );
  }

  return (
    <Wrap>
      <MapBox ref={boxRef} role="img" aria-label={heading != null ? "진행 방향 기준 전방 5km 지도" : "내 주변 5km 지도"} />
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
    </Wrap>
  );
}
