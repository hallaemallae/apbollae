# 앞볼래 RN Shell

웹앱(`../web`)을 WebView로 띄우는 얇은 RN 셸입니다. 할래말래와 같은 구조입니다.
여기에는 JS Shell(`App.js`, `src/`)만 있고, 네이티브 폴더는 init으로 새로 만듭니다.
할래말래 규칙과 같이, 프로젝트를 통째로 복사하는 방식은 쓰지 않습니다.

## 1. 새 앱 init
```bash
cd "26 -2/apbollae"
npx @react-native-community/cli@15.0.0 init Apbollae --version 0.77.0 --package-name com.hongcomms.apbollae
cd Apbollae
npm i react-native-webview @react-native-community/geolocation
```

## 2. JS Shell 이식
```bash
rm -rf src && cp -R ../mobile-shell/src ./src && cp ../mobile-shell/App.js ./App.js
```

## 3. 네이티브 권한
- Android `android/app/src/main/AndroidManifest.xml`
  ```xml
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <application android:usesCleartextTraffic="true" ...>  <!-- 개발 중 http://PC:3000 접속용 -->
  ```
- iOS `Info.plist`: `NSLocationWhenInUseUsageDescription` = "현재 위치와 진행 방향으로 앞쪽 CCTV를 고르기 위해 사용해요."

## 4. 실행
```bash
# 터미널 1 — 웹
cd ../web && npm run dev          # http://localhost:3000
# 터미널 2 — 앱
npx react-native run-android      # 에뮬레이터는 AppConfig.webUrl = http://10.0.2.2:3000
```
실기기에서는 `src/config/AppConfig.js`의 `webUrl`을 PC 내부 IP(예: `http://192.168.1.11:3000`)로 바꿔 주세요.

## 브릿지 메시지 (Web ↔ RN)
| 방향 | type | payload |
|---|---|---|
| Web→RN | `WEB_READY` | 스플래시 해제 |
| Web→RN | `NAV_STATE` | `{ isRoot, path }` |
| Web→RN | `REQUEST_LOCATION_PERMISSION` / `CHECK_LOCATION_PERMISSION` | - |
| RN→Web | `PERMISSION_RESULT` / `PERMISSION_STATUS` | `{ granted }` |
| Web→RN | `OPEN_SETTINGS` | - |
| Web→RN | `START_LOCATION` / `STOP_LOCATION` | `{ intervalMs }` |
| RN→Web | `LOCATION_UPDATE` | `{ latitude, longitude, heading, speed(m/s), accuracy, timestamp }` |
| RN→Web | `BACK_REQUEST` / `APP_EXIT_REQUEST` | 안드로이드 뒤로가기 |
| Web→RN | `EXIT_APP` | - |

웹앱 흐름 점검 패널에서 "실제 GPS"를 고르면 `START_LOCATION`으로 RN GPS를 받습니다.
