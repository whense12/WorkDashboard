/* 스크린샷 — 사전 설치 Chromium을 CLI로 직접 구동(npm 설치 0).
 * 실행: node design/mockup/shot.mjs  [필터문자열]
 * DPI는 --force-device-scale-factor 로 100/125/150/175%를 만든다(PNG 픽셀 크기가 배율만큼 커진다). */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/* headless_shell(순수 헤드리스)을 쓴다. --headless=new 는 창 크롬 높이(약 87px)를 window-size에
 * 포함해 뷰포트가 그만큼 줄고 스크린샷이 어긋난다 — 320×110 고정 검수에 치명적이라 확인 후 교체. */
const CHROME = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const PAGE = pathToFileURL(resolve(here, "index.html")).href;
const OUT = resolve(here, "shots");
mkdirSync(OUT, { recursive: true });
if (!existsSync(CHROME)) { console.error("Chromium 없음: " + CHROME); process.exit(1); }

const W = (h) => `only=widget&${h}`;
const shots = [
  // ── Layer 0 위젯: 320×110 고정 + DPI 4종 ──────────────────────────
  ["l0-rest-100",      W("state=rest"),                320, 110, 1],
  ["l0-rest-125",      W("state=rest"),                320, 110, 1.25],
  ["l0-rest-150",      W("state=rest"),                320, 110, 1.5],
  ["l0-rest-175",      W("state=rest"),                320, 110, 1.75],
  ["l0-hover",         W("state=hover"),               320, 110, 1],
  ["l0-locked",        W("state=locked"),              320, 110, 1],
  ["l0-edit",          W("state=edit"),                320, 110, 1],
  ["l0-empty",         W("state=rest&date=2026-09-27"),320, 110, 1],
  ["l0-busy23",        W("state=rest&date=2026-10-10"),320, 110, 1],
  ["l0-error",         W("state=rest&error=1"),        320, 110, 1],
  ["l0-dark",          W("state=rest&theme=dark"),     320, 110, 1],
  ["l0-gray",          W("state=rest&gray=on"),        320, 110, 1],
  // ── Layer 0 전체 표본 ────────────────────────────────────────────
  ["s-l0-all",         "mode=flow&stage=0",           1366, 900, 1],
  // ── Layer 1 ──────────────────────────────────────────────────────
  ["s-l1-A",           "mode=flow&stage=1&direction=A",1366, 1000, 1],
  ["s-l1-C-compact",   "mode=flow&stage=1&direction=C&density=compact", 1366, 1000, 1],
  ["s-l1-dark",        "mode=flow&stage=1&theme=dark", 1366, 1000, 1],
  ["s-l1-gray",        "mode=flow&stage=1&gray=on",    1366, 1000, 1],
  // ── Layer 2 월간: 오버플로 경계 ──────────────────────────────────
  ["s-l2-month-09-A",  "mode=flow&stage=2&direction=A&view=month&month=2026-09", 1366, 2400, 1],
  ["s-l2-month-10-A",  "mode=flow&stage=2&direction=A&view=month&month=2026-10", 1366, 2600, 1],
  ["s-l2-month-12-A",  "mode=flow&stage=2&direction=A&view=month&month=2026-12", 1366, 900, 1],
  ["s-l2-month-B",     "mode=flow&stage=2&direction=B&view=month&month=2026-10", 1366, 2600, 1],
  ["s-l2-month-C",     "mode=flow&stage=2&direction=C&density=compact&view=month&month=2026-10", 1366, 2400, 1],
  ["s-l2-month-dark",  "mode=flow&stage=2&view=month&month=2026-10&theme=dark",  1366, 2600, 1],
  // ── Layer 2 주간 · 기간표 ────────────────────────────────────────
  ["s-l2-week",        "mode=flow&stage=2&view=week&date=2026-10-05", 1366, 700, 1],
  ["s-l2-matrix-1366", "mode=flow&stage=2&view=matrix&month=2026-10", 1366, 768, 1],
  ["s-l2-matrix-C",    "mode=flow&stage=2&view=matrix&month=2026-10&direction=C&density=compact", 1366, 768, 1],
  ["s-l2-matrix-gray", "mode=flow&stage=2&view=matrix&month=2026-10&gray=on", 1366, 768, 1],
  ["s-l2-matrix-125",  "mode=flow&stage=2&view=matrix&month=2026-10", 1366, 768, 1.25],
  ["s-l2-matrix-150",  "mode=flow&stage=2&view=matrix&month=2026-10", 1366, 768, 1.5],
  ["s-l2-matrix-175",  "mode=flow&stage=2&view=matrix&month=2026-10", 1366, 768, 1.75],
  ["s-l2-noinspector", "mode=flow&stage=2&view=matrix&month=2026-10&inspector=off", 1366, 768, 1],
  // ── 대화상자 · 피드백 ────────────────────────────────────────────
  ["s-dlg-A",          "mode=flow&stage=3",            1366, 1100, 1],
  ["s-dlg-dark",       "mode=flow&stage=3&theme=dark", 1366, 1100, 1],
  ["s-dlg-gray",       "mode=flow&stage=3&gray=on",    1366, 1100, 1],
  // ── 판정 메모 ────────────────────────────────────────────────────
  ["s-notes",          "mode=flow&stage=4",            1100, 900, 1],
];

const filter = process.argv[2];
let ok = 0, fail = 0;
for (const [name, hash, w, h, scale] of shots) {
  if (filter && !name.includes(filter)) continue;
  const file = resolve(OUT, name + ".png");
  try {
    execFileSync(CHROME, [
      "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
      "--disable-lcd-text", "--font-render-hinting=none",
      "--force-device-scale-factor=" + scale,
      "--window-size=" + w + "," + h,
      "--virtual-time-budget=1500",
      "--screenshot=" + file,
      PAGE + "#" + hash,
    ], { stdio: ["ignore", "ignore", "pipe"], timeout: 60000 });
    const sz = statSync(file).size;
    if (sz < 1200) { console.log(`  ? ${name}.png  ${sz}B — 거의 빈 이미지일 수 있음`); }
    console.log(`  ✓ ${name}.png  ${w}×${h} @${scale}x  ${(sz / 1024).toFixed(0)}KB`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${String(e.stderr || e.message).slice(0, 200)}`);
    fail++;
  }
}
console.log(`\n촬영 ${ok}장 성공 / ${fail}장 실패 → design/mockup/shots/`);
