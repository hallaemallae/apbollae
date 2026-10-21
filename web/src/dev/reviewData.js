// src/dev/reviewData.js — 리뷰 허브(/review)가 띄울 앞볼래 화면 목록.
// 할래말래 src/dev/reviewData.js·boardData.js 를 한 파일로 합쳤다.
// 각 화면: { id(기록 스레드 키 — 정하면 바꾸지 않는다), no(표시용), name, path, mock, spec:[★=핵심], variants }
//  · mock     → 프레임 URL 에 ?mock=<시나리오> 로 붙는다 (시나리오 정의는 src/dev/reviewMock.js)
//  · variants → 같은 화면을 시나리오만 바꿔 본다(경우의 수). { key, name, mock, path? }

export const DOMAINS = [
  {
    key: "entry",
    label: "진입·로그인",
    screens: [
      {
        id: "splash",
        no: "1-1",
        name: "스플래시",
        path: "/",
        spec: ["★RN 네이티브 스플래시와 같은 바탕색(#0A0A0B) — 넘어올 때 튀지 않는지", "로그인 복원이 끝나면 1.3초 뒤 /confirm 으로 이동(고정 모드에선 머문다)"],
      },
      {
        id: "login",
        no: "1-2",
        name: "로그인",
        path: "/login",
        spec: ["★로그인은 선택 — '로그인 없이 시작'이 눈에 띄는지", "카카오·구글·Apple 은 아직 목업(누르면 약관 동의로)"],
      },
      { id: "login-email", no: "1-3", name: "이메일 로그인", path: "/login/email", spec: ["Firebase Auth 실제 연동"] },
      { id: "login-reset", no: "1-4", name: "비밀번호 재설정", path: "/login/reset", spec: [] },
      { id: "signup-email", no: "1-5", name: "이메일 가입", path: "/signup/email", spec: ["가입 즉시 로그인 → 약관 동의 게이트로"] },
      {
        id: "agreement",
        no: "1-6",
        name: "약관 동의",
        path: "/confirm",
        mock: "consent",
        spec: ["★[필수] 위치기반서비스 이용약관이 할래말래보다 하나 더 있다", "전체 동의 · 필수/선택 · 보기 · 다른 계정으로 로그인"],
      },
      { id: "signup-complete", no: "1-7", name: "가입 완료", path: "/confirm", mock: "welcome", spec: ["처음 한 번만 — '시작하기' → 동승자 확인"] },
    ],
  },
  {
    key: "ready",
    label: "주행 준비",
    screens: [
      {
        id: "passenger",
        no: "2-1",
        name: "동승자 확인",
        path: "/confirm",
        mock: "guest",
        spec: ["★E1 — 체크 전에는 영상 화면으로 갈 수 없다", "매 주행마다 묻는다(저장하지 않음)"],
      },
      {
        id: "permission",
        no: "2-2",
        name: "위치 권한",
        path: "/permission",
        mock: "permission",
        spec: ["★E2 — 거부되면 이유 안내 + 설정 이동, 목록은 비운다"],
        variants: [{ key: "denied", name: "권한 거부(E2)", mock: "permission-denied" }],
      },
    ],
  },
  {
    key: "tabs",
    label: "탭(홈·앞길·기록·내 정보)",
    screens: [
      {
        id: "drive",
        no: "3-1",
        name: "홈 · 앞 CCTV",
        path: "/drive",
        mock: "drive",
        spec: [
          "★CCTV 영상 크게(4:3) + 투명 카드 — 조수석에서 한눈에 읽히는지(글자 크기·대비)",
          "★원인 한 줄 요약(정체·돌발) · 풀리는 곳 CCTV · 운전자에게 보여 주기 · 장면 공유",
          "지나치면 바로 다음 CCTV로 자동 전환, 마커를 누르면 그 영상 → '바로 앞 CCTV로' 로 복귀",
          "목적지 검색(집·회사·최근·자동완성·경로 비교) — 목적지 없이도 앞 구간 소통(임시 경로)",
          "목업 = 경부고속도로 하행 시뮬레이션 + 목업 CCTV (ITS 한도 안 씀)",
        ],
        variants: [
          { key: "notice", name: "데이터 안내(첫 진입)", mock: "drive-notice" },
          { key: "jam", name: "정체 구간", mock: "drive-jam" },
          { key: "accident", name: "돌발 · 사고 직전", mock: "drive-accident" },
          { key: "day", name: "낮(밝은 화면)", mock: "drive-day" },
          { key: "night", name: "밤(미드나잇 네이비)", mock: "drive-night" },
          { key: "broken", name: "영상 재생 실패(E5)", mock: "drive-broken" },
          { key: "tunnel", name: "신호 끊김·터널(E3)", mock: "drive-tunnel" },
          { key: "no-cctv", name: "전방 CCTV 없음(E4)", mock: "drive-no-cctv" },
          { key: "api-down", name: "ITS 장애(E6)", mock: "drive-api-down" },
        ],
      },
      {
        id: "ahead",
        no: "3-2",
        name: "앞길",
        path: "/ahead",
        mock: "drive",
        spec: [
          "★'왜 막히고 어디까지야?' — 원인 요약 · 이 정체로 늦어지는 시간 · 다른 길 앱으로 넘기기",
          "★앞 10km 소통 띠(CCTV·돌발 위치) — 누르면 홈 탭에서 그 영상",
          "돌발 상세(발생·해소 예정·통제 차로) · 날씨(Open-Meteo)",
          "계산은 홈 탭이 하고 넘겨받는다 — 처음엔 '위치를 잡는 중' 이 잠깐 보일 수 있다",
        ],
        variants: [
          { key: "jam", name: "정체 구간", mock: "drive-jam" },
          { key: "accident", name: "돌발 · 사고 직전", mock: "drive-accident" },
          { key: "no-cctv", name: "앞 CCTV 없음", mock: "drive-no-cctv" },
          { key: "night", name: "밤", mock: "drive-night" },
        ],
      },
      {
        id: "log",
        no: "3-3",
        name: "기록",
        path: "/log",
        mock: "log-sample",
        spec: [
          "★'아까 왜 막혔지?' — 지나온 정체·돌발과 원인이 날짜별로 자동 기록(이 기기에만, 최근 200건)",
          "테스트 주행 정확도 기록(차터 KPI 90%) · CSV 내보내기",
          "목업 = 오늘·어제 견본 4건(기기 기록은 건드리지 않음)",
        ],
        variants: [{ key: "empty", name: "기록 없음", mock: "log-empty" }],
      },
    ],
  },
  {
    key: "info",
    label: "내 정보·약관",
    screens: [
      {
        id: "info",
        no: "4-1",
        name: "내 정보(앱 정보·설정)",
        path: "/info",
        mock: "guest",
        spec: ["★탭 4번째 — 주행 전(동승자 확인 전)에도 열린다", "동승자 재확인 · 화면 모드(자동=해 지면 어둡게/밝게/어둡게) · 데이터 안내", "출처 고지에 날씨(Open-Meteo, CC BY 4.0) 추가 · 오픈소스 라이선스"],
        variants: [
          { key: "user", name: "로그인한 사용자", mock: "user" },
          { key: "tabs", name: "주행 중(탭 4개)", mock: "drive" },
        ],
      },
      { id: "terms", no: "4-2", name: "이용약관", path: "/terms", spec: ["초안 — 출시 전 법률 검토"] },
      { id: "privacy", no: "4-3", name: "개인정보 처리방침", path: "/privacy", spec: ["초안 — 출시 전 법률 검토"] },
      { id: "location-terms", no: "4-4", name: "위치기반서비스 약관", path: "/location-terms", spec: ["초안 — 출시 전 법률 검토"] },
      { id: "licenses", no: "4-5", name: "오픈소스 라이선스", path: "/licenses", spec: ["★public/oss-licenses.json 자동 생성(npm run build-oss-licenses) — 항목을 누르면 전문"] },
    ],
  },
];
