// src/components/drive/DestinationSheet.jsx — 목적지 입력(선택 기능).
// Claude Design "목적지 입력" 시안(카카오내비 벤치마킹)을 앞볼래에 맞게 옮겼다.
//  1a 입력 전  : 집·회사 바로가기 + 최근 목적지(편집해서 지우기)
//  1b 자동완성 : 글자를 치면 0.3초 뒤 장소 후보, 친 글자는 강조
//  1c 경로 비교: 추천·최단 시간·무료도로 — 시간·거리·통행료와 함께 경로 위 CCTV 수·막힌 구간 수를 비교하고
//               "이 경로로 CCTV 보기"로 정한다(앞볼래는 길 안내를 하지 않는다 — 고른 경로 위 CCTV 만 보여 준다).
// 내비 전용인 카테고리 칩(휴게소·주유소)과 음성 검색은 넣지 않았다. 옅은 색 면은 쓰지 않는다(흰 면 + 선).
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { FiChevronLeft, FiMapPin, FiHome, FiBriefcase, FiClock, FiX, FiPlus, FiCheck } from "react-icons/fi";
import { searchPlaces, fetchRoute } from "../../services/routeApi";
import { usePlaces, addRecent, removeRecent, setFavorite } from "../../services/placeStore";
import { distanceKm, formatDistance } from "../../utils/aheadFilter";
import { buildRoute, selectAlongRoute, ROUTE_OPTS } from "../../utils/routeFilter";
import { trafficBands } from "../../utils/situation";

const ROUTE_OPTIONS = [
  { key: "recommend", label: "추천" },
  { key: "time", label: "최단 시간" },
  { key: "free", label: "무료도로" },
];

const ERROR_TEXT = {
  no_kakao_key: "목적지 검색이 아직 켜져 있지 않아요. (개발: server/.env 에 KAKAO_REST_KEY)",
  kakao_failed: "장소를 찾지 못했어요. 잠시 뒤 다시 검색해 주세요.",
};

/* ── 틀 ── */
const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1600;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
  padding-top: env(safe-area-inset-top);
`;

const Head = styled.form`
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 10px 4px;
  > button {
    flex: none;
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.textStrong};
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const Field = styled.div`
  flex: 1;
  min-width: 0;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px 0 14px;
  border-radius: 14px;
  border: 2px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.surface};
  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    background: transparent;
    font-size: 16px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textStrong};
    outline: none;
  }
  input::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
    font-weight: 500;
  }
  button {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: ${({ theme }) => theme.colors.textWeak};
    color: ${({ theme }) => theme.colors.surface};
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(env(safe-area-inset-bottom) + 24px);
  > * {
    flex-shrink: 0;
  }
`;

/* 흰 면 + 선 카드 */
const card = ({ theme }) => `
  background: ${theme.colors.surface};
  border: 1px solid ${theme.mode === "dark" ? theme.colors.border : "#E8EAEF"};
`;

/* ── 1a 집·회사 ── */
const Favs = styled.div`
  display: flex;
  gap: 8px;
  padding: 4px 16px 16px;
`;

