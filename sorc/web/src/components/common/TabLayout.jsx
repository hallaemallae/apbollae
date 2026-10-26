// src/components/common/TabLayout.jsx — 하단 탭바(홈·앞길·기록·내 정보). 할래말래 layouts/components/BottomTabBar 를 옮겼다.
//  - 할래말래는 아이콘 이미지를 마스크로 칠하지만, 여기서는 react-icons(Feather)로 같은 모양을 낸다.
//  - 탭바는 화면 맨 아래에 붙이고(fixed 아님), 위쪽 본문이 남은 높이를 채운다 — 주행 화면의 절대 배치가 탭바 위에서 끝나게.
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiHome, FiActivity, FiClock, FiUser } from "react-icons/fi";

const TAB_HEIGHT = 60; // 할래말래 theme.layout.bottomTabHeight

// 홈: 지금 앞이 어때? · 앞길: 왜 막히고 어디까지야? · 기록: 아까 왜 막혔지? · 내 정보
const TABS = [
  { key: "home", label: "홈", path: "/drive", Icon: FiHome },
  { key: "ahead", label: "앞길", path: "/ahead", Icon: FiActivity },
  { key: "log", label: "기록", path: "/log", Icon: FiClock },
  { key: "my", label: "내 정보", path: "/info", Icon: FiUser },
];

const Shell = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Body = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
`;

const Bar = styled.nav`
  flex: none;
  z-index: 30;
  height: calc(${TAB_HEIGHT}px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
`;

const Item = styled.button`
  flex: 1;
  border: none;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textWeak)};
`;

export default function TabLayout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <Shell>
      <Body>{children}</Body>
      <Bar aria-label="주 메뉴">
        {TABS.map(({ key, label, path, Icon }) => {
          const active = pathname.startsWith(path);
          return (
            <Item key={key} type="button" $active={active} aria-current={active ? "page" : undefined} onClick={() => !active && navigate(path)}>
              <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
              {label}
            </Item>
          );
        })}
      </Bar>
    </Shell>
  );
}
