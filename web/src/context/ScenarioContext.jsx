// src/context/ScenarioContext.jsx
// 흐름 점검용 시나리오 스위치(개발 패널이 조작). DB·서버 없이 E1~E6 를 재현하기 위한 것이다.
// flowStatus 는 각 화면이 "지금 기능흐름도 몇 단계·어떤 예외인지"를 보고하는 자리다.
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const DEFAULTS = {
  source: "sim", // sim: 시뮬레이션 주행 | device: 실제 위치(RN GPS 또는 브라우저)
  speed: "normal", // simulator.SPEED_PRESETS 키
  tunnel: false, // E3 신호 끊김
  apiDown: false, // E6 ITS 장애
  brokenFeeds: false, // E5 송출 중단 CCTV 실패시키기
  denyPermission: false, // E2 권한 거부
};

const ScenarioContext = createContext(null);

export function ScenarioProvider({ children }) {
  const [scenario, setScenario] = useState(DEFAULTS);
  const [flowStatus, setFlowStatus] = useState({ step: 1, exceptions: [] });
  const lastKeyRef = useRef("");

  const set = useCallback((patch) => setScenario((s) => ({ ...s, ...patch })), []);

  const reportFlow = useCallback((step, exceptions = []) => {
    const key = `${step}|${exceptions.join(",")}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    setFlowStatus({ step, exceptions });
  }, []);

  const value = useMemo(() => ({ scenario, set, flowStatus, reportFlow }), [scenario, set, flowStatus, reportFlow]);
  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario() {
  return useContext(ScenarioContext);
}