const Fav = styled.div`
  flex: 1;
  min-width: 0;
  position: relative;
  > button:first-child {
    width: 100%;
    min-height: 60px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    ${card}
    font-family: inherit;
    text-align: left;
    color: ${({ theme }) => theme.colors.textStrong};
  }
  > button:first-child > svg {
    flex: none;
    color: ${({ theme }) => theme.colors.primary};
  }
  b {
    display: block;
    font-size: 14px;
    font-weight: 700;
  }
  small {
    display: block;
    margin-top: 1px;
    font-size: 11.5px;
    color: ${({ theme }) => theme.colors.textWeak};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  > button + button {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: none;
    background: ${({ theme }) => theme.colors.textStrong};
    color: ${({ theme }) => theme.colors.surface};
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const Section = styled.section`
  margin: 0 0 8px;
  border-radius: 22px 22px 0 0;
  ${card}
  border-bottom: none;
  flex: 1 0 auto;
  margin-bottom: calc(-1 * (env(safe-area-inset-bottom) + 24px));
  padding-top: 16px;
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px 6px;
  }
  header b {
    font-size: 15px;
    font-weight: 700;
  }
  header button {
    min-height: 36px;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Help = styled.p`
  margin: 12px 20px;
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 장소 한 줄(최근·자동완성 공통) */
const Place = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  > button:first-child {
    flex: 1;
    min-width: 0;
    min-height: 62px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 20px;
    border: none;
    background: transparent;
    font-family: inherit;
    text-align: left;
    color: ${({ theme }) => theme.colors.textStrong};
  }
  i {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid ${({ theme }) => theme.colors.border};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  span {
    flex: 1;
    min-width: 0;
  }
  b {
    display: block;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  b mark {
    background: none;
    color: ${({ theme }) => theme.colors.primary};
  }
  small {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  em {
    flex: none;
    font-style: normal;
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  > button + button {
    flex: none;
    width: 48px;
    height: 48px;
    margin-right: 8px;
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.textWeak};
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

/* ── 1c 경로 비교 ── */
const Trip = styled.div`
  margin: 0 16px 12px;
  padding: 12px 14px;
  border-radius: 16px;
  ${card}
  font-size: 14px;
  div {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 0;
  }
  i {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
  }
  i.dest {
    border-radius: 2px;
    background: ${({ theme }) => theme.colors.textStrong};
  }
  b {
    font-weight: 700;
  }
  span {
    color: ${({ theme }) => theme.colors.textNormal};
  }
`;

const Route = styled.button`
  display: block;
  width: calc(100% - 32px);
  margin: 0 16px 8px;
  padding: 14px 16px;
  border-radius: 16px;
  ${card}
  border: ${({ theme, $on }) => ($on ? `2px solid ${theme.colors.primary}` : `1px solid ${theme.mode === "dark" ? theme.colors.border : "#E8EAEF"}`)};
  font-family: inherit;
  text-align: left;
  color: ${({ theme }) => theme.colors.textStrong};
  .top {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
  }
  .tag {
    font-weight: 800;
    color: ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.textNormal)};
  }
  .meta {
    margin-left: auto;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  .time {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }
  .time b {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.4px;
  }
  .time span {
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textNormal};
  }
  .chips {
    display: flex;
    gap: 14px;
    margin-top: 10px;
    font-size: 13px;
    font-weight: 700;
  }
  .chips span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .chips i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
`;

const Go = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: calc(100% - 32px);
  height: 54px;
  margin: 8px 16px 0;
  border: none;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryText};
  font-family: inherit;
  font-size: 17px;
  font-weight: 700;
  &:disabled {
    background: ${({ theme }) => theme.colors.textWeak};
  }
`;

const kmText = (km) => {
  if (km == null) return "";
  const d = formatDistance(km);
  return `${d.value}${d.unit}`;
};

const durText = (sec) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
};

