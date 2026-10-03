# 앞볼래 (Apbollae)

조수석 동승자용 전방 도로 CCTV 앱입니다. 팀은 졸업하자입니다.
지금 단계는 **프론트엔드만** 있습니다. DB·서버 없이 목업 데이터로 기능흐름도(1~9단계, E1~E6)를 점검합니다.

```
apbollae/
├─ web/            React 웹앱 (Vite + styled-components). 할래말래 웹앱 구조를 그대로 씀
└─ mobile-shell/   RN WebView 셸 JS (할래말래 RN Shell에서 축소). README에 init 절차 있음
```

## 실행
```bash
cd web
npm install
npm run dev       # 터미널 1 — 웹앱 http://localhost:3000 (같은 와이파이 폰은 http://<PC IP>:3000)
npm run proxy     # 터미널 2 — 실제 ITS 데이터를 쓸 때만. server/.env 의 ITS_API_KEY 필요
```
오른쪽 가장자리의 **흐름** 탭을 열면 다음을 할 수 있습니다.
- 현재 기능흐름도 단계(로그인 L1~L3, 주행 1~9)와 예외(E1~E6) 확인
- **교통 데이터** 선택: `목업` 또는 `실제 ITS`(로컬 프록시 경유, 월 호출 한도에서 빠짐)
- 주행 속도와 순간이동 조작
- 터널, 송출 중단, ITS 장애, 권한 거부 상황 일으키기

`?dev=0`을 붙이면 이 패널이 숨겨집니다.

## 서버 구성
- **로그인과 DB**는 Firebase를 씁니다(프로젝트 `apbollae`).
  - Auth는 이메일만 실제 연동되어 있습니다.
  - Firestore에는 `users/{uid}`가 있고, 규칙은 `firestore.rules`에 있습니다.
- **ITS 프록시**의 공통 로직은 `server/functions/itsCore.js`에 있습니다(캐시, 월 한도 보호, 응답 정리).
  - 개발할 때는 `server/dev-proxy.cjs`를 내 PC에서 돌립니다. **ITS가 Google Cloud IP를 막아서** Cloud Functions(`server/functions/index.js`)에서는 ITS를 부를 수 없습니다(2026-10-03 확인).
  - 운영 서버는 국내 IP 환경에서 `itsCore.js`를 감싸서 띄워야 합니다. 아직 정하지 않았습니다.
  - 로컬 사용량은 `server/.its-usage.json`에 셉니다. ITS 마이페이지 사용량도 함께 확인하세요.
- **목적지·경로(선택 기능)**는 카카오 로컬 장소 검색과 카카오모빌리티 자동차 길찾기를 씁니다(`server/functions/kakaoCore.js`).
  - 키는 `server/.env`의 `KAKAO_REST_KEY`이고, 로컬 프록시를 거칩니다.
  - 비상업 용도는 하루 10,000건까지 무료입니다.
  - 목적지를 넣으면 경로 위 CCTV만 경로 거리순으로 고르고, 앞쪽 정체 구간을 보여 줍니다. 목적지가 없으면 부채꼴(±30°) 방식으로 고릅니다.
- **카카오 지도**는 `web/.env.local`의 `VITE_KAKAO_JS_KEY`를 씁니다. 키가 없으면 간이 지도로 대신 그립니다.
- **ITS 인증키**는 다음 두 곳에만 있습니다.
  - `server/.env`: 커밋하지 않습니다.
  - Firebase 시크릿 `ITS_API_KEY`

## 할래말래에서 가져온 것
| 할래말래 | 앞볼래 |
|---|---|
| `bridge/webviewBridge.js` | 그대로 |
| `context/WebviewBridgeContext.jsx` | 메시지 규약은 같고, 코드는 축소 |
| `context/ThemeContext.jsx`, `theme/theme.js`·`GlobalStyle.js` | 구조는 같고, 색과 서체를 교체(기본 다크) |
| `components/common/OfflineBanner`, `Button`, `EmptyState` | 이식 |
| AppRoutes의 NAV_STATE / BACK_REQUEST / 뒤로가기 두 번 종료 | `components/common/BridgeNavSync.jsx` |
| RN Shell `App.js`, `bridge.js`, `useBootGuard`, `permissionHandler`, `locationTracker`, `linkingPolicy` | `mobile-shell/` (로그인·푸시·헬스·결제 제거, 위치는 1초·heading·speed로 강화) |

## 실제 연결 때 바꿀 곳
- `web/src/components/drive/MiniMap.jsx`: SVG를 MapLibre와 브이월드/OSM 타일로 바꿉니다.
- `web/src/pages/DrivePage.jsx`의 `road`: 실제 GPS일 때 표준노드링크로 현재 도로와 방향을 매칭합니다.
