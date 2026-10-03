import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// RN 셸(mobile-shell)의 __DEV__ webUrl 이 http://<PC IP>:3000 을 바라본다 — 할래말래와 같은 포트.
export default defineConfig({
  plugins: [react()],
  server: { port: 3000, host: true },
});
