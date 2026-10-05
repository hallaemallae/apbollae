// 앱 정보·설정 — 할래말래 마이페이지(프로필 머리 + 섹션별 메뉴 목록) 구성을 따른다.
//   프로필 · 주행 · 이용 안내 · 약관·정책 · 계정 · 버전
// 로그아웃은 확인창, 회원 탈퇴는 할래말래 WithdrawPage 처럼 안내 확인 + 동의 체크 뒤에만 실행한다(이 화면 안에서 펼친다).
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiChevronLeft, FiChevronRight, FiChevronDown, FiUser } from "react-icons/fi";
import { useFlow } from "../context/FlowContext";
import { useThemeMode } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { authErrorMessage, PROVIDER_LABEL } from "../services/authService";
import CheckCircle from "../components/common/CheckCircle";
import { showToast } from "../utils/toast";

const APP_VERSION = "0.1.0";

// 실제로 쓰는 것만 — 웹앱(web/package.json)·RN 셸·서체
const OSS = [
  ["React · React DOM · React Router", "MIT"],
  ["styled-components", "MIT"],
  ["React Icons (Feather)", "MIT"],
  ["Turf.js", "MIT"],
  ["hls.js", "Apache-2.0"],
  ["Firebase JS SDK", "Apache-2.0"],
  ["React Native · react-native-webview", "MIT"],
  ["@react-native-community/geolocation", "MIT"],
  ["Pretendard", "OFL-1.1"],
  ["Barlow Semi Condensed", "OFL-1.1"],
];

// 데이터 출처 — 각 기관 이용조건에 따라 출처를 밝힌다
const SOURCES = [
  ["CCTV 영상 · 돌발상황", "국가교통정보센터(ITS)"],
  ["도로 정보(표준노드링크)", "국가교통정보센터(ITS)"],
  ["지도 · 장소 검색 · 길찾기", "카카오 · 카카오모빌리티"],
];

/* ── 레이아웃 ─────────────────────────────────── */

const Page = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding-bottom: calc(env(safe-area-inset-bottom) + 40px);
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

/* 프로필 머리 — 할래말래 ProfileHeader */
const Profile = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 16px 6px;
  padding: 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.card};
`;

const Avatar = styled.div`
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 22px;
  font-weight: 800;
