/* Layer 3 — 인스펙터. 라벨-값 세로 목록, 섹션 = 12px 공백 + 명조 라벨 + 1px 룰. 카드ㆍ원형 배지ㆍ좌측 색 바 없음.
   '계획 편집'은 전체 변경의 유일한 진입점. 참가일 목록의 [이 날짜만 수정]은 예외 진입점. */
import React from "react";
import { Button, Link, makeStyles, tokens, mergeClasses, MessageBar, MessageBarBody, Tooltip } from "@fluentui/react-components";
import { useApp } from "./context";
import { useType } from "./styles";
import { byId, plansOfVendor, planSummary, orphanExceptions, overlapConflicts, invalidPlans, eventDays, plansOfEvent, weekdayChars } from "../domain/derived";
import { expandPlan } from "../domain/expandPlan";
import { dateShort, dateMD, period, weekdays, dateFull } from "../domain/format";
import { FONT_MYEONGJO } from "../theme";
import { C } from "./copy";

const useStyles = makeStyles({
  sec: { marginTop: "16px", paddingTop: "10px", borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  lbl: { fontFamily: FONT_MYEONGJO, fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2, marginBottom: "4px" },
  dl: { display: "grid", gridTemplateColumns: "7ch minmax(0, 1fr)", columnGap: "8px", rowGap: "2px" },
  dt: { fontFamily: FONT_MYEONGJO, fontSize: "12px", lineHeight: "20px", color: tokens.colorNeutralForeground2 },
  dd: { margin: 0 },
  sum: { fontSize: "14px", lineHeight: "20px" },
  list: { maxHeight: "180px", overflowY: "auto", marginTop: "6px", margin: 0, padding: 0, listStyleType: "none" },
  reveal: { opacity: 0 },
  li: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: "8px", alignItems: "baseline", paddingTop: "2px", paddingBottom: "2px", fontSize: "12px", lineHeight: "16px" },
  liAct: { cursor: "pointer", paddingLeft: "4px", paddingRight: "4px", ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover }, ":focus-visible": { outlineWidth: "2px", outlineStyle: "solid", outlineColor: tokens.colorStrokeFocus2, outlineOffset: "-2px" } },
  conflict: { marginTop: "4px", color: tokens.colorPaletteDarkOrangeForeground1 },
  none: { fontSize: "12px", color: tokens.colorNeutralForeground3 },
  mask: { cursor: "pointer", fontVariantNumeric: "tabular-nums" },
  pick: { fontFamily: FONT_MYEONGJO, fontSize: "14px", lineHeight: "20px", color: tokens.colorNeutralForeground2 },
});

const mask = (p: string) => p.replace(/(\d{3})-(\d{4})-(\d{4})/, "$1-****-$3");

