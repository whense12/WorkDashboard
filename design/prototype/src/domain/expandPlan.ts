/* 이 제품의 유일한 계산 축 — 명세 §7 "참가계획이 원본, 날짜별 참가 여부는 계산".
   불변식(정오표 G5-3 기본값):
   - end < start → 빈 결과, invalid="end<start"
   - weekdays 0개 → 무효 계획: 빈 결과, invalid="weekdays-empty" (예외도 적용하지 않음)
   - 예외는 계획 기간 안에서만 유효. 기간 밖 예외는 orphans로 보고만 한다
   - 같은 날 include·exclude가 둘 다 있으면 exclude가 이긴다 */
import { eachDate, weekdayISO } from "./date";
import type { LocalDate, ParticipationException, ParticipationPlan } from "./types";

export interface ExpandResult {
  dates: LocalDate[];
  added: LocalDate[];      // include 예외로 늘어난 날
  removed: LocalDate[];    // exclude 예외로 빠진 날
  invalid: null | "end<start" | "weekdays-empty";
  orphans: ParticipationException[];
}

export function expandPlan(
  plan: ParticipationPlan,
  exceptions: readonly ParticipationException[],
  range?: { start?: LocalDate; end?: LocalDate } | null,
): ExpandResult {
  const res: ExpandResult = { dates: [], added: [], removed: [], invalid: null, orphans: [] };
  if (plan.end_date < plan.start_date) { res.invalid = "end<start"; return res; }

  const from = range?.start && range.start > plan.start_date ? range.start : plan.start_date;
  const to = range?.end && range.end < plan.end_date ? range.end : plan.end_date;
  const mine = exceptions.filter((x) => x.participation_plan_id === plan.id);
  for (const x of mine) if (x.date < plan.start_date || x.date > plan.end_date) res.orphans.push(x);
  if (!plan.weekdays.length) { res.invalid = "weekdays-empty"; return res; }

  const set = new Set<LocalDate>();
  for (const d of eachDate(from, to)) if (plan.weekdays.includes(weekdayISO(d))) set.add(d);
  const inRange = (d: LocalDate) => d >= from && d <= to && d >= plan.start_date && d <= plan.end_date;

  for (const x of mine) if (inRange(x.date) && x.type === "include" && !set.has(x.date)) { set.add(x.date); res.added.push(x.date); }
  for (const x of mine) if (inRange(x.date) && x.type === "exclude" && set.has(x.date)) {
    set.delete(x.date); res.removed.push(x.date);
    const i = res.added.indexOf(x.date); if (i >= 0) res.added.splice(i, 1);
  }
  res.dates = [...set].sort(); res.added.sort(); res.removed.sort();
  return res;
}

/** 특정 날짜에 이 계획이 나오는가 (예외 반영) */
export function comesOn(plan: ParticipationPlan, exceptions: readonly ParticipationException[], d: LocalDate): boolean {
  const x = exceptions.find((e) => e.participation_plan_id === plan.id && e.date === d);
  if (x) return x.type === "include";
  return d >= plan.start_date && d <= plan.end_date && plan.weekdays.includes(weekdayISO(d));
}
export const plannedOn = (plan: ParticipationPlan, d: LocalDate) =>
  d >= plan.start_date && d <= plan.end_date && plan.weekdays.includes(weekdayISO(d));
