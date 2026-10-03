// src/utils/loadKakaoMaps.js
// 카카오 지도 SDK 로더 — 할래말래 loadKakaoMaps.js 에서 지도 부분만 가져왔다(주소검색 제외).
//
// 키: web/.env.local 의 VITE_KAKAO_JS_KEY (카카오 디벨로퍼스 > 앞볼래 앱 > JavaScript 키)
//   - 웹 도메인 등록 필요: http://localhost:3000, 폰 테스트용 http://<PC IP>:3000, 배포 주소
//   - JavaScript 키는 브라우저로 내려가는 공개 값이다(도메인으로 사용처를 제한한다).
// 키가 없거나 SDK 를 못 받으면 reject → 호출한 쪽이 간이 지도(SVG)로 대신 그린다.

const KEY = import.meta.env.VITE_KAKAO_JS_KEY;
const SRC = KEY ? `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false` : "";

let kakaoPromise = null;

export const hasKakaoKey = () => !!KEY;

/** window.kakao.maps 를 쓸 수 있게 되면 resolve(kakao) */
export function loadKakaoMaps() {
  if (!KEY) return Promise.reject(new Error("VITE_KAKAO_JS_KEY 없음"));
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);

  if (!kakaoPromise) {
    kakaoPromise = new Promise((resolve, reject) => {
      let el = document.querySelector(`script[src="${SRC}"]`);
      if (!el) {
        el = document.createElement("script");
        el.src = SRC;
        el.async = true;
        document.head.appendChild(el);
      }
      el.addEventListener("load", () => {
        // autoload=false → load() 가 본체를 받은 뒤 콜백한다. 키·도메인이 틀리면 전역이 생기지 않는다.
        if (window.kakao?.maps?.load) window.kakao.maps.load(() => resolve(window.kakao));
        else reject(new Error("카카오 SDK 를 받았지만 kakao.maps 가 없음(키·도메인 확인)"));
      });
      el.addEventListener("error", () => reject(new Error("카카오 SDK 를 받지 못함")));
    }).catch((e) => {
      kakaoPromise = null; // 실패는 캐시하지 않는다 — 다음 진입에서 다시 시도
      document.querySelector(`script[src="${SRC}"]`)?.remove();
      throw e;
    });
  }
  return kakaoPromise;
}
