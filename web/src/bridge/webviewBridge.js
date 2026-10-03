// src/bridge/webviewBridge.js
// RN WebView ↔ Web 브릿지 유틸리티 (React 의존 없음)

/**
 * 현재 환경이 RN WebView 안인지 감지
 */
export function isInWebView() {
  try {
    return typeof window !== "undefined" && !!window.ReactNativeWebView;
  } catch {
    return false;
  }
}

/**
 * Web → RN 타입 기반 메시지 발송
 * @param {string} type - 메시지 타입 (e.g. "WEB_READY", "NAV_STATE")
 * @param {object} payload
 * @returns {boolean} 발송 성공 여부
 */
export function postToApp(type, payload = {}) {
  if (!isInWebView()) return false;
  try {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type, payload })
    );
    return true;
  } catch (e) {
    console.warn("[Bridge] postToApp error:", e);
    return false;
  }
}

/**
 * RN → Web 수신 메시지 파싱
 * @param {*} eventData - window message event.data
 * @returns {{ type: string, payload: object } | null}
 */
export function parseAppMessage(eventData) {
  try {
    const data =
      typeof eventData === "string" ? JSON.parse(eventData) : eventData;
    if (!data?.type) return null;
    return { type: data.type, payload: data.payload || {} };
  } catch {
    return null;
  }
}

/**
 * 글로벌 1회성 메시지 대기 (React 의존 없음)
 * WebviewBridgeContext와 같은 window message 이벤트를 공유
 */
const _oneTimeListeners = {};

export function onceFromApp(type, callback) {
  if (!_oneTimeListeners[type]) {
    _oneTimeListeners[type] = new Set();
  }
  _oneTimeListeners[type].add(callback);
  return () => _oneTimeListeners[type]?.delete(callback);
}

/**
 * 상시 구독 (페이지가 살아있는 동안 계속 받는다)
 *
 * onceFromApp 은 "지금 기다리는 중인 프라미스"에만 쓸 수 있다. 외부 앱을 다녀오는 사이
 * RN 이 WebView 를 리로드하면 그 프라미스가 페이지와 함께 사라지고, 뒤늦게 도착한 결과를
 * 받을 곳이 없어진다. 모듈 로드 시점에 걸어 두는 구독이 그 구멍을 막는다.
 */
const _listeners = {};

export function onFromApp(type, callback) {
  if (!_listeners[type]) {
    _listeners[type] = new Set();
  }
  _listeners[type].add(callback);
  return () => _listeners[type]?.delete(callback);
}

// 글로벌 메시지 핸들러 (1회 등록)
// RN WebView: iOS는 window에, Android는 document에 message가 dispatch됨
if (typeof window !== "undefined") {
  const _globalHandler = (event) => {
    const msg = parseAppMessage(event.data);
    if (!msg) return;
    const cbs = _oneTimeListeners[msg.type];
    if (cbs?.size) {
      const arr = [...cbs];
      cbs.clear();
      arr.forEach((cb) => {
        try { cb(msg.payload); } catch (e) { console.warn("[Bridge] once error:", e); }
      });
    }
    const persistent = _listeners[msg.type];
    if (persistent?.size) {
      [...persistent].forEach((cb) => {
        try { cb(msg.payload); } catch (e) { console.warn("[Bridge] on error:", e); }
      });
    }
  };
  window.addEventListener("message", _globalHandler);
  if (typeof document !== "undefined") {
    document.addEventListener("message", _globalHandler);
  }
}