const etaText = (sec) => {
  const d = new Date(Date.now() + sec * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** 이름에서 친 글자를 강조 */
function Highlight({ text, q }) {
  const i = q ? text.indexOf(q) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * @param {{ near, heading, data, cctvs, onPick, onClose }} props
 *   cctvs: 전국 CCTV 목록(경로 위 CCTV 수 세기용)
 *   onPick({ name, address, lat, lng, opt })
 */
export default function DestinationSheet({ near, heading = null, data, cctvs = [], onPick, onClose }) {
  const places = usePlaces();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ status: "idle", places: [], error: null });
  const [editing, setEditing] = useState(false);
  const [setting, setSetting] = useState(null); // "home" | "work" — 집·회사 등록 중
  const [target, setTarget] = useState(null); // 경로 비교 중인 장소
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 1b 자동완성 — 친 뒤 0.3초 쉬면 찾는다
  const q = query.trim();
  useEffect(() => {
    if (!q && data !== "mock") {
      setResult({ status: "idle", places: [], error: null });
      return undefined;
    }
    if (!q) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      setResult((r) => ({ ...r, status: "loading" }));
      searchPlaces(q, near, { data })
        .then((list) => alive && setResult({ status: "done", places: list, error: null }))
        .catch((err) => alive && setResult({ status: "error", places: [], error: ERROR_TEXT[err.code] || "장소를 찾지 못했어요. 인터넷 연결을 확인해 주세요." }));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // near 는 움직일 때마다 바뀌어 다시 찾지 않게 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, data]);

  const choose = (p) => {
    if (setting) {
      setFavorite(setting, p);
      setSetting(null);
      setQuery("");
      return;
    }
    setTarget(p);
  };

  const far = (p) => (near ? kmText(distanceKm(near, p)) : "");

  if (target) {
    return (
      <Compare
        place={target}
        near={near}
        heading={heading}
        data={data}
        cctvs={cctvs}
        onBack={() => setTarget(null)}
        onGo={(opt) => {
          addRecent(target);
          onPick({ name: target.name, address: target.address, lat: target.lat, lng: target.lng, opt });
        }}
      />
    );
  }

  return (
    <Screen role="dialog" aria-label={setting ? `${setting === "home" ? "집" : "회사"} 등록` : "목적지 검색"}>
      <Head onSubmit={(e) => e.preventDefault()}>
        <button type="button" aria-label={setting ? "등록 그만두기" : "닫기"} onClick={setting ? () => setSetting(null) : onClose}>
          <FiChevronLeft size={24} />
        </button>
        <Field>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={setting ? `${setting === "home" ? "집" : "회사"} 주소나 이름을 찾아 주세요` : "어디로 가세요?"}
            enterKeyHint="search"
            aria-label="목적지"
          />
          {query ? (
            <button type="button" aria-label="지우기" onClick={() => setQuery("")}>
              <FiX size={14} strokeWidth={3} />
            </button>
          ) : null}
        </Field>
      </Head>

      <Body>
        {!q ? (
          <>
            {/* 1a 입력 전 — 집·회사 */}
            {!setting ? (
              <Favs>
                {[
                  ["home", "집", FiHome],
                  ["work", "회사", FiBriefcase],
                ].map(([key, label, Icon]) => {
                  const p = places[key];
                  return (
                    <Fav key={key}>
                      <button type="button" onClick={() => (p ? choose(p) : setSetting(key))} aria-label={p ? `${label}, ${p.name}` : `${label} 등록`}>
                        {p ? <Icon size={20} aria-hidden="true" /> : <FiPlus size={20} aria-hidden="true" />}
                        <span style={{ minWidth: 0 }}>
                          <b>{label}</b>
                          <small>{p ? `${p.name}${near ? ` · ${far(p)}` : ""}` : "눌러서 등록"}</small>
                        </span>
                      </button>
                      {p && editing ? (
                        <button type="button" aria-label={`${label} 지우기`} onClick={() => setFavorite(key, null)}>
                          <FiX size={14} strokeWidth={3} />
                        </button>
                      ) : null}
                    </Fav>
                  );
                })}
              </Favs>
            ) : (
              <Help>찾은 장소를 누르면 {setting === "home" ? "집" : "회사"}으로 등록해요.</Help>
            )}

            {/* 1a 최근 목적지 */}
            {!setting ? (
              <Section aria-label="최근 목적지">
                <header>
                  <b>최근 목적지</b>
                  {places.recent.length || places.home || places.work ? (
                    <button type="button" onClick={() => setEditing((v) => !v)}>
                      {editing ? "완료" : "편집"}
                    </button>
                  ) : null}
                </header>
                {places.recent.length ? (
                  places.recent.map((p) => (
                    <Place key={p.id}>
                      <button type="button" onClick={() => choose(p)}>
                        <FiClock size={18} aria-hidden="true" style={{ flex: "none", color: "inherit", opacity: 0.55 }} />
                        <span>
                          <b>{p.name}</b>
                          <small>{p.address}</small>
                        </span>
                        {!editing ? <em>{far(p)}</em> : null}
                      </button>
                      {editing ? (
                        <button type="button" aria-label={`${p.name} 지우기`} onClick={() => removeRecent(p)}>
                          <FiX size={18} />
                        </button>
                      ) : null}
                    </Place>
                  ))
                ) : (
                  <Help>목적지를 넣으면 경로 위에 있는 CCTV만, 경로를 따라 가까운 순서로 골라요. 앞쪽 정체 구간도 함께 알려 드려요.</Help>
                )}
              </Section>
            ) : null}
          </>
        ) : (
          <>
            {/* 1b 자동완성 */}
            {result.status === "error" ? <Help role="alert">{result.error}</Help> : null}
            {result.status === "done" && !result.places.length ? <Help>"{q}"에 맞는 장소가 없어요. 다른 이름으로 찾아 주세요.</Help> : null}
            {result.places.map((p) => (
              <Place key={p.id}>
                <button type="button" onClick={() => choose(p)}>
                  <i aria-hidden="true">
                    <FiMapPin size={16} />
                  </i>
                  <span>
                    <b>
                      <Highlight text={p.name} q={q} />
                    </b>
                    <small>{[p.category, p.address].filter(Boolean).join(" · ")}</small>
                  </span>
                  <em>{p.distanceM != null ? kmText(p.distanceM / 1000) : far(p)}</em>
                </button>
              </Place>
            ))}
          </>
        )}
      </Body>
    </Screen>
  );
}

/** 1c 경로 비교 — 세 가지 경로를 받아 CCTV 수·막힌 구간 수와 함께 비교 */
function Compare({ place, near, heading, data, cctvs, onBack, onGo }) {
  const [routes, setRoutes] = useState(null); // [{ key, label, route }]
  const [error, setError] = useState(null);
  const [pick, setPick] = useState("recommend");

  useEffect(() => {
    if (!near) {
      setError("내 위치를 아직 몰라요. 위치가 잡힌 뒤 다시 골라 주세요.");
      return undefined;
    }
    let alive = true;
    Promise.allSettled(ROUTE_OPTIONS.map((o) => fetchRoute(near, place, heading, { data, opt: o.key }))).then((res) => {
      if (!alive) return;
      const list = [];
      res.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const raw = r.value;
        // 같은 경로(거리·시간이 같음)는 하나로 합친다
        const dup = list.find((x) => x.raw.distance === raw.distance && x.raw.duration === raw.duration);
        if (dup) dup.label += ` · ${ROUTE_OPTIONS[i].label}`;
        else list.push({ key: ROUTE_OPTIONS[i].key, label: ROUTE_OPTIONS[i].label, raw, route: buildRoute(raw) });
      });
      if (!list.length) setError("경로를 찾지 못했어요. 잠시 뒤 다시 골라 주세요.");
      setRoutes(list);
      setPick(list[0]?.key || "recommend");
    });
    return () => {
      alive = false;
    };
  }, [near, place, heading, data]);

  // 경로마다 경로 위 CCTV 수·막힌 구간 수
  const stats = useMemo(() => {
    if (!routes) return {};
    const opts = { ...ROUTE_OPTS, maxKm: Infinity, limit: Infinity };
    return Object.fromEntries(
      routes.map((r) => {
        const cctv = cctvs.length ? selectAlongRoute(cctvs, r.route, 0, null, opts).selected.length : null;
        const jam = trafficBands({ route: r.route, s0: 0 }, r.route.total).filter((b) => ["jam", "delay", "blocked"].includes(b.state) && b.toKm - b.fromKm > 0.2).length;
        return [r.key, { cctv, jam }];
      })
    );
  }, [routes, cctvs]);

  return (
    <Screen role="dialog" aria-label={`${place.name}까지 경로 비교`}>
      <Head onSubmit={(e) => e.preventDefault()}>
        <button type="button" aria-label="다시 검색" onClick={onBack}>
          <FiChevronLeft size={24} />
        </button>
        <b style={{ fontSize: 17 }}>경로 고르기</b>
      </Head>
      <Body>
        <Trip>
          <div>
            <i aria-hidden="true" />
            <span>내 위치</span>
          </div>
          <div>
            <i className="dest" aria-hidden="true" />
            <b>{place.name}</b>
          </div>
        </Trip>

        {error ? <Help role="alert">{error}</Help> : null}
        {!routes && !error ? <Help>경로를 비교하는 중이에요</Help> : null}
        {routes?.map((r) => {
          const st = stats[r.key] || {};
          return (
            <Route key={r.key} type="button" $on={pick === r.key} aria-pressed={pick === r.key} onClick={() => setPick(r.key)}>
              <div className="top">
                <span className="tag">{r.label}</span>
                <span className="meta">
                  {kmText(r.raw.distance / 1000)} · 통행료 {r.raw.toll ? `${r.raw.toll.toLocaleString()}원` : "없음"}
                </span>
              </div>
              <div className="time">
                <b>{durText(r.raw.duration)}</b>
                <span>{etaText(r.raw.duration)} 도착</span>
              </div>
              <div className="chips">
                <span>
                  <i style={{ background: "#F08A24" }} aria-hidden="true" />
                  CCTV {st.cctv != null ? `${st.cctv}곳` : "-"}
                </span>
                <span>
                  <i style={{ background: "#D33A2C" }} aria-hidden="true" />
                  막힌 구간 {st.jam ?? "-"}
                </span>
              </div>
            </Route>
          );
        })}
        {routes?.length ? (
          <Go type="button" onClick={() => onGo(pick)}>
            <FiCheck size={20} aria-hidden="true" />이 경로로 CCTV 보기
          </Go>
        ) : null}
        <Help style={{ fontSize: 12.5 }}>앞볼래는 길 안내를 하지 않아요. 고른 경로 위의 CCTV와 정체만 보여 드려요.</Help>
      </Body>
    </Screen>
  );
}
