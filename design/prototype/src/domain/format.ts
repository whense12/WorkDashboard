/* 표기 — 부서 문체 규칙(goseong-official-doc/references/style-spec.md) 규칙 7·11·12.
   날짜 `2026. 9. 12.(토)` · 시각 `16:14` · 기간은 실제 문서 표기 `2026. 9. 22.(화) ~ 11. 1.(일), 41일간`
   가운뎃점은 화면에서 ㆍ(U+318D), 기계가 읽는 CSV에서는 ·(U+00B7). Intl 미사용(결정성). */
import { KO, weekdayISO } from "./date";
import type { LocalDate } from "./types";

const parts = (d: LocalDate) => d.split("-").map(Number) as [number, number, number];

/** 2026. 9. 12.(토) */
export function dateFull(d: LocalDate): string {
  const [y, m, dd] = parts(d);
  return `${y}. ${m}. ${dd}.(${KO[weekdayISO(d) - 1]})`;
}
/** 9. 12.(토) — 같은 해가 문맥에서 정해질 때 */
export function dateShort(d: LocalDate): string {
  const [, m, dd] = parts(d);
  return `${m}. ${dd}.(${KO[weekdayISO(d) - 1]})`;
}
/** 9. 12. — 표 안 */
export function dateMD(d: LocalDate): string {
  const [, m, dd] = parts(d);
  return `${m}. ${dd}.`;
}
/** 2026년 9월 12일 (토) — 인스펙터 제목 */
export function dateLong(d: LocalDate): string {
  const [y, m, dd] = parts(d);
  return `${y}년 ${m}월 ${dd}일 (${KO[weekdayISO(d) - 1]})`;
}
/** 실제 문서 표기: 2026. 9. 12.(토) ~ 10. 31.(토), 28일간 */
export function period(start: LocalDate, end: LocalDate, days?: number): string {
  const tail = days != null ? `, ${days}일간` : "";
  return `${dateFull(start)} ~ ${dateShort(end)}${tail}`;
}
export const weekdayLabel = (d: LocalDate) => KO[weekdayISO(d) - 1];
export const weekdays = (ws: number[]) => [...ws].sort((a, b) => a - b).map((w) => KO[w - 1]).join("ㆍ");
export const MID = "ㆍ";      // 화면
export const MID_CSV = "·";   // 기계

/* 달력 셀ㆍ위젯용 짧은 이름: 법인격 접두어ㆍ접미어를 뗀다(담당자는 '하이면'ㆍ'고성들녘'이라 부름). 운영표ㆍ인스펙터ㆍCSV는 정식 명칭. */
const CORP_PREFIX = /^(㈜|\(주\)|주식회사|유한회사|합자회사|합명회사|농업회사법인|영농조합법인|사단법인|재단법인)\s*/;
const CORP_SUFFIX = /\s*(㈜|\(주\)|주식회사|농업회사법인|영농조합법인|영농조합)$/;
export function shortName(name: string): string {
  const t = name.replace(CORP_PREFIX, "").replace(CORP_SUFFIX, "").trim();
  return t.length >= 2 ? t : name;
}
