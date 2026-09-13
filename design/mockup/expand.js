/* 파생 엔진 — 이 제품의 유일한 계산 축(spec:336-341 "참가계획이 원본, 날짜별 참가는 계산").
 * 월간·기간표 셀을 손으로 그리지 않기 위해 시안에서도 실제로 계산한다.
 * 단계 2에서 src/domain/expandPlan.ts 로 이식 + vitest 골든(docs/spec/golden-expand-plan.md).
 * 기본값 출처: 정오표 G5-1(날짜=로컬 'YYYY-MM-DD' 문자열) · G5-2(weekdays ISO 1=월…7=일, 주 시작 월) · G5-3(불변식) */
var WD = window.WD || (window.WD = {});

/* ── 날짜 원시 연산: 전부 'YYYY-MM-DD' 문자열. UTC Date로만 계산해 DST·시간대 밀림 없음 ── */
function toUTC(s) { var p = s.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function fromUTC(ms) { var d = new Date(ms); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
WD.addDays = function (s, n) { return fromUTC(toUTC(s) + n * 86400000); };
WD.cmp = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };
/* ISO 요일 1=월 … 7=일 */
WD.weekdayISO = function (s) { var wd = new Date(toUTC(s)).getUTCDay(); return wd === 0 ? 7 : wd; };
WD.eachDate = function (start, end) { var out = []; if (start > end) return out; for (var d = start; d <= end; d = WD.addDays(d, 1)) out.push(d); return out; };
WD.WD_KO = ["월", "화", "수", "목", "금", "토", "일"];

/* ── expandPlan: (계획 + 예외 + 조회구간) → 참가 날짜 목록 ─────────────
 * 불변식(G5-3): end<start → 빈 결과 / weekdays 0개 → 무효 계획(빈 결과, 예외도 적용 안 함)
 * 예외는 계획 기간 안에서만 유효. 기간 밖 예외는 고아로 따로 보고(적용하지 않음).
 * exclude가 include를 이긴다(같은 날 둘 다 있으면 불참) — 중복 입력 방어 */
WD.expandPlan = function (plan, exceptions, range) {
  var res = { dates: [], added: [], removed: [], invalid: null, orphans: [] };
  if (plan.end_date < plan.start_date) { res.invalid = "end<start"; return res; }
  var from = range && range.start ? (range.start > plan.start_date ? range.start : plan.start_date) : plan.start_date;
  var to = range && range.end ? (range.end < plan.end_date ? range.end : plan.end_date) : plan.end_date;
  var mine = (exceptions || []).filter(function (x) { return x.plan_id === plan.id; });
  mine.forEach(function (x) { if (x.date < plan.start_date || x.date > plan.end_date) res.orphans.push(x); });
  if (!plan.weekdays || plan.weekdays.length === 0) { res.invalid = "weekdays-empty"; return res; }

  var base = {};
  WD.eachDate(from, to).forEach(function (d) { if (plan.weekdays.indexOf(WD.weekdayISO(d)) !== -1) base[d] = true; });
  var inRange = function (d) { return d >= from && d <= to && d >= plan.start_date && d <= plan.end_date; };
  mine.forEach(function (x) {
    if (!inRange(x.date)) return;
    if (x.type === "include" && !base[x.date]) { base[x.date] = true; res.added.push(x.date); }
  });
  mine.forEach(function (x) {
    if (!inRange(x.date)) return;
    if (x.type === "exclude" && base[x.date]) { delete base[x.date]; res.removed.push(x.date); if (res.added.indexOf(x.date) !== -1) res.added.splice(res.added.indexOf(x.date), 1); }
  });
  res.dates = Object.keys(base).sort();
  res.added.sort(); res.removed.sort();
  return res;
};

/* ── 불변식 위반 수집 (인스펙터 '충돌' 섹션·확인 필요 산식의 입력) ── */
WD.orphanExceptions = function () {
  var byId = {}; WD.plans.forEach(function (p) { byId[p.id] = p; });
  return WD.exceptions.filter(function (x) {
    var p = byId[x.plan_id]; return p && (x.date < p.start_date || x.date > p.end_date);
  });
};
WD.overlapConflicts = function () {
  var out = [];
  for (var i = 0; i < WD.plans.length; i++) for (var j = i + 1; j < WD.plans.length; j++) {
    var a = WD.plans[i], b = WD.plans[j];
    if (a.event_id === b.event_id && a.vendor_id === b.vendor_id &&
        a.start_date <= b.end_date && b.start_date <= a.end_date) out.push([a, b]);
  }
  return out;
};
WD.invalidPlans = function () {
  return WD.plans.filter(function (p) { return !p.weekdays || p.weekdays.length === 0 || p.end_date < p.start_date; });
};

/* ── 날짜별 참가 업체 (월간 셀·기간표 셀의 유일한 출처) ─────────────── */
WD.vendorById = function (id) { for (var i = 0; i < WD.vendors.length; i++) if (WD.vendors[i].id === id) return WD.vendors[i]; return null; };
WD.eventById = function (id) { for (var i = 0; i < WD.events.length; i++) if (WD.events[i].id === id) return WD.events[i]; return null; };
WD.planById = function (id) { for (var i = 0; i < WD.plans.length; i++) if (WD.plans[i].id === id) return WD.plans[i]; return null; };

/* state: confirmed | changed(이 날짜만 변경) | needs_attention | cancelled(이 날만 불참) */
WD.participationsOn = function (date, eventId) {
  var out = [];
  WD.plans.forEach(function (p) {
    if (eventId && p.event_id !== eventId) return;
    var r = WD.expandPlan(p, WD.exceptions, { start: date, end: date });
    var v = WD.vendorById(p.vendor_id);
    if (!v) return;
    if (r.dates.indexOf(date) !== -1) {
      var st = r.added.indexOf(date) !== -1 ? "changed"
             : (p.status === "needs_confirmation" || v.status === "needs_confirmation") ? "needs_attention"
             : "confirmed";
      out.push({ vendor: v, plan: p, state: st, exception: r.added.indexOf(date) !== -1 });
    } else if (r.removed.indexOf(date) !== -1) {
      out.push({ vendor: v, plan: p, state: "cancelled", exception: true, ghost: "참가" });
    }
  });
  out.sort(function (a, b) { return a.vendor.name.localeCompare(b.vendor.name, "ko"); });
  return out;
};

/* ── 파생 지표 (정오표 F18/F22 기본값 — 시안이 하드코딩하는 기본값 ③) ──
 * 오늘 N        = 그 날짜의 Task 수(category 무관)
 * 확인 필요 N   = 오늘 Task(status=needs_confirmation) ∪ 고아 예외 ∪ 중첩 계획 충돌 ∪ 무효 계획 */
WD.tasksOn = function (date) { return WD.tasks.filter(function (t) { return t.date === date; }).sort(function (a, b) { return WD.cmp(a.time, b.time); }); };
WD.derived = function (date) {
  var ts = WD.tasksOn(date);
  var needTask = ts.filter(function (t) { return t.status === "needs_confirmation"; });
  var structural = WD.orphanExceptions().length + WD.overlapConflicts().length + WD.invalidPlans().length;
  var next = null;
  for (var i = 0; i < ts.length; i++) if (ts[i].time >= WD.NOW) { next = ts[i]; break; }
  return { date: date, count: ts.length, needs: needTask.length + structural, needsTask: needTask.length, structural: structural, tasks: ts, next: next || ts[ts.length - 1] || null };
};
/* 다음 참가/일정이 있는 날 (빈 상태 문구 "다음 9/12(금) 고성청과"의 출처) */
WD.nextBusyDay = function (from) {
  for (var i = 1; i <= 60; i++) {
    var d = WD.addDays(from, i);
    if (WD.tasksOn(d).length) return { date: d, label: WD.tasksOn(d)[0].title };
    var ps = WD.participationsOn(d);
    if (ps.length) return { date: d, label: ps[0].vendor.name };
  }
  return null;
};

/* ── 모노그램: 법인격 접두어 제거 → 1음절 → 충돌 시 2음절 ────────────── */
WD.PREFIX = ["주식회사", "㈜", "(주)", "농업회사법인", "영농조합법인", "합자회사", "유한회사", "사단법인", "재단법인"];
WD.stripPrefix = function (name) {
  var s = name;
  for (var i = 0; i < WD.PREFIX.length; i++) {
    if (s.indexOf(WD.PREFIX[i]) === 0) { s = s.slice(WD.PREFIX[i].length); break; }
  }
  return s.replace(/^[\s·]+/, "");
};
WD.monogramMap = function () {
  var one = {}, base = {};
  WD.vendors.forEach(function (v) { var s = WD.stripPrefix(v.name); base[v.id] = s; one[s.slice(0, 1)] = (one[s.slice(0, 1)] || 0) + 1; });
  var map = {};
  WD.vendors.forEach(function (v) {
    var s = base[v.id], g = s.slice(0, 1);
    map[v.id] = one[g] > 1 ? s.slice(0, 2) : g;
  });
  return map;
};

/* ── 표기 (토큰 date_format 그대로. Intl 미사용 — 헤드리스·로케일 무관 결정성) ── */
WD.fmt = {
  widget: function (d) { var p = d.split("-"); return (+p[1]) + "월 " + (+p[2]) + "일 (" + WD.WD_KO[WD.weekdayISO(d) - 1] + ")"; },
  cell: function (d) { return String(+d.split("-")[2]); },
  header: function (d) { var p = d.split("-"); return (+p[2]) + "(" + WD.WD_KO[WD.weekdayISO(d) - 1] + ")"; },
  inspector: function (d) { var p = d.split("-"); return p[0] + "년 " + (+p[1]) + "월 " + (+p[2]) + "일 (" + WD.WD_KO[WD.weekdayISO(d) - 1] + ")"; },
  short: function (d) { var p = d.split("-"); return (+p[1]) + "/" + (+p[2]) + "(" + WD.WD_KO[WD.weekdayISO(d) - 1] + ")"; },
  md: function (d) { var p = d.split("-"); return (+p[1]) + "/" + (+p[2]); },
  range: function (a, b) { return WD.fmt.md(a) + "–" + WD.fmt.md(b); },
  /* 상대+절대 병기(U8): ISO 노출 금지 */
  rel: function (d, time) {
    if (d === WD.TODAY) return "오늘 " + time;
    if (d === WD.addDays(WD.TODAY, 1)) return "내일 " + time;
    return WD.fmt.short(d) + " " + time;
  }
};

/* ── 요약 문법: 결론형 자동 생성. 수동 작성 금지(spec:61) ──────────── */
WD.summary = {
  weekdays: function (ws) { return ws.slice().sort().map(function (w) { return WD.WD_KO[w - 1]; }).join("·"); },
  plan: function (plan) {
    var r = WD.expandPlan(plan, WD.exceptions, null);
    if (r.invalid === "weekdays-empty") return "참가 요일 없음 — 참가일 0일 · 확인 필요";
    if (r.invalid) return "기간 입력 오류 · 확인 필요";
    var ex = WD.exceptions.filter(function (x) { return x.plan_id === plan.id; });
    var exs = ex.map(function (x) { return WD.fmt.md(x.date) + (x.type === "exclude" ? " 제외" : " 추가"); }).join(" · ");
    return WD.summary.weekdays(plan.weekdays) + " 참가 · " + r.dates.length + "일 · 첫 " + WD.fmt.md(r.dates[0]) +
           " · 마지막 " + WD.fmt.md(r.dates[r.dates.length - 1]) + (exs ? " · " + exs : "");
  },
  day: function (date) {
    var d = WD.derived(date);
    if (d.count === 0) {
      var n = WD.nextBusyDay(date);
      return n ? "오늘 일정 없음 · 다음 " + WD.fmt.short(n.date) + " " + n.label : "오늘 일정 없음";
    }
    return d.needsTask > 0 ? "오늘 " + d.count + "건 중 " + d.needsTask + "건 확인 필요" : "오늘 " + d.count + "건 · 확인 필요 없음";
  }
};

WD.STATUS_KO = { confirmed: "확정", needs_attention: "확인 필요", changed: "이 날짜만 변경", cancelled: "불참", linked: "연결됨" };
WD.STATUS_CELL = { confirmed: "확정", needs_attention: "확인 필요", changed: "변경됨", cancelled: "불참", linked: "연결됨" };
