/* F1 Quick Add — 제목 + 일시만으로 저장. 해석 결과 한 줄 상시. Enter=저장(조합 중 제외), Ctrl+Enter=저장 후 유지, Esc=닫기. */
import React from "react";
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button, Field, Input, Select, makeStyles, tokens } from "@fluentui/react-components";
import { useApp } from "../context";
import { useType } from "../styles";
import { dateFull } from "../../domain/format";
import { C } from "../copy";

const useStyles = makeStyles({ grid: { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "8px" }, echo: { marginTop: "8px", fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2 }, ime: { fontSize: "12px", color: tokens.colorNeutralForeground3, marginTop: "6px" } });

export function QuickAdd({ onClose }: { onClose: () => void }) {
  const s = useStyles(); const ty = useType();
  const { db, store, state, notify } = useApp();
  const [title, setTitle] = React.useState(""); const [date, setDate] = React.useState(state.selection.date); const [time, setTime] = React.useState("15:00");
  const [vendorId, setVendorId] = React.useState(""); const [eventId, setEventId] = React.useState(state.selection.eventId ?? "");
  const [err, setErr] = React.useState<string | null>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const save = (keep: boolean) => {
    if (!title.trim()) { setErr(C.dialog.quickAdd.needTitle); titleRef.current?.focus(); return; }
    const t = store.addTask({ title: title.trim(), date, time: time || undefined, category: vendorId ? "vendor" : "office", event_id: eventId || null, vendor_id: vendorId || null, status: "confirmed" });
    notify(C.dialog.quickAdd.saved(t.title), { undo: true });
    if (keep) { setTitle(""); setErr(null); titleRef.current?.focus(); } else onClose();
  };
  const v = db.vendors.find((x) => x.id === vendorId), e = db.events.find((x) => x.id === eventId);
  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface style={{ maxWidth: 440 }}>
        <DialogBody>
          <DialogTitle>{C.dialog.quickAdd.title}</DialogTitle>
          <DialogContent>
            <div className={ty.caption} style={{ marginBottom: 8 }}>{C.dialog.quickAdd.sub}</div>
            <Field label={C.dialog.quickAdd.titleLabel} required validationMessage={err ?? undefined} validationState={err ? "error" : "none"}>
              <Input ref={titleRef} value={title} onChange={(_, d) => { setTitle(d.value); if (err) setErr(null); }} autoFocus data-testid="qa-title"
                onKeyDown={(ev) => { if (ev.nativeEvent.isComposing || ev.keyCode === 229) return; if (ev.code === "Enter") { ev.preventDefault(); save(ev.ctrlKey); } }} />
            </Field>
            <div className={s.grid}>
              <Field label={C.dialog.quickAdd.dateLabel}><Input type="date" value={date} onChange={(_, d) => setDate(d.value)} data-testid="qa-date" /></Field>
              <Field label={C.dialog.quickAdd.timeLabel}><Input type="time" step={300} value={time} onChange={(_, d) => setTime(d.value)} data-testid="qa-time" /></Field>
            </div>
            <Field label={C.dialog.quickAdd.linkLabel}>
              <div className={s.grid}>
                <Select value={eventId} onChange={(_, d) => setEventId(d.value)}><option value="">행사 없음</option>{db.events.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
                <Select value={vendorId} onChange={(_, d) => setVendorId(d.value)}><option value="">업체 없음</option>{db.vendors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
              </div>
            </Field>
            <div className={s.echo} data-testid="qa-echo">→ {dateFull(date)} {time || "종일"} ㆍ {v ? v.name : "업체 연결 없음"}{e ? ` ㆍ ${e.name}` : ""}</div>
            <div className={s.ime}>{C.dialog.quickAdd.ime}</div>
          </DialogContent>
          <DialogActions fluid>
            <Button appearance="secondary" onClick={onClose}>{C.dialog.quickAdd.cancel}</Button>
            <Button appearance="secondary" onClick={() => save(true)}>{C.dialog.quickAdd.saveKeep}</Button>
            <Button appearance="primary" onClick={() => save(false)} data-testid="qa-save">{C.dialog.quickAdd.save}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
