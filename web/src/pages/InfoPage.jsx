// 앱 정보·설정 — 동승자 재확인, 테마, 데이터 안내, 출처·오픈소스 라이선스 고지
import React from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiChevronLeft } from "react-icons/fi";
import { useFlow } from "../context/FlowContext";
import { useThemeMode } from "../context/ThemeContext";

const Page = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding-bottom: calc(env(safe-area-inset-bottom) + 90px);
`;

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 5;
  height: calc(env(safe-area-inset-top) + 52px);
  padding-top: env(safe-area-inset-top);
  display: flex;
  align-items: center;
  gap: 2px;
  background: ${({ theme }) => theme.colors.bg};
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
  }
  button {
    width: 48px;
    height: 48px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const Section = styled.section`
  margin: 18px 16px 0;
  h2 {
    margin: 0 0 8px 4px;
    font-size: 13px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Group = styled.div`
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surface};
  overflow: hidden;
`;

const Row = styled.button`
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  text-align: left;
  font-size: 16px;
  font-weight: 600;
  &:first-child { border-top: none; }
  span {
    font-size: 14px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Text = styled.div`
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.textNormal};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  &:first-child { border-top: none; }
  b { color: ${({ theme }) => theme.colors.textStrong}; }
`;

const OSS = [
  ["React Native", "MIT"],
  ["Expo / expo-location", "MIT"],
  ["Turf.js", "MIT"],
  ["react-native-video", "MIT"],
  ["MapLibre", "BSD-2-Clause"],
  ["OpenStreetMap 지도 데이터", "ODbL"],
  ["React / React Router", "MIT"],
  ["styled-components", "MIT"],
  ["React Icons (Feather)", "MIT"],
  ["Pretendard", "OFL-1.1"],
  ["Barlow Semi Condensed", "OFL-1.1"],
];

export default function InfoPage() {
  const navigate = useNavigate();
  const { resetDrive } = useFlow();
  const { mode, toggleMode } = useThemeMode();

  return (
    <Page>
      <Bar>
        <button type="button" aria-label="뒤로" onClick={() => navigate(-1)}>
          <FiChevronLeft size={26} />
        </button>
        <h1>앱 정보</h1>
      </Bar>

      <Section>
        <h2>주행</h2>
        <Group>
          <Row
            type="button"
            onClick={() => {
              resetDrive();
              navigate("/confirm", { replace: true });
            }}
          >
            새 주행 시작(동승자 다시 확인)
          </Row>
          <Row type="button" onClick={toggleMode}>
            화면 밝기
            <span>{mode === "dark" ? "어둡게" : "밝게"}</span>
          </Row>
        </Group>
      </Section>

      <Section>
        <h2>데이터 사용</h2>
        <Group>
          <Text>
            CCTV 영상은 모바일 데이터를 써요. 데이터를 아끼려고 <b>영상은 한 번에 하나만</b> 재생하고, 나머지 카드는 눌렀을 때만 연결해요.
          </Text>
        </Group>
      </Section>

      <Section>
        <h2>정보 출처</h2>
        <Group>
          <Text>
            CCTV 영상과 돌발상황(사고·공사·통제) 정보는 <b>국가교통정보센터(ITS)</b>가 공공누리 제1유형으로 제공해요. 앞볼래는 영상을 녹화하거나
            저장하지 않아요.
          </Text>
        </Group>
      </Section>

      <Section>
        <h2>오픈소스 라이선스</h2>
        <Group>
          {OSS.map(([name, lic]) => (
            <Row as="div" key={name}>
              {name}
              <span>{lic}</span>
            </Row>
          ))}
        </Group>
      </Section>

      <Section>
        <h2>버전</h2>
        <Group>
          <Row as="div">
            앞볼래 <span>0.1.0 (프론트엔드 목업)</span>
          </Row>
        </Group>
      </Section>
    </Page>
  );
}
