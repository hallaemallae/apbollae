// src/config/firebase.js
// Firebase 웹 설정 — 공개해도 되는 값(브라우저에 그대로 내려가는 값)이다. 비밀 키(ITS 인증키 등)는 여기 두지 않는다.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCC--8AffVLulQo8U6WVAGrDBticglcW4w",
  authDomain: "apbollae.firebaseapp.com",
  projectId: "apbollae",
  storageBucket: "apbollae.firebasestorage.app",
  messagingSenderId: "768630054464",
  appId: "1:768630054464:web:ec367f6e008b2e2fff89a5",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
auth.languageCode = "ko"; // 비밀번호 재설정 메일 등을 한국어로
