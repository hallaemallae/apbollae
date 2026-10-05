// src/context/FlowContext.jsx
// 실행 → 동승자 확인(F-01) → 위치 권한(F-02) 의 진행 상태.
// 동승자 확인은 "매 주행" 받는다 — 저장하지 않고 메모리에만 둬서 앱을 새로 켜면 다시 묻는다.
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { REVIEW_MOCK } from "../dev/reviewMock";

const FlowContext = createContext(null);

export function FlowProvider({ children }) {
  const [passenger, setPassenger] = useState(!!REVIEW_MOCK?.passenger);
  const [permission, setPermission] = useState(REVIEW_MOCK?.permission || "unknown"); // unknown | granted | denied
  const [dataNoticeSeen, setDataNoticeSeen] = useState(!!REVIEW_MOCK?.notice);
  const [destination, setDestination] = useState(null); // { name, address, lat, lng } — 선택 기능

  const resetDrive = useCallback(() => {
    setPassenger(false);
    setPermission("unknown");
    setDataNoticeSeen(false);
    setDestination(null);
  }, []);

  const value = useMemo(
    () => ({
      passenger,
      setPassenger,
      permission,
      setPermission,
      dataNoticeSeen,
      setDataNoticeSeen,
      destination,
      setDestination,
      resetDrive,
    }),
    [passenger, permission, dataNoticeSeen, destination, resetDrive]
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  return useContext(FlowContext);
}
