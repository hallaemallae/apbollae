// src/pages/AheadPage.jsx — 앞길 탭: "왜 막히고 어디까지야?"
//  ① 원인 한 줄 요약(+③ 운전자에게 보여 주기)  ⑤ 이 정체로 늦어지는 시간·다른 길 앱으로 넘기기
//  ⑥ 앞 10km 소통 띠(CCTV·돌발 위치)  ④ 돌발 상세(발생·해소 예정·통제 차로)
// 계산은 홈 탭(DrivePage)이 하고 DriveDataContext 로 받아 그린다. CCTV 를 누르면 홈 탭에서 그 영상을 튼다.
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { useTheme } from "styled-components";
import { FiMaximize2, FiVideo, FiNavigation2, FiCloudRain, FiCloudSnow, FiCloud, FiSun, FiWind, FiChevronRight } from "react-icons/fi";
import { TabPage, TabBar, Card, Empty } from "../components/common/TabPage";
import DriverView from "../components/drive/DriverView";
import { useDriveData } from "../context/DriveDataContext";
import { delayMinutes, trafficBands, blockedLanes, HORIZON_KM } from "../utils/situation";
import { formatDistance } from "../utils/aheadFilter";
import { TRAFFIC_LABEL } from "../utils/routeFilter";
import { EVENT_LABEL } from "../mock/events";

const fmt = (km) => {
  const d = formatDistance(Math.max(0, km));
  return `${d.value}${d.unit}`;
};

/* ── ① 요약 ── */
const Summary = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  i {
    flex: none;
    width: 12px;
    height: 12px;
    margin-top: 6px;
    border-radius: 50%;
    background: ${({ $tone }) => $tone};
  }
  b {
    display: block;
    font-size: 20px;
    line-height: 1.35;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  p {
    margin: 4px 0 0;
    font-size: 14px;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textNormal};
  }
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 14px;
`;

const Btn = styled.button`
  flex: 1;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 12px;
  border: 1px solid ${({ theme, $primary }) => ($primary ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme, $primary }) => ($primary ? theme.colors.primary : "transparent")};
  color: ${({ theme, $primary }) => ($primary ? theme.colors.primaryText : theme.colors.textStrong)};
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
`;

/* ── ⑤ 늦어지는 시간 ── */
const Big = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  b {
    font-family: ${({ theme }) => theme.fonts.numeric};
    font-size: 40px;
    line-height: 1;
    font-weight: 700;
    color: ${({ theme, $bad }) => ($bad ? theme.colors.danger : theme.colors.textStrong)};
  }
  span {
    font-size: 15px;
    font-weight: 700;
  }
`;

const Note = styled.p`
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ── ⑥ 소통 띠 ── */
const PX_PER_KM = 46;

const Strip = styled.div`
  position: relative;
  height: ${HORIZON_KM * PX_PER_KM + 24}px;
  margin-left: 4px;
`;

const Rail = styled.div`
  position: absolute;
  left: 52px;
  top: 12px;
  width: 10px;
  bottom: 12px;
  border-radius: 5px;
  background: ${({ theme }) => theme.colors.road};
  overflow: hidden;
`;

const Band = styled.div`
  position: absolute;
  left: 0;
  right: 0;
`;

const Tick = styled.span`
  position: absolute;
  left: 0;
  width: 40px;
  text-align: right;
  font-family: ${({ theme }) => theme.fonts.numeric};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
  transform: translateY(-50%);
