// 이메일 가입 — Firebase Auth 실제 연동. 가입하면 바로 로그인되고 약관 동의 게이트로 이어진다.
import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import styled from "styled-components";
import Button from "../../components/common/Button";
import { AuthHeader, AuthLead, AuthScreen, AuthTitle, Field, FormError } from "../../components/auth/AuthParts";
import { useAuth } from "../../context/AuthContext";
import { useScenario } from "../../context/ScenarioContext";
import { authErrorMessage } from "../../services/authService";

const Form = styled.form`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PW = 8;

export default function EmailSignupPage() {
  const navigate = useNavigate();
  const { user, loading, signUpEmail } = useAuth();
  const { reportFlow } = useScenario();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    reportFlow("L1");
  }, [reportFlow]);

  if (!loading && user) return <Navigate to="/confirm" replace />;

  const emailErr = touched && email && !EMAIL_RE.test(email.trim()) ? "이메일 형식을 확인해 주세요." : "";
  const pwErr = touched && pw && pw.length < MIN_PW ? `${MIN_PW}자 이상으로 정해 주세요.` : "";
  const pw2Err = touched && pw2 && pw !== pw2 ? "비밀번호가 서로 달라요." : "";
  const ready = EMAIL_RE.test(email.trim()) && pw.length >= MIN_PW && pw === pw2;

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!ready) return;
    setError("");
    setBusy(true);
    try {
      await signUpEmail(email, pw);
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
      <AuthTitle>이메일로 가입</AuthTitle>
      <AuthLead>이메일과 비밀번호만 있으면 돼요.</AuthLead>
      <Form onSubmit={submit} noValidate onBlur={() => setTouched(true)}>
        <Field label="이메일" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" error={emailErr} />
        <Field label="비밀번호" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint={`${MIN_PW}자 이상`} error={pwErr} />
        <Field label="비밀번호 확인" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={pw2Err} />
        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          {error ? <FormError role="alert">{error}</FormError> : null}
          <Button type="submit" fullWidth disabled={busy || !ready}>
            {busy ? "가입하는 중" : "가입하기"}
          </Button>
        </div>
      </Form>
    </AuthScreen>
  );
}
