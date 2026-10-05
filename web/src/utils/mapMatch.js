// src/utils/mapMatch.js
// 표준노드링크 맵매칭 — GPS 한 점 + 진행 방향으로 "지금 달리는 링크"를 고르고,
// 그 링크에서 도로를 따라 앞쪽 몇 km 의 길(예상 경로)을 만든다.
// 목적지가 없어도 이 예상 경로를 routeFilter 에 넘기면 "내 도로 앞쪽" CCTV 만 고를 수 있다.
//
// 링크는 방향이 있다(F_NODE → T_NODE). 상행·하행이 서로 다른 링크라서
// 진행 방향과 링크 방향을 비교하면 반대 차로 링크가 자연히 빠진다.
// React 의존 없는 순수 함수만 둔다.
import { angleDiff, bearingDeg } from "./aheadFilter";

export const TILE = 0.05; // server/nodelink/build-tiles.py 와 같은 값

export const MATCH = {
  radiusKm: 0.04, // GPS 오차를 감안한 후보 링크 거리
  maxHeadingDiff: 55, // 진행 방향과 링크 방향 차이가 이보다 크면 후보에서 뺀다(반대 차로)
  aheadKm: 6, // 예상 경로 길이 — 선별 범위(5km)보다 조금 길게
};

export const RANK_LABEL = {
  101: "고속국도",
  102: "도시고속도로",
  103: "일반국도",
  104: "특별·광역시도",
  105: "국가지원지방도",
  106: "지방도",
  107: "시군도",
  108: "기타 도로",
};

export const tileKey = (lat, lng) => `${Math.floor(lat / TILE)}_${Math.floor(lng / TILE)}`;

/** p 를 둘러싼 (2r+1)² 칸 */
export function tileKeysAround(p, r = 1) {
  const ty = Math.floor(p.lat / TILE);
  const tx = Math.floor(p.lng / TILE);
  const keys = [];
  for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) keys.push(`${ty + dy}_${tx + dx}`);
  return keys;
}

