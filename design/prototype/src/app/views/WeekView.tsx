/* 주간 — 선택 날짜가 속한 주. 같은 업체명을 같은 x에서 읽는다. 시간 격자가 아니라 '누가 오는가'가 축. */
import { makeStyles, tokens, mergeClasses } from "@fluentui/react-components";
import { useApp } from "../context";
import { weekStart, eachDate, addDays, weekdayISO } from "../../domain/date";
import { participationsOn, tasksOn } from "../../domain/derived";
import { dateShort, dateFull, shortName } from "../../domain/format";

const useStyles = makeStyles({
  grid: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderTop: `1px solid ${tokens.colorNeutralStrokeAccessible}`, borderLeft: `1px solid ${tokens.colorNeutralStrokeAccessible}`, backgroundColor: tokens.colorNeutralBackground1 },
  head: { fontSize: "12px", lineHeight: "16px", textAlign: "center", paddingTop: "4px", paddingBottom: "4px", borderRight: `1px solid ${tokens.colorNeutralStroke2}`, borderBottom: `1px solid ${tokens.colorNeutralStrokeAccessible}`, backgroundColor: "var(--wd-head)", color: tokens.colorNeutralForeground1 },
  headToday: { fontWeight: 700 },
  col: { borderRight: `1px solid ${tokens.colorNeutralStroke2}`, borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, padding: "6px", minHeight: "320px", backgroundColor: "transparent", textAlign: "left", cursor: "pointer", color: "inherit", fontFamily: "inherit", display: "block", width: "100%",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover }, ":focus-visible": { outlineWidth: "2px", outlineStyle: "solid", outlineColor: tokens.colorStrokeFocus2, outlineOffset: "-2px" } },
  weekend: { backgroundColor: tokens.colorNeutralBackground2 },
  today: { backgroundColor: tokens.colorNeutralBackground3, boxShadow: `inset 0 2px 0 ${tokens.colorNeutralForeground1}` },
  selected: { boxShadow: `inset 0 0 0 2px ${tokens.colorBrandStroke1}` },
  sec: { fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground3, marginTop: "6px", marginBottom: "2px", letterSpacing: "0.04em" },
  item: { fontSize: "12px", lineHeight: "17px", display: "flex", alignItems: "baseline", columnGap: "6px" },
  t: { fontVariantNumeric: "tabular-nums", color: tokens.colorNeutralForeground2, flexShrink: 0 },
  needs: { color: tokens.colorPaletteDarkOrangeForeground1 },
  cancelled: { textDecorationLine: "line-through", color: tokens.colorNeutralForeground3 },
});

export function WeekView() {
  const s = useStyles();
  const { db, state, dispatch, today } = useApp();
  const start = weekStart(state.selection.date), dates = eachDate(start, addDays(start, 6));
  return (
    <div data-testid="week">
      <div className={s.grid} role="grid" aria-label={`${dateShort(dates[0])}부터 한 주`}>
        {dates.map((d) => <div key={d} className={mergeClasses(s.head, d === today && s.headToday)} role="columnheader">{dateShort(d)}</div>)}
        {dates.map((d) => { const ts = tasksOn(db, d); const ps = participationsOn(db, d, state.selection.eventId); const wd = weekdayISO(d);
          return (
            <div key={d} role="gridcell" tabIndex={0} className={mergeClasses(s.col, wd >= 6 && s.weekend, d === today && s.today, d === state.selection.date && s.selected)} aria-label={`${dateFull(d)} 일정 ${ts.length}건 업체 ${ps.length}곳`} data-testid={`wday-${d}`}
              onClick={() => dispatch({ type: "select", selection: { date: d, taskId: undefined } })} onKeyDown={(e) => { if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); dispatch({ type: "select", selection: { date: d, taskId: undefined } }); } }}>
              {ts.length > 0 && <div className={s.sec}>일정 {ts.length}</div>}
              {ts.map((t) => <div key={t.id} className={mergeClasses(s.item, t.status === "needs_confirmation" && s.needs)}><span className={s.t}>{t.time ?? "종일"}</span><span>{t.title}</span></div>)}
              {ps.length > 0 && <div className={s.sec}>참가 {ps.filter((p) => p.state !== "cancelled").length}곳</div>}
              {ps.map((p) => <div key={p.plan.id} className={mergeClasses(s.item, p.state === "needs_attention" && s.needs, p.state === "cancelled" && s.cancelled)}><span title={p.vendor.name}>{shortName(p.vendor.name)}</span></div>)}
            </div>); })}
      </div>
    </div>
  );
}
