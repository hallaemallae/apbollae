// src/utils/sun.js — 일출·일몰 시각(외부 API 없이 계산). 화면 모드 "자동"이 해가 지면 어두운 화면으로 바꾸는 데 쓴다.
// 일출 방정식(NOAA 간이식), 오차 몇 분 안. 대기 굴절·해 반지름을 반영해 고도 -0.833° 를 기준으로 한다.

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440587.5;
const J2000 = 2451545;

// 국내는 서울 기준으로 충분하다(제주·독도 차이 ±15분 안팎)
export const SEOUL = { lat: 37.5665, lng: 126.978 };

const toJulian = (date) => date.getTime() / DAY_MS + J1970;
const fromJulian = (j) => new Date((j - J1970) * DAY_MS);

/** 그날의 { sunrise, sunset }. 백야·극야면 null */
export function sunTimes(date = new Date(), { lat, lng } = SEOUL) {
  const n = Math.ceil(toJulian(date) - J2000 + 0.0008);
  const jStar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = J2000 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec);
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW) / RAD;
  return { sunrise: fromJulian(jTransit - w / 360), sunset: fromJulian(jTransit + w / 360) };
}

/** 지금 해가 져 있는가 */
export function isNight(now = new Date(), pos = SEOUL) {
  const t = sunTimes(now, pos);
  if (!t) return false;
  return now < t.sunrise || now > t.sunset;
}
