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
npm run dev     # http://localhost:3000  (같은 와이파이 폰에서는 http://<PC IP>:3000)
```
오른쪽 가장자리의 **흐름** 탭을 열면 다음을 할 수 있습니다.
- 현재 기능흐름도 단계와 예외(E1~E6) 확인
- 주행 속도와 순간이동 조작
- 터널, 송출 중단, ITS 장애, 권한 거부 상황 일으키기

`?dev=0`을 붙이면 이 패널이 숨겨집니다.

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
- `web/src/services/itsApi.js`: 목업을 Firebase Functions 프록시 호출로 바꿉니다.
- `web/src/components/drive/CctvPlayer.jsx`: `MockFeed`를 HLS 재생으로 바꿉니다.
  - 웹: hls.js
  - RN 네이티브 전환 시: react-native-video
- `web/src/components/drive/MiniMap.jsx`: SVG를 MapLibre와 브이월드/OSM 타일로 바꿉니다.
- `web/src/pages/DrivePage.jsx`의 `road`: 실제 GPS일 때 표준노드링크로 현재 도로와 방향을 매칭합니다.
