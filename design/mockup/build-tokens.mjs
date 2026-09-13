// design_tokens_v0.2.json -> tokens.css
// 토큰은 제안이 아니라 제약(ADR-0002 §2). 이 스크립트만이 tokens.css를 만든다 — 손으로 고치지 말 것.
// 실행: node design/mockup/build-tokens.mjs
// 의존성 0(node 내장 모듈만). Fluent v9 중립 램프 hex는 [훈련지식]이며 단계 2에서
// @fluentui/tokens 실제 import로 대체된다(NEUTRAL_SOURCE 참조).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const T = JSON.parse(readFileSync(resolve(repo, "docs/spec/design_tokens_v0.2.json"), "utf8"));

const NEUTRAL_SOURCE =
  "[훈련지식] Fluent UI v9 webLightTheme/webDarkTheme 중립 램프 값. 단계 2에서 @fluentui/tokens import로 대체 — 그때까지 '미검증'.";

// Fluent v9 webLightTheme / webDarkTheme neutral ramp
const NEUTRAL = {
  light: {
    bg1: "#ffffff", bg1h: "#f5f5f5", bg1p: "#e0e0e0", bg1sel: "#ebebeb",
    bg2: "#fafafa", bg3: "#f5f5f5", bg4: "#f0f0f0", bg5: "#ebebeb",
    fg1: "#242424", fg2: "#424242", fg3: "#616161", fg4: "#707070", fgdis: "#bdbdbd",
    stroke1: "#d1d1d1", stroke2: "#e0e0e0", stroke3: "#f0f0f0",
    focus1: "#ffffff", focus2: "#000000",
    shadow16: "0 0 2px rgba(0,0,0,.12), 0 8px 16px rgba(0,0,0,.14)",
    shadow28: "0 0 8px rgba(0,0,0,.12), 0 14px 28px rgba(0,0,0,.24)",
    // 라이트 전용 warm tilt (독트린 색 절 [정체성]; chroma <= 0.02)
    widget: "#fbfaf9", paneWarm: "#fdfcfb",
  },
  dark: {
    bg1: "#292929", bg1h: "#3d3d3d", bg1p: "#1f1f1f", bg1sel: "#383838",
    bg2: "#242424", bg3: "#1f1f1f", bg4: "#141414", bg5: "#0a0a0a",
    fg1: "#ffffff", fg2: "#d6d6d6", fg3: "#adadad", fg4: "#999999", fgdis: "#5c5c5c",
    stroke1: "#666666", stroke2: "#525252", stroke3: "#3d3d3d",
    focus1: "#000000", focus2: "#ffffff",
    shadow16: "0 0 2px rgba(0,0,0,.24), 0 8px 16px rgba(0,0,0,.28)",
    shadow28: "0 0 8px rgba(0,0,0,.24), 0 14px 28px rgba(0,0,0,.48)",
    widget: "#292929", paneWarm: "#292929", // 다크·HC에서 warm tilt 해제
  },
};

const out = [];
const push = (...s) => out.push(...(s.length ? s : [""]));
let varCount = 0;
const v = (name, val) => { varCount++; return `  --${name}: ${val};`; };

const ramp = (mode) => {
  const r = T.typography.ramp[mode];
  const lines = [];
  for (const [role, d] of Object.entries(r)) {
    if (typeof d !== "object") continue; // 'note'
    lines.push(v(`fs-${role}`, `${d.size}px`));
    lines.push(v(`lh-${role}`, `${d.line}px`));
    if (d.weight) lines.push(v(`fw-${role}`, d.weight));
  }
  return lines;
};

const statusVars = (theme) => {
  const lines = [];
  for (const [k, d] of Object.entries(T.color.status.values)) {
    if (!d[theme]) continue; // linked = 색 없음
    lines.push(v(`st-${k}`, d[theme]));
  }
  return lines;
};

const accentVars = (cand, theme) => {
  const c = T.color.accent.candidates[cand][theme];
  return Object.entries(c).map(([k, hex]) => v(`ac-${k}`, hex));
};

const neutralVars = (theme) =>
  Object.entries(NEUTRAL[theme]).map(([k, val]) => v(k, val));

const densityVars = (mode) => {
  const d = T.density[mode];
  const [mw, mh] = d.monogram.split("x");
  return [
    v("row-h", `${d.row}px`),
    v("cell-pad", `${d.cell_pad}px`),
    v("mono-w", `${mw}px`),
    v("mono-h", `${mh}px`),
    v("ctl-h", `${d.control}px`),
  ];
};

