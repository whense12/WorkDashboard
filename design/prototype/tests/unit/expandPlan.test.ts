/* 골든 테이블 — 명세 §7 "참가계획이 원본, 날짜별 참가는 계산" + 정오표 G5-0 케이스.
   기대값은 손으로 센 것. 구현을 따라가지 않는다. 2026-09-12=토, 2026-10-31=토, 2026-12-25=금, 2027-01-01=금. */
import { describe, it, expect } from "vitest";
import { expandPlan, comesOn } from "../../src/domain/expandPlan";
import { eachDate, weekdayISO, weekStart, addDays } from "../../src/domain/date";
import { dateFull, period, dateShort } from "../../src/domain/format";
import type { ParticipationPlan, ParticipationException } from "../../src/domain/types";

const P = (o: Partial<ParticipationPlan>): ParticipationPlan =>
  ({ id: "P", event_id: "E", vendor_id: "V", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [5, 6], status: "confirmed", ...o });
const X = (date: string, type: "include" | "exclude", plan = "P"): ParticipationException =>
  ({ id: "X" + date, participation_plan_id: plan, date, type, reason: "" });

describe("날짜 원시", () => {
  it("요일 ISO 1=월…7=일", () => { expect(weekdayISO("2026-09-12")).toBe(6); expect(weekdayISO("2026-09-13")).toBe(7); expect(weekdayISO("2026-09-14")).toBe(1); });
  it("주 시작 = 월", () => { expect(weekStart("2026-09-24")).toBe("2026-09-21"); expect(weekStart("2026-09-21")).toBe("2026-09-21"); });
  it("월 경계·연말 경계", () => { expect(addDays("2026-09-30", 1)).toBe("2026-10-01"); expect(addDays("2026-12-31", 1)).toBe("2027-01-01"); expect(eachDate("2026-12-30", "2027-01-02")).toHaveLength(4); });
});

describe("expandPlan 골든", () => {
  it("1 금·토 9/12~10/31 = 15일", () => { expect(expandPlan(P({}), []).dates).toHaveLength(15); });
  it("2 단일일 계획(9/24 목, weekdays=[4]) = 1일", () => { expect(expandPlan(P({ start_date: "2026-09-24", end_date: "2026-09-24", weekdays: [4] }), []).dates).toEqual(["2026-09-24"]); });
  it("3 weekdays 0개 = 무효, 예외도 적용 안 함", () => { const r = expandPlan(P({ weekdays: [] }), [X("2026-09-19", "include")]); expect(r.dates).toEqual([]); expect(r.invalid).toBe("weekdays-empty"); });
  it("4 요일 밖 include → 추가", () => { const r = expandPlan(P({}), [X("2026-10-08", "include")]); expect(r.dates).toContain("2026-10-08"); expect(r.added).toEqual(["2026-10-08"]); expect(r.dates).toHaveLength(16); });
  it("5 요일 안 exclude → 제외", () => { const r = expandPlan(P({}), [X("2026-10-10", "exclude")]); expect(r.dates).not.toContain("2026-10-10"); expect(r.removed).toEqual(["2026-10-10"]); expect(r.dates).toHaveLength(14); });
  it("6 요일 밖 exclude는 무의미(변화 없음)", () => { const r = expandPlan(P({}), [X("2026-10-07", "exclude")]); expect(r.dates).toHaveLength(15); expect(r.removed).toEqual([]); });
  it("7 end<start → 빈 결과·invalid", () => { const r = expandPlan(P({ start_date: "2026-10-31", end_date: "2026-09-12" }), []); expect(r.dates).toEqual([]); expect(r.invalid).toBe("end<start"); });
  it("8 조회 구간이 계획을 자름", () => { const r = expandPlan(P({}), [], { start: "2026-10-01", end: "2026-10-15" }); expect(r.dates).toEqual(["2026-10-02", "2026-10-03", "2026-10-09", "2026-10-10"]); });
  it("9 기간 밖 예외 = 고아, 적용 안 됨", () => { const r = expandPlan(P({}), [X("2026-11-15", "include")]); expect(r.orphans).toHaveLength(1); expect(r.dates).not.toContain("2026-11-15"); });
  it("10 같은 날 include+exclude → exclude 우선", () => { const r = expandPlan(P({}), [X("2026-10-08", "include"), X("2026-10-08", "exclude")]); expect(r.dates).not.toContain("2026-10-08"); expect(r.added).toEqual([]); });
  it("11 연말 경계 토·일 12/19~1/11, 12/25 exclude → 8일", () => { const r = expandPlan(P({ start_date: "2026-12-19", end_date: "2027-01-11", weekdays: [6, 7] }), [X("2026-12-25", "exclude")]); expect(r.dates).toHaveLength(8); expect(r.dates[0]).toBe("2026-12-19"); expect(r.dates[7]).toBe("2027-01-10"); });
  it("12 다른 계획의 예외는 영향 없음", () => { const r = expandPlan(P({}), [X("2026-10-10", "exclude", "OTHER")]); expect(r.dates).toHaveLength(15); });
  it("comesOn: 예외가 요일보다 우선", () => { const p = P({}); expect(comesOn(p, [X("2026-10-10", "exclude")], "2026-10-10")).toBe(false); expect(comesOn(p, [X("2026-10-08", "include")], "2026-10-08")).toBe(true); expect(comesOn(p, [], "2026-10-07")).toBe(false); });
});

describe("표기 — 부서 문체 규칙 7", () => {
  it("2026. 9. 12.(토)", () => expect(dateFull("2026-09-12")).toBe("2026. 9. 12.(토)"));
  it("기간: 실제 문서 표기", () => expect(period("2026-09-12", "2026-10-31", 28)).toBe("2026. 9. 12.(토) ~ 10. 31.(토), 28일간"));
  it("9. 12.(토)", () => expect(dateShort("2026-09-12")).toBe("9. 12.(토)"));
});
