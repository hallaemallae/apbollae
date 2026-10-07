// src/services/accuracyLog.js
// 테스트 주행 정확도 기록 — 차터 KPI "전방 선별 정확도 90%+ (테스트 경로 20곳)" 측정용.
// 주행 중 동승자가 "지금 고른 CCTV 가 정말 내 앞인지"를 지점마다 판정해 남긴다.
// 이 기기(localStorage)에만 저장하고, CSV 로 내려받거나 복사해 팀과 나눈다.
import { useSyncExternalStore } from "react";

const KEY = "apbollae.accuracy.v1";
export const TARGET_POINTS = 20;
export const KPI_TARGET = 0.9;

// 틀림 사유 — 선별 알고리즘의 어느 단계가 틀렸는지 나중에 가르기 위한 것
export const WRONG_REASONS = {
  opposite: "반대 차로",
  behind: "이미 지남",
  otherRoad: "다른 도로",
  other: "기타",
};

const EMPTY = { enabled: false, entries: [] };
let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw);
    return { enabled: !!v.enabled, entries: Array.isArray(v.entries) ? v.entries : [] };
  } catch {
    return EMPTY;
  }
}

function commit(next) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 공간이 막힌 브라우저 — 이번 실행 동안만 메모리에 둔다
  }
  listeners.forEach((fn) => fn());
}

export function setRecordEnabled(enabled) {
  commit({ ...state, enabled });
}

export function addEntry(entry) {
  const no = (state.entries.at(-1)?.no || 0) + 1;
  commit({ ...state, entries: [...state.entries, { ...entry, no }] });
  return no;
}

export function removeLastEntry() {
  commit({ ...state, entries: state.entries.slice(0, -1) });
}

export function clearEntries() {
  commit({ ...state, entries: [] });
}

export function useAccuracyLog() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state
  );
}

/**
 * 지표
 *  - cctv : 고른 CCTV 중 정말 내 앞이었던 비율(판정한 CCTV 기준) — KPI 의 주 지표
 *  - first: 1순위(자동 재생) CCTV 가 맞았던 지점 비율
 *  - point: 고른 CCTV 가 모두 맞고 놓친 CCTV 도 없던 지점 비율
 */
export function summarize(entries) {
  let judged = 0;
  let correct = 0;
  let firstN = 0;
  let firstOk = 0;
  let pointOk = 0;
  entries.forEach((e) => {
    e.items.forEach((it) => {
      judged += 1;
      if (it.ok) correct += 1;
    });
    if (e.items.length) {
      firstN += 1;
      if (e.items[0].ok) firstOk += 1;
    }
    if (e.items.every((it) => it.ok) && !e.missed) pointOk += 1;
  });
  const ratio = (a, b) => (b ? a / b : null);
  return {
    points: entries.length,
    judged,
    correct,
    cctv: ratio(correct, judged),
    first: ratio(firstOk, firstN),
    point: ratio(pointOk, entries.length),
  };
}

export const pct = (r) => (r == null ? "-" : `${Math.round(r * 1000) / 10}%`);

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CCTV 판정 한 건이 한 줄. 고른 CCTV 가 없던 지점은 CCTV 칸을 비운 한 줄. */
export function toCsv(entries) {
  const head = [
    "지점", "시각", "지점 이름", "위도", "경도", "진행 방위", "방위 출처", "속도(km/h)", "선별 방식", "도로", "목적지",
    "순위", "CCTV ID", "CCTV 이름", "출처", "거리(km)", "판정", "틀림 사유", "놓친 CCTV 수", "메모",
  ];
  const rows = [head];
  entries.forEach((e) => {
    const base = [
      e.no,
      new Date(e.t).toLocaleString("ko-KR"),
      e.label,
      e.lat?.toFixed(6),
      e.lng?.toFixed(6),
      e.heading != null ? Math.round(e.heading) : "",
      e.headingSource,
      e.speed != null ? Math.round(e.speed) : "",
      e.mode,
      e.road,
      e.destination,
    ];
    const tail = [e.missed || 0, e.memo];
    if (!e.items.length) rows.push([...base, "", "", "", "", "", "CCTV 없음", "", ...tail]);
    e.items.forEach((it, i) =>
      rows.push([...base, i + 1, it.id, it.name, it.source, it.km?.toFixed(2), it.ok ? "맞음" : "틀림", it.ok ? "" : WRONG_REASONS[it.reason] || "", ...tail])
    );
  });
  // 엑셀이 한글을 깨뜨리지 않게 BOM 을 붙인다
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(entries) {
  const blob = new Blob([toCsv(entries)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  a.href = url;
  a.download = `apbollae-accuracy-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** WebView 처럼 내려받기가 안 되는 곳에서 쓰는 복사 */
export async function copyCsv(entries) {
  await navigator.clipboard.writeText(toCsv(entries).replace(/^﻿/, ""));
}
