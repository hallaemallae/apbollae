// src/utils/toast.js — 할래말래 appDialog.showToast 와 같은 쓰임새의 최소 버전(React 밖에서도 호출 가능)
const listeners = new Set();

export function showToast(message, durationMs = 2600) {
  listeners.forEach((fn) => fn({ message, durationMs, id: Date.now() + Math.random() }));
}

export function onToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
