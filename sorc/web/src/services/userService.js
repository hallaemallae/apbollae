// src/services/userService.js
// Firestore users/{uid} — 이메일 로그인 사용자의 약관 동의·가입 완료 여부.
// 할래말래 userService(saveUserConsents 등)와 같은 자리. 필드:
//   email, provider, consents{ age14, terms, privacy, location, marketing, version, at }, welcomeSeen, createdAt, updatedAt
// 위치정보는 여기에 저장하지 않는다.
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

const userRef = (uid) => doc(db, "users", uid);

/** 문서가 없으면 만들고(첫 로그인), 있으면 읽어 온다 */
export async function ensureUserDoc({ uid, email, provider }) {
  const snap = await getDoc(userRef(uid));
  if (snap.exists()) return snap.data();
  const now = serverTimestamp();
  const data = { email: email || null, provider, consents: null, welcomeSeen: false, createdAt: now, updatedAt: now };
  await setDoc(userRef(uid), data);
  return data;
}

export function saveConsents(uid, consents) {
  return setDoc(userRef(uid), { consents, updatedAt: serverTimestamp() }, { merge: true });
}

export function markWelcomeSeen(uid) {
  return setDoc(userRef(uid), { welcomeSeen: true, updatedAt: serverTimestamp() }, { merge: true });
}

export function deleteUserDoc(uid) {
  return deleteDoc(userRef(uid));
}

/** 탈퇴 실패 시 되돌리기용 */
export function restoreUserDoc(uid, data) {
  return setDoc(userRef(uid), data);
}
