// 약관 동의 게이트 — 할래말래 AgreementGate 구성(전체 동의 + 필수/선택 + 보기 + 다른 계정으로 로그인).
// 앞볼래는 위치를 쓰므로 [필수] 위치기반서비스 이용약관이 추가된다.
// 라우트로 가는 화면이 아니라, 로그인했지만 동의 전인 사용자에게 RequireEntry 가 그 자리에 그린다.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiChevronRight } from "react-icons/fi";
import Button from "../../components/common/Button";
import CheckCircle from "../../components/common/CheckCircle";
import { AuthScreen, BrandLogo, TextLink } from "../../components/auth/AuthParts";
import { useAuth } from "../../context/AuthContext";
import { useScenario } from "../../context/ScenarioContext";
import { showToast } from "../../utils/toast";

const ITEMS = [
  { key: "age14", label: "만 14세 이상이에요", required: true },
  { key: "terms", label: "서비스 이용약관", required: true, doc: "/terms" },
  { key: "privacy", label: "개인정보 처리방침", required: true, doc: "/privacy" },
  { key: "location", label: "위치기반서비스 이용약관", required: true, doc: "/location-terms" },
  { key: "marketing", label: "새 기능·이벤트 소식 받기", required: false },
];

const Head = styled.div`
  padding: calc(env(safe-area-inset-top) + 40px) 0 28px;
  h1 {
    margin: 22px 0 8px;
    font-size: 25px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  p {
    margin: 0;
    font-size: 15.5px;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const All = styled.button`
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 16px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border: 1.5px solid ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: transparent;
  font-size: 17px;
  font-weight: 700;
  text-align: left;
  transition: background 0.15s ease;
`;

const List = styled.ul`
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
`;

const Row = styled.li`
  display: flex;
  align-items: center;
`;

const RowCheck = styled.button`
  flex: 1;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 16px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 15.5px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textNormal};
  em {
    font-style: normal;
    font-weight: 700;
    margin-right: 4px;
    color: ${({ theme, $req }) => ($req ? theme.colors.primary : theme.colors.textWeak)};
  }
`;

const View = styled.button`
  width: 48px;
  height: 48px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textWeak};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default function AgreementGate() {
  const navigate = useNavigate();
  const { saveConsent, signOut, user } = useAuth();
  const { reportFlow } = useScenario();
  const [checked, setChecked] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    reportFlow("L2");
  }, [reportFlow]);

  const allOn = ITEMS.every((i) => checked[i.key]);
  const requiredOn = ITEMS.filter((i) => i.required).every((i) => checked[i.key]);

  const toggle = (k) => setChecked((c) => ({ ...c, [k]: !c[k] }));
  const toggleAll = () => setChecked(allOn ? {} : Object.fromEntries(ITEMS.map((i) => [i.key, true])));

  const agree = async () => {
    setSaving(true);
    try {
      await saveConsent(Object.fromEntries(ITEMS.map((i) => [i.key, !!checked[i.key]])));
    } catch (err) {
      console.warn("[consent] 저장 실패:", err);
      showToast("동의 내용을 저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.", 3500);
      setSaving(false);
    }
  };

  return (
    <AuthScreen>
      <Head>
        <BrandLogo size={64} />
        <h1>약관에 동의해 주세요</h1>
        <p>{user?.displayName ? `${user.displayName}님, ` : ""}앞볼래를 쓰려면 아래 약관 동의가 필요해요.</p>
      </Head>

      <All type="button" role="checkbox" aria-checked={allOn} $on={allOn} onClick={toggleAll}>
        <CheckCircle on={allOn} />
        전체 동의 (선택 항목 포함)
      </All>

      <List>
        {ITEMS.map((i) => (
          <Row key={i.key}>
            <RowCheck type="button" role="checkbox" aria-checked={!!checked[i.key]} $req={i.required} onClick={() => toggle(i.key)}>
              <CheckCircle on={!!checked[i.key]} size={22} />
              <span>
                <em>{i.required ? "[필수]" : "[선택]"}</em>
                {i.label}
              </span>
            </RowCheck>
            {i.doc ? (
              <View type="button" aria-label={`${i.label} 보기`} onClick={() => navigate(i.doc)}>
                <FiChevronRight size={22} />
              </View>
            ) : null}
          </Row>
        ))}
      </List>

      <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", flexDirection: "column", gap: 6 }}>
        <Button fullWidth disabled={!requiredOn || saving} onClick={agree}>
          {saving ? "저장하는 중" : "동의하고 시작하기"}
        </Button>
        <TextLink type="button" onClick={signOut}>
          다른 계정으로 로그인
        </TextLink>
      </div>
    </AuthScreen>
  );
}
