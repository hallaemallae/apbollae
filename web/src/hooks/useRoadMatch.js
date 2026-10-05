// src/hooks/useRoadMatch.js
// 표준노드링크 맵매칭 — 내 위치 주변 타일(3×3, 약 15km)을 받아 두고, 1초마다 지금 링크를 고른다.
// 매칭되면 "지금 도로 이름"과 "도로를 따라 앞쪽 6km 예상 경로"를 돌려준다.
// 타일은 로컬 프록시(/api/links)가 준다 — ITS 호출 한도와 상관없다.
// 타일이 없거나(프록시 꺼짐·타일 미생성) 매칭이 안 되면 null 을 돌려주고, 선별은 부채꼴 방식으로 돌아간다.
import { useEffect, useMemo, useRef, useState } from "react";
import { buildGraph, decodeLink, linkName, matchLink, pathAhead, tileKeysAround } from "../utils/mapMatch";
import { buildRoute } from "../utils/routeFilter";

const tileCache = new Map(); // key → links[] (모듈 싱글턴 — 화면을 오가도 다시 받지 않는다)
const pending = new Map(); // key → Promise
const PATH_EVERY_MS = 2000; // 같은 링크 위에서는 예상 경로를 이 간격으로만 다시 만든다

function loadTile(key) {
  if (tileCache.has(key)) return Promise.resolve(tileCache.get(key));
  if (pending.has(key)) return pending.get(key);
  const p = fetch(`/api/links?tile=${key}`)
    .then((r) => {
      if (!r.ok) throw new Error(`links HTTP ${r.status}`);
      return r.json();
    })
    .then((j) => {
      const links = (j.links || []).map(decodeLink);
      tileCache.set(key, links);
      return links;
    })
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

/**
 * @param fix      { lat, lng } | null
 * @param heading  진행 방위 | null
 * @param enabled  false 면 아무것도 하지 않는다(목업 시뮬레이션처럼 도로를 이미 아는 경우)
 * @returns {{ status, road, path, linkId }}
 *   status: off | loading | ready | nomatch | unavailable
 *   road  : { name, rank, no, lanes } | null
 *   path  : buildRoute 결과(routeFilter 로 선별) | null
 */
export default function useRoadMatch(fix, heading, enabled = true) {
  const [graph, setGraph] = useState(null);
  const [status, setStatus] = useState(enabled ? "loading" : "off");
  const keysRef = useRef("");
  const prevRef = useRef(null);
  const pathRef = useRef({ at: 0, linkId: null, value: null });

  // 내가 있는 칸이 바뀌면 주변 3×3 칸을 받아 그래프를 다시 만든다
  const centerKey = fix ? `${Math.floor(fix.lat / 0.05)}_${Math.floor(fix.lng / 0.05)}` : "";
  useEffect(() => {
    if (!enabled || !fix) return undefined;
    const keys = tileKeysAround(fix, 1);
    const joined = keys.join(",");
    if (joined === keysRef.current) return undefined;
    keysRef.current = joined;
    let alive = true;
    Promise.all(keys.map(loadTile))
      .then((lists) => {
        if (!alive) return;
        setGraph(buildGraph(lists.flat()));
        setStatus("ready");
      })
      .catch((e) => {
        if (!alive) return;
        console.warn("[match] 노드링크 타일을 받지 못했어요:", e.message);
        keysRef.current = ""; // 다음 칸 이동 때 다시 시도
        setStatus("unavailable");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, centerKey]);

  const result = useMemo(() => {
    if (!enabled || !graph || !fix) return null;
    const m = matchLink(graph, fix, heading, prevRef.current);
    if (!m) {
      prevRef.current = null;
      return null;
    }
    prevRef.current = m;
    if (!m.confident) return { match: m, path: null };
    const cache = pathRef.current;
    const now = Date.now();
    if (cache.linkId !== m.link.id || now - cache.at > PATH_EVERY_MS) {
      const raw = pathAhead(graph, m);
      pathRef.current = { at: now, linkId: m.link.id, value: raw && raw.roads.length ? buildRoute(raw) : null };
    }
    return { match: m, path: pathRef.current.value };
  }, [enabled, graph, fix, heading]);

  if (!enabled) return { status: "off", road: null, path: null, linkId: null };
  const m = result?.match;
  return {
    status: status === "ready" && !m ? "nomatch" : status,
    road: m ? { name: linkName(m.link), rank: m.link.rank, no: m.link.no, lanes: m.link.lanes } : null,
    path: result?.path || null,
    linkId: m?.link.id || null,
  };
}
