// src/services/authService.js
// 로그인 창구 — 할래말래 authService 의 역할을 앞볼래 크기로 줄였다.
//  - 이메일: Firebase Auth 실제 연동
//  - 카카오·구글·Apple: 지금은 목업(누르면 바로 로그인된 것으로 처리)
//      실제 연동 시 할래말래와 같은 방식: 웹 → RN START_SIGNIN { provider } → SIGNIN_RESULT { idToken/accessToken }
//      → 구글·Apple 은 signInWithCredential, 카카오는 Cloud Function 커스텀 토큰 → signInWithCustomToken
//
// 약관 동의·가입 완료 여부(프로필)
//  - 이메일 사용자: Firestore users/{uid} (services/userService.js)
//  - 목업 소셜 사용자: Firebase 계정이 없어 DB 에 쓸 수 없으므로 기기 localStorage 에 uid 별로 둔다.
//    실제 소셜 연동이 붙으면 이 분기는 사라지고 모두 Firestore 로 간다.
import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "../config/firebase";
import * as userService from "./userService";

const MOCK_KEY = "apb.mockUser";
const GUEST_KEY = "apb.guest";
const CONSENT_KEY = (uid) => `apb.consent.${uid}`;
const WELCOME_KEY = (uid) => `apb.welcome.${uid}`;

export const TERMS_VERSION = "2026-10-03";

export const PROVIDER_LABEL = { email: "이메일", kakao: "카카오", google: "구글", apple: "Apple" };

const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};

/* ── 이메일 (실제) ───────────────────────────── */

export const signInEmail = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password);
export const signUpEmail = (email, password) => createUserWithEmailAndPassword(auth, email.trim(), password);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

/** Firebase 오류 코드 → 사용자 문구 */
export function authErrorMessage(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-email": "이메일 형식을 확인해 주세요.",
    "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않아요.",
    "auth/wrong-password": "이메일 또는 비밀번호가 맞지 않아요.",
    "auth/user-not-found": "이메일 또는 비밀번호가 맞지 않아요.",
    "auth/email-already-in-use": "이미 가입된 이메일이에요. 로그인해 주세요.",
    "auth/weak-password": "비밀번호를 8자 이상으로 정해 주세요.",
    "auth/too-many-requests": "시도가 많아 잠시 막혔어요. 잠시 뒤 다시 시도해 주세요.",
    "auth/network-request-failed": "인터넷 연결을 확인해 주세요.",
    "auth/requires-recent-login": "보안을 위해 다시 로그인한 뒤 탈퇴해 주세요.",
    "auth/configuration-not-found": "이메일 로그인이 아직 켜져 있지 않아요. Firebase 콘솔 Authentication 에서 켜 주세요.",
    "auth/operation-not-allowed": "이메일 로그인이 아직 켜져 있지 않아요. Firebase 콘솔 Authentication 에서 켜 주세요.",
  };
  return map[code] || `요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요. (${code || "unknown"})`;
}

/* ── 소셜 (목업) ─────────────────────────────── */

export function signInMock(provider) {
  const user = { uid: `mock-${provider}`, provider, displayName: `${PROVIDER_LABEL[provider]} 사용자` };
  write(MOCK_KEY, JSON.stringify(user));
  return user;
}

export function readMockUser() {
  try {
    return JSON.parse(read(MOCK_KEY)) || null;
  } catch {
    return null;
  }
}

/* ── 게스트 ──────────────────────────────────── */

export const readGuest = () => read(GUEST_KEY) === "1";
export const setGuest = (on) => write(GUEST_KEY, on ? "1" : null);

/* ── 프로필: 동의·가입 완료 ───────────────── */

const isDbUser = (user) => user?.provider === "email";

function readLocal(uid) {
  let consents = null;
  try {
    consents = JSON.parse(read(CONSENT_KEY(uid))) || null;
  } catch {}
  return { consents, welcomeSeen: read(WELCOME_KEY(uid)) === "1" };
}

/** @returns {Promise<{ consents: object|null, welcomeSeen: boolean }>} */
export async function loadProfile(user) {
  if (!isDbUser(user)) return readLocal(user.uid);
  const d = await userService.ensureUserDoc(user);
  return { consents: d.consents || null, welcomeSeen: d.welcomeSeen === true };
}

export async function saveConsent(user, consent) {
  const consents = { ...consent, version: TERMS_VERSION, at: new Date().toISOString() };
  if (isDbUser(user)) await userService.saveConsents(user.uid, consents);
  else write(CONSENT_KEY(user.uid), JSON.stringify(consents));
  return consents;
}

export async function markWelcomeSeen(user) {
  if (isDbUser(user)) await userService.markWelcomeSeen(user.uid);
  else write(WELCOME_KEY(user.uid), "1");
}

/* ── 로그아웃·탈퇴 ───────────────────────────── */

export async function signOutAll() {
  write(MOCK_KEY, null);
  if (auth.currentUser) await fbSignOut(auth);
}

/**
 * 탈퇴 — 이메일 계정은 Firestore 문서와 Firebase 계정을 실제로 지운다. 목업은 기기 기록만 지운다.
 * 계정 삭제는 최근 로그인을 요구할 수 있어(auth/requires-recent-login) 실패하면 지운 문서를 되살린다.
 */
export async function deleteAccount(user) {
  if (isDbUser(user) && auth.currentUser) {
    const backup = await userService.ensureUserDoc(user);
    await userService.deleteUserDoc(user.uid);
    try {
      await deleteUser(auth.currentUser);
    } catch (err) {
      await userService.restoreUserDoc(user.uid, backup).catch(() => {});
      throw err;
    }
  }
  write(CONSENT_KEY(user.uid), null);
  write(WELCOME_KEY(user.uid), null);
  write(MOCK_KEY, null);
}