`;

const Mark = styled.button`
  position: absolute;
  left: 44px;
  right: 0;
  transform: translateY(-50%);
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  text-align: left;
  color: ${({ theme }) => theme.colors.textStrong};
  > span:first-child {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ $c }) => $c};
    color: #fff;
    border: 2px solid ${({ theme }) => theme.colors.surface};
    font-size: 12px;
    font-weight: 800;
  }
  > span:last-child {
    min-width: 0;
    font-size: 13.5px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  em {
    font-style: normal;
    margin-left: 6px;
    color: ${({ theme }) => theme.colors.textWeak};
    font-weight: 500;
  }
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
`;

/* ── ④ 돌발 상세 ── */
const Event = styled.div`
  padding: 14px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  &:first-of-type {
    border-top: none;
    padding-top: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  header span {
    padding: 3px 9px;
    border-radius: 999px;
    background: ${({ $c }) => $c};
    color: #fff;
    font-size: 12px;
    font-weight: 800;
  }
  header b {
    font-size: 16px;
    font-weight: 800;
  }
  p {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textNormal};
  }
  dl {
    display: flex;
    gap: 16px;
    margin: 8px 0 0;
    font-size: 13px;
  }
  dt {
    color: ${({ theme }) => theme.colors.textWeak};
  }
  dd {
    margin: 2px 0 0;
    font-weight: 700;
  }
`;

const Lanes = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 10px;
  span {
    width: 34px;
    height: 44px;
    border-radius: 6px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 4px;
    font-size: 11px;
    font-weight: 700;
    background: ${({ theme }) => theme.colors.road};
    color: ${({ theme }) => theme.colors.textNormal};
  }
  span[data-blocked="true"] {
    background: repeating-linear-gradient(135deg, ${({ $c }) => $c} 0 6px, transparent 6px 10px), ${({ theme }) => theme.colors.road};
    color: #fff;
  }
`;

/* ── ⑧ 날씨 ── */
const Weather = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  > svg {
    flex: none;
    color: ${({ theme, $slow }) => ($slow ? theme.colors.work : theme.colors.textWeak)};
  }
  b {
    display: block;
    font-size: 16px;
    font-weight: 700;
  }
  small {
    display: block;
    margin-top: 2px;
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const WX_ICON = { snow: FiCloudSnow, rain: FiCloudRain, drizzle: FiCloudRain, storm: FiCloudRain, fog: FiWind, ice: FiCloudSnow, clear: FiSun };

/* ── 앞쪽 CCTV 목록 ── */
const CctvRow = styled.button`
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  font-family: inherit;
  text-align: left;
  color: ${({ theme }) => theme.colors.textStrong};
  &:first-of-type {
    border-top: none;
  }
  > em {
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
    background: ${({ theme }) => theme.colors.lane};
    color: ${({ theme }) => theme.colors.laneText};
  }
  > span {
    flex: 1;
    min-width: 0;
  }
  b {
    display: block;
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  small {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
    font-size: 12.5px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  small i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  > svg {
    flex: none;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const NowTag = styled.span`
  padding: 1px 7px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 11px;
  font-weight: 700;
`;

const TONE = (t) => ({
  accident: t.colors.accident,
  work: t.colors.work,
  control: t.colors.control,
  jam: t.colors.traffic.jam,
  clear: t.colors.traffic.smooth,
  unknown: t.colors.textWeak,
});

/** 다른 길 앱으로 — 카카오맵·티맵 앱 주소(설치돼 있지 않으면 아무 일도 일어나지 않는다) */
function naviLinks(dest) {
  const name = encodeURIComponent(dest.name || "목적지");
  return {
    kakao: `kakaomap://route?ep=${dest.lat},${dest.lng}&by=CAR`,
    tmap: `tmap://route?goalname=${name}&goalx=${dest.lng}&goaly=${dest.lat}`,
  };
}

