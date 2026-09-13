/* F3 전체 일정 변경 — 인스펙터 [계획 편집]이 유일한 진입점. 제목에 범위. diff preview 두 열. 의미를 잃는 예외에 [유지]/[삭제], 정하기 전 저장 불가. 버튼에 영향 수. */
import React from "react";
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button, Field, Input, ToggleButton, makeStyles, tokens } from "@fluentui/react-components";
import { useApp } from "../context";
import { useType } from "../styles";
import { expandPlan } from "../../domain/expandPlan";
import { byId } from "../../domain/derived";
import { dateShort, period, weekdays } from "../../domain/format";
import { KO, weekdayISO } from "../../domain/date";
import type { ISOWeekday } from "../../domain/types";
import { FONT_MYEONGJO } from "../../theme";
import { C } from "../copy";

const useStyles = makeStyles({ sec: { fontFamily: FONT_MYEONGJO, fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2, marginTop: "12px", marginBottom: "4px" }, grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "16px" }, wd: { display: "flex", columnGap: "4px" }, ul: { fontSize: "12px", lineHeight: "17px", fontVariantNumeric: "tabular-nums", maxHeight: "120px", overflowY: "auto", marginTop: "3px", margin: 0, padding: 0, listStyleType: "none" }, ghost: { color: tokens.colorNeutralForeground3 }, cf: { display: "flex", alignItems: "center", columnGap: "8px", marginTop: "4px" }, reason: { fontSize: "12px", color: tokens.colorPaletteDarkOrangeForeground1 } });

export function PlanEdit({ planId, onClose }: { planId: string; onClose: () => void }) {
  const s = useStyles(); const ty = useType();
  const { db, store, notify } = useApp();
  const p = byId(db.plans, planId)!; const v = byId(db.vendors, p.vendor_id)!; const e = byId(db.events, p.event_id)!;
  const [start, setStart] = React.useState(p.start_date); const [end, setEnd] = React.useState(p.end_date); const [wd, setWd] = React.useState<ISOWeekday[]>([...p.weekdays]);
  const [decision, setDecision] = React.useState<Record<string, "keep" | "drop">>({});
  const before = expandPlan(p, db.exceptions, null);
  const trial = { ...p, start_date: start, end_date: end, weekdays: wd };
  const after = wd.length ? expandPlan(trial, db.exceptions, null) : null;
  const bs = new Set(before.dates), as = new Set(after?.dates ?? []);
  const add = (after?.dates ?? []).filter((d) => !bs.has(d)), rem = before.dates.filter((d) => !as.has(d));
  /* 의미를 잃는 예외: 새 기간 밖이거나, 새 요일 집합에서 exclude 대상이 아예 참가일이 아닌 것 */
  const stale = db.exceptions.filter((x) => x.participation_plan_id === p.id && (x.date < start || x.date > end || (x.type === "exclude" && !wd.includes(weekdayISO(x.date)))));
  const undecided = stale.filter((x) => !decision[x.id]);
  const changed = add.length + rem.length > 0 || start !== p.start_date || end !== p.end_date;
  const canSave = wd.length > 0 && changed && undecided.length === 0;
  const save = () => {
    store.updatePlan(p.id, { start_date: start, end_date: end, weekdays: wd }, stale.filter((x) => decision[x.id] === "drop").map((x) => x.id));
    notify(C.dialog.planEdit.saved(v.name, add.length, rem.length), { undo: true }); onClose();
  };
  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface style={{ maxWidth: 560 }}>
        <DialogBody>
          <DialogTitle>{C.dialog.planEdit.title(v.name, e.name)}</DialogTitle>
          <DialogContent>
            <div className={ty.caption}>{C.dialog.planEdit.sub(period(p.start_date, p.end_date), before.dates.length, weekdays(p.weekdays))}</div>
            <div className={s.grid2}>
              <Field label={C.dialog.planEdit.start}><Input type="date" value={start} min={e.start_date} max={e.end_date} onChange={(_, d) => setStart(d.value)} /></Field>
              <Field label={C.dialog.planEdit.end}><Input type="date" value={end} min={e.start_date} max={e.end_date} onChange={(_, d) => setEnd(d.value)} /></Field>
            </div>
            <div className={s.sec}>{C.dialog.planEdit.weekdays}</div>
            <div className={s.wd} role="group" aria-label={C.dialog.planEdit.weekdays}>
              {KO.map((k, i) => <ToggleButton key={k} size="small" checked={wd.includes((i + 1) as ISOWeekday)} onClick={() => setWd((w) => w.includes((i + 1) as ISOWeekday) ? w.filter((x) => x !== i + 1) : [...w, (i + 1) as ISOWeekday])} data-testid={`pe-wd-${i + 1}`}>{k}</ToggleButton>)}
            </div>
            {!wd.length && <div className={s.reason} role="alert">{C.dialog.planEdit.needWeekday}</div>}
            <div className={s.grid2} style={{ marginTop: 12 }}>
              <div><div className={s.sec} style={{ marginTop: 0 }}>{C.dialog.planEdit.add(add.length)}</div><ul className={s.ul} data-testid="pe-add">{add.map((d) => <li key={d}>{dateShort(d)}</li>)}</ul></div>
              <div><div className={s.sec} style={{ marginTop: 0 }}>{C.dialog.planEdit.rem(rem.length)}</div><ul className={s.ul} data-testid="pe-rem">{rem.map((d) => <li key={d} className={s.ghost}>{dateShort(d)}</li>)}</ul></div>
            </div>
            {stale.length > 0 && <>
              <div className={s.sec}>{C.dialog.planEdit.conflicts(stale.length)}</div>
              {stale.map((x) => <div key={x.id} className={s.cf}><span>{dateShort(x.date)} {x.type === "exclude" ? C.status.cancelled : C.status.changed}{x.reason ? ` (${x.reason})` : ""}</span>
                <ToggleButton size="small" checked={decision[x.id] === "keep"} onClick={() => setDecision((d) => ({ ...d, [x.id]: "keep" }))}>{C.dialog.planEdit.keep}</ToggleButton>
                <ToggleButton size="small" checked={decision[x.id] === "drop"} onClick={() => setDecision((d) => ({ ...d, [x.id]: "drop" }))} data-testid={`pe-drop-${x.id}`}>{C.dialog.planEdit.drop}</ToggleButton></div>)}
            </>}
            {!changed && wd.length > 0 && <div className={ty.caption} style={{ marginTop: 8 }}>{C.dialog.planEdit.nochange}</div>}
          </DialogContent>
          <DialogActions fluid>
            <Button appearance="secondary" onClick={onClose} autoFocus>{C.dialog.planEdit.cancel}</Button>
            <Button appearance="primary" disabled={!canSave} onClick={save} data-testid="pe-save">{C.dialog.planEdit.save(add.length, rem.length)}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
