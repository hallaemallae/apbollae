// src/features/linking/linkingPolicy.js — 할래말래 linkingPolicy 에서 결제(intent://·AppLink) 부분을 뺀 것
import { Linking } from "react-native";

export function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

export async function openExternal(url) {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    // ignore
  }
}

/** http(s) 가 아닌 스킴(tel:, mailto:, 앱 스킴)은 웹뷰 밖에서 연다 */
export function handleShouldStartLoadRequest(req) {
  const url = String(req?.url || "");
  if (!url || isHttpUrl(url) || url.startsWith("about:")) return true;
  openExternal(url);
  return false;
}
