// src/components/dev/ScenarioPanel.jsx
// 흐름 점검 패널 — 기능흐름도 1~9 단계 중 지금 위치, 발생 중인 예외(E1~E6)를 보여 주고
// 시나리오 스위치로 예외를 일부러 일으킨다. 출시 빌드에서는 빼거나 ?dev=0 으로 숨긴다.
// 시연 영상에 걸리지 않게 화면 가장자리 버튼은 두지 않고, 내 정보 > 개발 > 흐름 점검에서 연다(openScenarioPanel).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiX } from "react-icons/fi";
import { useScenario } from "../../context/ScenarioContext";
import { useFlow } from "../../context/FlowContext";
import { useAuth } from "../../context/AuthContext";
import { SPEED_PRESETS, teleport, resetTrip, jumpTrip, tripStart, setTripStart, simPoint, placeTrip } from "../../services/simulator";
import { NO_CCTV_INDEX } from "../../mock/route";
import {
  useAccuracyLog,
  setRecordEnabled,
  summarize,
  pct,
  downloadCsv,
  copyCsv,
  removeLastEntry,
  clearEntries,
  TARGET_POINTS,
  KPI_TARGET,
} from "../../services/accuracyLog";
import { showToast } from "../../utils/toast";

const LOGIN_STEPS = [
  ["L1", "로그인"],
  ["L2", "약관 동의"],
  ["L3", "가입 완료"],
];
const STEPS = ["앱 실행", "동승자 확인", "위치 권한", "위치·방향 산출", "전방 CCTV 선별", "목록·자동 재생", "돌발 배지", "카드 전환", "자동 갱신"];
const EXCEPTIONS = {
  E1: "동승자 미확인",
  E2: "위치 권한 거부",
  E3: "정차·저속·터널",
  E4: "전방 CCTV 없음",
  E5: "영상 재생 실패",
  E6: "ITS API 장애",
};

// 시뮬레이션 순간이동 — 서초IC 다음 양재IC, 판교IC 는 송출 중단 CCTV(E5)·사고 지점이다
const JUMPS = [
  [0, "한남IC"],
  [3, "서초IC(E5 직전)"],
  [6, "금토JC(사고 직전)"],
];

// 내 위치 임시로 바꾸기 — 자주 쓰는 출발지
const PLACES = [
  { label: "한성대학교", lat: 37.5826, lng: 127.0105 },
  { label: "서울역", lat: 37.5547, lng: 126.9707 },
  { label: "강남역", lat: 37.4979, lng: 127.0276 },
  { label: "판교역", lat: 37.3948, lng: 127.1112 },
  { label: "대전역", lat: 36.3324, lng: 127.4342 },
  { label: "부산역", lat: 35.1151, lng: 129.0414 },
];

// 시연 흐름 — 경부고속도로로 부산 가는 길. 목업 데이터에서는 경로가 경부선 목업 끝(안성JC)까지만 이어진다
const BUSAN = { name: "부산역", address: "부산 동구 중앙대로 206", lat: 35.1151, lng: 129.0414 };
const DEMO_START = 1; // 잠원IC — 서울 시내를 지나 바로 고속도로 위에서 시작한다

