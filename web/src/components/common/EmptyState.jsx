// src/components/common/EmptyState.jsx — 할래말래 EmptyState 이식(로고 이미지 대신 아이콘만)
import React from "react";
import styled from "styled-components";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 40px 24px;
`;

const Icon = styled.div`
  font-size: 30px;
  line-height: 1;
  margin-bottom: 4px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Title = styled.div`
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Sub = styled.div`
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-line;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export default function EmptyState({ icon, text, sub }) {
  return (
    <Wrap role="status">
      {icon ? <Icon aria-hidden="true">{icon}</Icon> : null}
      {text ? <Title>{text}</Title> : null}
      {sub ? <Sub>{sub}</Sub> : null}
    </Wrap>
  );
}
