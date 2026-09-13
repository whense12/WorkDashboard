/* Layer 1 — 오늘/다음. 데이터로 시작. 제목은 결론형 한 줄. 행의 열 x좌표는 모든 행에서 같다. Space=확인 처리, Enter=열기. */
import React from "react";
import { Button, makeStyles, tokens, mergeClasses, Tooltip } from "@fluentui/react-components";
import { useApp } from "./context";
import { useRow, useType, useMark } from "./styles";
import { tasksOn, participationsOn, orphanExceptions, overlapConflicts, invalidPlans, byId, nextBusyDay } from "../domain/derived";
import { dateFull, dateShort } from "../domain/format";
import { addDays } from "../domain/date";
import type { Task } from "../domain/types";
import { C } from "./copy";
import { NOW } from "../fixtures/sample-data";

const useStyles = makeStyles({
  panel: { width: "480px", maxWidth: "calc(100vw - 48px)", backgroundColor: tokens.colorNeutralBackground1, border: `1px solid ${tokens.colorNeutralStrokeAccessible}`, padding: "14px 16px" },
  scroll: { maxHeight: "400px", overflowY: "auto", marginTop: "10px" },
  foot: { display: "flex", alignItems: "center", columnGap: "8px", marginTop: "12px", paddingTop: "10px", borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  mark: { width: "14px", display: "inline-flex", justifyContent: "center" },
  office: { width: "6px", height: "6px", border: `1px solid ${tokens.colorNeutralForeground3}`, display: "inline-block" },
  vendor: { width: "7px", height: "7px", backgroundColor: tokens.colorNeutralForeground1, display: "inline-block" },
});

function TaskRow({ t, selected }: { t: Task; selected?: boolean }) {
  const r = useRow(); const m = useMark(); const s = useStyles(); const ty = useType();
  const { db, store, dispatch, notify } = useApp();
  const v = byId(db.vendors, t.vendor_id);
  const needs = t.status === "needs_confirmation";
  const check = () => { store.setTaskStatus(t.id, "done"); notify(C.toast.checked(t.title), { undo: true }); };
  const open = () => { dispatch({ type: "select", selection: { date: t.date, taskId: t.id, vendorId: v?.id } }); dispatch({ type: "layer", layer: 2 }); };
  return (
    <div role="row" tabIndex={0} aria-selected={selected || undefined} className={mergeClasses(r.row, "wd-row", selected && r.selected)} data-testid="task-row"
      onKeyDown={(e) => { if (e.code === "Space") { e.preventDefault(); check(); } if (e.code === "Enter") open(); }} onClick={open}>
      <span className={r.time}>{t.time ?? ""}</span>
      <span className={s.mark}>{v ? <span className={s.vendor} aria-hidden="true" /> : <span className={s.office} aria-hidden="true" />}</span>
      <span className={r.name} title={v ? `${v.name} ㆍ ${t.title}` : t.title}>{v ? v.name : t.title}{v ? <span className={ty.fg3}> ㆍ {t.title}</span> : null}</span>
      <span className={mergeClasses(r.status, needs ? m.needs : undefined)}>{t.status === "done" ? C.status.done : needs ? C.status.taskNeeds : C.status.taskOk}</span>
      <span className={mergeClasses(r.cmds, "wd-cmds")}>
        {t.status !== "done" && <Tooltip content={C.layer1.checkTip} relationship="description"><Button size="small" appearance="subtle" onClick={(e) => { e.stopPropagation(); check(); }}>{C.layer1.check}</Button></Tooltip>}
      </span>
    </div>
  );
}

export function Today() {
  const s = useStyles(); const r = useRow(); const ty = useType(); const m = useMark();
  const { db, dispatch, today } = useApp();
  const panelRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => { panelRef.current?.querySelector<HTMLElement>('[role="row"]')?.focus(); }, []);
  const ts = tasksOn(db, today);
  const needs = ts.filter((t) => t.status === "needs_confirmation");
  const rest = ts.filter((t) => t.status !== "needs_confirmation");
  const orphans = orphanExceptions(db), overlaps = overlapConflicts(db), invalid = invalidPlans(db);
  const structural = orphans.length + overlaps.length + invalid.length;
  const ps = participationsOn(db, today).filter((p) => p.state !== "cancelled");

  return (
    <section ref={panelRef} className={s.panel} aria-label="오늘" data-testid="layer1">
      <h2 className={ty.title}>{C.layer1.title(ts.length, needs.length)}</h2>
      <div className={ty.caption}>{dateFull(today)} ㆍ {NOW} 기준</div>
      <div className={s.scroll}>
        {ts.length === 0 ? (
          <>
            <div className={ty.strong}>{(() => { const n = nextBusyDay(db, today); return n ? `다음 ${dateShort(n.date)} ${n.label}.` : "예정된 일정 없음."; })()}</div>
            <div className={ty.caption}>{C.layer1.emptyNext}</div>
            {(() => { const out: React.ReactNode[] = []; let shown = 0;
              for (let i = 1; i <= 40 && shown < 3; i++) { const d = addDays(today, i); const dt = tasksOn(db, d); if (!dt.length) continue;
                out.push(<div key={d} className={r.sectionLabel}>{dateShort(d)}</div>);
                for (const t of dt) { if (shown >= 3) break; out.push(<TaskRow key={t.id} t={t} />); shown++; } }
              return out; })()}
          </>
        ) : (
          <>
            {needs.length > 0 && <><div className={r.sectionLabel}>{C.layer1.secNeeds(needs.length)}</div><div className={r.rows}>{needs.map((t) => <TaskRow key={t.id} t={t} />)}</div></>}
            <div className={r.sectionLabel}>{C.layer1.secRest(rest.length)}</div>
            <div className={r.rows}>{rest.map((t) => <TaskRow key={t.id} t={t} />)}</div>
            {structural > 0 && <>
              <div className={r.sectionLabel}>{C.layer1.secConflict(structural)}</div>
              <div className={r.rows}>
                {orphans.map((x) => { const p = byId(db.plans, x.participation_plan_id)!; const v = byId(db.vendors, p.vendor_id)!;
                  return <div key={x.id} role="row" tabIndex={0} className={r.row} onClick={() => { dispatch({ type: "select", selection: { vendorId: v.id, eventId: p.event_id } }); dispatch({ type: "layer", layer: 2 }); }}>
                    <span /><span /><span className={r.name}>{v.name} ㆍ 계획 밖 예외 {dateShort(x.date)}</span><span className={mergeClasses(r.status, m.needs)}>{C.status.taskNeeds}</span><span /></div>; })}
                {overlaps.map(([a]) => { const v = byId(db.vendors, a.vendor_id)!;
                  return <div key={a.id} role="row" tabIndex={0} className={r.row} onClick={() => { dispatch({ type: "select", selection: { vendorId: v.id, eventId: a.event_id } }); dispatch({ type: "layer", layer: 2 }); }}>
                    <span /><span /><span className={r.name}>{v.name} ㆍ 기간이 겹치는 계획 2건</span><span className={mergeClasses(r.status, m.needs)}>{C.status.taskNeeds}</span><span /></div>; })}
                {invalid.map((p) => { const v = byId(db.vendors, p.vendor_id)!;
                  return <div key={p.id} role="row" tabIndex={0} className={r.row} onClick={() => { dispatch({ type: "select", selection: { vendorId: v.id, eventId: p.event_id } }); dispatch({ type: "layer", layer: 2 }); }}>
                    <span /><span /><span className={r.name}>{v.name} ㆍ 나오는 요일 0개</span><span className={mergeClasses(r.status, m.needs)}>{C.status.taskNeeds}</span><span /></div>; })}
              </div></>}
            {ps.length > 0 && <><div className={r.sectionLabel}>{C.layer1.secVendors(ps.length)}</div>
              <div className={r.rows}>{ps.map((p) => (
                <div key={p.plan.id} role="row" tabIndex={0} className={r.row} onClick={() => { dispatch({ type: "select", selection: { vendorId: p.vendor.id, eventId: p.plan.event_id } }); dispatch({ type: "layer", layer: 2 }); }}>
                  <span /><span className={s.mark}><span className={s.vendor} aria-hidden="true" /></span><span className={r.name} title={p.vendor.name}>{p.vendor.name}</span>
                  <span className={mergeClasses(r.status, p.state === "needs_attention" ? m.needs : undefined)}>{p.state === "needs_attention" ? C.status.needs : p.state === "changed" ? C.status.changed : C.status.confirmed}</span><span /></div>))}</div></>}
          </>
        )}
      </div>
      <div className={s.foot}>
        <Tooltip content="Ctrl+2" relationship="description"><Button appearance="primary" onClick={() => dispatch({ type: "layer", layer: 2 })} data-testid="open-calendar">{C.layer1.openCalendar}</Button></Tooltip>
        <Tooltip content="Ctrl+N" relationship="description"><Button onClick={() => dispatch({ type: "dialog", dialog: { kind: "quickAdd" } })} data-testid="quick-add">{C.layer1.quickAdd}</Button></Tooltip>
      </div>
    </section>
  );
}
