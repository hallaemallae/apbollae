// src/pages/legal/OssLicensesPage.jsx — 오픈소스 라이선스 고지 (할래말래 OssLicensesPage 이식)
// 목록은 scripts/build-oss-licenses.mjs 가 만든 public/oss-licenses.json.
// 본문이 100KB 넘게 커서 번들에 넣지 않고 이 화면을 열 때만 받아온다.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { FiChevronDown, FiSearch } from "react-icons/fi";
import { AuthHeader, AuthScreen, AuthTitle } from "../../components/auth/AuthParts";

const SRC_LABEL = { web: "앱 화면", rn: "앱 셸", font: "글꼴" };

const Intro = styled.p`
  margin: 0 0 18px;
  font-size: 14.5px;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const SearchBox = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 14px;
  margin-bottom: 8px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textWeak};
  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 15px;
    color: ${({ theme }) => theme.colors.textStrong};
  }
  &:focus-within {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Count = styled.p`
  margin: 0 0 4px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Item = styled.li`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Row = styled.button`
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 2px;
  border: 0;
  background: none;
  text-align: left;
  > svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.textWeak};
    transition: transform 0.15s ease;
    transform: rotate(${({ $open }) => ($open ? 180 : 0)}deg);
  }
`;

const Name = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  word-break: break-all;
  small {
    display: block;
    margin-top: 2px;
    font-size: 12.5px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const License = styled.span`
  flex-shrink: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Body = styled.div`
  padding: 0 2px 16px;
  font-size: 12.5px;
  a {
    display: inline-block;
    margin-bottom: 8px;
    color: ${({ theme }) => theme.colors.primary};
    word-break: break-all;
  }
  pre {
    margin: 0;
    max-height: 360px;
    overflow: auto;
    padding: 12px;
    border-radius: ${({ theme }) => theme.radius.sm}px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.textNormal};
  }
`;

const Note = styled.p`
  margin: 20px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export default function OssLicensesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}oss-licenses.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const shown = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return q ? data.packages.filter((p) => p.name.toLowerCase().includes(q) || p.license.toLowerCase().includes(q)) : data.packages;
  }, [data, query]);

  return (
    <AuthScreen>
      <AuthHeader />
      <AuthTitle>오픈소스 라이선스</AuthTitle>
      <Intro>
        앞볼래는 아래 오픈소스 소프트웨어를 사용합니다. 각 소프트웨어의 저작권은 해당 저작권자에게 있으며, 항목을 누르면 라이선스 전문과
        저작권 고지를 볼 수 있습니다.
      </Intro>

      {error ? <Intro role="alert">목록을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.</Intro> : null}
      {!data && !error ? <Intro role="status">불러오는 중…</Intro> : null}

      {data ? (
        <>
          <SearchBox>
            <FiSearch size={18} aria-hidden="true" />
            <input type="search" placeholder="이름 또는 라이선스로 찾기" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="오픈소스 찾기" />
          </SearchBox>
          <Count>
            {query.trim() ? `${shown.length}개 찾음 · ` : ""}전체 {data.packages.length}개
          </Count>
          <List>
            {shown.map((p) => {
              const key = `${p.name}@${p.version}`;
              const isOpen = open === key;
              return (
                <Item key={key}>
                  <Row type="button" $open={isOpen} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : key)}>
                    <Name>
                      {p.name}
                      <small>
                        {[p.version && `v${p.version}`, SRC_LABEL[p.src]].filter(Boolean).join(" · ")}
                      </small>
                    </Name>
                    <License>{p.license}</License>
                    <FiChevronDown size={18} aria-hidden="true" />
                  </Row>
                  {isOpen ? (
                    <Body>
                      {p.homepage ? (
                        <a href={p.homepage} target="_blank" rel="noopener noreferrer">
                          {p.homepage}
                        </a>
                      ) : null}
                      <pre>{p.copyright ? `${p.copyright}\n\n${data.texts[p.t]}` : data.texts[p.t]}</pre>
                    </Body>
                  ) : null}
                </Item>
              );
            })}
          </List>
          <Note>
            지도 화면은 카카오맵을, 목적지 검색·경로는 카카오모빌리티 API 를 이용합니다. 이 서비스들은 오픈소스가 아니며 각 제공자의 이용약관을
            따릅니다.
          </Note>
        </>
      ) : null}
    </AuthScreen>
  );
}
