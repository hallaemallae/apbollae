// src/pages/LogPage.jsx — 기록 탭: "아까 왜 막혔지?"
//  ⑩ 지나온 정체·돌발(useTripRecorder 가 남긴 것)  + 테스트 주행 정확도 기록(차터 KPI)
import React from "react";
import { useNavigate } from "react-router-dom";
import styled, { useTheme } from "styled-components";
import { TabPage, TabBar, Card, Empty } from "../components/common/TabPage";
import { useTripLog, clearTripLog } from "../services/tripLog";
import { useAccuracyLog, setRecordEnabled, summarize, pct, downloadCsv, TARGET_POINTS, KPI_TARGET } from "../services/accuracyLog";
import { EVENT_LABEL } from "../mock/events";

const hhmm = (t) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const dayLabel = (t) => {
  const d = new Date(t);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === y.toDateString()) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const Day = styled.h3`
  margin: 16px 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
  &:first-of-type {
    margin-top: 0;
  }
`;

const Item = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  ${Day} + & {
    border-top: none;
  }
  time {
    flex: none;
    width: 44px;
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 15px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textNormal};
  }
  i {
    flex: none;
    width: 10px;
    height: 10px;
    margin-top: 6px;
    border-radius: 50%;
    background: ${({ $c }) => $c};
  }
  b {
    display: block;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.4;
  }
  p {
    margin: 2px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Summary = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  > div + div {
    border-left: 1px solid ${({ theme }) => theme.colors.border};
    padding-left: 12px;
  }
  small {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  b {
    display: block;
    margin-top: 4px;
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 24px;
    font-weight: 700;
    line-height: 1.1;
  }
  b span {
    font-family: inherit;
    font-size: 13px;
    margin-left: 2px;
  }
  b.text {
    font-family: inherit;
    font-size: 16px;
    padding-top: 6px;
  }
`;

const MapLink = styled.a`
  display: inline-block;
  margin-top: 4px;
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

const Btn = styled.button`
  min-height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid ${({ theme, $primary }) => ($primary ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme, $primary }) => ($primary ? theme.colors.primary : "transparent")};
  color: ${({ theme, $primary }) => ($primary ? theme.colors.primaryText : theme.colors.textStrong)};
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
`;

const Stats = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  b {
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 17px;
  }
`;

function describe(e) {
  const c = e.cause;
  const causeText = c ? `${c.label || EVENT_LABEL[c.type] || "돌발"}${c.lanes ? `(${c.lanes})` : ""}` : null;
  if (e.kind === "jam") {
    const min = Math.max(1, Math.round((e.endedAt - e.startedAt) / 60000));
    return {
      title: causeText ? `${causeText} 때문에 ${e.lengthKm}km 정체` : `${e.lengthKm}km 정체 · 원인 정보 없음`,
      sub: [e.road, `${min}분 걸림`, c?.message].filter(Boolean).join(" · "),
      type: c?.type || "jam",
    };
  }
  return { title: `${causeText || "돌발"} 지점 지남`, sub: [e.road, c?.message].filter(Boolean).join(" · "), type: c?.type || "control" };
}

export default function LogPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const trips = useTripLog();
  const accuracy = useAccuracyLog();
  const sum = summarize(accuracy.entries);
  const color = { accident: theme.colors.accident, work: theme.colors.work, control: theme.colors.control, jam: theme.colors.traffic.jam };

  // 최근 7일 요약 — 정체 횟수·정체로 보낸 시간·가장 잦은 원인
  const weekAgo = Date.now() - 7 * 86400000;
  const week = trips.filter((e) => e.endedAt >= weekAgo);
  const weekJams = week.filter((e) => e.kind === "jam");
  const jamMin = weekJams.reduce((m, e) => m + Math.max(1, Math.round((e.endedAt - e.startedAt) / 60000)), 0);
  const causeCount = {};
  week.forEach((e) => {
    const k = e.cause ? e.cause.label || EVENT_LABEL[e.cause.type] || "돌발" : e.kind === "jam" ? "차량 많음" : null;
    if (k) causeCount[k] = (causeCount[k] || 0) + 1;
  });
  const topCause = Object.entries(causeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  // 날짜별로 묶는다(최신 먼저)
  const groups = [];
  trips.forEach((e) => {
    const label = dayLabel(e.endedAt);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(e);
    else groups.push({ label, items: [e] });
  });

  return (
    <TabPage>
      <TabBar>
        <h1>기록</h1>
      </TabBar>

      {trips.length ? (
        <Card aria-label="최근 7일 요약">
          <h2>최근 7일</h2>
          <Summary>
            <div>
              <small>정체</small>
              <b>
                {weekJams.length}
                <span>번</span>
              </b>
            </div>
            <div>
              <small>정체로 보낸 시간</small>
              <b>
                {jamMin}
                <span>분</span>
              </b>
            </div>
            <div>
              <small>가장 잦은 원인</small>
              <b className="text">{topCause}</b>
            </div>
          </Summary>
        </Card>
      ) : null}

      <Card aria-label="지나온 정체">
        <h2>지나온 정체와 원인</h2>
        {trips.length ? (
          <>
            {groups.map((g) => (
              <React.Fragment key={g.label}>
                <Day>{g.label}</Day>
                {g.items.map((e) => {
                  const d = describe(e);
                  return (
                    <Item key={e.id} $c={color[d.type] || theme.colors.textWeak}>
                      <time>{hhmm(e.endedAt)}</time>
                      <i aria-hidden="true" />
                      <div>
                        <b>{d.title}</b>
                        {d.sub ? <p>{d.sub}</p> : null}
                        {e.lat != null ? (
                          <MapLink href={`https://map.kakao.com/link/map/${encodeURIComponent(d.title)},${e.lat},${e.lng}`} target="_blank" rel="noreferrer">
                            지도에서 위치 보기
                          </MapLink>
                        ) : null}
                      </div>
                    </Item>
                  );
                })}
              </React.Fragment>
            ))}
            <Row>
              <Btn
                type="button"
                onClick={() => {
                  if (window.confirm(`기록 ${trips.length}건을 모두 지울까요?`)) clearTripLog();
                }}
              >
                기록 지우기
              </Btn>
            </Row>
          </>
        ) : (
          <Empty>정체 구간을 빠져나오거나 사고·공사 지점을 지나면, 언제 어디서 왜 막혔는지 여기에 남겨 드려요.</Empty>
        )}
      </Card>

      <Card aria-label="테스트 주행 정확도 기록">
        <h2>테스트 주행 정확도</h2>
        {accuracy.entries.length ? (
          <Stats>
            지점 <b>{sum.points}</b>/{TARGET_POINTS} · CCTV 정확도{" "}
            <b style={{ color: sum.cctv != null && sum.cctv < KPI_TARGET ? theme.colors.danger : theme.colors.traffic.smooth }}>{pct(sum.cctv)}</b>
            <br />
            1순위 정확도 {pct(sum.first)}
          </Stats>
        ) : (
          <Empty>기록 모드를 켜고 테스트 지점마다 기록하면 차터 KPI(정확도 {Math.round(KPI_TARGET * 100)}%, {TARGET_POINTS}곳)를 계산해 드려요.</Empty>
        )}
        <Row>
          <Btn type="button" $primary={!accuracy.enabled} onClick={() => setRecordEnabled(!accuracy.enabled)}>
            {accuracy.enabled ? "기록 모드 끄기" : "기록 모드 켜기"}
          </Btn>
          {accuracy.enabled ? (
            <Btn
              type="button"
              $primary
              onClick={() => {
                navigate("/drive");
                setTimeout(() => window.dispatchEvent(new Event("apb:record")), 60); // 홈 탭이 지금 선별 결과로 기록 창을 연다
              }}
            >
              지금 지점 기록
            </Btn>
          ) : null}
          {accuracy.entries.length ? (
            <Btn type="button" onClick={() => downloadCsv(accuracy.entries)}>
              CSV 내려받기
            </Btn>
          ) : null}
        </Row>
      </Card>
    </TabPage>
  );
}
