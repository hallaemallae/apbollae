// src/components/auth/AuthParts.jsx
// 로그인 화면 공통 조각 — 할래말래 AuthPageHeader(뒤로 + 제목) 와 입력칸을 앞볼래 스타일로.
// 카카오내비 톤: 흰 바탕, 회색 면 입력칸(포커스 때 파란 테두리), 밑줄 없는 회색 글자 링크.
import React from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { FiChevronLeft } from "react-icons/fi";

export const AuthScreen = styled.main`
  min-height: 100%;
  background: ${({ theme }) => theme.colors.surface};
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 0 20px calc(env(safe-area-inset-bottom) + 20px);
`;

const Bar = styled.header`
  height: calc(env(safe-area-inset-top) + 52px);
  padding-top: env(safe-area-inset-top);
  margin: 0 -14px;
  display: flex;
  align-items: center;
  button {
    width: 48px;
    height: 48px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

export function AuthHeader({ onBack }) {
  const navigate = useNavigate();
  return (
    <Bar>
      <button type="button" aria-label="뒤로" onClick={onBack || (() => navigate(-1))}>
        <FiChevronLeft size={28} />
      </button>
    </Bar>
  );
}

export const AuthTitle = styled.h1`
  margin: 12px 0 8px;
  font-size: 25px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.03em;
`;

export const AuthLead = styled.p`
  margin: 0 0 32px;
  font-size: 15.5px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const FieldWrap = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
  span {
    font-size: 14px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textNormal};
  }
  input {
    height: 56px;
    padding: 0 16px;
    border-radius: ${({ theme }) => theme.radius.md}px;
    border: 1.5px solid ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.border)};
    background: ${({ theme }) => theme.colors.surface};
    font-size: 17px;
    font-weight: 600;
    outline: none;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  input::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
    font-weight: 500;
  }
  input:focus {
    border-color: ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.primary)};
    background: ${({ theme }) => theme.colors.surface};
  }
  small {
    font-size: 13px;
    color: ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.textWeak)};
  }
`;

export function Field({ label, hint, error, ...input }) {
  return (
    <FieldWrap $error={!!error}>
      <span>{label}</span>
      <input {...input} aria-invalid={!!error} />
      {error || hint ? <small>{error || hint}</small> : null}
    </FieldWrap>
  );
}

export const FormError = styled.p`
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.danger};
`;

export const TextLink = styled.button`
  align-self: center;
  min-height: 44px;
  padding: 0 12px;
  border: none;
  background: transparent;
  font-size: 14.5px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/** 앞볼래 로고(앱 아이콘과 같은 그림) — 스플래시·로그인·약관·가입 완료 화면 공통 */
const LogoImg = styled.img`
  display: block;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $size }) => Math.round($size * 0.24)}px;
  box-shadow: ${({ theme }) => (theme.mode === "dark" ? "0 10px 30px rgba(0, 0, 0, 0.45)" : "0 8px 24px rgba(20, 24, 28, 0.18)")};
`;

export function BrandLogo({ size = 132 }) {
  return <LogoImg src="/logo-512.png" alt="앞볼래" width={size} height={size} $size={size} />;
}

const spin = keyframes`to { transform: rotate(360deg); }`;
const Dim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1700;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: ${({ theme }) => theme.colors.overlay};
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  &::before {
    content: "";
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.25);
    border-top-color: ${({ theme }) => theme.colors.primary};
    animation: ${spin} 0.8s linear infinite;
  }
`;

/** 할래말래 LoginPage 의 "로그인 중…" 오버레이 */
export function BusyOverlay({ text = "로그인 중" }) {
  return <Dim role="status">{text}</Dim>;
}
