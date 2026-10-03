import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// RN 셸(mobile-shell)의 __DEV__ webUrl 이 http://<PC IP>:3000 을 바라본다 — 할래말래와 같은 포트.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    // 실제 ITS 데이터: /api 를 내 PC 의 로컬 프록시(npm run proxy, 8787)로 넘긴다.
    // 폰(RN WebView)에서도 http://<PC IP>:3000/api 로 같은 길을 탄다.
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: true } },
  },
});