export default function AheadPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { data, selectCctv } = useDriveData();
  const [driverView, setDriverView] = useState(false);
  const tones = TONE(theme);

  const bands = useMemo(() => trafficBands(data?.traffic), [data?.traffic]);
  const delay = useMemo(() => delayMinutes(data?.traffic), [data?.traffic]);

  if (!data) {
    return (
      <TabPage>
        <TabBar>
          <h1>앞길</h1>
        </TabBar>
        <Card>
          <Empty>홈 화면에서 위치를 잡는 중이에요. 잠시 뒤 앞길 정보를 보여 드려요.</Empty>
        </Card>
      </TabPage>
    );
  }

  const { summary, events, items, jamEnd, destination } = data;
  const goCctv = (c) => {
    selectCctv(c.id, c);
    navigate("/drive");
  };

  // 띠 위 표시: 선별된 CCTV(번호) + 정체 끝 CCTV + 돌발
  const marks = [
    ...items
      .filter((c) => c.liveKm != null && c.liveKm <= HORIZON_KM)
      .map((c, i) => ({ key: `c-${c.id}`, km: c.liveKm, color: theme.colors.lane, label: String(i + 1), text: c.name, onClick: () => goCctv(c) })),
    ...(jamEnd && !items.some((c) => c.id === jamEnd.cctv.id)
      ? [{ key: "end", km: jamEnd.km, color: theme.colors.traffic.smooth, label: <FiVideo size={13} />, text: `${jamEnd.cctv.name}`, sub: "풀리는 곳", onClick: () => goCctv(jamEnd.cctv) }]
      : []),
    ...events.map((ev) => ({ key: `e-${ev.id}`, km: ev.km, color: tones[ev.type], label: "!", text: `${ev.label || EVENT_LABEL[ev.type]}${ev.lanes ? ` · ${ev.lanes}` : ""}` })),
  ]
    .filter((m) => m.km >= 0 && m.km <= HORIZON_KM)
    .sort((a, b) => a.km - b.km);
  // 글자가 겹치지 않게 최소 간격(36px)을 둔다
  let lastY = -Infinity;
  const placed = marks.map((m) => {
    const y = Math.max(12 + m.km * PX_PER_KM, lastY + 36);
    lastY = y;
    return { ...m, y };
  });

  const links = destination ? naviLinks(destination) : null;
  const ago = data.updatedAt ? Math.max(0, Math.round((Date.now() - data.updatedAt) / 1000)) : null;

  return (
    <TabPage>
      <TabBar>
        <h1>앞길</h1>
        {ago != null ? <small>{ago < 5 ? "방금" : `${ago}초 전`} 갱신</small> : null}
      </TabBar>

      {/* ① 원인 한 줄 요약 */}
      <Card aria-label="앞 상황 요약">
        <Summary $tone={tones[summary.tone]}>
          <i aria-hidden="true" />
          <div>
            <b>{summary.title}</b>
            {summary.sub ? <p>{summary.sub}</p> : null}
          </div>
        </Summary>
        <Row>
          <Btn type="button" onClick={() => setDriverView(true)}>
            <FiMaximize2 size={16} aria-hidden="true" />
            운전자에게 보여 주기
          </Btn>
          {jamEnd ? (
            <Btn type="button" $primary onClick={() => goCctv(jamEnd.cctv)}>
              <FiVideo size={16} aria-hidden="true" />
              풀리는 곳 보기
            </Btn>
          ) : null}
        </Row>
      </Card>

      {/* ⑤ 이 정체로 늦어지는 시간 */}
      <Card aria-label="늦어지는 시간">
        <h2>이 정체로 늦어지는 시간</h2>
        {delay == null ? (
          <Empty>앞 구간 소통 정보를 받는 중이에요.</Empty>
        ) : (
          <>
            <Big $bad={delay >= 5}>
              <b>{delay < 1 ? "0" : `+${delay}`}</b>
              <span>분</span>
            </Big>
            <Note>
              앞 {HORIZON_KM}km 기준, 막히지 않을 때보다 더 걸리는 시간(어림값)이에요.
              {destination && data.routeDurationMin != null ? ` ${destination.name}까지는 약 ${data.routeDurationMin}분 남았어요.` : ""}
            </Note>
            {links ? (
              <Row>
                <Btn as="a" href={links.kakao}>
                  <FiNavigation2 size={16} aria-hidden="true" />
                  카카오맵으로
                </Btn>
                <Btn as="a" href={links.tmap}>
                  <FiNavigation2 size={16} aria-hidden="true" />
                  티맵으로
                </Btn>
              </Row>
            ) : (
              <Note>목적지를 넣으면 다른 길을 찾아볼 수 있게 카카오맵·티맵으로 넘겨 드려요.</Note>
            )}
          </>
        )}
      </Card>

      {/* ⑧ 날씨·노면 */}
      {data.weather ? (
        <Card aria-label="날씨">
          <h2>날씨·노면</h2>
          {(() => {
            const Icon = WX_ICON[data.weather.kind] || FiCloud;
            return (
              <Weather $slow={data.weather.slow}>
                <Icon size={30} aria-hidden="true" />
                <div>
                  <b>
                    {data.weather.text}
                    {data.weather.tempC != null ? ` · ${Math.round(data.weather.tempC)}°` : ""}
                  </b>
                  <small>{data.weather.slow ? "차가 평소보다 느려질 수 있는 날씨예요." : "운전에 영향을 줄 날씨는 아니에요."}</small>
                </div>
              </Weather>
            );
          })()}
          <Note>날씨: Open-Meteo.com (현재 위치 약 1km 단위)</Note>
        </Card>
      ) : null}

      {/* 앞쪽 CCTV — 누르면 홈에서 그 영상 */}
      <Card aria-label="앞쪽 CCTV">
        <h2>앞쪽 CCTV {items.length ? `${items.length}곳` : ""}</h2>
        {items.length ? (
          items.map((c, i) => (
            <CctvRow key={c.id} type="button" onClick={() => goCctv(c)}>
              <em aria-hidden="true">{i + 1}</em>
              <span>
                <b>{c.name}</b>
                <small>
                  {fmt(c.liveKm ?? c.km)} 앞
                  {c.traffic && c.traffic.state !== "unknown" ? (
                    <>
                      {" · "}
                      <i style={{ background: theme.colors.traffic[c.traffic.state] }} aria-hidden="true" />
                      {TRAFFIC_LABEL[c.traffic.state]}
                    </>
                  ) : null}
                  {c.id === data.activeId ? <NowTag>재생 중</NowTag> : null}
                </small>
              </span>
              <FiChevronRight size={18} aria-hidden="true" />
            </CctvRow>
          ))
        ) : (
          <Empty>앞 5km 안에 볼 수 있는 CCTV가 없어요. 조금 더 가면 다시 찾아요.</Empty>
        )}
      </Card>

      {/* ⑥ 앞 10km 소통 띠 */}
      <Card aria-label={`앞 ${HORIZON_KM}km 소통`}>
        <h2>앞 {HORIZON_KM}km 소통</h2>
        {bands.length ? (
          <>
            <Strip>
              <Rail aria-hidden="true">
                {bands.map((b, i) => (
                  <Band
                    key={i}
                    style={{ top: b.fromKm * PX_PER_KM, height: Math.max(2, (b.toKm - b.fromKm) * PX_PER_KM), background: theme.colors.traffic[b.state] || theme.colors.traffic.unknown }}
                  />
                ))}
              </Rail>
              {[0, 2, 4, 6, 8, 10].map((k) => (
                <Tick key={k} style={{ top: 12 + k * PX_PER_KM }}>
                  {k === 0 ? "지금" : `${k}km`}
                </Tick>
              ))}
              {placed.map((m) => (
                <Mark
                  key={m.key}
                  type="button"
                  $c={m.color}
                  style={{ top: m.y }}
                  onClick={m.onClick}
                  disabled={!m.onClick}
                  aria-label={`${fmt(m.km)} 앞 ${m.text}${m.sub ? `, ${m.sub}` : ""}`}
                >
                  <span aria-hidden="true">{m.label}</span>
                  <span>
                    {m.text}
                    <em>
                      {fmt(m.km)}
                      {m.sub ? ` · ${m.sub}` : ""}
                    </em>
                  </span>
                </Mark>
              ))}
            </Strip>
            <Legend>
              {["smooth", "slow", "delay", "jam"].map((s) => (
                <span key={s}>
                  <i style={{ background: theme.colors.traffic[s] }} />
                  {TRAFFIC_LABEL[s]}
                </span>
              ))}
            </Legend>
          </>
        ) : (
          <Empty>앞 구간 소통 정보를 받는 중이에요. 차가 움직이면 진행 방향을 따라 보여 드려요.</Empty>
        )}
      </Card>

      {/* ④ 돌발 상세 */}
      <Card aria-label="앞쪽 돌발 상황">
        <h2>앞쪽 사고·공사·통제</h2>
        {events.length ? (
          events.map((ev) => {
            const lanes = blockedLanes(ev.lanes);
            const total = lanes.length ? Math.max(3, Math.max(...lanes) + 1) : 0;
            return (
              <Event key={ev.id} $c={tones[ev.type]}>
                <header>
                  <span>{ev.label || EVENT_LABEL[ev.type]}</span>
                  <b>{fmt(ev.km)} 앞</b>
                </header>
                {ev.lanes || ev.message ? <p>{[ev.lanes, ev.message].filter(Boolean).join(" · ")}</p> : null}
                {ev.startedAt || ev.endsAt ? (
                  <dl>
                    {ev.startedAt ? (
                      <div>
                        <dt>발생</dt>
                        <dd>{ev.startedAt}</dd>
                      </div>
                    ) : null}
                    {ev.endsAt ? (
                      <div>
                        <dt>해소 예정</dt>
                        <dd>{ev.endsAt}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
                {total ? (
                  <Lanes $c={tones[ev.type]} aria-label={`${lanes.join(", ")}차로 통제`}>
                    {Array.from({ length: total }, (_, i) => (
                      <span key={i} data-blocked={lanes.includes(i + 1)}>
                        {i + 1}
                      </span>
                    ))}
                  </Lanes>
                ) : null}
              </Event>
            );
          })
        ) : (
          <Empty>앞 {HORIZON_KM}km 안에 알려진 사고·공사·통제가 없어요.</Empty>
        )}
      </Card>

      {driverView ? <DriverView summary={summary} onClose={() => setDriverView(false)} /> : null}
    </TabPage>
  );
}