/** "37.55, 126.97" · "37.55 126.97" 같은 입력을 읽는다. 한국 범위를 벗어나면 null */
function parseLatLng(text) {
  const m = String(text).match(/(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  let lat = Number(m[1]);
  let lng = Number(m[2]);
  if (lat > 90) [lat, lng] = [lng, lat]; // 경도, 위도 순으로 붙여 넣었을 때
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) return null;
  return { lat, lng };
}

const Field = styled.form`
  display: flex;
  gap: 6px;
  margin-top: 8px;
  input {
    flex: 1;
    min-width: 0;
    min-height: 38px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1.5px solid #C9CEC9;
    background: #fff;
    color: #15191C;
    font-size: 13.5px;
  }
`;

const Sheet = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1900;
  max-height: 78vh;
  overflow-y: auto;
  padding: 16px 16px calc(env(safe-area-inset-bottom) + 20px);
  border-radius: 18px 18px 0 0;
  background: #F2F3F0;
  color: #15191C;
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.45);
  font-size: 14px;
  @media (min-width: 520px) {
    left: auto;
    right: 16px;
    bottom: 16px;
    width: 380px;
    border-radius: 18px;
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  h2 {
    margin: 0;
    font-size: 17px;
  }
  button {
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
  }
`;

const Label = styled.h3`
  margin: 16px 0 8px;
  font-size: 13px;
  color: #5D666C;
`;

const Steps = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  li {
    padding: 7px 8px;
    border-radius: 8px;
    background: #E2E5E2;
    font-size: 12.5px;
    font-weight: 600;
    color: #5D666C;
  }
  li[data-on="true"] {
    background: #0B6B4C;
    color: #fff;
  }
  li b {
    font-family: ${({ theme }) => theme.fonts.numeric};
    margin-right: 4px;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.button`
  min-height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1.5px solid ${({ $on }) => ($on ? "#15191C" : "#C9CEC9")};
  background: ${({ $on }) => ($on ? "#15191C" : "transparent")};
  color: ${({ $on }) => ($on ? "#fff" : "#15191C")};
  font-size: 13.5px;
  font-weight: 700;
`;

const Ex = styled.span`
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 8px;
  background: ${({ $on }) => ($on ? "#E5483B" : "#E2E5E2")};
  color: ${({ $on }) => ($on ? "#fff" : "#8A9196")};
  font-size: 12.5px;
  font-weight: 700;
`;

const OPEN_EVENT = "apbollae:open-scenario-panel";

/** 흐름 점검 패널을 연다 — 내 정보 화면의 개발 메뉴에서 부른다 */
export function openScenarioPanel() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export default function ScenarioPanel() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);
  const navigate = useNavigate();
  const { scenario, set, flowStatus } = useScenario();
  const { resetDrive, setPermission, destination, setDestination } = useFlow();
  const auth = useAuth();
  const accuracy = useAccuracyLog();
  const [start, setStart] = useState(tripStart);
  const [coordText, setCoordText] = useState("");

  // 출발지를 옮기고 '경로 주행'으로 바꾼다 — 목적지를 넣기 전까지 그 자리에 서 있다
  const moveTo = (p) => {
    setTripStart(p);
    setStart(tripStart());
    set({ source: "trip" });
    showToast(`내 위치를 ${tripStart().label}(으)로 바꿨어요`);
  };

  // 시연 흐름 한 단계를 실행하고 주행 화면으로 — 패널은 닫아 화면이 바뀌는 걸 바로 보게 한다
  const runDemo = (fn, msg) => {
    fn();
    setOpen(false);
    navigate("/drive");
    showToast(msg);
  };
  const demoStep = scenario.source === "sim" && !destination ? 1 : destination?.name === BUSAN.name ? 2 : scenario.source === "trip" && !destination ? 3 : 0;

  if (!open) return null;

  const Toggle = ({ k, children }) => (
    <Chip type="button" $on={scenario[k]} aria-pressed={scenario[k]} onClick={() => set({ [k]: !scenario[k] })}>
      {children}
    </Chip>
  );

  return (
    <Sheet role="dialog" aria-label="흐름 점검 패널">
      <Head>
        <h2>흐름 점검</h2>
        <button type="button" aria-label="닫기" onClick={() => setOpen(false)}>
          <FiX size={22} />
        </button>
      </Head>

      <Label>시연 흐름 · 부산 가는 길 (순서대로 누르기)</Label>
      <Steps as="div" style={{ gridTemplateColumns: "1fr" }}>
        {[
          [
            "고속도로 달리는 중 → 부채꼴로 앞 5km CCTV",
            () =>
              runDemo(() => {
                setDestination(null);
                teleport(DEMO_START);
                set({ source: "sim", speed: "normal", tunnel: false, apiDown: false });
              }, "경부고속도로 하행을 달리는 중이에요. 부채꼴 안 앞 5km CCTV를 보여 줘요"),
          ],
          [
            "목적지 '부산' 입력 → 경로 위 CCTV만",
            () =>
              runDemo(() => {
                // 시뮬레이션 위치에서 그대로 이어서, 받은 경로를 따라 달린다
                placeTrip(simPoint());
                set({ source: "trip" });
                setDestination({ ...BUSAN });
              }, "목적지를 부산으로 정했어요. 경로를 받으면 경로 위 CCTV만 보여 줘요"),
          ],
          [
            "목적지 취소 → 다시 부채꼴",
            () => runDemo(() => setDestination(null), "목적지를 지웠어요. 다시 진행 방향 앞쪽 CCTV를 보여 줘요"),
          ],
        ].map(([label, run], i) => (
          <Chip key={label} type="button" $on={demoStep === i + 1} onClick={run} style={{ borderRadius: 10, textAlign: "left" }}>
            {i + 1}. {label}
          </Chip>
        ))}
      </Steps>

      <Label>
        로그인 흐름 {auth.user ? `· ${auth.user.email || auth.user.displayName}` : auth.isGuest ? "· 로그인 없이 사용 중" : ""}
      </Label>
      <Steps>
        {LOGIN_STEPS.map(([code, s]) => (
          <li key={code} data-on={flowStatus.step === code}>
            <b>{code}</b>
            {s}
          </li>
        ))}
      </Steps>

      <Label>기능흐름도 단계 (지금 화면 상태를 저절로 표시 · 누르는 버튼 아님)</Label>
      <Steps>
        {STEPS.map((s, i) => (
          <li key={s} data-on={flowStatus.step === i + 1}>
            <b>{i + 1}</b>
            {s}
          </li>
        ))}
      </Steps>

      <Label>예외 상황</Label>
      <Chips>
        {Object.entries(EXCEPTIONS).map(([code, name]) => (
          <Ex key={code} $on={flowStatus.exceptions.includes(code)}>
            {code} {name}
          </Ex>
        ))}
      </Chips>

      <Label>교통 데이터</Label>
      <Chips>
        <Chip type="button" $on={scenario.data === "mock"} onClick={() => set({ data: "mock" })}>
          목업
        </Chip>
        <Chip type="button" $on={scenario.data === "live"} onClick={() => set({ data: "live" })}>
          실제 ITS (npm run proxy)
        </Chip>
      </Chips>

      <Label>위치 출처</Label>
      <Chips>
        <Chip type="button" $on={scenario.source === "sim"} onClick={() => set({ source: "sim" })}>
          시뮬레이션 주행
        </Chip>
        <Chip
          type="button"
          $on={scenario.source === "trip"}
          onClick={() => {
            resetTrip();
            set({ source: "trip" });
          }}
        >
          경로 주행({start.label} 출발)
        </Chip>
        <Chip type="button" $on={scenario.source === "device"} onClick={() => set({ source: "device" })}>
          실제 GPS
        </Chip>
      </Chips>

      <Label>내 위치 임시로 바꾸기 (지금: {start.label})</Label>
      <Chips>
        {PLACES.map((p) => (
          <Chip
            key={p.label}
            type="button"
            $on={scenario.source === "trip" && start.lat === p.lat && start.lng === p.lng}
            onClick={() => moveTo(p)}
          >
            {p.label}
          </Chip>
        ))}
      </Chips>
      <Field
        onSubmit={(e) => {
          e.preventDefault();
          const p = parseLatLng(coordText);
          if (!p) {
            showToast("위도, 경도 형식으로 넣어 주세요 (예: 37.5547, 126.9707)");
            return;
          }
          moveTo(p);
          setCoordText("");
        }}
      >
        <input
          value={coordText}
          onChange={(e) => setCoordText(e.target.value)}
          placeholder="위도, 경도 (카카오맵 좌표 붙여 넣기)"
          inputMode="decimal"
          aria-label="위도, 경도"
        />
        <Chip type="submit">이동</Chip>
      </Field>

      {scenario.source === "sim" || scenario.source === "trip" ? (
        <>
          <Label>주행 속도</Label>
          <Chips>
            {Object.entries(SPEED_PRESETS).map(([k, p]) => (
              <Chip key={k} type="button" $on={scenario.speed === k} onClick={() => set({ speed: k })}>
                {p.label}
              </Chip>
            ))}
          </Chips>
        </>
      ) : null}

      {scenario.source === "trip" ? (
        <>
          <Label>경로 구간으로 건너뛰기 (목적지를 넣은 뒤)</Label>
          <Chips>
            {[0, 0.1, 0.25, 0.5, 0.75, 0.97].map((f) => (
              <Chip key={f} type="button" onClick={() => jumpTrip(f)}>
                {f === 0 ? "출발" : f === 0.97 ? "도착 직전" : `${Math.round(f * 100)}%`}
              </Chip>
            ))}
            <Chip type="button" onClick={resetTrip}>
              출발지로 되돌리기
            </Chip>
          </Chips>
        </>
      ) : null}

      {scenario.source === "sim" ? (
        <>
          <Label>이동</Label>
          <Chips>
            {JUMPS.map(([idx, label]) => (
              <Chip key={idx} type="button" onClick={() => teleport(idx)}>
                {label}
              </Chip>
            ))}
            <Chip type="button" onClick={() => teleport(NO_CCTV_INDEX)}>
              CCTV 없는 구간으로(E4)
            </Chip>
          </Chips>
        </>
      ) : null}

      <Label>테스트 주행 정확도 기록 (KPI {Math.round(KPI_TARGET * 100)}%, {TARGET_POINTS}곳)</Label>
      <Chips>
        <Chip type="button" $on={accuracy.enabled} aria-pressed={accuracy.enabled} onClick={() => setRecordEnabled(!accuracy.enabled)}>
          {accuracy.enabled ? "기록 모드 켜짐" : "기록 모드 켜기"}
        </Chip>
        {accuracy.enabled ? (
          <Chip
            type="button"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event("apb:record")); // 주행 화면이 지금 선별 결과로 기록 시트를 연다
            }}
          >
            지금 지점 기록
          </Chip>
        ) : null}
      </Chips>
      {accuracy.entries.length ? (
        <>
          {(() => {
            const sum = summarize(accuracy.entries);
            return (
              <p style={{ margin: "10px 0 8px", lineHeight: 1.6 }}>
                지점 <b>{sum.points}</b>/{TARGET_POINTS} · CCTV 정확도{" "}
                <b style={{ color: sum.cctv != null && sum.cctv < KPI_TARGET ? "#E5483B" : "#0B6B4C" }}>{pct(sum.cctv)}</b> ({sum.correct}/{sum.judged})
                <br />
                1순위 정확도 {pct(sum.first)} · 지점 전부 맞음 {pct(sum.point)}
              </p>
            );
          })()}
          <Chips>
            <Chip type="button" onClick={() => downloadCsv(accuracy.entries)}>
              CSV 내려받기
            </Chip>
            <Chip
              type="button"
              onClick={() =>
                copyCsv(accuracy.entries)
                  .then(() => showToast("CSV를 복사했어요. 메모장이나 시트에 붙여 넣으세요"))
                  .catch(() => showToast("복사하지 못했어요. CSV 내려받기를 써 주세요"))
              }
            >
              CSV 복사
            </Chip>
            <Chip type="button" onClick={removeLastEntry}>
              마지막 지점 지우기
            </Chip>
            <Chip
              type="button"
              onClick={() => {
                if (window.confirm(`기록 ${accuracy.entries.length}건을 모두 지울까요? 되돌릴 수 없어요.`)) clearEntries();
              }}
            >
              전부 지우기
            </Chip>
          </Chips>
        </>
      ) : (
        <p style={{ margin: "10px 0 0", lineHeight: 1.5, color: "#5D666C" }}>
          켜고 테스트 지점마다 “지금 지점 기록”을 누르면, 그 순간 고른 CCTV가 맞는지 판정해 이 기기에 저장해요.
        </p>
      )}

      <Label>예외 일으키기</Label>
      <Chips>
        <Toggle k="tunnel">터널, GPS 끊김(E3)</Toggle>
        <Toggle k="brokenFeeds">송출 중단 CCTV(E5)</Toggle>
        <Toggle k="apiDown">ITS 장애(E6)</Toggle>
        <Toggle k="denyPermission">권한 거부(E2)</Toggle>
      </Chips>

      <Label>처음부터</Label>
      <Chips>
        <Chip
          type="button"
          onClick={() => {
            resetDrive();
            navigate("/", { replace: true });
          }}
        >
          앱 다시 실행
        </Chip>
        <Chip
          type="button"
          onClick={async () => {
            await auth.resetEntry();
            resetDrive();
            navigate("/", { replace: true });
          }}
        >
          첫 설치 상태로(로그인부터)
        </Chip>
        <Chip
          type="button"
          onClick={() => {
            setPermission("unknown");
            navigate("/permission", { replace: true });
          }}
        >
          권한 화면 다시 보기
        </Chip>
      </Chips>
    </Sheet>
  );
}
