// src/context/DriveDataContext.jsx — 주행 화면(홈 탭)이 계산한 "앞 상황"을 다른 탭(앞길·기록)과 나눈다.
// 위치·선별·소통 계산은 홈 탭(DrivePage)에만 있고, 탭을 옮겨도 DrivePage 는 숨겨진 채 살아 있다(MainTabs).
// 다른 탭에서 CCTV 를 고르면 selectCctv() → 홈 탭이 그 영상을 튼다.
// 내보내기(publish)와 읽기(data)를 다른 컨텍스트로 나눈다 — 내보내는 홈 탭이 자기 데이터 변경으로 다시 그려지지 않게.
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const DataContext = createContext(null);
const PublishContext = createContext(() => {});

export function DriveDataProvider({ children }) {
  const [data, setData] = useState(null);
  const selectCctv = useCallback((id, item) => {
    window.dispatchEvent(new CustomEvent("apb:select", { detail: { id, item } }));
  }, []);
  const value = useMemo(() => ({ data, selectCctv }), [data, selectCctv]);
  return (
    <PublishContext.Provider value={setData}>
      <DataContext.Provider value={value}>{children}</DataContext.Provider>
    </PublishContext.Provider>
  );
}

/** 다른 탭에서 읽기: { data, selectCctv } */
export function useDriveData() {
  return useContext(DataContext);
}

/** 홈 탭에서 내보내기 */
export function useDrivePublish() {
  return useContext(PublishContext);
}
