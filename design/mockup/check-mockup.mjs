/* 정적 슬롭·규범 검사 — 위반 0건이어야 통과.
 * 근거: docs/design/doctrine.md 슬롭 체크리스트 23항 · CLAUDE.md §3 자동 리젝트 4항 · §4 금지 패턴
 * 실행: node design/mockup/check-mockup.mjs   (종료코드 0=통과) */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => [".html", ".css", ".js", ".mjs"].includes(extname(f)) && f !== "check-mockup.mjs");

/* 주석을 제거하고 검사한다 — 규칙을 설명하는 주석이 위반으로 잡히면 검사가 무의미해진다 */
function strip(src, ext) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, " ");
  if (ext === ".js" || ext === ".mjs") s = s.replace(/^\s*\/\/.*$/gm, " ");
  if (ext === ".html") s = s.replace(/<!--[\s\S]*?-->/g, " ");
  return s;
}

const RULES = [
  ["외부 네트워크 요청(CDN·웹폰트·API)", /\b(https?:)?\/\/(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}/i, "CLAUDE.md §8 런타임 외부 요청 0"],
  ["@import / link href 외부", /@import\s+url\(\s*['"]?https?:/i, "CLAUDE.md §6 웹폰트·CDN 금지"],
  ["'+N' · '외 N곳' 접기", /\+\s*\d+\s*(more|개|곳|건)|외\s*\d+\s*곳/, "spec:54 · 독트린 슬롭 3"],
  ["Math.random 데이터", /Math\.random/, "CLAUDE.md §3 자동 리젝트"],
  ["setInterval / 초 단위 타이머", /setInterval\s*\(/, "spec §7 위젯 초 단위 갱신 금지 · 독트린 슬롭 11"],
  ["hover에 transform/scale/translateY", /:hover[^{}]*\{[^{}]*(transform|scale\s*:|translate\s*:)/i, "독트린 슬롭 10"],
  ["pressed scale", /:active[^{}]*\{[^{}]*(transform|scale\s*:)/i, "독트린 슬롭 10"],
  ["outline: none", /outline\s*:\s*none/i, "독트린 슬롭 20 · spec 포커스 링"],
            ["LIVE · SYSTEM ONLINE · 초 단위 시계", /\bLIVE\b|SYSTEM ONLINE|toLocaleTimeString|getSeconds\s*\(/, "CLAUDE.md §3 자동 리젝트"],
  ["이모지 아이콘", /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, "독트린 슬롭 19", "ui"],
  ["breathe/pulse/stagger 키프레임", /@keyframes\s+(breathe|pulse|stagger|float|shimmer)/i, "motion_ms.forbidden"],
    ["backdrop-filter / 글래스", /backdrop-filter/i, "독트린 슬롭 9"],
  ["mobile-first · 햄버거 · max-width 중앙", /hamburger|☰/, "spec:56-57"],
];

/* CSS 선언(prop: value)을 값 단위로 본다 — 정규식 백트래킹으로 'letter-spacing: 0'이
 * 위반으로 잡히던 문제를 없애고, 허용 예외를 선택자 블록 단위로 판단한다. */
function cssDecls(src) {
  const out = [];
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = blockRe.exec(src))) {
    const sel = m[1].trim().replace(/\s+/g, " ");
    const startLine = src.slice(0, m.index).split("\n").length;
    m[2].split(";").forEach((d) => {
      const k = d.indexOf(":");
      if (k < 0) return;
      out.push({ sel, prop: d.slice(0, k).trim().toLowerCase(), val: d.slice(k + 1).trim(), line: startLine });
    });
  }
  return out;
}
function checkCss(file, src) {
  let n = 0;
  const say = (line, rule, why, detail) => { console.log(`  ✗ ${file}:${line}  [${rule}]  ${why}`); console.log(`      ${detail}`); n++; };
  for (const d of cssDecls(src)) {
    const latinOnly = /\.kbd|\.t-micro|\.w-date|#rig/.test(d.sel);
    if (d.prop === "letter-spacing") {
      const ok = /^(0|inherit|normal)$/.test(d.val) || (latinOnly && /^[+-]?\.?0?\.0[0-9]*em$/.test(d.val));
      if (!ok) say(d.line, "한글 자간", "ADR-0003 한글 자간 0 (라틴/숫자 라벨만 +0.02~0.05em)", `${d.sel} { letter-spacing: ${d.val} }`);
    }
    if (d.prop === "font-size") {
      const px = /^([0-9.]+)px$/.exec(d.val);
      if (px) {
        const v = parseFloat(px[1]);
        if (v === 13 || v === 15) say(d.line, "램프 밖 크기", "독트린 슬롭 13 — 2px 계단은 위계가 아니라 경사", `${d.sel} { font-size: ${d.val} }`);
        else if (v < 12 && !latinOnly) say(d.line, "한글 12px 미만", "ADR-0003 한글 하한 12px", `${d.sel} { font-size: ${d.val} }`);
      }
    }
    if (d.prop === "border-radius" && /(^|\s)(50%|999px|9999px)/.test(d.val)) {
      /* 상태 마커의 채운 점·빈 링은 독트린이 지정한 '형태 부호'다(6~8px). 알약·아바타와 구분한다. */
      const statusDot = /\.mk-confirmed|\.mk-needs/.test(d.sel);
      if (!statusDot) say(d.line, "999px 알약 · 원형", "독트린 슬롭 8 · 모노그램 원형/Avatar 금지", `${d.sel} { border-radius: ${d.val} }`);
    }
    if ((d.prop === "background" || d.prop === "background-image") && /(linear|radial|conic)-gradient/.test(d.val)) {
      /* changed 마커의 대각선만 예외 — 표면 그라디언트는 금지 */
      if (!/\.mk-changed/.test(d.sel)) say(d.line, "그라디언트 표면", "독트린 슬롭 9 — 그레인·글래스·그라디언트 금지", `${d.sel} { ${d.prop}: ${d.val.slice(0, 60)} }`);
    }
    if (d.prop === "font-weight" && /^[0-9]+$/.test(d.val) && d.val !== "400" && d.val !== "700") {
      say(d.line, "굵기 400/700 외", "ADR-0003 — 맑은 고딕에 Semibold가 없어 600은 합성 굵기", `${d.sel} { font-weight: ${d.val} }`);
    }
  }
  return n;
}


let violations = 0, checked = 0;
for (const f of files) {
  const ext = extname(f);
  const raw = readFileSync(resolve(here, f), "utf8");
  const src = strip(raw, ext);
  const lines = src.split("\n");
  checked++;
  for (const [name, re, why, scope] of RULES) {
    if (scope === "ui" && (ext === ".mjs")) continue;
    lines.forEach((line, i) => {
      const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
      const rx = new RegExp(re.source, flags);
      if (!rx.test(line)) return;
      console.log(`  ✗ ${f}:${i + 1}  [${name}]  ${why}`);
      console.log(`      ${line.trim().slice(0, 120)}`);
      violations++;
    });
  }
}
violations += checkCss("tokens.css", strip(readFileSync(resolve(here, "tokens.css"), "utf8"), ".css"));
violations += checkCss("base.css", strip(readFileSync(resolve(here, "base.css"), "utf8"), ".css"));

/* 위젯 정보 슬롯 상한(4개)·rest 금지 요소는 렌더 결과가 아니라 구조로 확인한다 */
const appjs = readFileSync(resolve(here, "app.js"), "utf8");
if (/\.w[^\n]*appendChild\([^)]*input/.test(appjs)) { console.log("  ✗ 위젯에 입력 요소(§7 텍스트 입력 0)"); violations++; }

console.log(`\n검사 파일 ${checked} · 패턴 규칙 ${RULES.length} + CSS 값 규칙 6 · 위반 ${violations}건`);
process.exit(violations ? 1 : 0);
