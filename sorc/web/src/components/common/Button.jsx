// 할래말래 Button 기반 — 조수석 손 흔들림을 고려해 높이를 키웠다(52px+)
// 카카오내비처럼 주 버튼은 파란 면, 보조 버튼은 테두리 없는 회색 면.
import React from "react";
import styled, { css } from "styled-components";

const StyledButton = styled.button`
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
  min-height: ${({ theme }) => theme.layout.touch + 4}px;
  padding: 0 22px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: none;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  transition: transform 0.08s ease, opacity 0.15s ease, background 0.15s ease;
  &:active:not(:disabled) { transform: scale(0.985); }
  &:disabled { cursor: not-allowed; }

  ${({ $variant, theme }) =>
    $variant === "primary"
      ? css`
          background: ${theme.colors.primary};
          color: ${theme.colors.primaryText};
          /* 누를 수 없을 때 — 옅은 파랑 면 대신 진한 회색 면 */
          &:disabled { background: ${theme.colors.textWeak}; color: ${theme.colors.primaryText}; }
        `
      : css`
          background: ${theme.colors.surface};
          border: 1.5px solid ${theme.colors.border};
          color: ${theme.colors.textStrong};
          &:disabled { opacity: 0.45; }
        `}
`;

export default function Button({ children, variant = "primary", fullWidth = false, ...rest }) {
  return (
    <StyledButton type="button" $variant={variant} $fullWidth={fullWidth} {...rest}>
      {children}
    </StyledButton>
  );
}
