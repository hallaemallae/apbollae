// src/components/drive/CctvPlayer.jsx
// F-04 1순위 자동 재생 / E5 재생 실패 → onError 로 알리면 부모가 다음 CCTV 로 넘긴다.
// 한 번에 1개만 재생한다(이 컴포넌트는 화면에 하나뿐).
// cctv.url 이 있으면(실제 ITS) HLS 영상을 재생하고, 없으면(목업) MockFeed 를 그린다.
//  - Safari·iOS WebView 는 HLS 를 직접 재생, 그 밖(Chrome·Android WebView)은 hls.js 로 재생
//  - ITS 영상 서버는 CORS 를 허용한다(Access-Control-Allow-Origin: *, 2026-10-03 확인)
//  - 출처 줄은 CCTV 출처(cctv.source)마다 기관 이용조건대로 쓴다. UTIC 은 "경찰청 도시교통정보센터(UTIC) 제공" 표기가 의무다.
import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import Hls from "hls.js";
import { FiVideoOff } from "react-icons/fi";
import MockFeed from "./MockFeed";

// 출처 표기 — source 가 없으면(목업 포함) ITS
const SOURCE_LABEL = {
  its: "출처: 국가교통정보센터(ITS)",
  utic: "경찰청 도시교통정보센터(UTIC) 제공",
};

const CONNECT_MS = 900;
const FAIL_MS = 1800;
const LIVE_TIMEOUT_MS = 12000; // 이 안에 첫 화면이 안 나오면 송출 중단으로 본다(E5)

const Video = styled.video`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: ${({ $contain }) => ($contain ? "contain" : "cover")};
  background: #0e1012;
`;

/** 실제 CCTV HLS 재생. 첫 프레임이 나오면 onPlaying, 치명적 오류·시간 초과면 onFail */
function LiveVideo({ url, onPlaying, onFail, contain }) {
  const ref = useRef(null);
  const cb = useRef({ onPlaying, onFail });
  cb.current = { onPlaying, onFail };

  useEffect(() => {
    const video = ref.current;
    let hls = null;
    let done = false;
    const fail = (why) => {
      if (done) return;
      done = true;
      console.warn("[cctv] 재생 실패:", why);
      cb.current.onFail?.();
    };
    const timer = setTimeout(() => fail("timeout"), LIVE_TIMEOUT_MS);
    const playing = () => {
      clearTimeout(timer);
      cb.current.onPlaying?.();
    };
    video.addEventListener("playing", playing);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.addEventListener("error", () => fail("native error"), { once: true });
      video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 2, maxBufferLength: 10 });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) fail(`${data.type}/${data.details}`);
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    } else {
      fail("hls unsupported");
    }

    return () => {
      done = true;
      clearTimeout(timer);
      video.removeEventListener("playing", playing);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);

  // 음성 없음(운전자 주의 분산 방지) · 인라인 재생 · 자동 재생
  // crossOrigin: Safari(네이티브 HLS)에서도 장면 공유(캔버스로 옮겨 그리기)가 되게
  return <Video ref={ref} $contain={contain} muted playsInline autoPlay crossOrigin="anonymous" aria-label="CCTV 실시간 영상" />;
}

const Frame = styled.div`
  position: relative;
  width: 100%;
  /* 전체 화면에서는 부모(화면)를 채우고 영상은 잘리지 않게 contain */
  /* 일반 화면은 4:3 — ITS CCTV 원본 대부분이 4:3(640×480)이라 위아래로 더 크게, 덜 잘린다 */
  ${({ $full }) => ($full ? "height: 100%;" : "aspect-ratio: 4 / 3;")}
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

// 앞쪽 CCTV 없음(E4) 안내 — 영상 칸 안에 그린다
const Empty = styled(Layer)`
  gap: 6px;
  color: #9aa1a6;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.55;
  white-space: pre-line;
  > svg {
    margin-bottom: 4px;
    color: #6f777d;
  }
  b {
    font-size: 16px;
    font-weight: 700;
    color: #e7e9e6;
  }
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
  gap: 8px;
  padding: 18px ${({ $reserveRight }) => ($reserveRight ? 96 : 12)}px 8px 12px;
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

/**
 * empty: 재생할 CCTV 가 없을 때 영상 칸에 띄울 안내 { title, sub } (없으면 기본 문구)
 * full : 전체 화면(가로 모드·영상 탭) — 화면을 채우고 영상을 자르지 않는다
 * reserveRight: 오른쪽 아래에 부모가 띄운 버튼(전체 화면) 자리를 비운다
 */
export default function CctvPlayer({ cctv, willFail, blocked, onError, empty, full = false, reserveRight = false }) {
  const [phase, setPhase] = useState("connecting"); // connecting | playing | failed
  const now = useClock();

  const live = !!cctv?.url;

  useEffect(() => {
    setPhase("connecting");
    if (!cctv || live) return undefined; // 실제 영상은 LiveVideo 가 단계를 알린다
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
  }, [cctv?.id, willFail, live]);

  return (
    <Frame $full={full}>
      {cctv && live && phase !== "failed" && (
        <LiveVideo
          key={cctv.id}
          url={cctv.url}
          contain={full}
          onPlaying={() => setPhase("playing")}
          onFail={() => {
            setPhase("failed");
            onError?.(cctv);
          }}
        />
      )}
      {cctv && !live && phase === "playing" && <MockFeed seed={cctv.id} flow={cctv.flow} blocked={blocked} />}

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

      {!cctv && empty ? (
        <Empty role="status">
          <FiVideoOff size={28} aria-hidden="true" />
          <b>{empty.title}</b>
          {empty.sub}
        </Empty>
      ) : null}
      {!cctv && !empty && <Layer style={{ color: "#9AA1A6" }}>재생할 CCTV가 없어요</Layer>}

      {cctv && (
        <>
          <Top>
            <Name>{cctv.name}</Name>
            {phase === "playing" && <Live>실시간</Live>}
          </Top>
          <Bottom $reserveRight={reserveRight}>
            <span>
              {now.getFullYear()}-{pad(now.getMonth() + 1)}-{pad(now.getDate())} {pad(now.getHours())}:
              {pad(now.getMinutes())}:{pad(now.getSeconds())}
            </span>
            <span style={{ textAlign: "right" }}>
              {SOURCE_LABEL[cctv.source] || SOURCE_LABEL.its}
              {live ? "" : " · 모의 영상"}
            </span>
          </Bottom>
        </>
      )}
    </Frame>
  );
}
