// src/utils/shareFrame.js — ⑦ CCTV 장면 공유. 지금 영상 한 장면에 CCTV 이름·시각·원인 요약·출처를 얹어 이미지로 만든다.
// 휴대폰은 공유 시트(navigator.share, 카톡 등)로, 안 되면 이미지 파일로 내려받는다.
// ITS 영상 서버는 CORS 를 허용해(hls.js 가 받은 조각은 같은 출처 취급) 캔버스로 옮겨 그릴 수 있다.
// 출처 표기는 이용조건상 이미지 안에도 넣는다.

const SOURCE = { its: "출처: 국가교통정보센터(ITS)", utic: "경찰청 도시교통정보센터(UTIC) 제공" };

/** container 안의 <video> 또는 <canvas>(목업 영상)를 찾아 장면을 PNG Blob 으로 */
export async function captureFrame(container, { cctv, summary }) {
  const media = container?.querySelector("video") || container?.querySelector("canvas");
  if (!media) throw new Error("no_media");
  const w0 = media.videoWidth || media.width || 640;
  const h0 = media.videoHeight || media.height || 480;
  const W = 960;
  const H = Math.round((W * h0) / w0);
  const PAD = 120; // 아래 글자 띠
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H + PAD;
  const g = c.getContext("2d");
  g.fillStyle = "#0b0e14";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(media, 0, 0, W, H); // 교차 출처라 막히면 toBlob 에서 오류가 난다

  const now = new Date();
  const time = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  g.fillStyle = "rgba(0,0,0,.55)";
  g.fillRect(0, 0, W, 56);
  g.fillStyle = "#fff";
  g.font = "700 28px 'Pretendard Variable', Pretendard, sans-serif";
  g.textBaseline = "middle";
  g.fillText(`${cctv?.name || "CCTV"} · ${time}`, 20, 28);

  g.fillStyle = "#fff";
  g.font = "800 34px 'Pretendard Variable', Pretendard, sans-serif";
  g.fillText(summary?.title || "지금 앞 상황", 20, H + 42);
  g.fillStyle = "#9aa3b2";
  g.font = "500 22px 'Pretendard Variable', Pretendard, sans-serif";
  const src = SOURCE[cctv?.source] || SOURCE.its;
  g.fillText(`${summary?.sub ? `${summary.sub} · ` : ""}${src} · 앞볼래`.slice(0, 70), 20, H + 88);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/png"));
}

/** 공유 시트 → 안 되면 내려받기. 반환: "shared" | "downloaded" | "cancelled" */
export async function shareImage(blob, text) {
  const file = new File([blob], `apbollae-${Date.now()}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