/** 타일 한 줄 → 링크 객체 */
export function decodeLink(row) {
  const [id, f, t, rank, name, no, lanes, c] = row;
  const pts = [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (let i = 0; i + 1 < c.length; i += 2) {
    const lat = c[i] / 1e5;
    const lng = c[i + 1] / 1e5;
    pts.push({ lat, lng });
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { id, f, t, rank: Number(rank), name, no, lanes, pts, box: [minLat, maxLat, minLng, maxLng] };
}

/** 링크 묶음 → 그래프(id·출발 노드로 찾기) */
export function buildGraph(links) {
  const byId = new Map();
  const byFrom = new Map();
  links.forEach((l) => {
    if (byId.has(l.id)) return;
    byId.set(l.id, l);
    if (!byFrom.has(l.f)) byFrom.set(l.f, []);
    byFrom.get(l.f).push(l);
  });
  return { byId, byFrom, links: [...byId.values()] };
}

/** 점을 링크에 투영 → { d(km), seg, t, along(km, 링크 시작부터), bearing(그 선분 방위) } */
export function projectOnLink(link, p) {
  const kx = 111.32 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 111.32;
  let best = null;
  let acc = 0;
  for (let i = 0; i + 1 < link.pts.length; i += 1) {
    const a = link.pts[i];
    const b = link.pts[i + 1];
    const ax = (a.lng - p.lng) * kx;
    const ay = (a.lat - p.lat) * ky;
    const dx = (b.lng - a.lng) * kx;
    const dy = (b.lat - a.lat) * ky;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const x = ax + t * dx;
    const y = ay + t * dy;
    const d = Math.sqrt(x * x + y * y);
    if (!best || d < best.d) best = { d, seg: i, t, along: acc + t * len, bearing: bearingDeg(a, b) };
    acc += len;
  }
  return best;
}

/**
 * 지금 달리는 링크를 고른다.
 * @param graph   buildGraph 결과
 * @param fix     { lat, lng }
 * @param heading 진행 방위(모르면 null — 그때는 이전 링크를 이어 쓰거나 가까운 링크만 본다)
 * @param prev    직전 매칭 결과(연속성 가산점)
 * @returns {{ link, d, seg, t, along, bearing, confident } | null}
 */
export function matchLink(graph, fix, heading, prev, opts = MATCH) {
  const pad = opts.radiusKm / 111;
  const padLng = pad / Math.cos((fix.lat * Math.PI) / 180);
  let best = null;
  let bestScore = Infinity;
  for (const link of graph.links) {
    const [a, b, c, e] = link.box;
    if (fix.lat < a - pad || fix.lat > b + pad || fix.lng < c - padLng || fix.lng > e + padLng) continue;
    const pr = projectOnLink(link, fix);
    if (!pr || pr.d > opts.radiusKm) continue;
    let score = pr.d / 0.012;
    if (heading != null) {
      const diff = Math.abs(angleDiff(heading, pr.bearing));
      if (diff > opts.maxHeadingDiff) continue;
      score += diff / 20;
    }
    if (prev?.link) {
      if (link.id === prev.link.id) score -= 1.2;
      else if (link.f === prev.link.t) score -= 0.6;
    }
    if (score < bestScore) {
      bestScore = score;
      best = { link, ...pr };
    }
  }
  if (!best) return null;
  // 방향을 모르면 어느 쪽 차로인지 확신할 수 없다 — 이전에 고른 링크를 이어 쓸 때만 믿는다
  return { ...best, confident: heading != null || best.link.id === prev?.link?.id };
}

/** 링크 이름(없으면 등급 이름) */
export const linkName = (link) => link.name || RANK_LABEL[link.rank] || "도로";

/**
 * 매칭된 링크에서 도로를 따라 앞쪽 km 만큼의 길을 만든다(routeFilter.buildRoute 에 넣을 모양).
 * 갈림길에서는 같은 이름 → 같은 등급 → 꺾이는 각이 작은 쪽을 고른다. 유턴(되돌아가는 링크)은 뺀다.
 * @returns {{ roads: Array<{name, coords:[[lat,lng]], state, speed}>, linkIds: string[] } | null}
 */
export function pathAhead(graph, match, km = MATCH.aheadKm) {
  if (!match?.link) return null;
  const roads = [];
  const linkIds = [];
  let total = 0;
  const push = (link, pts) => {
    const name = linkName(link);
    const coords = pts.map((p) => [p.lat, p.lng]);
    const last = roads[roads.length - 1];
    if (last && last.name === name) last.coords.push(...coords.slice(1));
    else roads.push({ name, coords, state: "unknown", speed: null, rank: link.rank, no: link.no });
    for (let i = 0; i + 1 < pts.length; i += 1) total += segKm(pts[i], pts[i + 1]);
  };

  // 첫 링크: 내 투영점부터 링크 끝까지
  const first = match.link;
  const a = first.pts[match.seg];
  const b = first.pts[match.seg + 1];
  const here = { lat: a.lat + (b.lat - a.lat) * match.t, lng: a.lng + (b.lng - a.lng) * match.t };
  push(first, [here, ...first.pts.slice(match.seg + 1)]);
  linkIds.push(first.id);

  const seen = new Set([first.id]);
  let cur = first;
  while (total < km) {
    const nexts = (graph.byFrom.get(cur.t) || []).filter((l) => !seen.has(l.id) && l.t !== cur.f);
    if (!nexts.length) break; // 타일 밖이거나 막다른 길
    const inBearing = bearingDeg(cur.pts[cur.pts.length - 2], cur.pts[cur.pts.length - 1]);
    let pick = null;
    let pickScore = Infinity;
    nexts.forEach((l) => {
      const turn = Math.abs(angleDiff(bearingDeg(l.pts[0], l.pts[1]), inBearing));
      const score = turn + (cur.name && l.name === cur.name ? 0 : 45) + (l.rank === cur.rank ? 0 : 25);
      if (score < pickScore) {
        pickScore = score;
        pick = l;
      }
    });
    seen.add(pick.id);
    linkIds.push(pick.id);
    push(pick, pick.pts);
    cur = pick;
  }
  return { roads, linkIds, km: total };
}

function segKm(a, b) {
  const kx = 111.32 * Math.cos((a.lat * Math.PI) / 180);
  const dx = (b.lng - a.lng) * kx;
  const dy = (b.lat - a.lat) * 111.32;
  return Math.sqrt(dx * dx + dy * dy);
}
