// src/components/common/TabPage.jsx — 탭 화면(앞길·기록)의 공통 틀: 붙는 머리글 + 본문. 내 정보 화면(InfoPage)의 Bar 와 같은 모양.
import styled from "styled-components";

export const TabPage = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding-bottom: 32px;
`;

export const TabBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 5;
  height: calc(env(safe-area-inset-top) + 52px);
  padding: env(safe-area-inset-top) 20px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${({ theme }) => theme.colors.bg};
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
  }
  small {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

/* 할래말래 지도 위 카드와 같은 흰 카드 */
export const Card = styled.section`
  margin: 12px 16px 0;
  padding: 16px;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => (theme.mode === "dark" ? theme.colors.border : "#E8EAEF")};
  box-shadow: ${({ theme }) => (theme.mode === "dark" ? "none" : "0 4px 14px rgba(0, 0, 0, 0.06)")};
  h2 {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 800;
  }
`;

export const Empty = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textWeak};
`;