push(`/* 생성물 — 손으로 고치지 말 것. 출처: docs/spec/design_tokens_v0.2.json v${T.version}`);
push(` * 생성: node design/mockup/build-tokens.mjs`);
push(` * 중립 램프: ${NEUTRAL_SOURCE}`);
push(` * 액센트 기본: ${T.color.accent.default} / 밀도 기본: ${T.density.default}`);
push(` * Aesthetic: quiet-swiss-instrument (Fluent 2) */`);
push();
push(":root {");
push(v("font-ui", T.typography.font_stack.ui));
push(v("hangul-min", `${T.typography.hangul.min_px}px`));
push(v("lh-prose", T.typography.hangul.line_height.prose));
push(v("measure-prose", "520px"));
push(...ramp("normal"));
push(...T.spacing.map((n) => v(`sp-${n}`, `${n}px`)));
push(v("r-control", `${T.radius.control}px`));
push(v("r-chip", `${T.radius.compact_surface}px`));
push(v("r-pane", `${T.radius.pane}px`));
push(v("r-widget", `${T.radius.floating_widget}px`));
push(v("r-flyout", `${T.radius.flyout}px`));
for (const [k, ms] of Object.entries(T.motion_ms)) {
  if (typeof ms === "number") push(v(`d-${k.replace(/_/g, "-")}`, `${ms}ms`));
}
for (const [k, c] of Object.entries(T.motion_ms.curves)) push(v(`c-${k}`, c));
push(v("grid-base", `${T.grid.base}px`));
push(v("matrix-vendor-col", `${T.grid.matrix_vendor_col_px.normal}px`));
push(v("min-target", `${T.grid.min_click_target}px`));
push(v("tooltip-delay", `${T.timing.tooltip_delay_ms}ms`));
push(...densityVars("normal"));
push(...neutralVars("light"));
push(...statusVars("light"));
push("  color-scheme: light dark;");
push("}");
push();
push('/* 밀도: compact는 글자 크기를 내리지 않는다 — 행 높이·패딩만 (typography.ramp.compact.note) */');
push('[data-density="compact"] {');
push(...densityVars("compact"));
push(...ramp("compact"));
push(v("matrix-vendor-col", `${T.grid.matrix_vendor_col_px.compact}px`));
push("}");
push();
for (const cand of ["A_ink_blue", "B_teal_steel"]) {
  const key = cand[0];
  push(`[data-accent="${key}"] {`);
  push(...accentVars(cand, "light"));
  push("}");
}
push();
push("/* 다크: Windows 추종. 순흑 금지. warm tilt 해제 */");
push('[data-theme="dark"] {');
push(...neutralVars("dark"));
push(...statusVars("dark"));
push("}");
for (const cand of ["A_ink_blue", "B_teal_steel"]) {
  push(`[data-theme="dark"][data-accent="${cand[0]}"] {`);
  push(...accentVars(cand, "dark"));
  push("}");
}
push();
push("/* forced-colors: 배경 톤으로만 구분되던 것(오늘 열·주말·선택 행·레일)을 경계/시스템 색으로 치환 */");
push('@media (forced-colors: active) {');
push("  :root, [data-theme=\"dark\"] {");
push("    --bg1: Canvas; --bg1h: Canvas; --bg1p: Canvas; --bg1sel: Highlight;");
push("    --bg2: Canvas; --bg3: Canvas; --bg4: Canvas; --bg5: Canvas;");
push("    --widget: Canvas; --paneWarm: Canvas;");
push("    --fg1: CanvasText; --fg2: CanvasText; --fg3: CanvasText; --fg4: CanvasText; --fgdis: GrayText;");
push("    --stroke1: CanvasText; --stroke2: CanvasText; --stroke3: CanvasText;");
push("    --focus1: Canvas; --focus2: CanvasText;");
push("    --ac-rest: Highlight; --ac-hover: Highlight; --ac-pressed: Highlight; --ac-subtle: Canvas; --ac-selected: Highlight;");
push("    --st-needs_attention: CanvasText; --st-changed: CanvasText; --st-confirmed: CanvasText; --st-cancelled: GrayText;");
push("    --shadow16: none; --shadow28: none;");
push("  }");
push("}");
push();
push("/* reduced-motion: 제거가 아니라 대체 — translate는 없애고 opacity 83ms linear만 (motion_ms.reduced_motion) */");
push("@media (prefers-reduced-motion: reduce) {");
push("  :root {");
push(`    --d-hover-in: ${T.motion_ms.widget_data_crossfade}ms; --d-hover-out: ${T.motion_ms.widget_data_crossfade}ms;`);
push(`    --d-selection-in: ${T.motion_ms.widget_data_crossfade}ms; --d-selection-out: ${T.motion_ms.widget_data_crossfade}ms;`);
push(`    --d-pane-expand: ${T.motion_ms.widget_data_crossfade}ms; --d-pane-collapse: ${T.motion_ms.widget_data_crossfade}ms;`);
push("    --c-enter: linear; --c-ease: linear; --c-exit: linear;");
push("  }");
push("}");
push();

writeFileSync(resolve(here, "tokens.css"), out.join("\n"));
console.log(`tokens.css 생성 — CSS 변수 ${varCount}개`);
console.log(`ramp normal ${Object.keys(T.typography.ramp.normal).length}역할 / spacing ${T.spacing.length} / status ${Object.keys(T.color.status.values).length} / accent 후보 ${Object.keys(T.color.accent.candidates).length}`);
