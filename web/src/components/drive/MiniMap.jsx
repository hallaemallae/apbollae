// src/components/drive/MiniMap.jsx
// F-06 미니맵 — 진행 방향이 위로 오는(heading-up) 간이 지도.
// 지금은 타일 없이 SVG 로 그려 "부채꼴 안/밖" 판정을 눈으로 점검하는 용도다.
// 실제 연결 시: MapLibre(웹: maplibre-gl, RN: maplibre-react-native) + 브이월드/OSM 타일로 교체.
import React, { useMemo } from "react";
import styled from "styled-components";
import { AHEAD } from "../../utils/aheadFilter";

const W = 320;
const H = 300;
const ME = { x: W / 2, y: H - 26 };
const SCALE = (H - 50) / (AHEAD.maxKm * 1000); // px per meter

const Wrap = styled.figure`
  margin: 0;
  padding: 12px 16px 16px;
`;

const Svg = styled.svg`
  display: block;
  width: 100%;
  height: auto;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
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

function project(origin, heading, p) {
  const dy = (p.lat - origin.lat) * 111_320;
  const dx = (p.lng - origin.lng) * 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const h = (heading * Math.PI) / 180;
  const forward = dx * Math.sin(h) + dy * Math.cos(h);
  const right = dx * Math.cos(h) - dy * Math.sin(h);
  return { x: ME.x + right * SCALE, y: ME.y - forward * SCALE };
}

function sectorPath() {
  const r = AHEAD.maxKm * 1000 * SCALE;
  const a = (AHEAD.halfAngle * Math.PI) / 180;
  const lx = ME.x - r * Math.sin(a);
  const rx = ME.x + r * Math.sin(a);
  const y = ME.y - r * Math.cos(a);
  return `M${ME.x},${ME.y} L${lx},${y} A${r},${r} 0 0 1 ${rx},${y} Z`;
}

const EVENT_COLOR = { accident: "#E5483B", work: "#F08A24", control: "#3D7BE0" };

export default function MiniMap({ position, heading, route, all, selected, events, theme }) {
  const rank = useMemo(() => Object.fromEntries(selected.map((c, i) => [c.id, i + 1])), [selected]);

  if (!position || heading == null) return null;
  const P = (p) => project(position, heading, p);
  const routePts = route.map((n) => P(n)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const c = theme.colors;
  const r5 = AHEAD.maxKm * 1000 * SCALE;

  return (
    <Wrap>
      <Svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="진행 방향 기준 전방 5km 지도">
        <defs>
          <clipPath id="mm-clip">
            <rect width={W} height={H} rx="12" />
          </clipPath>
        </defs>
        <g clipPath="url(#mm-clip)">
          <path d={sectorPath()} fill={c.lane} opacity="0.1" stroke={c.lane} strokeOpacity="0.5" strokeDasharray="4 5" />
          {[1, 3].map((km) => (
            <circle key={km} cx={ME.x} cy={ME.y} r={km * 1000 * SCALE} fill="none" stroke={c.border} strokeDasharray="2 6" />
          ))}
          <text x={ME.x + 6} y={ME.y - r5 + 14} fontSize="11" fill={c.textWeak}>
            5km
          </text>
          <text x={ME.x + 6} y={ME.y - 3000 * SCALE + 14} fontSize="11" fill={c.textWeak}>
            3km
          </text>
          {route.length ? <polyline points={routePts} fill="none" stroke={c.road} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /> : null}

          {all.map((cc) => {
            if (rank[cc.id]) return null;
            const p = P(cc);
            const hollow = cc.status === "opposite" || cc.status === "otherRoad";
            return (
              <circle key={cc.id} cx={p.x} cy={p.y} r="4.5" fill={hollow ? "none" : c.textWeak} stroke={c.textWeak} strokeWidth="1.5" opacity="0.8">
                <title>{`${cc.name} — 제외(${STATUS_LABEL[cc.status]})`}</title>
              </circle>
            );
          })}

          {selected.map((cc) => {
            const p = P(cc);
            return (
              <g key={cc.id}>
                <circle cx={p.x} cy={p.y} r="10" fill={c.lane} stroke={c.bg} strokeWidth="2" />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={c.laneText}>
                  {rank[cc.id]}
                </text>
              </g>
            );
          })}

          {events.map((ev) => {
            const q = P(ev);
            const p = { x: q.x + 14, y: q.y - 6 }; // 같은 지점의 CCTV 번호와 겹치지 않게
            return (
              <path
                key={ev.id}
                d={`M${p.x},${p.y - 8} L${p.x + 7.5},${p.y + 5} L${p.x - 7.5},${p.y + 5} Z`}
                fill={EVENT_COLOR[ev.type]}
                stroke="#fff"
                strokeWidth="1.2"
              />
            );
          })}

          <path d={`M${ME.x},${ME.y - 13} L${ME.x + 10},${ME.y + 9} L${ME.x},${ME.y + 4} L${ME.x - 10},${ME.y + 9} Z`} fill={c.textStrong} stroke={c.bg} strokeWidth="2" />
        </g>
      </Svg>
      <Legend>
        <span>
          <i style={{ background: c.lane }} />내 앞 CCTV(가까운 순)
        </span>
        <span>
          <i style={{ background: c.textWeak }} />범위 밖
        </span>
        <span>
          <i style={{ border: `1.5px solid ${c.textWeak}` }} />반대 방향·다른 도로
        </span>
      </Legend>
    </Wrap>
  );
}

const STATUS_LABEL = { far: "5km 밖", behind: "부채꼴 밖", opposite: "반대 방향", otherRoad: "다른 도로", ahead: "선별" };
