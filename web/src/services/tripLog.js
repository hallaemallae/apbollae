// src/services/tripLog.js — ⑩ 지나온 정체 원인 기록. "아까 왜 막혔지?"에 답한다.
// 정체 구간을 빠져나오거나 돌발 지점을 지나면 한 건씩 남긴다. 이 기기(localStorage)에만, 최근 200건.
import { useSyncExternalStore } from "react";
import { REVIEW_MOCK } from "../dev/reviewMock";

const KEY = "apbollae.tripLog.v1";
const MAX = 200;

// 리뷰 허브 목업이면 기기 기록 대신 시나리오의 견본을 쓰고, 저장소에는 쓰지 않는다
const MOCK = REVIEW_MOCK ? REVIEW_MOCK.tripLog || [] : null;
let entries = MOCK || load();
const listeners = new Set();

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function commit(next) {
  entries = next;
  if (MOCK) {
    listeners.forEach((fn) => fn());
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // 저장이 막힌 브라우저 — 이번 실행 동안만 메모리에 둔다
  }
  listeners.forEach((fn) => fn());
}

/**
 * @param {{ kind: "jam"|"event", startedAt:number, endedAt:number, road?:string, lengthKm?:number, cause?:{ type, label, lanes, message } | null, lat?:number, lng?:number }} entry
 */
export function addTripEntry(entry) {
  commit([{ id: `${entry.endedAt}-${Math.random().toString(36).slice(2, 7)}`, ...entry }, ...entries].slice(0, MAX));
}

export function clearTripLog() {
  commit([]);
}

export function useTripLog() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => entries
  );
}
