// 비밀번호 재설정 — Firebase 가 재설정 메일을 보낸다(실제 연동)
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import Button from "../../components/common/Button";
import { AuthHeader, AuthLead, AuthScreen, AuthTitle, Field, FormError } from "../../components/auth/AuthParts";
import { useAuth } from "../../context/AuthContext";
import { authErrorMessage } from "../../services/authService";

const Form = styled.form`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const Sent = styled.div`
  padding: 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 15px;
  line-height: 1.6;
`;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await resetPassword(email);
      setSentTo(email.trim());
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <AuthHeader />
      <AuthTitle>비밀번호 재설정</AuthTitle>
      <AuthLead>가입한 이메일로 재설정 링크를 보내 드려요.</AuthLead>
      {sentTo ? (
        <>
          <Sent role="status">
            <b>{sentTo}</b>로 재설정 메일을 보냈어요. 메일의 링크에서 새 비밀번호를 정한 뒤 다시 로그인해 주세요. 메일이 안 보이면 스팸함도
            확인해 주세요.
          </Sent>
          <div style={{ marginTop: "auto", paddingTop: 24 }}>
            <Button fullWidth onClick={() => navigate("/login/email", { replace: true })}>
              로그인으로 돌아가기
            </Button>
          </div>
        </>
      ) : (
        <Form onSubmit={submit} noValidate>
          <Field label="이메일" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          <div style={{ marginTop: "auto", paddingTop: 24 }}>
            {error ? <FormError role="alert">{error}</FormError> : null}
            <Button type="submit" fullWidth disabled={busy || !email}>
              {busy ? "보내는 중" : "재설정 메일 보내기"}
            </Button>
          </div>
        </Form>
      )}
    </AuthScreen>
  );
}
