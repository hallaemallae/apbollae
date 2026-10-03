// src/components/drive/CctvPlayer.jsx
// F-04 1순위 자동 재생 / E5 재생 실패 → onError 로 알리면 부모가 다음 CCTV 로 넘긴다.
// 한 번에 1개만 재생한다(이 컴포넌트는 화면에 하나뿐).
// 실제 연결 시: MockFeed 자리에 <video> + hls.js (RN 쪽은 react-native-video) 로 cctv.url 을 재생.
import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import MockFeed from "./MockFeed";

const CONNECT_MS = 900;
const FAIL_MS = 1800;

const Frame = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #0E1012;
  overflow: hidden;
`;

const Layer = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #E7E9E6;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  padding: 0 24px;
`;

const spin = keyframes`to { transform: rotate(360deg); }`;
const Ring = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: ${({ theme }) => theme.colors.lane};
  animation: ${spin} 0.8s linear infinite;
`;

const Top = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px 24px;
  background: linear-gradient(rgba(0, 0, 0, 0.55), transparent);
  color: #fff;
  pointer-events: none;
`;

const Name = styled.div`
  font-size: 15px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
`;

const blink = keyframes`50% { opacity: 0.25; }`;
const Live = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  font-size: 12px;
  font-weight: 700;
  &::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #FF4B3E;
    animation: ${blink} 1.4s ease-in-out infinite;
  }
`;

const Bottom = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  padding: 18px 12px 8px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  font-weight: 600;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
`;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const pad = (n) => String(n).padStart(2, "0");

export default function CctvPlayer({ cctv, willFail, blocked, onError }) {
  const [phase, setPhase] = useState("connecting"); // connecting | playing | failed
  const now = useClock();

  useEffect(() => {
    setPhase("connecting");
    if (!cctv) return undefined;
    if (willFail) {
      const t = setTimeout(() => {
        setPhase("failed");
        onError?.(cctv);
      }, FAIL_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("playing"), CONNECT_MS);
    return () => clearTimeout(t);
    // onError 는 부모 렌더마다 바뀌어도 재연결하면 안 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cctv?.id, willFail]);

  return (
    <Frame>
      {cctv && phase === "playing" && <MockFeed seed={cctv.id} flow={cctv.flow} blocked={blocked} />}

      {cctv && phase === "connecting" && (
        <Layer>
          <Ring />
          영상 연결 중
        </Layer>
      )}

      {cctv && phase === "failed" && (
        <Layer>
          영상이 나오지 않는 CCTV예요.
          <span style={{ fontSize: 13, opacity: 0.75 }}>다음 CCTV로 넘어갈게요.</span>
        </Layer>
      )}

      {!cctv && <Layer style={{ color: "#9AA1A6" }}>재생할 CCTV가 없어요</Layer>}

      {cctv && (
        <>
          <Top>
            <Name>{cctv.name}</Name>
            {phase === "playing" && <Live>실시간</Live>}
          </Top>
          <Bottom>
            <span>
              {now.getFullYear()}-{pad(now.getMonth() + 1)}-{pad(now.getDate())} {pad(now.getHours())}:
              {pad(now.getMinutes())}:{pad(now.getSeconds())}
            </span>
            <span>출처: 국가교통정보센터(ITS) · 모의 영상</span>
          </Bottom>
        </>
      )}
    </Frame>
  );
}
