// src/services/placeStore.js — 목적지 입력의 최근 목적지·집/회사. 이 기기(localStorage)에만 둔다.
import { useSyncExternalStore } from "react";

const KEY = "apbollae.places.v1";
const MAX_RECENT = 10;
const EMPTY = { recent: [], home: null, work: null };

let state = load();
const listeners = new Set();

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v ? { ...EMPTY, ...v, recent: Array.isArray(v.recent) ? v.recent : [] } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function commit(next) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장이 막힌 브라우저 — 이번 실행 동안만
  }
  listeners.forEach((fn) => fn());
}

const slim = (p) => ({ id: p.id || `${p.lat},${p.lng}`, name: p.name, address: p.address || "", category: p.category || "", lat: p.lat, lng: p.lng });
const same = (a, b) => a.id === b.id || (Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5);

export function addRecent(place) {
  const p = slim(place);
  commit({ ...state, recent: [p, ...state.recent.filter((r) => !same(r, p))].slice(0, MAX_RECENT) });
}

export function removeRecent(place) {
  commit({ ...state, recent: state.recent.filter((r) => !same(r, place)) });
}

/** which: "home" | "work", place: 장소 또는 null(지우기) */
export function setFavorite(which, place) {
  commit({ ...state, [which]: place ? slim(place) : null });
}

export function usePlaces() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state
  );
}
