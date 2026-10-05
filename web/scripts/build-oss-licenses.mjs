// scripts/build-oss-licenses.mjs
// 앱에 실려 나가는 오픈소스의 라이선스 고지 → public/oss-licenses.json (/licenses 화면이 읽는다)
// 할래말래 scripts/build-oss-licenses.mjs 를 앞볼래 크기로 줄였다.
//
// 대상은 "사용자에게 배포되는 것"만이다:
//   web    web/package.json dependencies 의 런타임 트리 (vite 등 devDependencies 는 배포물이 아니라 제외)
//   rn     mobile-shell 의 런타임 트리 — RN 프로젝트를 init 해서 mobile-shell/package.json·node_modules 가 생기면 자동으로 들어간다
//   font   웹에서 불러 쓰는 폰트(Pretendard·Barlow Semi Condensed)
//
// 자동화: prebuild 에 물려 있어 `npm run build` 때마다 다시 만든다. 개발 서버용으로는 `npm run build-oss-licenses`.
// 실패해도 빌드를 막지 않는다 — 경고만 찍고 직전 결과를 유지한다.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outFile = resolve(root, "public", "oss-licenses.json");
const OFL_TEXT = readFileSync(resolve(__dirname, "oss-licenses", "OFL-1.1.txt"), "utf8").trim();
const SHELL_DIR = resolve(root, "..", "mobile-shell");

const FONTS = [
  {
    name: "Pretendard",
    version: "1.3.9",
    license: "OFL-1.1",
    homepage: "https://github.com/orioncactus/pretendard",
    copyright: "Copyright (c) 2021, Kil Hyung-jin (https://github.com/orioncactus/pretendard), with Reserved Font Name 'Pretendard'.",
  },
  {
    name: "Barlow Semi Condensed",
    version: "",
    license: "OFL-1.1",
    homepage: "https://github.com/jpt/barlow",
    copyright: "Copyright 2017 The Barlow Project Authors (https://github.com/jpt/barlow)",
  },
];

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const warn = (msg) => console.warn(`⚠ oss-licenses: ${msg}`);

// LICENSE 파일이 없을 때 SPDX 표준 문구로 채운다
const TEMPLATES = {
  MIT: `MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
  ISC: `ISC License\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`,
};

const fallback = (license, who) => {
  const spdx = license.replace(/[()]/g, "").split(" OR ")[0].trim();
  return {
    copyright: `Copyright (c) ${who}`,
    text: TEMPLATES[spdx] ?? `Licensed under ${license}. See https://spdx.org/licenses/${spdx}.html`,
  };
};

// 본문 표를 공유하는 저장 형식 { packages: [{..., t}], texts } — 같은 MIT 전문이 패키지마다 복제되지 않게
const pack = (entries) => {
  const texts = [];
  const index = new Map();
  const packages = entries.map(({ text, ...rest }) => {
    if (!index.has(text)) {
      index.set(text, texts.length);
      texts.push(text);
    }
    return { ...rest, t: index.get(text) };
  });
  return { packages, texts };
};
const unpack = ({ packages, texts }) => packages.map(({ t, ...p }) => ({ ...p, text: texts[t] }));

const licenseOf = (pkg) => {
  let l = pkg.license ?? pkg.licenses;
  if (Array.isArray(l)) l = l.map((x) => x.type ?? x).join(" OR ");
  if (l && typeof l === "object") l = l.type;
  return l || "UNKNOWN";
};

const homepageOf = (pkg) => {
  const r = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const url = pkg.homepage || r || "";
  return url.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
};

const authorOf = (pkg) => (typeof pkg.author === "string" ? pkg.author : pkg.author?.name) || `${pkg.name} contributors`;

// LICENSE·NOTICE 파일 본문. Apache-2.0 은 NOTICE 가 있으면 그것도 함께 고지해야 한다.
const licenseTextOf = (dir) => {
  const files = readdirSync(dir).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f));
  files.sort((a, b) => /^notice/i.test(a) - /^notice/i.test(b));
  return files
    .map((f) => {
      try {
        return readFileSync(join(dir, f), "utf8").trim();
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
};

// Node 모듈 해석 규칙: fromDir 부터 위로 올라가며 node_modules/name 을 찾는다
const resolvePkg = (name, fromDir, stopDir) => {
  let dir = fromDir;
  for (;;) {
    const cand = join(dir, "node_modules", name);
    if (existsSync(join(cand, "package.json"))) return cand;
    if (dir === stopDir) return null;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
};

const walkNpm = (names, projectDir, src) => {
  const out = [];
  const queue = names.map((n) => [n, projectDir]);
  const seen = new Set();
  while (queue.length) {
    const [name, from] = queue.shift();
    const dir = resolvePkg(name, from, projectDir);
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    const pkg = readJson(join(dir, "package.json"));
    // 하위 폴더의 package.json({"type":"module"} 등)만 있는 경우 — 이름이 없으면 고지 대상이 아니다
    if (!pkg.name) continue;
    const license = licenseOf(pkg);
    const text = licenseTextOf(dir);
    out.push({
      src,
      name: pkg.name,
      version: pkg.version || "",
      license,
      homepage: homepageOf(pkg),
      ...(text ? { text } : fallback(license, authorOf(pkg))),
    });
    // 설치 안 된 optional·peer 는 resolvePkg 가 null 을 돌려 자연히 걸러진다
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies };
    for (const d of Object.keys(deps)) queue.push([d, dir]);
  }
  return out;
};

const main = () => {
  const webDeps = Object.keys(readJson(resolve(root, "package.json")).dependencies || {});
  const all = walkNpm(webDeps, root, "web");

  const shellManifest = join(SHELL_DIR, "package.json");
  if (existsSync(shellManifest) && existsSync(join(SHELL_DIR, "node_modules"))) {
    all.push(...walkNpm(Object.keys(readJson(shellManifest).dependencies || {}), SHELL_DIR, "rn"));
  } else {
    warn("mobile-shell 에 package.json·node_modules 가 아직 없다 — RN 셸 항목은 RN init 뒤에 들어간다");
  }

  for (const f of FONTS) all.push({ src: "font", name: f.name, version: f.version, license: f.license, homepage: f.homepage, copyright: f.copyright, text: OFL_TEXT });

  // 같은 패키지·버전이 여러 출처에서 나오면 하나만
  const byKey = new Map();
  for (const p of all) if (!byKey.has(`${p.name}@${p.version}`)) byKey.set(`${p.name}@${p.version}`, p);
  const { packages, texts } = pack([...byKey.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)));

  writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), packages, texts }));
  const count = (s) => packages.filter((p) => p.src === s).length;
  console.log(`✓ oss-licenses: ${packages.length}개 (web ${count("web")} · rn ${count("rn")} · font ${count("font")})`);
};

try {
  main();
} catch (e) {
  warn(`생성 실패 — 직전 public/oss-licenses.json 을 유지한다 (${e.message})`);
  if (existsSync(outFile)) unpack(readJson(outFile)); // 직전 결과가 깨지지 않았는지만 확인
}
