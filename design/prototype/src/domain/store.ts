/* 상태 저장소 — 되돌리기는 AuditLog(previous/new)로 성립(명세 §7). 되돌릴 수 있는 변경은 묻지 않는다(독트린 U1).
   Tauri 명령과 같은 시그니처를 지향한다(bridge). 지금은 메모리. */
import { useSyncExternalStore } from "react";
import type { DB, ParticipationException, ParticipationPlan, Task, Vendor, AuditLog } from "./types";

type Listener = () => void;
export interface Mutation { label: string; apply: (db: DB) => void; revert: (db: DB) => void; }

export class Store {
  private db: DB;
  private listeners = new Set<Listener>();
  private undoStack: Mutation[] = [];
  private redoStack: Mutation[] = [];
  private snapshot: DB | null = null;
  readonly actor = "GOSEONG\\nongsan01";

  constructor(initial: DB) { this.db = initial; }
  get state() { return this.db; }
  subscribe = (l: Listener) => { this.listeners.add(l); return () => this.listeners.delete(l); };
  private emit() { this.db = { ...this.db }; for (const l of this.listeners) l(); }

  private log(entity_type: string, entity_id: string, action: string, prev: string, next: string) {
    const a: AuditLog = { id: `L${Date.now()}${Math.floor(Math.random() * 1e4)}`, timestamp: nowStamp(), entity_type, entity_id, action, previous_value: prev, new_value: next, actor: this.actor };
    this.db.audit.unshift(a);
  }
  commit(m: Mutation) { m.apply(this.db); this.undoStack.push(m); this.redoStack = []; this.emit(); }
  undo() { const m = this.undoStack.pop(); if (!m) return null; m.revert(this.db); this.redoStack.push(m); this.emit(); return m.label; }
  redo() { const m = this.redoStack.pop(); if (!m) return null; m.apply(this.db); this.undoStack.push(m); this.emit(); return m.label; }
  get canUndo() { return this.undoStack.length > 0; }

  /* ── 도메인 명령 ─────────────────────────────────────────────── */
  setException(x: Omit<ParticipationException, "id">): string {
    const old = this.db.exceptions.find((e) => e.participation_plan_id === x.participation_plan_id && e.date === x.date);
    const nx: ParticipationException = { id: `X${Date.now()}`, ...x };
    const label = old ? "그날만 변경 덮어씀" : "그날만 변경";
    this.commit({ label,
      apply: (db) => { if (old) db.exceptions.splice(db.exceptions.indexOf(old), 1); db.exceptions.push(nx); this.log("exception", nx.id, label, old ? old.type : "", nx.type); },
      revert: (db) => { db.exceptions.splice(db.exceptions.indexOf(nx), 1); if (old) db.exceptions.push(old); } });
    return label;
  }
  removeException(id: string) {
    const x = this.db.exceptions.find((e) => e.id === id); if (!x) return;
    const i = this.db.exceptions.indexOf(x);
    this.commit({ label: "그날만 변경 지움", apply: (db) => { db.exceptions.splice(db.exceptions.indexOf(x), 1); this.log("exception", id, "지움", x.type, ""); }, revert: (db) => db.exceptions.splice(i, 0, x) });
  }
  updatePlan(id: string, patch: Partial<Pick<ParticipationPlan, "start_date" | "end_date" | "weekdays" | "status">>, dropExceptionIds: string[] = []) {
    const p = this.db.plans.find((q) => q.id === id); if (!p) return;
    const before = { start_date: p.start_date, end_date: p.end_date, weekdays: [...p.weekdays], status: p.status };
    const dropped = this.db.exceptions.filter((x) => dropExceptionIds.includes(x.id));
    this.commit({ label: "계획 변경",
      apply: (db) => { Object.assign(p, patch); for (const x of dropped) { const i = db.exceptions.indexOf(x); if (i >= 0) db.exceptions.splice(i, 1); }
        this.log("plan", id, "계획 변경", JSON.stringify(before), JSON.stringify(patch)); },
      revert: (db) => { Object.assign(p, before); for (const x of dropped) db.exceptions.push(x); } });
  }
  setPlanStatus(id: string, status: ParticipationPlan["status"]) { this.updatePlan(id, { status }); }
  addVendorWithPlan(v: Omit<Vendor, "id">, plan: Omit<ParticipationPlan, "id" | "vendor_id"> | null) {
    const nv: Vendor = { id: `V${Date.now()}`, ...v };
    const np: ParticipationPlan | null = plan ? { id: `P${Date.now()}`, vendor_id: nv.id, ...plan } : null;
    this.commit({ label: "업체 등록",
      apply: (db) => { db.vendors.push(nv); if (np) db.plans.push(np); this.log("vendor", nv.id, "등록", "", nv.name); },
      revert: (db) => { db.vendors.splice(db.vendors.indexOf(nv), 1); if (np) db.plans.splice(db.plans.indexOf(np), 1); } });
    return nv;
  }
  addTask(t: Omit<Task, "id">) {
    const nt: Task = { id: `T${Date.now()}`, ...t };
    this.commit({ label: "일정 저장", apply: (db) => { db.tasks.push(nt); this.log("task", nt.id, "저장", "", nt.title); }, revert: (db) => db.tasks.splice(db.tasks.indexOf(nt), 1) });
    return nt;
  }
  setTaskStatus(id: string, status: Task["status"]) {
    const t = this.db.tasks.find((q) => q.id === id); if (!t) return;
    const old = t.status;
    this.commit({ label: status === "done" ? "확인 처리" : "상태 변경", apply: (db) => { const q = db.tasks.find((z) => z.id === id)!; q.status = status; this.log("task", id, "상태", old, status); }, revert: (db) => { db.tasks.find((z) => z.id === id)!.status = old; } });
  }
  updateVendorField<K extends keyof Vendor>(id: string, key: K, value: Vendor[K]) {
    const v = this.db.vendors.find((q) => q.id === id); if (!v) return;
    const old = v[key];
    this.commit({ label: "업체 정보 수정", apply: (db) => { db.vendors.find((z) => z.id === id)![key] = value; this.log("vendor", id, String(key), String(old), String(value)); }, revert: (db) => { db.vendors.find((z) => z.id === id)![key] = old; } });
  }
  /* 복원: 현재 상태를 스냅샷으로 저장하고 백업 내용으로 바꾼다. 여기서는 백업 = 예외·상태 일부가 다른 사본 */
  restoreFrom(backupId: string, replacement: Partial<DB>) {
    const snap: DB = JSON.parse(JSON.stringify(this.db));
    this.snapshot = snap;
    this.commit({ label: `백업 ${backupId}에서 복원`,
      apply: (db) => { Object.assign(db, JSON.parse(JSON.stringify(replacement))); this.log("db", backupId, "복원", "", backupId); },
      revert: (db) => { Object.assign(db, JSON.parse(JSON.stringify(snap))); } });
  }
  get hasSnapshot() { return this.snapshot !== null; }
}

export function nowStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function useDB(store: Store): DB {
  return useSyncExternalStore(store.subscribe, () => store.state, () => store.state);
}
