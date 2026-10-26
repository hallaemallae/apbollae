// src/components/common/BridgeNavSync.jsx
// 할래말래 AppRoutes 의 NAV_STATE / BACK_REQUEST / APP_EXIT_REQUEST 처리를 앞볼래 크기로 줄인 것.
// RN 셸(App.js)은 그대로 — 안드로이드 뒤로가기를 웹에 위임한다.
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBridge } from "../../context/WebviewBridgeContext";
import { showToast } from "../../utils/toast";

// 더 뒤로 갈 곳이 없는 화면 → 뒤로가기 두 번이면 종료
const ROOTS = ["/", "/login", "/confirm", "/permission", "/drive"];
const ARM_WINDOW_MS = 2000;

export default function BridgeNavSync() {
  const bridge = useBridge();
  const location = useLocation();
  const navigate = useNavigate();
  const armedAtRef = useRef(0);
  const isRoot = ROOTS.includes(location.pathname);
  const isRootRef = useRef(isRoot);
  isRootRef.current = isRoot;

  useEffect(() => {
    bridge?.sendToApp("NAV_STATE", { isRoot, path: location.pathname, canGoBackInWeb: !isRoot });
  }, [bridge, isRoot, location.pathname]);

  useEffect(() => {
    if (!bridge) return undefined;

    const exit = () => {
      const now = Date.now();
      if (armedAtRef.current && now - armedAtRef.current <= ARM_WINDOW_MS) {
        armedAtRef.current = 0;
        bridge.sendToApp("EXIT_APP");
        return;
      }
      armedAtRef.current = now;
      showToast("한 번 더 누르면 종료돼요", ARM_WINDOW_MS);
    };

    const offBack = bridge.subscribe("BACK_REQUEST", () => (isRootRef.current ? exit() : navigate(-1)));
    const offExit = bridge.subscribe("APP_EXIT_REQUEST", exit);
    return () => {
      offBack();
      offExit();
    };
  }, [bridge, navigate]);

  return null;
}
