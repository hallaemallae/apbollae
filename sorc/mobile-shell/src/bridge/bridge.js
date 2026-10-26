// src/bridge/bridge.js
export function createBridge({ webViewRef, debugTag = "[BRIDGE]" }) {
  let webReady = false;
  const queue = [];

  const setWebReady = (ready) => {
    webReady = !!ready;
  };

  const getWebReady = () => webReady;

  const post = (rawJson) => {
    const wv = webViewRef.current;

    if (!wv) {
      queue.push(rawJson);
      console.log(debugTag, "queue (no webViewRef). size=", queue.length);
      return;
    }

    if (!webReady) {
      queue.push(rawJson);
      console.log(debugTag, "queue (web not ready). size=", queue.length);
      return;
    }

    try {
      wv.postMessage(rawJson);
    } catch (e) {
      console.log(debugTag, "postMessage error:", e?.message || e);
      queue.push(rawJson);
    }
  };

  const send = (type, payload = {}) => {
    try {
      post(JSON.stringify({ type, payload }));
    } catch (e) {
      console.log(debugTag, "send stringify error:", e?.message || e);
    }
  };

  const sendRaw = (rawJson) => post(rawJson);

  const parseIncoming = (raw) => {
    if (typeof raw !== "string") return null;
    try {
      const data = JSON.parse(raw);
      const type = String(data?.type || "");
      if (!type) return null;
      return { type, payload: data?.payload };
    } catch {
      return null;
    }
  };

  const flushQueue = () => {
    const wv = webViewRef.current;
    if (!wv || !webReady) return;

    console.log(debugTag, "flushQueue size=", queue.length);
    while (queue.length) {
      const s = queue.shift();
      if (!s) break;
      try {
        wv.postMessage(s);
      } catch (e) {
        console.log(debugTag, "flush postMessage error:", e?.message || e);
        break;
      }
    }
  };

  /**
   * webReady 상태와 무관하게 injectJavaScript로 강제 전달
   * 카카오 로그인처럼 Activity 복귀 후 WebView가 리로드되는 경우 사용
   */
  const forceSend = (type, payload = {}) => {
    const wv = webViewRef.current;
    if (!wv) {
      console.log(debugTag, "forceSend: no webViewRef, queuing");
      queue.push(JSON.stringify({ type, payload }));
      return;
    }
    const json = JSON.stringify({ type, payload });
    const js = `(function(){try{window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(json)}}));}catch(e){}})();true;`;
    console.log(debugTag, "forceSend:", type);
    wv.injectJavaScript(js);
  };

  return { setWebReady, getWebReady, send, sendRaw, parseIncoming, flushQueue, forceSend };
}