`;

const Who = styled.div`
  flex: 1;
  min-width: 0;
  b {
    display: block;
    font-size: 17px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  span {
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Pill = styled.button`
  flex-shrink: 0;
  min-height: 40px;
  padding: 0 14px;
  border: 1.5px solid ${({ theme }) => theme.colors.primary};
  border-radius: 999px;
  background: transparent;
  color: ${({ theme }) => theme.colors.primary};
  font-size: 14px;
  font-weight: 700;
`;

/* 섹션 + 메뉴 목록 — 할래말래 Section / MenuList / MenuItemButton */
const Section = styled.section`
  margin: 22px 16px 0;
  h2 {
    margin: 0 0 8px 4px;
    font-size: 13px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const List = styled.div`
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.card};
  overflow: hidden;
  > * + * {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const Item = styled.button`
  width: 100%;
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px 0 16px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme, $danger }) => ($danger ? theme.colors.danger || "#E5483B" : theme.colors.textStrong)};
  > span:first-child {
    flex: 1;
    min-width: 0;
  }
  em {
    font-style: normal;
    font-size: 14px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
  }
  svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Note = styled.div`
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.textNormal};
  b {
    color: ${({ theme }) => theme.colors.textStrong};
  }
`;

const Pairs = styled.dl`
  margin: 0;
  padding: 6px 16px 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 12px;
  font-size: 14px;
  dt {
    color: ${({ theme }) => theme.colors.textNormal};
  }
  dd {
    margin: 0;
    text-align: right;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Withdraw = styled.div`
  padding: 14px 16px 16px;
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textNormal};
  ul {
    margin: 0 0 12px;
    padding-left: 18px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    font-weight: 600;
    cursor: pointer;
  }
  label input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
`;

const DangerBtn = styled.button`
  width: 100%;
  min-height: 48px;
  margin-top: 8px;
  border: none;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.danger || "#E5483B"};
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  &:disabled {
    opacity: 0.4;
  }
`;

const Foot = styled.p`
  margin: 28px 16px 0;
  text-align: center;
  font-size: 12.5px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ── 화면 ─────────────────────────────────────── */

/** 펼치고 접는 메뉴 한 줄 */
function Fold({ title, open, onToggle, children }) {
  return (
    <>
      <Item type="button" aria-expanded={open} onClick={onToggle}>
        <span>{title}</span>
        {open ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
      </Item>
      {open ? children : null}
    </>
  );
}

export default function InfoPage() {
  const navigate = useNavigate();
  const { resetDrive } = useFlow();
  const { mode, toggleMode } = useThemeMode();
  const auth = useAuth();
  const [open, setOpen] = useState(null); // 펼친 메뉴 하나: data | source | oss | withdraw
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = (key) => {
    setOpen((v) => (v === key ? null : key));
    if (key === "withdraw") setAgree(false);
  };

  const user = auth.user;
  const name = user ? user.displayName || user.email || "앞볼래 사용자" : "게스트";
  const sub = user ? `${PROVIDER_LABEL[user.provider] || "로그인"}${user.provider === "email" ? "" : " (목업)"} 계정` : "로그인 없이 쓰는 중이에요";

  const newDrive = () => {
    resetDrive();
    navigate("/confirm", { replace: true });
  };

  const logout = async () => {
    if (!window.confirm("로그아웃할까요?")) return;
    await auth.signOut();
    resetDrive();
    showToast("로그아웃했어요");
    navigate("/login", { replace: true });
  };

  const withdraw = async () => {
    if (!agree || busy) return;
    if (!window.confirm("정말 탈퇴할까요?\n계정 정보는 바로 삭제되고 되돌릴 수 없어요.")) return;
    setBusy(true);
    try {
      await auth.deleteAccount();
      resetDrive();
      showToast("탈퇴했어요. 그동안 고마웠어요.");
      navigate("/login", { replace: true });
    } catch (err) {
      showToast(authErrorMessage(err), 3500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <Bar>
        <button type="button" aria-label="뒤로" onClick={() => navigate(-1)}>
          <FiChevronLeft size={26} />
        </button>
        <h1>앱 정보</h1>
      </Bar>

      <Profile>
        <Avatar aria-hidden="true">{user ? name.trim().charAt(0).toUpperCase() : <FiUser />}</Avatar>
        <Who>
          <b>{name}</b>
          <span>{sub}</span>
        </Who>
        {!user ? (
          <Pill type="button" onClick={() => navigate("/login")}>
            로그인
          </Pill>
        ) : null}
      </Profile>

      <Section>
        <h2>주행</h2>
        <List>
          <Item type="button" onClick={newDrive}>
            <span>새 주행 시작</span>
            <em>동승자 다시 확인</em>
            <FiChevronRight size={20} />
          </Item>
          <Item type="button" onClick={toggleMode}>
            <span>화면 모드</span>
            <em>{mode === "dark" ? "어둡게" : "밝게"}</em>
            <FiChevronRight size={20} />
          </Item>
        </List>
      </Section>

      <Section>
        <h2>이용 안내</h2>
        <List>
          <Fold title="데이터 사용" open={open === "data"} onToggle={() => toggle("data")}>
            <Note>
              CCTV 영상은 모바일 데이터를 써요. 데이터를 아끼려고 <b>영상은 한 번에 하나만</b> 재생하고, 다른 CCTV는 눌렀을 때만 연결해요.
            </Note>
          </Fold>
          <Fold title="정보 출처" open={open === "source"} onToggle={() => toggle("source")}>
            <Pairs>
              {SOURCES.map(([what, who]) => (
                <React.Fragment key={what}>
                  <dt>{what}</dt>
                  <dd>{who}</dd>
                </React.Fragment>
              ))}
            </Pairs>
            <Note>앞볼래는 CCTV 영상을 녹화하거나 저장하지 않아요.</Note>
          </Fold>
        </List>
      </Section>

      <Section>
        <h2>약관·정책</h2>
        <List>
          <Item type="button" onClick={() => navigate("/terms")}>
            <span>서비스 이용약관</span>
            <FiChevronRight size={20} />
          </Item>
          <Item type="button" onClick={() => navigate("/privacy")}>
            <span>개인정보 처리방침</span>
            <FiChevronRight size={20} />
          </Item>
          <Item type="button" onClick={() => navigate("/location-terms")}>
            <span>위치기반서비스 이용약관</span>
            <FiChevronRight size={20} />
          </Item>
          <Fold title="오픈소스 라이선스" open={open === "oss"} onToggle={() => toggle("oss")}>
            <Pairs>
              {OSS.map(([lib, lic]) => (
                <React.Fragment key={lib}>
                  <dt>{lib}</dt>
                  <dd>{lic}</dd>
                </React.Fragment>
              ))}
            </Pairs>
          </Fold>
        </List>
      </Section>

      {user ? (
        <Section>
          <h2>계정</h2>
          <List>
            <Item type="button" onClick={logout}>
              <span>로그아웃</span>
              <FiChevronRight size={20} />
            </Item>
            <Fold title="회원 탈퇴" open={open === "withdraw"} onToggle={() => toggle("withdraw")}>
              <Withdraw>
                <ul>
                  <li>계정 정보(이메일·가입 정보)가 바로 삭제되고 되돌릴 수 없어요.</li>
                  <li>앞볼래는 이동 기록을 저장하지 않아서 따로 지울 주행 기록은 없어요.</li>
                  <li>같은 이메일로 언제든 다시 가입할 수 있어요.</li>
                </ul>
                <label>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <CheckCircle on={agree} size={24} />
                  위 내용을 확인했고 탈퇴에 동의해요
                </label>
                <DangerBtn type="button" disabled={!agree || busy} onClick={withdraw}>
                  {busy ? "탈퇴 처리 중" : "탈퇴하기"}
                </DangerBtn>
              </Withdraw>
            </Fold>
          </List>
        </Section>
      ) : null}

      <Foot>
        앞볼래 {APP_VERSION}
        <br />팀 졸업하자
      </Foot>
    </Page>
  );
}
