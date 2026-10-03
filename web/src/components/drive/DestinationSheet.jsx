// src/components/drive/DestinationSheet.jsx
// 목적지 검색(선택 기능) — 목적지를 넣으면 경로 위 CCTV 만, 경로 거리 순으로 고른다.
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { FiChevronLeft, FiMapPin, FiSearch } from "react-icons/fi";
import { searchPlaces } from "../../services/routeApi";
import { formatDistance } from "../../utils/aheadFilter";

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
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px 8px 4px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  button {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  input {
    flex: 1;
    min-width: 0;
    height: 48px;
    padding: 0 14px;
    border-radius: ${({ theme }) => theme.radius.md}px;
    border: 1.5px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    font-size: 17px;
    font-weight: 600;
    outline: none;
  }
  input:focus {
    border-color: ${({ theme }) => theme.colors.lane};
  }
`;

const Help = styled.p`
  margin: 16px 20px 8px;
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0 0 calc(env(safe-area-inset-bottom) + 24px);
  overflow-y: auto;
`;

const Item = styled.li`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  button {
    width: 100%;
    min-height: 64px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 20px;
    border: none;
    background: transparent;
    text-align: left;
  }
  svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.textWeak};
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
  em {
    margin-left: auto;
    flex-shrink: 0;
    font-style: normal;
    font-size: 13px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textNormal};
  }
`;

const ERROR_TEXT = {
  no_kakao_key: "목적지 검색이 아직 켜져 있지 않아요. (개발: server/.env 에 KAKAO_REST_KEY)",
  kakao_failed: "장소를 찾지 못했어요. 잠시 뒤 다시 검색해 주세요.",
};

export default function DestinationSheet({ near, data, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ status: "idle", places: [], error: null });
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim() && data !== "mock") return;
    setState({ status: "loading", places: [], error: null });
    try {
      const places = await searchPlaces(query, near, { data });
      setState({ status: "done", places, error: null });
    } catch (err) {
      setState({ status: "error", places: [], error: ERROR_TEXT[err.code] || "장소를 찾지 못했어요. 인터넷 연결을 확인해 주세요." });
    }
  };

  return (
    <Screen role="dialog" aria-label="목적지 검색">
      <Head onSubmit={search}>
        <button type="button" aria-label="닫기" onClick={onClose}>
          <FiChevronLeft size={26} />
        </button>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="목적지 검색 (예: 기흥IC, 부산역)"
          enterKeyHint="search"
          aria-label="목적지"
        />
        <button type="submit" aria-label="검색">
          <FiSearch size={22} />
        </button>
      </Head>

      {state.status === "idle" ? (
        <Help>목적지를 넣으면 경로 위에 있는 CCTV만, 경로를 따라 가까운 순서로 골라요. 앞쪽 정체 구간도 함께 알려 드려요.</Help>
      ) : null}
      {state.status === "loading" ? <Help>찾는 중</Help> : null}
      {state.status === "error" ? <Help role="alert">{state.error}</Help> : null}
      {state.status === "done" && !state.places.length ? <Help>"{query}"에 맞는 장소가 없어요. 다른 이름으로 찾아 주세요.</Help> : null}

      <List>
        {state.places.map((p) => {
          const d = p.distanceM != null ? formatDistance(p.distanceM / 1000) : null;
          return (
            <Item key={p.id}>
              <button type="button" onClick={() => onPick({ name: p.name, address: p.address, lat: p.lat, lng: p.lng })}>
                <FiMapPin size={20} />
                <span>
                  <b>{p.name}</b>
                  <small>{[p.category, p.address].filter(Boolean).join(" · ")}</small>
                </span>
                {d ? (
                  <em>
                    {d.value}
                    {d.unit}
                  </em>
                ) : null}
              </button>
            </Item>
          );
        })}
      </List>
    </Screen>
  );
}
