/* 공용 조판 — 램프는 토큰 v0.2(anchor 28/36 · title 20/28 · subtitle 16/22 · body 14/20 · caption 12/16 · micro 11/14).
   서체 3벌은 부서 양식 그대로: 제목 HY헤드라인M 계열 / ❖·❍ 항목 명조 / 본문 맑은 고딕.
   문서 상자: 제목 상하 이중선, ❖ 실선 사각(form-spec). 머리행 #D9D9D9, 문항행 #F2F2F2(form-spec 값 그대로). */
import { makeStyles, tokens, shorthands } from "@fluentui/react-components";
import { FONT_TITLE, FONT_MYEONGJO } from "../theme";

export const HEAD_BG = "var(--wd-head)";   // 라이트 #D9D9D9 (main.tsx)
export const SUB_BG  = "var(--wd-sub)";    // 라이트 #F2F2F2

export const useType = makeStyles({
  anchor:   { fontFamily: FONT_TITLE, fontSize: "28px", lineHeight: "36px", fontWeight: 700, letterSpacing: "-0.01em" },
  title:    { fontFamily: FONT_TITLE, fontSize: "20px", lineHeight: "28px", fontWeight: 700 },
  subtitle: { fontSize: "16px", lineHeight: "22px", fontWeight: 700 },
  myeongjo: { fontFamily: FONT_MYEONGJO, fontSize: "14px", lineHeight: "20px" },
  body:     { fontSize: "14px", lineHeight: "20px", fontWeight: 400 },
  strong:   { fontSize: "14px", lineHeight: "20px", fontWeight: 700 },
  caption:  { fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground3 },
  num:      { fontVariantNumeric: "tabular-nums" },
  fg2:      { color: tokens.colorNeutralForeground2 },
  fg3:      { color: tokens.colorNeutralForeground3 },
});