export function Inspector() {
  const s = useStyles(); const ty = useType();
  const { db, state, dispatch, store, notify } = useApp();
  const sel = state.selection;
  const task = byId(db.tasks, sel.taskId);
  const vendor = byId(db.vendors, sel.vendorId);
  const ev = byId(db.events, sel.eventId);
  const [showPhone, setShowPhone] = React.useState(false);

  if (task) {
    const v = byId(db.vendors, task.vendor_id), e = byId(db.events, task.event_id);
    return (<div data-testid="inspector-task">
      <div className={s.sec}><dl className={s.dl}>
        <dt className={s.dt}>{C.inspector.task.when}</dt><dd className={s.dd}>{dateFull(task.date)}{task.time ? ` ${task.time}` : " 종일"}</dd>
        <dt className={s.dt}>{C.inspector.task.linked}</dt><dd className={s.dd}>{[e?.name, v?.name].filter(Boolean).join(" ㆍ ") || "없음"}</dd>
        <dt className={s.dt}>상  태</dt><dd className={s.dd}>{task.status === "needs_confirmation" ? C.status.taskNeeds : task.status === "done" ? C.status.done : C.status.taskOk}</dd>
      </dl></div>
      {task.status !== "done" && <div className={s.sec}><Button onClick={() => { store.setTaskStatus(task.id, "done"); notify(C.toast.checked(task.title), { undo: true }); }}>{C.layer1.check}</Button></div>}
    </div>);
  }

  if (vendor) {
    const plans = plansOfVendor(db, vendor.id);
    const dup = db.vendors.filter((x) => x.name === vendor.name).length > 1;
    const orph = orphanExceptions(db).filter((x) => byId(db.plans, x.participation_plan_id)?.vendor_id === vendor.id);
    const ovl = overlapConflicts(db).filter(([a]) => a.vendor_id === vendor.id);
    const inv = invalidPlans(db).filter((p) => p.vendor_id === vendor.id);
    const atts = db.attachments.filter((a) => a.owner_id === vendor.id);
    const logs = db.audit.filter((l) => l.entity_id === vendor.id);
    return (<div data-testid="inspector-vendor">
      <div className={ty.caption}>{dateFull(sel.date)} 선택</div>
      {dup && <MessageBar intent="warning" style={{ marginTop: 8 }}><MessageBarBody>{C.inspector.dup(vendor.name)}</MessageBarBody></MessageBar>}
      <div className={s.sec}><div className={s.lbl}>{C.inspector.basic}</div>
        <dl className={s.dl}>
          <dt className={s.dt}>{C.inspector.contact}</dt><dd className={s.dd}>{vendor.contact_name}</dd>
          <dt className={s.dt}>{C.inspector.phone}</dt><dd className={s.dd}><Tooltip content={C.inspector.phoneTip} relationship="description"><span className={s.mask} onClick={() => setShowPhone((x) => !x)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); setShowPhone((x) => !x); } }}>{showPhone ? vendor.contact_phone : mask(vendor.contact_phone)}</span></Tooltip></dd>
          <dt className={s.dt}>{C.inspector.products}</dt><dd className={s.dd}>{vendor.products.join(" ㆍ ")}</dd>
        </dl></div>
      {plans.map((p) => { const e = byId(db.events, p.event_id)!; const r = expandPlan(p, db.exceptions, null);
        return (<div key={p.id} className={s.sec} data-testid={`plan-${p.id}`}>
          <div className={s.lbl}>{C.inspector.plan(e.name)}</div>
          <div className={s.sum}>{planSummary(db, p)}</div>
          <div className={ty.caption}>{period(p.start_date, p.end_date)} ㆍ {p.weekdays.length ? weekdays(p.weekdays) : "요일 없음"}</div>
          <Tooltip content={C.inspector.planEditTip} relationship="description"><Button size="small" style={{ marginTop: 8 }} onClick={() => dispatch({ type: "dialog", dialog: { kind: "planEdit", planId: p.id } })} data-testid={`plan-edit-${p.id}`}>{C.inspector.planEdit}</Button></Tooltip>
          {r.dates.length > 0 && <><div className={s.lbl} style={{ marginTop: 10 }}>{C.inspector.days(r.dates.length)}</div>
            <ul className={s.list}>{r.dates.map((d) => (
              <li key={d} className={mergeClasses(s.li, s.liAct, "wd-row")} tabIndex={0} data-testid={`day-row-${p.id}-${d}`}
                onClick={() => dispatch({ type: "dialog", dialog: { kind: "dayException", planId: p.id, date: d } })}
                onKeyDown={(e) => { if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); dispatch({ type: "dialog", dialog: { kind: "dayException", planId: p.id, date: d } }); } }}>
                <span className={ty.num}>{dateShort(d)}{r.added.includes(d) ? <span className={ty.fg3}> ㆍ {C.status.changed}</span> : null}</span>
                <span className={mergeClasses(s.reveal, "wd-cmds", ty.fg2)}>{C.inspector.dayEdit}</span></li>))}</ul></>}
        </div>); })}
      <div className={s.sec}><div className={s.lbl}>{C.inspector.conflicts}</div>
        {!orph.length && !ovl.length && !inv.length && <div className={s.none}>{C.inspector.none}</div>}
        {orph.map((x) => { const p = byId(db.plans, x.participation_plan_id)!; return <div key={x.id} className={s.conflict}>{C.inspector.orphan(dateShort(x.date), period(p.start_date, p.end_date))}</div>; })}
        {ovl.map(([a, b]) => <div key={a.id + b.id} className={s.conflict}>{C.inspector.overlap(period(a.start_date, a.end_date), period(b.start_date, b.end_date))}</div>)}
        {inv.map((p) => <div key={p.id} className={s.conflict}>{C.inspector.invalid}</div>)}
      </div>
      <div className={s.sec}><div className={s.lbl}>{C.inspector.attach(atts.length)}</div>
        {!atts.length ? <div className={s.none}>{C.inspector.none}</div> : <ul className={s.list}>{atts.map((a) => <li key={a.id} className={mergeClasses(s.li, a.missing && s.conflict)}><span>{a.filename}</span><span className={mergeClasses(ty.caption, ty.num)}>{a.missing ? C.inspector.missing : `${Math.round(a.file_size / 1024)} KB`}</span></li>)}</ul>}
      </div>
      <div className={s.sec}><div className={s.lbl}>{C.inspector.history(logs.length)}</div>
        <ul className={s.list}>{logs.slice(0, 40).map((l) => <li key={l.id} className={s.li}><span>{l.action} ㆍ {l.previous_value || "(없음)"} → {l.new_value || "(없음)"}</span><span className={mergeClasses(ty.caption, ty.num)}>{l.timestamp}</span></li>)}</ul>
        {logs.length > 0 && <div className={ty.caption}>{C.inspector.actor(logs[0].actor)}</div>}
      </div>
    </div>);
  }

  if (ev) {
    const ps = plansOfEvent(db, ev.id), days = eventDays(db, ev);
    return (<div data-testid="inspector-event">
      <div className={s.sec}><dl className={s.dl}>
        <dt className={s.dt}>{C.inspector.event.period}</dt><dd className={s.dd}>{days.length ? period(days[0], days[days.length - 1], days.length) : period(ev.start_date, ev.end_date)}</dd>
        <dt className={s.dt}>{C.inspector.event.place}</dt><dd className={s.dd}>{ev.location}</dd>
        <dt className={s.dt}>{C.inspector.event.days}</dt><dd className={s.dd}>{days.length ? `${weekdayChars(days)}요일` : "없음"}</dd>
      </dl></div>
      <div className={s.sec}><div className={s.lbl}>{C.inspector.event.vendors(ps.length)}</div>
        <ul className={s.list}>{ps.map((p) => { const v = byId(db.vendors, p.vendor_id)!; return <li key={p.id} className={s.li}><Link onClick={() => dispatch({ type: "select", selection: { vendorId: v.id } })}>{v.name}</Link><span className={ty.caption}>{p.status === "confirmed" ? weekdays(p.weekdays) : C.status.needs}</span></li>; })}</ul>
      </div>
      <div className={s.sec}><div className={s.lbl}>{dateFull(sel.date)}</div><div className={ty.caption}>{dateMD(sel.date)} 참가 {ps.filter((p) => expandPlan(p, db.exceptions, null).dates.includes(sel.date)).length}곳</div></div>
    </div>);
  }
  return <div className={s.pick} data-testid="inspector-empty">{C.inspector.pick}<br /><span className={ty.caption}>Ctrl+N 일정 추가 ㆍ 1 2 3 뷰 ㆍ T 오늘 ㆍ F6 인스펙터 ㆍ Ctrl+Z 되돌리기 ㆍ Esc 닫기</span></div>;
}
