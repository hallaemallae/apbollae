// 이메일 로그인 — Firebase Auth 실제 연동
import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import styled from "styled-components";
import Button from "../../components/common/Button";
import { AuthHeader, AuthLead, AuthScreen, AuthTitle, Field, FormError, TextLink } from "../../components/auth/AuthParts";
import { useAuth } from "../../context/AuthContext";
import { useScenario } from "../../context/ScenarioContext";
import { authErrorMessage } from "../../services/authService";

const Form = styled.form`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const Links = styled.div`
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 6px;
`;

export default function EmailLoginPage() {
  const navigate = useNavigate();
  const { user, loading, signInEmail } = useAuth();
  const { reportFlow } = useScenario();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    reportFlow("L1");
  }, [reportFlow]);

  if (!loading && user) return <Navigate to="/confirm" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInEmail(email, pw);
      navigate("/confirm", { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <AuthHeader />
      <AuthTitle>이메일로 로그인</AuthTitle>
      <AuthLead>가입한 이메일과 비밀번호를 입력해 주세요.</AuthLead>
      <Form onSubmit={submit} noValidate>
        <Field label="이메일" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        <Field label="비밀번호" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Links>
          <TextLink type="button" onClick={() => navigate("/login/reset")}>
            비밀번호를 잊었어요
          </TextLink>
        </Links>
        <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", flexDirection: "column", gap: 6 }}>
          {error ? <FormError role="alert">{error}</FormError> : null}
          <Button type="submit" fullWidth disabled={busy || !email || !pw}>
            {busy ? "로그인 중" : "로그인"}
          </Button>
          <TextLink type="button" onClick={() => navigate("/signup/email")}>
            처음이에요, 이메일로 가입하기
          </TextLink>
        </div>
      </Form>
    </AuthScreen>
  );
}
