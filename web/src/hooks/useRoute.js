// src/hooks/useRoute.js
// 목적지가 있을 때 자동차 경로를 받아 두고, 내 위치를 경로 위에 놓는다.
//  - 경로에서 300m 넘게 벗어나면 30초 간격을 두고 경로를 다시 찾는다
//  - 목적지 300m 안이면 경로 기준 선별을 끝내고 부채꼴 기준으로 돌아간다
//  - 경로를 못 찾으면 부채꼴 기준으로 계속 쓴다(배너로 알림)
import { useEffect, useMemo, useRef, useState } from "react";
import { useFlow } from "../context/FlowContext";
import { useScenario } from "../context/ScenarioContext";
import { fetchRoute } from "../services/routeApi";
import { buildRoute, congestionAhead, locate, roadAt, ROUTE_OPTS } from "../utils/routeFilter";
import { showToast } from "../utils/toast";

const REROUTE_GAP_MS = 30_000;

export default function useRoute(fix, heading) {
  const { destination, setDestination } = useFlow();
  const { scenario } = useScenario();
  const [route, setRoute] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);
  const busyRef = useRef(false);
  const fixRef = useRef(fix);
  fixRef.current = fix;
  const headingRef = useRef(heading);
  headingRef.current = heading;

  const load = (reason) => {
    const from = fixRef.current;
    if (!destination || !from || busyRef.current) return;
    busyRef.current = true;
    lastFetchRef.current = Date.now();
    setStatus((s) => (s === "ready" ? s : "loading"));
    fetchRoute(from, destination, headingRef.current, { data: scenario.data })
      .then((raw) => {
        setRoute(buildRoute(raw));
        setStatus("ready");
        setError(null);
        if (reason === "reroute") showToast("경로를 벗어나 새 경로로 다시 골랐어요");
      })
      .catch((e) => {
        setError(e.code || e.message);
        setStatus("error");
      })
      .finally(() => {
        busyRef.current = false;
      });
  };

  // 목적지가 바뀌면(또는 위치가 처음 잡히면) 경로를 받는다
  const hasFix = !!fix;
  useEffect(() => {
    setRoute(null);
    setError(null);
    setStatus(destination ? "loading" : "idle");
    if (destination && hasFix) load("new");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, hasFix, scenario.data]);

  // 내 위치를 경로 위에
  const here = useMemo(() => (route && fix ? locate(route, fix) : null), [route, fix]);

  useEffect(() => {
    if (!route || !here) return;
    if (route.total - here.s < ROUTE_OPTS.arriveKm) {
      showToast(`${destination?.name || "목적지"} 근처예요. 경로 기준 선별을 마쳤어요.`);
      setDestination(null);
      return;
    }
    if (here.offKm > ROUTE_OPTS.offRouteKm && Date.now() - lastFetchRef.current > REROUTE_GAP_MS) load("reroute");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);

  const ready = status === "ready" && !!route && !!here;
  return {
    destination,
    status,
    error,
    route: ready ? route : null,
    s0: here?.s ?? 0,
    remainingKm: ready ? Math.max(0, route.total - here.s) : null,
    road: ready ? roadAt(route, here.road) : null,
    congestion: ready ? congestionAhead(route, here.s) : null,
    retry: () => load("retry"),
  };
}
