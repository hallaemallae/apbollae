import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { onToast } from "../../utils/toast";

const Bubble = styled.div`
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + 28px);
  transform: translateX(-50%);
  z-index: 2000;
  max-width: min(420px, calc(100vw - 32px));
  padding: 13px 20px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(242, 243, 245, 0.96)" : "rgba(25, 27, 30, 0.92)")};
  color: ${({ theme }) => (theme.mode === "dark" ? "#191B1E" : "#FFFFFF")};
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  box-shadow: ${({ theme }) => theme.shadow.float};
  pointer-events: none; /* 아래 버튼을 가리지 않게 — 토스트는 누를 수 없다 */
  animation: toastIn 0.18s ease-out;
  @keyframes toastIn {
    from { opacity: 0; transform: translate(-50%, 8px); }
  }
`;

export default function Toast() {
  const [toast, setToast] = useState(null);

  useEffect(() => onToast(setToast), []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.durationMs);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <Bubble role="status" key={toast.id}>
      {toast.message}
    </Bubble>
  );
}
