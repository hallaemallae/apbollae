// 앞볼래 API 프록시 — Cloud Functions 판 (기능흐름도 5번 슬라이드 · F-06)
//
// ⚠️ 2026-10-03 확인: ITS(its.go.kr)가 Google Cloud 의 나가는 IP(34.96.x)에서 오는 연결을 받지 않는다
//    (UND_ERR_CONNECT_TIMEOUT). 지금은 배포해도 ITS 를 못 부른다. 개발은 server/dev-proxy.cjs(내 PC) 로 한다.
//    운영 서버는 국내 IP 에서 돌려야 한다 — 같은 itsCore.js 를 감싸기만 하면 된다.
//
//   GET /api/its/around?lat=&lng=  → itsCore 응답 모양
// - ITS 인증키는 시크릿(ITS_API_KEY)에만 있다.
// - 캐시: Firestore itsCache/{kind_cell}(인스턴스끼리 공유, 클라이언트 접근 불가) + 인스턴스 메모리
// - 월 한도: itsUsage/{YYYY-MM}.count 가 ITS_MONTHLY_LIMIT 에 닿으면 캐시만 돌려준다(E6)
// - 요청에 사용자 식별 정보를 받지 않고, 위치를 저장하지 않는다(격자 칸 번호만 캐시 키로 쓴다).
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineInt } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { inKorea, createLoaders, createAround } = require("./itsCore");

initializeApp();
const db = getFirestore();

const ITS_API_KEY = defineSecret("ITS_API_KEY");
const ITS_MONTHLY_LIMIT = defineInt("ITS_MONTHLY_LIMIT", { default: 900 });

const monthKey = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7); // KST 기준 YYYY-MM

const mem = new Map();
const store = {
  async get(id) {
    if (mem.has(id)) return mem.get(id);
    const snap = await db.doc(`itsCache/${id}`).get();
    return snap.exists ? snap.data() : null;
  },
  async set(id, val) {
    mem.set(id, val);
    await db.doc(`itsCache/${id}`).set(val);
  },
};

let around = null; // 시크릿·파라미터는 요청 시점에 읽는다

exports.api = onRequest(
  { region: "asia-northeast3", secrets: [ITS_API_KEY], cors: true, maxInstances: 3, memory: "256MiB", timeoutSeconds: 30 },
  async (req, res) => {
    // Hosting 리라이트(/api/its/around)와 함수 직접 호출(/its/around) 둘 다 받는다
    if (req.method !== "GET" || !/\/its\/around\/?$/.test(req.path)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!inKorea(lat, lng)) {
      res.status(400).json({ error: "bad_position" });
      return;
    }

    around ||= createAround({
      loaders: createLoaders({
        apiKey: () => ITS_API_KEY.value(),
        countCall: () =>
          db.doc(`itsUsage/${monthKey()}`).set({ count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      }),
      store,
      usage: async () => {
        const snap = await db.doc(`itsUsage/${monthKey()}`).get();
        return snap.exists ? snap.data().count || 0 : 0;
      },
      limit: ITS_MONTHLY_LIMIT.value(),
      log: { warn: (...a) => logger.warn(a.join(" ")), error: (...a) => logger.error(a.join(" ")) },
    });

    try {
      res.set("Cache-Control", "no-store").json(await around(lat, lng));
    } catch (err) {
      res.status(503).json({ error: err.message === "QUOTA_EXCEEDED" ? "quota_exceeded" : "its_unavailable" });
    }
  }
);
