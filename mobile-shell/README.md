# 앞볼래 RN Shell

웹앱(`../web`)을 WebView로 띄우는 얇은 RN 셸입니다. 할래말래와 같은 구조입니다.
여기에는 JS Shell(`App.js`, `src/`)만 있고, 네이티브 폴더는 init으로 새로 만듭니다.
할래말래 규칙과 같이, 프로젝트를 통째로 복사하는 방식은 쓰지 않습니다.

## 1. 새 앱 init
```bash
cd "26 -2/apbollae"
npx @react-native-community/cli@15.0.0 init Apbollae --version 0.77.0 --package-name com.ilsaeng.apbollae
cd Apbollae
npm i react-native-webview @react-native-community/geolocation
```

## 2. JS Shell 이식
```bash
rm -rf src && cp -R ../mobile-shell/src ./src && cp ../mobile-shell/App.js ./App.js
```

## 3. Firebase 설정 파일
`mobile-shell/firebase/`에 콘솔에서 받은 파일이 있습니다. 패키지명과 번들 ID는 둘 다 `com.ilsaeng.apbollae`입니다.
- Android: `firebase/google-services.json` → `android/app/google-services.json`
- iOS: `firebase/GoogleService-Info.plist` → Xcode에서 `ios/Apbollae/`에 추가합니다. Copy Bundle Resources에 들어갔는지 확인하세요.

웹앱이 로그인과 DB를 직접 처리하기 때문에, 지금은 이 파일이 없어도 앱이 돌아갑니다.
나중에 네이티브 소셜 로그인이나 푸시를 붙일 때 필요합니다.

## 4. 네이티브 권한
- Android `android/app/src/main/AndroidManifest.xml`
  ```xml
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <application android:usesCleartextTraffic="true" ...>  <!-- 개발 중 http://PC:3000 접속용 -->
  ```
- iOS `Info.plist`: `NSLocationWhenInUseUsageDescription` = "현재 위치와 진행 방향으로 앞쪽 CCTV를 고르기 위해 사용해요."

## 5. 실행
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
