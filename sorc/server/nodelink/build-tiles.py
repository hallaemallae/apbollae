# server/nodelink/build-tiles.py
# 전국 표준노드링크(ITS) SHP → 0.05° 격자 타일(위경도, gzip JSON).
# 프록시가 내 위치 주변 타일만 내려 주고, 앱이 그 링크로 맵매칭(지금 도로·방향)을 한다.
#
# 준비: ITS 노드링크 자료실에서 받은 [YYYY-MM-DD]NODELINKDATA.zip 을 data/nodelink/raw 에 풀어 둔다.
# 실행: pip install pyshp pyproj
#       python server/nodelink/build-tiles.py
# 결과: data/nodelink/tiles/<ty>_<tx>.json.gz  (git 에 올리지 않는다)
#
# 타일 한 줄(링크) = [LINK_ID, F_NODE, T_NODE, ROAD_RANK, 도로명, 노선번호, 차로수, 좌표]
#   좌표는 [lat*1e5, lng*1e5, ...] 정수 — 1m 남짓 정밀도. 링크는 방향이 있다(F_NODE → T_NODE).
import gzip
import json
import math
import os
import sys
import time
from collections import defaultdict

import shapefile
from pyproj import CRS, Transformer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "data", "nodelink", "raw")
OUT = os.path.join(ROOT, "data", "nodelink", "tiles")
TILE = 0.05  # 도 단위 격자 — 약 5km. 프록시와 앱(web/src/utils/mapMatch.js)이 같은 값을 쓴다
BATCH = 50_000


def main():
    shp = os.path.join(RAW, "MOCT_LINK")
    if not os.path.exists(shp + ".shp"):
        sys.exit(f"{shp}.shp 가 없어요. NODELINKDATA.zip 을 data/nodelink/raw 에 풀어 주세요.")
    with open(shp + ".prj", encoding="utf8") as f:
        src = CRS.from_wkt(f.read())
    tf = Transformer.from_crs(src, CRS.from_epsg(4326), always_xy=True)

    os.makedirs(OUT, exist_ok=True)
    tiles = defaultdict(list)
    reader = shapefile.Reader(shp, encoding="cp949")
    total = len(reader)
    t0 = time.time()

    pending = []  # (record, points)

    def flush():
        xs, ys, spans = [], [], []
        for _, pts in pending:
            spans.append((len(xs), len(pts)))
            for x, y in pts:
                xs.append(x)
                ys.append(y)
        lngs, lats = tf.transform(xs, ys)
        for (rec, _), (start, n) in zip(pending, spans):
            coords = []
            keys = set()
            last = None
            for i in range(start, start + n):
                la = round(lats[i] * 1e5)
                ln = round(lngs[i] * 1e5)
                if last == (la, ln):
                    continue
                last = (la, ln)
                coords += [la, ln]
                keys.add((math.floor(lats[i] / TILE), math.floor(lngs[i] / TILE)))
            if len(coords) < 4:
                continue
            name = rec["ROAD_NAME"] if rec["ROAD_NAME"] not in ("", "-") else ""
            no = rec["ROAD_NO"] if rec["ROAD_NO"] not in ("", "-") else ""
            row = [rec["LINK_ID"], rec["F_NODE"], rec["T_NODE"], rec["ROAD_RANK"], name, no, int(rec["LANES"] or 0), coords]
            for k in keys:
                tiles[k].append(row)
        pending.clear()

    for i, sr in enumerate(reader.iterShapeRecords()):
        pending.append((sr.record.as_dict(), sr.shape.points))
        if len(pending) >= BATCH:
            flush()
            print(f"  {i + 1:,}/{total:,} 링크 ({time.time() - t0:.0f}s)", flush=True)
    flush()

    print(f"타일 {len(tiles):,}개 쓰는 중…", flush=True)
    size = 0
    for (ty, tx), rows in tiles.items():
        p = os.path.join(OUT, f"{ty}_{tx}.json.gz")
        with gzip.open(p, "wt", encoding="utf8", compresslevel=6) as f:
            json.dump({"v": 1, "tile": TILE, "links": rows}, f, ensure_ascii=False, separators=(",", ":"))
        size += os.path.getsize(p)
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf8") as f:
        json.dump({"tile": TILE, "links": total, "tiles": len(tiles), "source": os.listdir(os.path.dirname(RAW))}, f, ensure_ascii=False)
    print(f"끝: 링크 {total:,} · 타일 {len(tiles):,} · {size / 1e6:.0f}MB · {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
