// 약관 보기 — 지금은 화면 흐름 확인용 초안이다. 출시 전 법률 검토를 거쳐 본문을 바꾼다.
// (할래말래는 terms.html·privacy.html 을 따로 두었다. 앞볼래도 확정본이 나오면 같은 방식으로 옮긴다.)
import React from "react";
import styled from "styled-components";
import { AuthHeader, AuthScreen, AuthTitle } from "../../components/auth/AuthParts";

const DOCS = {
  terms: {
    title: "서비스 이용약관",
    body: [
      ["목적", "이 약관은 앞볼래(이하 서비스)가 제공하는 전방 도로 CCTV 확인 서비스의 이용 조건을 정합니다."],
      ["서비스 내용", "현재 위치와 진행 방향을 기준으로 국가교통정보센터(ITS)가 공개한 도로 CCTV 영상과 돌발상황 정보를 보여 줍니다."],
      ["이용자의 의무", "서비스는 동승자를 위한 것입니다. 운전 중인 사람은 이용할 수 없으며, 운전석 거치 사용을 금지합니다(도로교통법 제49조)."],
      ["정보의 정확성", "영상과 돌발상황 정보는 ITS 원자료를 그대로 보여 주며, 송출 중단·지연이 있을 수 있습니다."],
    ],
  },
  privacy: {
    title: "개인정보 처리방침",
    body: [
      ["수집 항목", "이메일 가입 시 이메일 주소. 소셜 로그인 시 해당 서비스가 제공하는 식별자."],
      ["이용 목적", "회원 식별과 로그인 유지, 문의 응대."],
      ["보관 기간", "회원 탈퇴 시 지체 없이 파기합니다."],
      ["위치 정보", "위치는 앞쪽 CCTV를 고르는 데에만 쓰며, 이동 기록을 저장하지 않고 회원 정보와 함께 서버로 보내지 않습니다."],
    ],
  },
  location: {
    title: "위치기반서비스 이용약관",
    body: [
      ["위치정보의 이용", "기기의 현재 위치·진행 방향·속도를 받아 전방 CCTV와 돌발상황을 고르는 데 사용합니다."],
      ["보유 기간", "위치정보는 화면에 결과를 보여 주는 즉시 버리며 별도로 보관하지 않습니다."],
      ["이용자의 권리", "기기 설정에서 언제든 위치 권한을 끌 수 있습니다. 이 경우 전방 CCTV를 고를 수 없습니다."],
    ],
  },
};

const Draft = styled.p`
  margin: 0 0 20px;
  padding: 10px 14px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.colors.surface};
  border-left: 4px solid ${({ theme }) => theme.colors.work};
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Article = styled.section`
  margin-bottom: 22px;
  h2 {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 800;
  }
  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.7;
    color: ${({ theme }) => theme.colors.textNormal};
  }
`;

export default function LegalPage({ doc }) {
  const d = DOCS[doc];
  return (
    <AuthScreen>
      <AuthHeader />
      <AuthTitle>{d.title}</AuthTitle>
      <Draft>초안이에요. 출시 전에 법률 검토를 거쳐 확정본으로 바꿔요.</Draft>
      {d.body.map(([h, p], i) => (
        <Article key={h}>
          <h2>
            제{i + 1}조 {h}
          </h2>
          <p>{p}</p>
        </Article>
      ))}
    </AuthScreen>
  );
}
