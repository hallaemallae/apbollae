// 흐름 3 — 위치 권한(최초 1회). 거부되면 E2: 이유 안내 + 설정 이동, 목록은 비운다.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiMapPin } from "react-icons/fi";
import Button from "../components/common/Button";
import { Bottom, Lead, Screen, Title } from "./PassengerPage";
import { useFlow } from "../context/FlowContext";
import { useScenario } from "../context/ScenarioContext";
import { useBridge } from "../context/WebviewBridgeContext";
import { onceFromApp } from "../bridge/webviewBridge";
import { showToast } from "../utils/toast";

const Pin = styled.div`
  width: 64px;
  height: 64px;
  margin-bottom: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid ${({ theme, $off }) => ($off ? theme.colors.danger : theme.colors.primary)};
  color: ${({ theme, $off }) => ($off ? theme.colors.danger : theme.colors.primary)};
`;

// 번호 붙은 항목 — 면 색 박스 없이 위 구분선만
const Points = styled.ol`
  list-style: none;
  counter-reset: pt;
  margin: 8px 0 0;
  padding: 18px 2px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14.5px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textNormal};
  li {
    counter-increment: pt;
    display: flex;
    gap: 10px;
  }
  li::before {
    content: counter(pt);
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primaryText};
    font-size: 12px;
    font-weight: 800;
  }
`;

/** 권한 요청 — 시뮬레이션 / RN 셸 / 브라우저 */
function requestLocation({ scenario, bridge }) {
  if (scenario.source === "sim") {
    return new Promise((r) => setTimeout(() => r(!scenario.denyPermission), 500));
  }
  if (bridge?.isWebView) {
    return new Promise((r) => {
      onceFromApp("PERMISSION_RESULT", (p) => r(!!p.granted));
      bridge.sendToApp("REQUEST_LOCATION_PERMISSION");
    });
  }
  return new Promise((r) => {
    if (!navigator.geolocation) return r(false);
    navigator.geolocation.getCurrentPosition(
      () => r(true),
      (err) => r(err.code !== 1),
      { timeout: 8000 }
    );
  });
}

export default function PermissionPage() {
  const navigate = useNavigate();
  const { permission, setPermission } = useFlow();
  const { scenario, reportFlow } = useScenario();
  const bridge = useBridge();
  const [busy, setBusy] = useState(false);
  const denied = permission === "denied";

  useEffect(() => {
    reportFlow(3, denied ? ["E2"] : []);
  }, [reportFlow, denied]);

  const ask = async () => {
    setBusy(true);
    const granted = await requestLocation({ scenario, bridge });
    setBusy(false);
    setPermission(granted ? "granted" : "denied");
    if (granted) navigate("/drive", { replace: true });
  };

  const openSettings = () => {
    if (bridge?.isWebView) bridge.sendToApp("OPEN_SETTINGS");
    else showToast("주소창 왼쪽 자물쇠 아이콘에서 위치를 허용으로 바꿔 주세요", 3500);
  };

  if (denied) {
    return (
      <Screen>
        <Pin $off aria-hidden="true">
          <FiMapPin size={30} />
        </Pin>
        <Title>위치 권한이 꺼져 있어요</Title>
        <Lead>
          내 위치와 진행 방향을 모르면 앞쪽 CCTV를 고를 수 없어서 목록이 비어 있어요. 설정에서 위치를 ‘앱을 사용하는 동안 허용’으로
          바꿔 주세요.
        </Lead>
        <Bottom>
          <Button fullWidth onClick={openSettings}>
            설정 열기
          </Button>
          <Button variant="secondary" fullWidth disabled={busy} onClick={ask}>
            설정을 바꿨어요, 다시 확인
          </Button>
        </Bottom>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pin aria-hidden="true">
        <FiMapPin size={30} />
      </Pin>
      <Title>내 앞 CCTV를 찾으려면 위치가 필요해요</Title>
      <Points>
        <li>현재 위치와 진행 방향으로 앞쪽 5km 안의 CCTV만 골라요.</li>
        <li>30초마다, 또는 500m를 갈 때마다 목록을 새로 고쳐요.</li>
        <li>이동 기록은 저장하지 않아요.</li>
      </Points>
      <Bottom>
        <Button fullWidth disabled={busy} onClick={ask}>
          {busy ? "권한 요청 중" : "위치 권한 허용"}
        </Button>
      </Bottom>
    </Screen>
  );
}
