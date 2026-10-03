// src/context/AuthContext.jsx
// 로그인 상태 — 할래말래 AuthContext 처럼 상태 enum 대신 플래그로 게이트를 판단한다.
//  user        : 로그인한 사용자(이메일=Firebase, 소셜=목업) 또는 null
//  isGuest     : "로그인 없이 시작"을 고른 기기
//  needsConsent: 로그인했지만 필수 약관 동의 전 → AgreementGate
//  needsWelcome: 동의했지만 가입 완료 화면을 아직 안 봄 → SignupCompletePage
// 앱을 다시 켜면 Firebase 가 로그인을 스스로 복원하고(onAuthStateChanged), 목업·게스트는 localStorage 에서 읽는다.
// 동의·가입 완료(프로필)는 이메일 사용자면 Firestore users/{uid}, 목업이면 기기에서 읽는다(authService.loadProfile).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

const REQUIRED = ["age14", "terms", "privacy", "location"];

export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(undefined); // undefined = 복원 중
  const [mockUser, setMockUser] = useState(authService.readMockUser);
  const [isGuest, setIsGuest] = useState(authService.readGuest);
  const [profile, setProfile] = useState(null); // { consents, welcomeSeen }
  const [profileState, setProfileState] = useState("idle"); // idle | loading | ready | error

  useEffect(() => onAuthStateChanged(auth, (u) => setFbUser(u || null)), []);

  const user = useMemo(() => {
    if (fbUser) return { uid: fbUser.uid, provider: "email", email: fbUser.email, displayName: fbUser.email?.split("@")[0] };
    return mockUser;
  }, [fbUser, mockUser]);

  // 로그인한 사람이 바뀌면 프로필을 다시 읽는다
  const uid = user?.uid;
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileState("idle");
      return undefined;
    }
    let alive = true;
    setProfileState("loading");
    authService
      .loadProfile(user)
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        setProfileState("ready");
      })
      .catch((err) => {
        console.warn("[auth] 프로필을 읽지 못함:", err);
        if (!alive) return;
        setProfile({ consents: null, welcomeSeen: false });
        setProfileState("error");
      });
    return () => {
      alive = false;
    };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsConsent = !!user && !REQUIRED.every((k) => profile?.consents?.[k] === true);
  const needsWelcome = !!user && !needsConsent && profile?.welcomeSeen !== true;

  const afterLogin = useCallback(() => {
    authService.setGuest(false);
    setIsGuest(false);
  }, []);

  const value = useMemo(
    () => ({
      loading: fbUser === undefined || (!!user && (profileState === "idle" || profileState === "loading")),
      profileError: profileState === "error",
      user,
      isGuest,
      needsConsent,
      needsWelcome,

      signInEmail: async (email, pw) => {
        await authService.signInEmail(email, pw);
        afterLogin();
      },
      signUpEmail: async (email, pw) => {
        await authService.signUpEmail(email, pw);
        afterLogin();
      },
      resetPassword: authService.resetPassword,
      signInMock: (provider) => {
        setMockUser(authService.signInMock(provider));
        afterLogin();
      },
      continueAsGuest: () => {
        authService.setGuest(true);
        setIsGuest(true);
      },
      saveConsent: async (c) => {
        const consents = await authService.saveConsent(user, c);
        setProfile((p) => ({ ...p, consents }));
      },
      markWelcomeSeen: async () => {
        await authService.markWelcomeSeen(user);
        setProfile((p) => ({ ...p, welcomeSeen: true }));
      },
      signOut: async () => {
        await authService.signOutAll();
        setMockUser(null);
      },
      deleteAccount: async () => {
        await authService.deleteAccount(user);
        await authService.signOutAll();
        setMockUser(null);
      },
      /** 흐름 점검용 — 로그인·게스트 상태를 모두 지우고 첫 설치 상태로 */
      resetEntry: async () => {
        await authService.signOutAll();
        authService.setGuest(false);
        setMockUser(null);
        setIsGuest(false);
      },
    }),
    [fbUser, user, isGuest, needsConsent, needsWelcome, afterLogin, profileState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
