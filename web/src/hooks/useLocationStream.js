// src/hooks/useLocationStream.js
// F-02 위치·진행 방향 수신 — 1초 주기.
// 출처는 셋 중 하나: 시뮬레이션 / RN 셸 GPS(LOCATION_UPDATE) / 브라우저 geolocation
import { useEffect, useRef, useState } from "react";
import { useBridge } from "../context/WebviewBridgeContext";
import { useScenario } from "../context/ScenarioContext";
import { step, stepTrip } from "../services/simulator";
import { resolveHeading } from "../utils/heading";

const TRAIL_MAX = 120;
const SIGNAL_LOST_MS = 5000;

export default function useLocationStream(active) {
  const bridge = useBridge();
  const { scenario } = useScenario();
  const [snapshot, setSnapshot] = useState({ fix: null, heading: null, headingSource: null, signalLost: false });

  const trailRef = useRef([]);
  const lastValidRef = useRef(null);
  const lastFixAtRef = useRef(0);
  const speedRef = useRef(scenario.speed);
  const tunnelRef = useRef(scenario.tunnel);
  speedRef.current = scenario.speed;
  tunnelRef.current = scenario.tunnel;

  useEffect(() => {
    if (!active) return undefined;

    const push = (fix) => {
      lastFixAtRef.current = Date.now();
      trailRef.current = [...trailRef.current.slice(-TRAIL_MAX + 1), fix];
    };

    // 1초마다 상태를 확정한다(새 점이 없으면 신호 끊김 판정)
    const tick = () => {
      if (scenario.source === "sim" && !tunnelRef.current) push(step(1, speedRef.current));
      if (scenario.source === "trip" && !tunnelRef.current) push(stepTrip(1, speedRef.current));
      const signalLost = tunnelRef.current || Date.now() - lastFixAtRef.current > SIGNAL_LOST_MS;
      const h = resolveHeading(trailRef.current, lastValidRef.current, signalLost);
      if (h.heading != null && h.source !== "hold") lastValidRef.current = { heading: h.heading };
      const fix = trailRef.current[trailRef.current.length - 1] || null;
      setSnapshot({ fix, heading: h.heading, headingSource: h.source, signalLost });
    };

    let cleanupSource = () => {};
    if (scenario.source === "device") {
      if (bridge?.isWebView) {
        bridge.sendToApp("START_LOCATION", { intervalMs: 1000 });
        const off = bridge.subscribe("LOCATION_UPDATE", (p) =>
          push({ lat: p.latitude, lng: p.longitude, heading: p.heading, speed: p.speed != null ? p.speed * 3.6 : null, t: p.timestamp || Date.now() })
        );
        cleanupSource = () => {
          off();
          bridge.sendToApp("STOP_LOCATION");
        };
      } else if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(
          (pos) =>
            push({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading,
              speed: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
              t: pos.timestamp,
            }),
          () => {},
          { enableHighAccuracy: true, maximumAge: 0 }
        );
        // 브라우저는 움직이지 않으면 새 위치를 거의 안 준다 — 마지막 값을 1초마다 다시 넣어 '신호 끊김'으로 오인하지 않게
        const keep = setInterval(() => {
          const last = trailRef.current[trailRef.current.length - 1];
          if (last && Date.now() - last.t > 1500) push({ ...last, t: Date.now() });
        }, 1000);
        cleanupSource = () => {
          navigator.geolocation.clearWatch(id);
          clearInterval(keep);
        };
      }
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
      cleanupSource();
    };
  }, [active, scenario.source, bridge]);

  return snapshot;
}
