// 할래말래 Button 기반 — 조수석 손 흔들림을 고려해 높이를 키웠다(52px+)
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
  transition: transform 0.08s ease, opacity 0.15s ease;
  &:active:not(:disabled) { transform: translateY(1px); }
  &:disabled { opacity: 0.38; cursor: not-allowed; }

  ${({ $variant, theme }) =>
    $variant === "primary"
      ? css`
          background: ${theme.colors.lane};
          color: ${theme.colors.laneText};
        `
      : css`
          background: transparent;
          color: ${theme.colors.textStrong};
          border: 1.5px solid ${theme.colors.border};
        `}
`;

export default function Button({ children, variant = "primary", fullWidth = false, ...rest }) {
  return (
    <StyledButton type="button" $variant={variant} $fullWidth={fullWidth} {...rest}>
      {children}
    </StyledButton>
  );
}
