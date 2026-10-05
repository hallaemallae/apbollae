// src/dev/reviewThreadStore.js — 리뷰 기록 스레드 저장소.
// 할래말래는 Firestore(reviewThreads)로 공유했지만, 앞볼래는 로컬에서만 본다 → 이 브라우저의 localStorage.
// 같은 PC·같은 브라우저의 다른 탭과는 storage 이벤트로 맞춘다. 다른 사람·다른 기기와는 공유되지 않는다.
// 각 기록 = { pid, screenId, by, at, text, replyTo?, imgs?, pins? }

const KEY = "apbollae.reviewThreads";
const listeners = new Set();

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function group(list) {
  const all = {};
  for (const e of list) (all[e.screenId] ||= []).push(e);
  return all;
}

function writeAll(list) {
  // 스샷이 많으면 localStorage 한도(약 5MB)를 넘을 수 있다 — 그때는 저장 실패를 그대로 알린다
  localStorage.setItem(KEY, JSON.stringify(list));
  const all = group(list);
  listeners.forEach((cb) => cb(all));
}

const kstNow = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

/** 전체 스레드 구독 → { screenId: [기록...] } */
export function subscribeThread(cb) {
  const onStorage = (e) => {
    if (e.key === KEY) cb(group(readAll()));
  };
  listeners.add(cb);
  window.addEventListener("storage", onStorage);
  cb(group(readAll()));
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export async function postEntry({ screenId, by, text, replyTo, imgs, pins }) {
  const entry = { pid: crypto.randomUUID(), screenId, by: by || "개발자", text: (text || "").trim(), at: kstNow() };
  if (replyTo) entry.replyTo = replyTo;
  if (Array.isArray(imgs) && imgs.length) entry.imgs = imgs;
  if (Array.isArray(pins) && pins.length) entry.pins = pins.slice(0, 30);
  writeAll([...readAll(), entry]);
}

/** 삭제 — 글을 지우면 그 글에 달린 답글도 함께 */
export async function deleteEntry(pid) {
  writeAll(readAll().filter((e) => e.pid !== pid && e.replyTo !== pid));
}
