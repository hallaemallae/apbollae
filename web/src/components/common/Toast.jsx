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
  padding: 12px 18px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => (theme.mode === "dark" ? "#F2F3F0" : "#15191C")};
  color: ${({ theme }) => (theme.mode === "dark" ? "#15191C" : "#F2F3F0")};
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
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
