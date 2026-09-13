/* 날짜 원시 연산 — UTC Date로만 계산해 DST·시간대 밀림 없음. 문자열 비교로 정렬. */
import type { LocalDate, ISOWeekday } from "./types";

const DAY = 86_400_000;
export const KO = ["월", "화", "수", "목", "금", "토", "일"] as const;

export function toUTC(s: LocalDate): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
export function fromUTC(ms: number): LocalDate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export const addDays = (s: LocalDate, n: number): LocalDate => fromUTC(toUTC(s) + n * DAY);
export function weekdayISO(s: LocalDate): ISOWeekday {
  const w = new Date(toUTC(s)).getUTCDay();
  return (w === 0 ? 7 : w) as ISOWeekday;
}
export function eachDate(start: LocalDate, end: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  if (start > end) return out;
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
export const monthOf = (s: LocalDate): string => s.slice(0, 7);
export function monthRange(ym: string): { first: LocalDate; last: LocalDate } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${ym}-01`, last: `${ym}-${String(last).padStart(2, "0")}` };
}
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}
/* 주 시작 = 월 (정오표 G5-2 기본값) */
export const weekStart = (s: LocalDate): LocalDate => addDays(s, -(weekdayISO(s) - 1));
