// 약관·정책 보기 — 서비스 이용약관 / 개인정보 처리방침 / 위치기반서비스 이용약관.
// 본문은 legalDocs.js 에 있다(앞볼래가 실제로 처리하는 정보 기준). 출시 전 법률 검토와 〔 〕 칸 채우기가 남아 있다.
// 위쪽 목차에서 조항을 누르면 그 조항으로 내려간다.
import React from "react";
import styled from "styled-components";
import { AuthHeader, AuthScreen, AuthTitle } from "../../components/auth/AuthParts";
import { DOCS } from "./legalDocs";

const Meta = styled.p`
  margin: 0 0 16px;
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Draft = styled.p`
  margin: 0 0 20px;
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Intro = styled.p`
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.75;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Toc = styled.nav`
  margin: 0 0 28px;
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  h2 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  button {
    width: 100%;
    min-height: 34px;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    font-size: 14px;
    color: ${({ theme }) => theme.colors.textNormal};
  }
`;

const Article = styled.section`
  min-width: 0; /* 넓은 표가 화면 폭을 밀어내지 않게 — 표는 TableWrap 안에서 가로로 민다 */
  margin-bottom: 28px;
  scroll-margin-top: 16px;
  h2 {
    margin: 0 0 10px;
    font-size: 16.5px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textStrong};
  }
  p {
    margin: 0 0 8px;
    font-size: 15px;
    line-height: 1.75;
    color: ${({ theme }) => theme.colors.textNormal};
  }
  ol,
  ul {
    margin: 0 0 10px;
    padding-left: 22px;
    font-size: 14.5px;
    line-height: 1.7;
    color: ${({ theme }) => theme.colors.textNormal};
  }
  ol {
    list-style: decimal;
  }
  li + li {
    margin-top: 4px;
  }
`;

// 표 — 좁은 폰 화면에서는 가로로 밀어서 본다
const TableWrap = styled.div`
  margin: 4px 0 12px;
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  table {
    width: 100%;
    min-width: 420px;
    border-collapse: collapse;
    font-size: 13.5px;
    line-height: 1.55;
  }
  th,
  td {
    padding: 9px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    text-align: left;
    vertical-align: top;
  }
  tr:last-child td {
    border-bottom: none;
  }
  th {
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textStrong};
    white-space: nowrap;
  }
  td {
    color: ${({ theme }) => theme.colors.textNormal};
  }
  td:first-child {
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textStrong};
  }
`;

function Block({ b }) {
  if (typeof b === "string") return <p>{b}</p>;
  if (b.ol) return <ol>{b.ol.map((x) => <li key={x}>{x}</li>)}</ol>;
  if (b.ul) return <ul>{b.ul.map((x) => <li key={x}>{x}</li>)}</ul>;
  if (b.table)
    return (
      <TableWrap>
        <table>
          <thead>
            <tr>
              {b.table.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.table.rows.map((r) => (
              <tr key={r.join("|")}>
                {r.map((c, i) => (
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    );
  return null;
}

export default function LegalPage({ doc }) {
  const d = DOCS[doc];
  const jump = (i) => document.getElementById(`art-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <AuthScreen>
      <AuthHeader />
      <AuthTitle>{d.title}</AuthTitle>
      <Meta>{d.meta}</Meta>
      <Draft>출시 전 초안이에요. 법률 검토를 거쳐 확정본으로 바꾸고, 바뀌면 앱 안에 미리 알려 드려요.</Draft>
      {d.intro ? <Intro>{d.intro}</Intro> : null}

      <Toc aria-label="목차">
        <h2>목차</h2>
        <ol>
          {d.sections.map((s, i) => (
            <li key={s.h}>
              <button type="button" onClick={() => jump(i)}>
                {s.h}
              </button>
            </li>
          ))}
        </ol>
      </Toc>

      {d.sections.map((s, i) => (
        <Article key={s.h} id={`art-${i}`}>
          <h2>{s.h}</h2>
          {s.body.map((b, k) => (
            <Block key={k} b={b} />
          ))}
        </Article>
      ))}
    </AuthScreen>
  );
}
