/* F2 업체 등록 — 순서 고정(한 pane 세로 섹션): 기본정보 → 행사 → 기간(기본=행사 기간) → 나오는 요일(7 토글) → 실제 참가일 preview → 저장.
   요일 0개면 저장 버튼은 눌리고 요일로 포커스 + 사유(U3). 동명은 차단하지 않고 경고. */
import React from "react";
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button, Field, Input, Select, ToggleButton, Link, makeStyles, tokens, Divider } from "@fluentui/react-components";
import { useApp } from "../context";
import { useType } from "../styles";
import { expandPlan } from "../../domain/expandPlan";
import { dateShort, weekdays } from "../../domain/format";
import { KO } from "../../domain/date";
import type { ISOWeekday } from "../../domain/types";
import { FONT_MYEONGJO } from "../../theme";
import { C } from "../copy";

const useStyles = makeStyles({ sec: { fontFamily: FONT_MYEONGJO, fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2, marginTop: "12px", marginBottom: "4px" }, grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "8px" }, wd: { display: "flex", columnGap: "4px" }, prev: { marginTop: "6px", fontSize: "14px", lineHeight: "20px" }, reason: { fontSize: "12px", color: tokens.colorPaletteDarkOrangeForeground1, marginTop: "4px" } });

export function VendorRegister({ onClose }: { onClose: () => void }) {
  const s = useStyles(); const ty = useType();
  const { db, store, state, notify, dispatch } = useApp();
  const ev0 = db.events.find((e) => e.id === state.selection.eventId) ?? db.events[0];
  const [name, setName] = React.useState(""); const [contact, setContact] = React.useState(""); const [phone, setPhone] = React.useState(""); const [products, setProducts] = React.useState("");
  const [eventId, setEventId] = React.useState(ev0.id); const [start, setStart] = React.useState(ev0.start_date); const [end, setEnd] = React.useState(ev0.end_date);
  const [wd, setWd] = React.useState<ISOWeekday[]>([]); const [nameErr, setNameErr] = React.useState<string | null>(null); const [wdErr, setWdErr] = React.useState<string | null>(null);
  const nameRef = React.useRef<HTMLInputElement>(null); const wdRef = React.useRef<HTMLDivElement>(null);
  const ev = db.events.find((e) => e.id === eventId)!;
  const dup = db.vendors.some((v) => v.name === name.trim() && name.trim());
  const preview = wd.length ? expandPlan({ id: "new", event_id: eventId, vendor_id: "new", start_date: start, end_date: end, weekdays: wd, status: "confirmed" }, [], null) : null;
  const onEvent = (id: string) => { setEventId(id); const e = db.events.find((x) => x.id === id)!; setStart(e.start_date); setEnd(e.end_date); };
  const save = () => {
    if (!name.trim()) { setNameErr(C.dialog.vendor.needName); nameRef.current?.focus(); return; }
    if (!wd.length) { setWdErr(C.dialog.vendor.needWeekday); wdRef.current?.querySelector("button")?.focus(); return; }
    const v = store.addVendorWithPlan({ name: name.trim(), contact_name: contact, contact_phone: phone.replace(/\D/g, "").replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3"), products: products.split(",").map((x) => x.trim()).filter(Boolean), status: "needs_confirmation" },
      { event_id: eventId, start_date: start, end_date: end, weekdays: wd, status: "needs_confirmation" });
    notify(C.dialog.vendor.saved(v.name), { undo: true }); dispatch({ type: "select", selection: { vendorId: v.id, eventId } }); onClose();
  };
  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface style={{ maxWidth: 520 }}>
        <DialogBody>
          <DialogTitle>{C.dialog.vendor.title}</DialogTitle>
          <DialogContent>
            <div className={s.sec}>{C.dialog.vendor.sec1}</div>
            <Field label={C.dialog.vendor.name} required validationMessage={nameErr ?? (dup ? <>{C.dialog.vendor.dup(name.trim())} <Link onClick={() => { const v = db.vendors.find((x) => x.name === name.trim())!; onClose(); dispatch({ type: "select", selection: { vendorId: v.id } }); }}>기존 업체 열기</Link></> : undefined)} validationState={nameErr ? "error" : dup ? "warning" : "none"}>
              <Input ref={nameRef} value={name} onChange={(_, d) => { setName(d.value); setNameErr(null); }} autoFocus data-testid="vr-name" /></Field>
            <div className={s.grid2}>
              <Field label={C.dialog.vendor.contact}><Input value={contact} onChange={(_, d) => setContact(d.value)} /></Field>
              <Field label={C.dialog.vendor.phone}><Input value={phone} inputMode="numeric" onChange={(_, d) => setPhone(d.value.replace(/[^\d-]/g, ""))} placeholder="숫자만" /></Field>
            </div>
            <Field label={C.dialog.vendor.products}><Input value={products} onChange={(_, d) => setProducts(d.value)} /></Field>
            <Divider style={{ marginTop: 12 }} />
            <div className={s.sec}>{C.dialog.vendor.sec2}</div>
            <Field label={C.dialog.vendor.event}><Select value={eventId} onChange={(_, d) => onEvent(d.value)} data-testid="vr-event">{db.events.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
            <div className={s.sec}>{C.dialog.vendor.sec3} <span className={ty.caption}>기본값 = 행사 기간. 밖은 고를 수 없음.</span></div>
            <div className={s.grid2}>
              <Field label={C.dialog.vendor.start}><Input type="date" value={start} min={ev.start_date} max={ev.end_date} onChange={(_, d) => setStart(d.value)} /></Field>
              <Field label={C.dialog.vendor.end}><Input type="date" value={end} min={ev.start_date} max={ev.end_date} onChange={(_, d) => setEnd(d.value)} /></Field>
            </div>
            <div className={s.sec}>{C.dialog.vendor.sec4}</div>
            <div className={s.wd} ref={wdRef} role="group" aria-label={C.dialog.vendor.sec4}>
              {KO.map((k, i) => <ToggleButton key={k} size="small" checked={wd.includes((i + 1) as ISOWeekday)} onClick={() => { setWdErr(null); setWd((w) => w.includes((i + 1) as ISOWeekday) ? w.filter((x) => x !== i + 1) : [...w, (i + 1) as ISOWeekday]); }} data-testid={`vr-wd-${i + 1}`}>{k}</ToggleButton>)}
            </div>
            {wdErr && <div className={s.reason} role="alert">{wdErr}</div>}
            <div className={s.sec}>{C.dialog.vendor.sec5}</div>
            <div className={s.prev} data-testid="vr-preview">{preview && preview.dates.length ? C.dialog.vendor.preview(weekdays(wd), preview.dates.length, dateShort(preview.dates[0]), dateShort(preview.dates[preview.dates.length - 1])) : C.dialog.vendor.previewNone}</div>
          </DialogContent>
          <DialogActions fluid>
            <Button appearance="secondary" onClick={onClose}>{C.dialog.vendor.cancel}</Button>
            <Button appearance="primary" onClick={save} data-testid="vr-save">{C.dialog.vendor.save}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
