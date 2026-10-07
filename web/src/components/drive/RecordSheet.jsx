// src/components/drive/RecordSheet.jsx
// 정확도 기록 시트 — 버튼을 누른 순간의 선별 결과를 얼려 두고, CCTV 마다 "정말 내 앞인가"를 판정해 저장한다.
// 주행 중에도 계속 갱신되므로 판정 대상은 열 때의 목록(snapshot)으로 고정한다.
import React, { useState } from "react";
import styled from "styled-components";
import { FiCheck, FiX, FiMinus, FiPlus } from "react-icons/fi";
import Button from "../common/Button";
import { formatDistance } from "../../utils/aheadFilter";
import { addEntry, summarize, pct, useAccuracyLog, WRONG_REASONS, TARGET_POINTS, KPI_TARGET } from "../../services/accuracyLog";
import { showToast } from "../../utils/toast";

const MODE_LABEL = { route: "목적지 경로", road: "내 도로 앞쪽", ahead: "전방 부채꼴", nearby: "주변(방향 모름)" };

const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 30;
  background: rgba(10, 14, 20, 0.4);
`;

const Sheet = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 31;
  max-height: 86%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textStrong};
  border-radius: 24px 24px 0 0;
`;

const Scroll = styled.div`
  overflow-y: auto;
  padding: 18px 16px 8px;
`;

const Head = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
  }
  p {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.45;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  button {
    flex: none;
    width: 44px;
    height: 44px;
    margin: -8px -8px 0 0;
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.textNormal};
  }
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 14px 0 4px;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  > div {
    padding: 10px 12px;
  }
  > div + div {
    border-left: 1.5px solid ${({ theme }) => theme.colors.border};
  }
  small {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  b {
    display: block;
    margin-top: 2px;
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 20px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textStrong};
  }
  b[data-miss="true"] {
    color: ${({ theme }) => theme.colors.danger};
  }
`;

const Label = styled.h3`
  margin: 18px 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Meta = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Input = styled.input`
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 16px;
`;

const Row = styled.li`
  padding: 12px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  &:first-child {
    border-top: none;
  }
`;

const RowHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  > span {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
  }
  em {
    flex: none;
    font-style: normal;
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 14px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Rank = styled.i`
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-style: normal;
  font-size: 12px;
  font-weight: 800;
  background: ${({ theme, $first }) => ($first ? theme.colors.lane : theme.colors.border)};
  color: ${({ theme, $first }) => ($first ? theme.colors.laneText : theme.colors.textStrong)};
`;

const Seg = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
`;

const SegBtn = styled.button`
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  border: 1.5px solid ${({ theme, $on, $tone }) => ($on ? ($tone === "ok" ? theme.colors.primary : theme.colors.danger) : theme.colors.border)};
  background: ${({ theme, $on, $tone }) => ($on ? ($tone === "ok" ? theme.colors.primary : theme.colors.danger) : "transparent")};
  color: ${({ theme, $on }) => ($on ? "#fff" : theme.colors.textStrong)};
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

const Chip = styled.button`
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1.5px solid ${({ theme, $on }) => ($on ? theme.colors.textStrong : theme.colors.border)};
  background: ${({ theme, $on }) => ($on ? theme.colors.textStrong : "transparent")};
  color: ${({ theme, $on }) => ($on ? theme.colors.surface : theme.colors.textStrong)};
  font-size: 14px;
  font-weight: 700;
`;

const Stepper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  button {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    border: 1.5px solid ${({ theme }) => theme.colors.border};
    background: transparent;
    color: ${({ theme }) => theme.colors.textStrong};
    display: flex;
    align-items: center;
    justify-content: center;
  }
  b {
    min-width: 28px;
    text-align: center;
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 22px;
  }
  small {
    flex: 1;
    font-size: 13px;
    line-height: 1.45;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Foot = styled.div`
  padding: 10px 16px calc(env(safe-area-inset-bottom) + 14px);
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

/**
 * @param {object} snapshot  열 때의 선별 결과
 *   { t, lat, lng, heading, headingSource, speed, mode, road, destination, items:[{ id, name, source, km }] }
 */
export default function RecordSheet({ snapshot, onClose }) {
  const log = useAccuracyLog();
  const sum = summarize(log.entries);
  const [label, setLabel] = useState("");
  const [memo, setMemo] = useState("");
  const [missed, setMissed] = useState(0);
  // id → { ok: boolean, reason?: string }
  const [judge, setJudge] = useState({});

  const items = snapshot.items;
  const pending = items.filter((c) => {
    const j = judge[c.id];
    return !j || (j.ok === false && !j.reason);
  }).length;

  const setOk = (id, ok) => setJudge((s) => ({ ...s, [id]: ok ? { ok: true } : { ok: false, reason: s[id]?.ok === false ? s[id].reason : null } }));
  const setReason = (id, reason) => setJudge((s) => ({ ...s, [id]: { ok: false, reason } }));
  const allOk = () => setJudge(Object.fromEntries(items.map((c) => [c.id, { ok: true }])));

  const save = () => {
    const no = addEntry({
      ...snapshot,
      label: label.trim(),
      memo: memo.trim(),
      missed,
      items: items.map((c) => ({ ...c, ok: judge[c.id].ok, reason: judge[c.id].reason || null })),
    });
    showToast(`${no}번 지점을 기록했어요`);
    onClose();
  };

  const below = sum.cctv != null && sum.cctv < KPI_TARGET;

  return (
    <>
      <Backdrop onClick={onClose} />
      <Sheet role="dialog" aria-label="정확도 기록">
        <Scroll>
          <Head>
            <div>
              <h2>{sum.points + 1}번 지점 기록</h2>
              <p>지금 고른 CCTV가 정말 내 앞(같은 도로·같은 방향, 아직 지나지 않음)인지 판정해 주세요.</p>
            </div>
            <button type="button" aria-label="닫기" onClick={onClose}>
              <FiX size={22} />
            </button>
          </Head>

          <Stats>
            <div>
              <small>지점</small>
              <b>
                {sum.points}/{TARGET_POINTS}
              </b>
            </div>
            <div>
              <small>CCTV 정확도</small>
              <b data-miss={below}>{pct(sum.cctv)}</b>
            </div>
            <div>
              <small>1순위 정확도</small>
              <b>{pct(sum.first)}</b>
            </div>
          </Stats>

          <Label>기록 시점</Label>
          <Meta>
            {new Date(snapshot.t).toLocaleTimeString("ko-KR")} · {MODE_LABEL[snapshot.mode] || "-"}
            {snapshot.road ? ` · ${snapshot.road}` : ""}
            {snapshot.speed != null ? ` · ${Math.round(snapshot.speed)}km/h` : ""}
            {snapshot.destination ? ` · ${snapshot.destination}행` : ""}
          </Meta>

          <Label>지점 이름 (선택)</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 서초IC 지나서" />

          <Label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>고른 CCTV {items.length}곳</span>
            {items.length ? (
              <Chip type="button" onClick={allOk} style={{ minHeight: 34 }}>
                모두 맞음
              </Chip>
            ) : null}
          </Label>
          {items.length ? (
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((c, i) => {
                const j = judge[c.id];
                const d = formatDistance(c.km);
                return (
                  <Row key={c.id}>
                    <RowHead>
                      <Rank $first={i === 0}>{i + 1}</Rank>
                      <span>{c.name}</span>
                      <em>
                        {d.value}
                        {d.unit}
                      </em>
                    </RowHead>
                    <Seg>
                      <SegBtn type="button" $tone="ok" $on={j?.ok === true} aria-pressed={j?.ok === true} onClick={() => setOk(c.id, true)}>
                        <FiCheck size={18} aria-hidden="true" />내 앞 맞음
                      </SegBtn>
                      <SegBtn type="button" $tone="bad" $on={j?.ok === false} aria-pressed={j?.ok === false} onClick={() => setOk(c.id, false)}>
                        <FiX size={18} aria-hidden="true" />
                        틀림
                      </SegBtn>
                    </Seg>
                    {j?.ok === false ? (
                      <Chips role="group" aria-label="틀린 이유">
                        {Object.entries(WRONG_REASONS).map(([k, name]) => (
                          <Chip key={k} type="button" $on={j.reason === k} aria-pressed={j.reason === k} onClick={() => setReason(c.id, k)}>
                            {name}
                          </Chip>
                        ))}
                      </Chips>
                    ) : null}
                  </Row>
                );
              })}
            </ol>
          ) : (
            <Meta>고른 CCTV가 없어요. 실제로도 앞 5km 안에 CCTV가 없었다면 그대로 저장하고, 있었다면 아래 "놓친 CCTV"에 개수를 넣어 주세요.</Meta>
          )}

          <Label>놓친 CCTV</Label>
          <Stepper>
            <button type="button" aria-label="하나 빼기" onClick={() => setMissed((n) => Math.max(0, n - 1))}>
              <FiMinus size={18} />
            </button>
            <b aria-live="polite">{missed}</b>
            <button type="button" aria-label="하나 더하기" onClick={() => setMissed((n) => n + 1)}>
              <FiPlus size={18} />
            </button>
            <small>앞 5km 안에 있는데 목록에 없던 CCTV (지도 마커로 확인)</small>
          </Stepper>

          <Label>메모 (선택)</Label>
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 갈림길 직전, 고가 아래" />
        </Scroll>
        <Foot>
          <Button fullWidth disabled={pending > 0} onClick={save}>
            {pending > 0 ? `${pending}곳 더 판정해 주세요` : "이 지점 저장"}
          </Button>
        </Foot>
      </Sheet>
    </>
  );
}
