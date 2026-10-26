// src/hooks/useTripRecorder.js — ⑩ 주행 중 정체·돌발을 지나면 기록(tripLog)에 남긴다.
//  - 정체: 앞 막힘 구간의 시작이 150m 안이면 "정체 안", 막힘이 사라지거나 500m 넘게 앞으로 밀리면 "빠져나옴".
//    정체 안에서 본 돌발(막힘 구간 안)을 원인으로 같이 적는다. 1분 미만·300m 미만은 버린다.
//  - 돌발: 400m 안까지 다가온 돌발이 목록에서 사라지면(지나침) 따로 적는다(그 정체의 원인으로 이미 적었으면 빼고).
// 소통 정보가 끊긴 순간(임시 경로 다시 받는 중)에는 판단하지 않는다.
import { useEffect, useRef } from "react";
import { addTripEntry } from "../services/tripLog";
import { distanceKm } from "../utils/aheadFilter";

const pickCause = (ev) => (ev ? { type: ev.type, label: ev.label || null, lanes: ev.lanes || null, message: ev.message || null } : null);

export default function useTripRecorder({ fix, jam, events, hasTraffic, road }) {
  const ref = useRef({ inJam: null, lastFix: null, tracked: new Map() });

  useEffect(() => {
    if (!fix) return;
    const st = ref.current;
    const now = Date.now();
    const step = st.lastFix ? distanceKm(st.lastFix, fix) : 0;
    st.lastFix = { lat: fix.lat, lng: fix.lng };

    // 정체
    if (st.inJam) {
      st.inJam.odo += step;
      const inside = jam ? events.filter((e) => e.km <= jam.startKm + jam.lengthKm + 0.5) : [];
      if (inside[0]) st.inJam.cause = inside[0];
      if (hasTraffic && (!jam || jam.startKm > 0.5)) {
        const j = st.inJam;
        st.inJam = null;
        if (now - j.startedAt >= 60_000 && j.odo >= 0.3) {
          addTripEntry({ kind: "jam", startedAt: j.startedAt, endedAt: now, road: j.road, lengthKm: Math.round(j.odo * 10) / 10, cause: pickCause(j.cause), lat: fix.lat, lng: fix.lng });
          if (j.cause) st.tracked.delete(j.cause.id);
        }
      }
    } else if (jam && jam.startKm < 0.15) {
      st.inJam = { startedAt: now, odo: 0, road: road || "", cause: events.find((e) => e.km <= jam.lengthKm + 0.5) || null };
    }

    // 돌발 지나침
    const ids = new Set(events.map((e) => e.id));
    events.forEach((e) => {
      if (e.km < 1) st.tracked.set(e.id, { ev: e, km: e.km });
    });
    st.tracked.forEach(({ ev, km }, id) => {
      if (ids.has(id)) return;
      st.tracked.delete(id);
      if (km > 0.4) return; // 바로 앞까지 오지 않았는데 사라짐 — 목록 갱신 탓일 수 있어 적지 않는다
      if (st.inJam?.cause?.id === id) return; // 정체 기록에 원인으로 들어간다
      addTripEntry({ kind: "event", startedAt: now, endedAt: now, road: road || ev.roadName || "", cause: pickCause(ev), lat: fix.lat, lng: fix.lng });
    });
  }, [fix, jam, events, hasTraffic, road]);
}
