// src/components/common/CheckCircle.jsx — 동그란 체크 표시(동승자 확인·약관 동의 공통).
// 켜지면 파란 원 + 흰 체크, 꺼지면 옅은 회색 원 + 회색 체크.
import React from "react";
import styled from "styled-components";
import { FiCheck } from "react-icons/fi";

const Dot = styled.span`
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme, $on }) => ($on ? theme.colors.primary : "transparent")};
  box-shadow: ${({ theme, $on }) => ($on ? "none" : `inset 0 0 0 2px ${theme.colors.border}`)};
  color: ${({ theme, $on }) => ($on ? theme.colors.primaryText : theme.colors.textWeak)};
  transition: background 0.15s ease;
`;

export default function CheckCircle({ on, size = 26 }) {
  return (
    <Dot $on={on} $size={size} aria-hidden="true">
      <FiCheck size={Math.round(size * 0.62)} strokeWidth={3.2} />
    </Dot>
  );
}
