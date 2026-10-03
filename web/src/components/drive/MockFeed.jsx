// src/components/drive/MockFeed.jsx
// 모의 CCTV 영상 — 실제 HLS 스트림이 붙기 전까지 흐름 점검용으로 쓴다.
// 고정 카메라에서 본 4차로 도로를 캔버스로 그리고, CCTV 의 flow(원활/서행/정체)에 따라
// 차량 수·속도를 바꾼다. 카드를 바꿔 보면 "어디까지 막히는지"를 눈으로 비교할 수 있다.
import React, { useEffect, useRef } from "react";
import styled from "styled-components";

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
`;

const FLOW = {
  smooth: { count: 7, speed: 0.22 },
  slow: { count: 13, speed: 0.07 },
  jam: { count: 22, speed: 0.018 },
};

const CAR_COLORS = ["#D9DCDF", "#2B2F33", "#E8E8E6", "#4B5D73", "#7A1E1E", "#9AA3A8", "#1F3A2E"];

// 시드 고정 난수 — 같은 CCTV 는 매번 같은 장면으로 시작한다
function seeded(seedStr) {
  let s = [...seedStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export default function MockFeed({ seed, flow = "smooth", blocked = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const rnd = seeded(seed);
    const cfg = FLOW[flow] || FLOW.smooth;

    const cars = Array.from({ length: cfg.count }, () => ({
      lane: Math.floor(rnd() * 4),
      z: rnd(),
      color: CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)],
      phase: rnd() * 6,
    }));
    // 사고 배지가 있는 CCTV 화면에는 2차로에 멈춘 차를 둔다
    const wreck = blocked ? { lane: 1, z: 0.42 } : null;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const horizon = () => h * 0.3;
    const persp = (z) => Math.pow(1 - z, 1.9); // z 0=가까움 → 1=지평선
    const roadW = (p) => w * 0.07 + (w * 1.25 - w * 0.07) * p;
    const cx = (p) => w * 0.56 - (w * 0.56 - w * 0.5) * p;
    const yAt = (p) => horizon() + (h - horizon()) * p;
    const laneX = (lane, p) => cx(p) + (lane - 1.5) * (roadW(p) / 4);

    const drawCar = (lane, z, color, hazard) => {
      const p = persp(z);
      const lw = roadW(p) / 4;
      const cw = lw * 0.62;
      const ch = cw * 0.62;
      const x = laneX(lane, p) - cw / 2;
      const y = yAt(p) - ch;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(x + cw * 0.05, y + ch * 0.85, cw * 0.95, ch * 0.22);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cw, ch);
      ctx.fillStyle = "rgba(20,24,28,0.55)";
      ctx.fillRect(x + cw * 0.12, y + ch * 0.08, cw * 0.76, ch * 0.3);
      ctx.fillStyle = hazard ? "#FFA21F" : "#C81E1E";
      ctx.fillRect(x + cw * 0.04, y + ch * 0.55, cw * 0.16, ch * 0.16);
      ctx.fillRect(x + cw * 0.8, y + ch * 0.55, cw * 0.16, ch * 0.16);
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t = now / 1000;

      // 하늘·지면
      const sky = ctx.createLinearGradient(0, 0, 0, horizon());
      sky.addColorStop(0, "#6D7880");
      sky.addColorStop(1, "#9AA2A6");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon());
      ctx.fillStyle = "#4A5148";
      ctx.fillRect(0, horizon(), w, h - horizon());

      // 노면
      ctx.fillStyle = "#3C3F43";
      ctx.beginPath();
      ctx.moveTo(cx(0) - roadW(0) / 2, yAt(0));
      ctx.lineTo(cx(0) + roadW(0) / 2, yAt(0));
      ctx.lineTo(cx(1) + roadW(1) / 2, yAt(1));
      ctx.lineTo(cx(1) - roadW(1) / 2, yAt(1));
      ctx.closePath();
      ctx.fill();

      // 차선 — 고정 카메라라 움직이지 않는다
      for (let i = 0; i <= 4; i += 1) {
        const edge = i === 0 || i === 4;
        ctx.strokeStyle = i === 0 ? "#D9B400" : "rgba(235,235,230,0.8)";
        ctx.lineWidth = edge ? 2 : 1.5;
        ctx.setLineDash(edge ? [] : [10, 14]);
        ctx.beginPath();
        for (let s = 0; s <= 20; s += 1) {
          const p = s / 20;
          const x = cx(p) + (i - 2) * (roadW(p) / 4);
          if (s === 0) ctx.moveTo(x, yAt(p));
          else ctx.lineTo(x, yAt(p));
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 차량 — 먼 것부터 그려야 가까운 차가 위에 온다
      cars.forEach((c) => {
        const stopGo = flow === "jam" ? Math.max(0, Math.sin(t * 0.6 + c.phase)) : 1;
        const slowedByWreck = wreck && c.lane === wreck.lane && c.z < wreck.z && wreck.z - c.z < 0.08;
        if (!slowedByWreck) c.z += cfg.speed * stopGo * dt * (0.8 + c.phase / 15);
        if (c.z > 1) {
          c.z = 0;
          c.lane = Math.floor(rnd() * 4);
        }
      });
      const drawList = [...cars.map((c) => ({ ...c, hazard: false }))];
      if (wreck) drawList.push({ ...wreck, color: "#E8E8E6", hazard: Math.floor(t * 2) % 2 === 0 });
      drawList.sort((a, b) => b.z - a.z).forEach((c) => drawCar(c.lane, c.z, c.color, c.hazard));

      // CCTV 특유의 저화질 줄무늬
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let y = (t * 40) % 4; y < h; y += 4) ctx.fillRect(0, y, w, 1);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [seed, flow, blocked]);

  return <Canvas ref={ref} aria-hidden="true" />;
}
