// src/components/common/MainTabs.jsx — 탭 4개(홈·앞길·기록·내 정보)를 한 화면 틀에 담는다.
// 홈(DrivePage)은 탭을 옮겨도 숨긴 채 계속 살아 있다 — 위치 수신·CCTV 선별·소통 계산이 끊기지 않게.
// 숨겨진 동안은 영상만 내린다(visible=false → 데이터 절약).
import React from "react";
import { useLocation } from "react-router-dom";
import styled from "styled-components";
import TabLayout from "./TabLayout";
import DrivePage from "../../pages/DrivePage";
import AheadPage from "../../pages/AheadPage";
import LogPage from "../../pages/LogPage";
import InfoPage from "../../pages/InfoPage";

const Pane = styled.div`
  position: absolute;
  inset: 0;
  display: ${({ $hidden }) => ($hidden ? "none" : "block")};
`;

export default function MainTabs() {
  const { pathname } = useLocation();
  const onHome = pathname.startsWith("/drive");
  return (
    <TabLayout>
      <Pane $hidden={!onHome}>
        <DrivePage visible={onHome} />
      </Pane>
      {pathname.startsWith("/ahead") ? <AheadPage /> : null}
      {pathname.startsWith("/log") ? <LogPage /> : null}
      {pathname.startsWith("/info") ? <InfoPage /> : null}
    </TabLayout>
  );
}
