/* 파생 지표·불변식 위반·요약 문법. 요약은 결론형 자동 생성(명세 §2 "수동 작성 금지"), 개조식. */
import { addDays, KO, weekdayISO } from "./date";
import { expandPlan, comesOn } from "./expandPlan";
import { dateMD, dateShort, weekdays } from "./format";
import type { DB, Event, LocalDate, ParticipationException, ParticipationPlan, Task, Vendor } from "./types";

export const byId = <T extends { id: string }>(xs: readonly T[], id: string | null | undefined) =>
  id ? xs.find((x) => x.id === id) : undefined;

export function plansOfEvent(db: DB, eventId: string) { return db.plans.filter((p) => p.event_id === eventId); }
export function plansOfVendor(db: DB, vendorId: string) { return db.plans.filter((p) => p.vendor_id === vendorId); }

/** 운영일 = 그 행사에서 실제로 한 곳이라도 나오는 날 */
export function eventDays(db: DB, ev: Event): LocalDate[] {
  const set = new Set<LocalDate>();
  for (const p of plansOfEvent(db, ev.id))
    for (const d of expandPlan(p, db.exceptions, { start: ev.start_date, end: ev.end_date }).dates) set.add(d);
  return [...set].sort();
}

export interface Participation { vendor: Vendor; plan: ParticipationPlan; state: "confirmed" | "needs_attention" | "changed" | "cancelled"; exception?: ParticipationException; }

/** 날짜별 참가 업체 — 월간 셀·기간표 셀·오늘 화면의 유일한 출처 */
export function participationsOn(db: DB, d: LocalDate, eventId?: string): Participation[] {
  const out: Participation[] = [];
  for (const p of db.plans) {
    if (eventId && p.event_id !== eventId) continue;
    const v = byId(db.vendors, p.vendor_id); if (!v) continue;
    const x = db.exceptions.find((e) => e.participation_plan_id === p.id && e.date === d);
    const on = comesOn(p, db.exceptions, d);
    if (on) out.push({ vendor: v, plan: p, exception: x,
      state: x?.type === "include" ? "changed" : (p.status === "needs_confirmation" || v.status === "needs_confirmation") ? "needs_attention" : "confirmed" });
    else if (x?.type === "exclude") out.push({ vendor: v, plan: p, exception: x, state: "cancelled" });
  }
  return out.sort((a, b) => a.vendor.name.localeCompare(b.vendor.name, "ko"));
}

export const tasksOn = (db: DB, d: LocalDate): Task[] =>
  db.tasks.filter((t) => t.date === d).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

/* 불변식 위반 — 인스펙터 '충돌' 섹션·오늘 화면 '날짜와 무관한 충돌'의 입력 */
export function orphanExceptions(db: DB) {
  return db.exceptions.filter((x) => { const p = byId(db.plans, x.participation_plan_id); return p && (x.date < p.start_date || x.date > p.end_date); });
}
export function overlapConflicts(db: DB): [ParticipationPlan, ParticipationPlan][] {
  const out: [ParticipationPlan, ParticipationPlan][] = [];
  const ps = db.plans;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j];
    if (a.event_id === b.event_id && a.vendor_id === b.vendor_id && a.start_date <= b.end_date && b.start_date <= a.end_date) out.push([a, b]);
  }
  return out;
}
export const invalidPlans = (db: DB) => db.plans.filter((p) => !p.weekdays.length || p.end_date < p.start_date);

/** 다음 운영일(오늘 포함) — 위젯의 주어 */
export function nextOperatingDay(db: DB, today: LocalDate): { date: LocalDate; event: Event } | null {
  let best: { date: LocalDate; event: Event } | null = null;
  for (const ev of db.events) for (const d of eventDays(db, ev)) if (d >= today && (!best || d < best.date)) best = { date: d, event: ev };
  return best;
}
export function nextBusyDay(db: DB, from: LocalDate) {
  for (let i = 1; i <= 90; i++) {
    const d = addDays(from, i);
    const ts = tasksOn(db, d); if (ts.length) return { date: d, label: ts[0].title };
    const ps = participationsOn(db, d); if (ps.length) return { date: d, label: ps[0].vendor.name };
  }
  return null;
}

/* ── 요약 문법 (개조식) ─────────────────────────────────────────────── */
export function planSummary(db: DB, p: ParticipationPlan): string {
  const r = expandPlan(p, db.exceptions, null);
  if (r.invalid === "weekdays-empty") return "나오는 요일이 없음. 참가일 0일.";
  if (r.invalid) return "기간이 잘못됨. 확인 필요.";
  const ex = db.exceptions.filter((x) => x.participation_plan_id === p.id).sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => `${dateMD(x.date)} ${x.type === "exclude" ? "빠짐" : "나옴"}`).join("ㆍ");
  return `${weekdays(p.weekdays)} 참가ㆍ${r.dates.length}일ㆍ${dateShort(r.dates[0])}부터 ${dateShort(r.dates[r.dates.length - 1])}까지` + (ex ? `ㆍ${ex}` : "");
}
export function daySummary(db: DB, d: LocalDate): string {
  const ts = tasksOn(db, d), need = ts.filter((t) => t.status === "needs_confirmation").length;
  if (!ts.length) { const n = nextBusyDay(db, d); return n ? `오늘 일정 없음. 다음 ${dateShort(n.date)} ${n.label}.` : "오늘 일정 없음."; }
  return need ? `오늘 ${ts.length}건 중 ${need}건 확인 필요.` : `오늘 ${ts.length}건. 확인 필요 없음.`;
}
export function eventSummary(db: DB, ev: Event): string {
  const ps = plansOfEvent(db, ev.id), days = eventDays(db, ev);
  const no = ps.filter((p) => p.status === "needs_confirmation").length;
  return `참가업체 ${ps.length}곳ㆍ운영 ${days.length}일. ` + (no ? `회신 없는 곳 ${no}곳임.` : "전부 회신 받았음.");
}
export const weekdayChars = (days: LocalDate[]) =>
  [...new Set(days.map(weekdayISO))].sort((a, b) => a - b).map((w) => KO[w - 1]).join("ㆍ");
