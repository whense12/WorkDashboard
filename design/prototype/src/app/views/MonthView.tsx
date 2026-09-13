/* 월간 — 명세 §3: 날짜 셀에 업체명 직접 표시, 업체가 많으면 그 주의 높이를 늘림, 이름을 숨기지 않음. +N more 없음.
   오늘 = 열 배경 + 날짜 굵게 + 상단 룰(액센트 원형 배지 아님). 주말 = 배경 1단. 사무일정은 6px 빈 사각, 업체는 채운 사각. */
import { makeStyles, tokens, mergeClasses, Link } from "@fluentui/react-components";
import { useApp } from "../context";
import { useType } from "../styles";
import { monthRange, weekStart, eachDate, addDays, weekdayISO, KO } from "../../domain/date";
import { participationsOn, tasksOn } from "../../domain/derived";
import { dateFull, shortName } from "../../domain/format";
import { C } from "../copy";

const useStyles = makeStyles({
  grid: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderTop: `1px solid ${tokens.colorNeutralStrokeAccessible}`, borderLeft: `1px solid ${tokens.colorNeutralStrokeAccessible}`, backgroundColor: tokens.colorNeutralBackground1 },
  dow: { fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2, textAlign: "center", paddingTop: "4px", paddingBottom: "4px", borderRight: `1px solid ${tokens.colorNeutralStroke2}`, borderBottom: `1px solid ${tokens.colorNeutralStrokeAccessible}`, backgroundColor: "var(--wd-head)" },
  cell: { borderRight: `1px solid ${tokens.colorNeutralStroke2}`, borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, padding: "4px 6px", minHeight: "96px", backgroundColor: "transparent", textAlign: "left", cursor: "pointer", color: "inherit", fontFamily: "inherit", display: "block", width: "100%",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover }, ":focus-visible": { outlineWidth: "2px", outlineStyle: "solid", outlineColor: tokens.colorStrokeFocus2, outlineOffset: "-2px" } },
  weekend: { backgroundColor: tokens.colorNeutralBackground2 },
  today: { backgroundColor: tokens.colorNeutralBackground3, boxShadow: `inset 0 2px 0 ${tokens.colorNeutralForeground1}` },
  other: { color: tokens.colorNeutralForeground4 },
  selected: { boxShadow: `inset 0 0 0 2px ${tokens.colorBrandStroke1}` },
  d: { fontSize: "12px", lineHeight: "16px", fontVariantNumeric: "tabular-nums", color: tokens.colorNeutralForeground2 },
  dToday: { fontWeight: 700, color: tokens.colorNeutralForeground1 },
  list: { marginTop: "2px", display: "grid", rowGap: "1px" },
  item: { fontSize: "12px", lineHeight: "16px", display: "flex", alignItems: "flex-start", columnGap: "4px", minWidth: 0 },
  /* 업체명은 숨기지 않는다(명세 §3). 짧은 이름 + 최대 2행, 전체 이름은 title */
  nm: { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
  office: { width: "6px", height: "6px", border: `1px solid ${tokens.colorNeutralForeground3}`, flexShrink: 0, marginTop: "5px" },
  vendor: { width: "6px", height: "6px", backgroundColor: tokens.colorNeutralForeground1, flexShrink: 0, marginTop: "5px" },
  needs: { border: `2px solid ${tokens.colorPaletteDarkOrangeBorderActive}`, backgroundColor: "transparent", width: "7px", height: "7px" },
  cancelled: { textDecorationLine: "line-through", color: tokens.colorNeutralForeground3 },
  hint: { fontSize: "12px", lineHeight: "16px", marginTop: "4px" },
});

export function MonthView() {
  const s = useStyles(); const ty = useType();
  const { db, state, dispatch, today } = useApp();
  const { first, last } = monthRange(state.month);
  const start = weekStart(first), end = addDays(weekStart(last), 6);
  const dates = eachDate(start, end);
  const weekMax: number[] = [];
  const items = dates.map((d) => {
    const ts = tasksOn(db, d).map((t) => ({ kind: "o" as const, name: t.title, full: t.title, state: t.status === "needs_confirmation" ? "needs" : "ok" }));
    const ps = participationsOn(db, d, state.selection.eventId).map((p) => ({ kind: "v" as const, name: shortName(p.vendor.name), full: p.vendor.name, state: p.state === "needs_attention" ? "needs" : p.state === "cancelled" ? "cancelled" : "ok" }));
    return [...ts, ...ps];
  });
  items.forEach((it, i) => { const w = Math.floor(i / 7); weekMax[w] = Math.max(weekMax[w] ?? 0, it.length); });

  return (
    <div data-testid="month">
      <div className={s.grid} role="grid" aria-label={`${+state.month.slice(0, 4)}년 ${+state.month.slice(5)}월`}>
        {KO.map((k) => <div key={k} className={s.dow} role="columnheader">{k}</div>)}
        {dates.map((d, i) => { const wd = weekdayISO(d); const w = Math.floor(i / 7); const it = items[i];
          return (
            <button type="button" key={d} role="gridcell" className={mergeClasses(s.cell, wd >= 6 && s.weekend, d === today && s.today, (d < first || d > last) && s.other, d === state.selection.date && s.selected)}
              aria-label={`${dateFull(d)} ${it.length}건`} data-testid={`day-${d}`}
              onClick={() => { dispatch({ type: "select", selection: { date: d, taskId: undefined } }); }}>
              <span className={mergeClasses(s.d, d === today && s.dToday)}>{+d.slice(8, 10)}</span>
              <div className={s.list}>
                {it.map((x, j) => (
                  <div key={j} className={s.item} title={x.full}>
                    {x.kind === "o" ? <span className={mergeClasses(s.office, x.state === "needs" && s.needs)} aria-hidden="true" /> : <span className={mergeClasses(s.vendor, x.state === "needs" && s.needs)} aria-hidden="true" />}
                    <span className={mergeClasses(s.nm, x.state === "cancelled" && s.cancelled)}>{x.name}</span>
                  </div>))}
              </div>
              {wd === 7 && (weekMax[w] ?? 0) >= 17 && <div className={s.hint}><Link onClick={(e) => { e.stopPropagation(); dispatch({ type: "view", view: "matrix" }); }}>{C.month.toMatrix}</Link></div>}
            </button>); })}
      </div>
      <p className={mergeClasses(ty.caption)} style={{ marginTop: 8 }}>{C.month.hint(weekMax)}</p>
    </div>
  );
}