export const useDoc = makeStyles({
  /* 제목: 상하 이중선, 가운데 (form-spec 제목 상자) */
  docTitle: { fontFamily: FONT_TITLE, fontSize: "24px", lineHeight: "32px", fontWeight: 700, textAlign: "center",
    paddingTop: "6px", paddingBottom: "6px", borderTop: `3px double ${tokens.colorNeutralForeground1}`, borderBottom: `3px double ${tokens.colorNeutralForeground1}` },
  /* ❖ 요약: 실선 사각, 명조 */
  lead: { fontFamily: FONT_MYEONGJO, fontSize: "16px", lineHeight: "22px", ...shorthands.border("1px", "solid", tokens.colorNeutralForeground1), paddingTop: "5px", paddingBottom: "5px", paddingLeft: "10px", paddingRight: "10px", marginTop: "10px", marginBottom: "10px" },
  /* ❍ 항목 라벨: 공백 폭 맞춤은 문자열에서(`기  간`) */
  meta: { display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: "10px", rowGap: "1px", fontFamily: FONT_MYEONGJO, fontSize: "14px", lineHeight: "20px" },
  metaLabel: { color: tokens.colorNeutralForeground2 },
  /* 표 */
  tableWrap: { overflowX: "auto", maxWidth: "100%", display: "inline-block", verticalAlign: "top", backgroundColor: tokens.colorNeutralBackground1, ...shorthands.border("1px", "solid", tokens.colorNeutralStrokeAccessible) },
  table: { borderCollapse: "collapse", tableLayout: "fixed", width: "auto" },
  th: { backgroundColor: HEAD_BG, fontSize: "12px", lineHeight: "14px", fontWeight: 400, textAlign: "center", paddingTop: "3px", paddingBottom: "3px", whiteSpace: "nowrap",
    ...shorthands.border("1px", "solid", tokens.colorNeutralStrokeAccessible), color: tokens.colorNeutralForeground1 },
  thLeft: { textAlign: "left", paddingLeft: "8px", paddingRight: "8px", position: "sticky", left: 0, zIndex: 2 },
  rowHeadSel: { backgroundColor: tokens.colorBrandBackground2 },
  thSat: { backgroundColor: "var(--wd-head-sat)" },
  rowHead: { backgroundColor: SUB_BG, textAlign: "left", position: "sticky", left: 0, zIndex: 1, fontWeight: 400, paddingTop: "4px", paddingBottom: "4px", paddingLeft: "8px", paddingRight: "8px",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1), color: tokens.colorNeutralForeground1 },
  td: { textAlign: "center", height: "26px", ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1), paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
  tdDay: { cursor: "pointer", ":hover": { backgroundColor: tokens.colorBrandBackground2 }, ":focus-visible": { outlineWidth: "2px", outlineStyle: "solid", outlineColor: tokens.colorStrokeFocus2, outlineOffset: "-2px" } },
  tdSat: { backgroundColor: tokens.colorNeutralBackground3 },
  tdWeekStart: { borderLeftWidth: "2px", borderLeftColor: tokens.colorNeutralStrokeAccessible },
  tdEx: { boxShadow: `inset 0 0 0 2px ${tokens.colorNeutralStrokeAccessible}` },
  tdNum: { textAlign: "right", paddingRight: "6px", color: tokens.colorNeutralForeground2 },
  tdMemo: { textAlign: "left", paddingLeft: "8px", paddingRight: "8px", fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

/* 상태 마크 — 형태가 1차(■ □ ─), 색은 3차. 회색조에서 구분되어야 한다. */
export const useMark = makeStyles({
  mark: { fontSize: "14px", lineHeight: "20px", fontFamily: FONT_TITLE },
  confirmed: { color: tokens.colorNeutralForeground1 },
  needs: { color: tokens.colorPaletteDarkOrangeForeground1 },
  changed: { color: tokens.colorNeutralForeground1 },
  cancelled: { color: tokens.colorNeutralForeground3 },
});

/* 행 — 모든 열 x좌표 동일(정렬축). 시각 5ch · 마커 · 이름 · 상태 · 예약 명령 슬롯 */
export const useRow = makeStyles({
  rows: { display: "grid" },
  row: { display: "grid", gridTemplateColumns: "5ch 14px minmax(0, 1fr) auto auto", alignItems: "center", columnGap: "8px",
    minHeight: "28px", paddingLeft: "8px", paddingRight: "8px", backgroundColor: "transparent", ...shorthands.border("0"), width: "100%", textAlign: "left", cursor: "pointer",
    color: tokens.colorNeutralForeground1, fontFamily: "inherit", fontSize: "14px", lineHeight: "20px",
    transitionProperty: "background-color", transitionDuration: tokens.durationFast, transitionTimingFunction: tokens.curveEasyEase,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outlineWidth: "2px", outlineStyle: "solid", outlineColor: tokens.colorStrokeFocus2, outlineOffset: "-2px" } },
  selected: { backgroundColor: tokens.colorNeutralBackground1Selected },
  time: { textAlign: "right", fontVariantNumeric: "tabular-nums", color: tokens.colorNeutralForeground2 },
  name: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  status: { display: "flex", alignItems: "center", columnGap: "4px", fontSize: "12px", lineHeight: "16px", whiteSpace: "nowrap" },
  /* 명령 슬롯: 자리는 항상 예약, 표시는 .wd-row:hover / :focus-within / [aria-selected] (global.css) */
  cmds: { display: "flex", columnGap: "2px", opacity: 0, transitionProperty: "opacity", transitionDuration: tokens.durationFast },
  sectionLabel: { fontFamily: FONT_MYEONGJO, fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2, paddingTop: "12px", paddingBottom: "4px", paddingLeft: "8px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, marginBottom: "2px" },
});

export const useLayout = makeStyles({
  /* Layer 2: 창을 채운다. 좌 행사 216 / 중 캘린더 / 우 인스펙터 InlineDrawer. max-width 중앙 컨테이너 없음. */
  shell: { display: "grid", gridTemplateColumns: "216px minmax(0, 1fr)", height: "100vh", overflow: "hidden" },
  side: { backgroundColor: tokens.colorNeutralBackground2, borderRight: `1px solid ${tokens.colorNeutralStrokeAccessible}`, paddingTop: "12px", overflowY: "auto" },
  main: { display: "flex", minWidth: 0, height: "100vh" },
  content: { flexGrow: 1, flexBasis: "0px", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" },
  cmdRow: { display: "flex", alignItems: "center", columnGap: "8px", paddingTop: "8px", paddingBottom: "8px", paddingLeft: "16px", paddingRight: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, flexWrap: "wrap" },
  viewArea: { flexGrow: 1, overflow: "auto", paddingTop: "12px", paddingBottom: "40px", paddingLeft: "16px", paddingRight: "16px" },
  spacer: { marginLeft: "auto" },
  reveal: { opacity: 0, transitionProperty: "opacity", transitionDuration: tokens.durationFast },
  revealOn: { opacity: 1 },
});
