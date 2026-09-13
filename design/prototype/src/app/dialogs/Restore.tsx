/* F5 복원 — 고르기만 해서는 덮어쓰지 않음. 바뀌는 양 preview → "지금 상태를 보관본으로 남김" → 확인 버튼. preview 전에는 비활성 + 사유. */
import React from "react";
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button, RadioGroup, Radio, ProgressBar, makeStyles, tokens } from "@fluentui/react-components";
import { useApp } from "../context";
import { useType } from "../styles";
import { FONT_MYEONGJO } from "../../theme";
import { C } from "../copy";
import { dateFull } from "../../domain/format";

const useStyles = makeStyles({ sec: { fontFamily: FONT_MYEONGJO, fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2, marginTop: "12px", marginBottom: "4px" }, dl: { display: "grid", gridTemplateColumns: "9ch auto", columnGap: "8px", rowGap: "2px", fontVariantNumeric: "tabular-nums" }, effect: { fontSize: "14px", lineHeight: "20px", fontWeight: 700, marginTop: "10px" } });

export function Restore({ onClose }: { onClose: () => void }) {
  const s = useStyles(); const ty = useType();
  const { db, store, notify, dispatch } = useApp();
  const [id, setId] = React.useState<string>(""); const [ready, setReady] = React.useState(false); const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (!id) return; setReady(false); const t = setTimeout(() => setReady(true), 350); return () => clearTimeout(t); }, [id]);
  const b = db.backups.find((x) => x.id === id);
  /* 보관본 내용: 예외 2건이 없고 계획 상태가 다른 사본(실제로는 파일에서 읽는다) */
  const replacement = () => ({ exceptions: db.exceptions.filter((x) => !["X01", "X03"].includes(x.id)), plans: db.plans.map((p) => p.id === "P05" ? { ...p, status: "confirmed" as const } : p) });
  const run = () => { setBusy(true); setTimeout(() => { store.restoreFrom(b!.id, replacement()); dispatch({ type: "restored", from: b!.label }); notify(C.dialog.restore.restored(b!.label)); setBusy(false); onClose(); }, 400); };
  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open && !busy) onClose(); }}>
      <DialogSurface style={{ maxWidth: 460 }}>
        <DialogBody>
          <DialogTitle>{C.dialog.restore.title}</DialogTitle>
          <DialogContent>
            <div className={ty.caption}>{C.dialog.restore.sub}</div>
            <div className={s.sec}>{C.dialog.restore.list}</div>
            <RadioGroup value={id} onChange={(_, d) => setId(d.value)} aria-label={C.dialog.restore.list}>
              {db.backups.map((x) => <Radio key={x.id} value={x.id} label={`${x.label} ㆍ ${dateFull(x.taken_at.slice(0, 10))} ${x.taken_at.slice(11)} ㆍ ${(x.size_bytes / 1048576).toFixed(1)} MB`} data-testid={`rs-${x.id}`} />)}
            </RadioGroup>
            {id && <>
              <div className={s.sec}>{C.dialog.restore.preview}</div>
              {!ready ? <><ProgressBar /><div className={ty.caption}>{C.dialog.restore.loading}</div></> :
                <dl className={s.dl}><dt className={ty.caption}>업체</dt><dd>±0</dd><dt className={ty.caption}>행사</dt><dd>±0</dd><dt className={ty.caption}>참가계획</dt><dd>상태 1건 바뀜</dd><dt className={ty.caption}>그날만 변경</dt><dd>−2</dd><dt className={ty.caption}>일정</dt><dd>±0</dd><dt className={ty.caption}>첨부</dt><dd>20개 중 1개 없음</dd></dl>}
              <div className={s.effect}>{C.dialog.restore.snapshot}</div>
            </>}
            {busy && <ProgressBar style={{ marginTop: 8 }} />}
          </DialogContent>
          <DialogActions fluid>
            <Button appearance="secondary" onClick={onClose} autoFocus disabled={busy}>{C.dialog.restore.cancel}</Button>
            <Button appearance="primary" disabled={!ready || busy} onClick={run} data-testid="rs-run">{C.dialog.restore.save}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
