// src/mock/events.js
// ITS 돌발상황정보 API(eventInfo) 응답을 흉내 낸 목업.
// 실제 필드: eventType(교통사고/공사/…), eventDetailType, roadName, roadDrcType(방향),
//            lanesBlockType, lanesBlocked, message, coordX(경도), coordY(위도), startDate, endDate
// type 은 앱 내부 분류: accident(사고) / work(공사) / control(통제)

export const MOCK_EVENTS = [
  {
    id: "ev-1",
    type: "accident",
    lat: 37.4005,
    lng: 127.0952,
    roadName: "경부고속도로",
    direction: "down",
    lanes: "2차로 통제",
    message: "승용차 2대 추돌, 견인 중",
    startedAt: "14:12",
  },
  {
    id: "ev-2",
    type: "work",
    lat: 37.2395,
    lng: 127.1093,
    roadName: "경부고속도로",
    direction: "down",
    lanes: "1차로 통제",
    message: "포장 보수 공사",
    startedAt: "09:00",
  },
  {
    id: "ev-3",
    type: "control",
    lat: 37.4885,
    lng: 127.0305,
    roadName: "경부고속도로",
    direction: "down",
    lanes: "갓길 통제",
    message: "낙하물 수거",
    startedAt: "14:40",
  },
  {
    // 반대 방향 사고 — 하행 주행 중에는 배지가 붙으면 안 된다
    id: "ev-4",
    type: "accident",
    lat: 37.4448,
    lng: 127.0571,
    roadName: "경부고속도로",
    direction: "up",
    lanes: "3차로 통제",
    message: "서울 방향 차량 고장",
    startedAt: "14:30",
  },
];

export const EVENT_LABEL = { accident: "사고", work: "공사", control: "통제" };
