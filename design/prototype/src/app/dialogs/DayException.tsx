/* F4 하루만 변경 — 큰 날짜 하나가 제목. 계획 필드(기간ㆍ요일)는 노출하지 않는다. 계획 상태 고스트 → 라디오 → 이유 → 효과 문장. 덮어쓰기면 이전 값 표시. */
import React from "react";
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button, RadioGroup, Radio, Field, Textarea, Link, makeStyles, tokens } from "@fluentui/react-components";
import { useApp } from "../context";
import { useType } from "../styles";
import { byId } from "../../domain/derived";
import { plannedOn } from "../../domain/expandPlan";
import { dateFull, dateMD, weekdays } from "../../domain/format";
import { FONT_TITLE } from "../../theme";
import { C } from "../copy";

const useStyles = makeStyles({ big: { fontFamily: FONT_TITLE, fontSize: "20px", lineHeight: "28px", fontWeight: 700 }, ghost: { color: tokens.colorNeutralForeground3, marginTop: "8px" }, effect: { fontSize: "14px", lineHeight: "20px", marginTop: "10px" } });

export function DayException({ planId, date, onClose }: { planId: string; date: string; onClose: () => void }) {
  const s = useStyles(); const ty = useType();
  const { db, store, notify, dispatch } = useApp();
  const p = byId(db.plans, planId)!; const v = byId(db.vendors, p.vendor_id)!;
  const existing = db.exceptions.find((x) => x.participation_plan_id === p.id && x.date === date);
  const planned = plannedOn(p, date);
  const current = existing ? existing.type === "include" : planned;
  const [choice, setChoice] = React.useState<"come" | "skip">(current ? "come" : "skip");
  const [reason, setReason] = React.useState(existing?.reason ?? "");
  const wantCome = choice === "come";
  const same = wantCome === planned;
  const save = () => {
    if (same) { if (existing) { store.removeException(existing.id); notify(C.dialog.dayEx.cleared(dateMD(date), v.name), { undo: true }); } onClose(); return; }
    store.setException({ participation_plan_id: p.id, date, type: wantCome ? "include" : "exclude", reason });
    notify(C.dialog.dayEx.saved(dateMD(date), v.name, wantCome ? C.status.changed : C.status.cancelled), { undo: true }); onClose();
  };
  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface style={{ maxWidth: 460 }}>
        <DialogBody>
          <DialogTitle><span className={s.big}>{dateFull(date)}</span></DialogTitle>
          <DialogContent>
            <div className={ty.strong}>{v.name}</div>
            <div className={ty.caption}>{C.dialog.dayEx.sub(v.name).replace(`${v.name}. `, "")}</div>
            <div className={s.ghost}>{C.dialog.dayEx.planned(planned ? "참가" : "없음")} ({weekdays(p.weekdays)} 참가)</div>
            {existing && <div className={ty.caption}>{C.dialog.dayEx.overwrite(existing.type === "include" ? C.status.changed : C.status.cancelled)}</div>}
            <RadioGroup value={choice} onChange={(_, d) => setChoice(d.value as "come" | "skip")} style={{ marginTop: 10 }} aria-label="이 날짜 참가 여부">
              <Radio value="come" label={C.dialog.dayEx.come} data-testid="de-come" />
              <Radio value="skip" label={C.dialog.dayEx.skip} data-testid="de-skip" />
            </RadioGroup>
            <Field label={C.dialog.dayEx.reason} style={{ marginTop: 8 }}><Textarea value={reason} onChange={(_, d) => setReason(d.value)} rows={2} /></Field>
            <div className={s.effect} data-testid="de-effect">{same ? C.dialog.dayEx.effectSame : C.dialog.dayEx.effect(wantCome ? "나옴" : "빠짐")}</div>
            <Link style={{ display: "inline-block", marginTop: 6, fontSize: 12 }} onClick={() => { onClose(); dispatch({ type: "dialog", dialog: { kind: "planEdit", planId: p.id } }); }}>{C.dialog.dayEx.toPlan}</Link>
          </DialogContent>
          <DialogActions fluid>
            <Button appearance="secondary" onClick={onClose} autoFocus>{C.dialog.dayEx.cancel}</Button>
            <Button appearance="primary" onClick={save} disabled={same && !existing} data-testid="de-save">{C.dialog.dayEx.save(dateMD(date))}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
