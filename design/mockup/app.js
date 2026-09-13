/* 시안 렌더러 — 화면의 모든 참가일·건수·요약은 expand.js가 계산한 값이다(손으로 적은 숫자 0).
 * classic script(file:// 더블클릭 지원) · 난수 0 · setInterval 0 · 외부 요청 0 */
(function () {
  "use strict";
  var W = window.WD, H = document.documentElement;

  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function add(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
  function mask(phone) { return phone.replace(/(\d{3})-(\d{4})-(\d{4})/, "$1-****-$3"); }

  /* ── font-guard: 스택에서 실제로 렌더된 서체를 판정해 기록(G2-3) ───── */
  function detectFont() {
    var probe = "고성수산 0123 AW", c = document.createElement("canvas").getContext("2d");
    function width(fam) { c.font = '16px ' + fam; return c.measureText(probe).width; }
    var ghost = width('"__wd_absent__"');
    var stack = ['"Malgun Gothic"', '"맑은 고딕"', '"Segoe UI Variable Text"', '"Segoe UI"', '"NanumGothic"', '"Noto Sans KR"'];
    for (var i = 0; i < stack.length; i++) {
      if (Math.abs(width(stack[i] + ', "__wd_absent__"') - ghost) > 0.5) return stack[i].replace(/"/g, "");
    }
    return "sans-serif(대체)";
  }

  /* ════ Layer 0 ════════════════════════════════════════════════════ */
  function widget(state, opts) {
    opts = opts || {};
    var date = opts.date || W.TODAY, d = W.derived(date);
    var w = el("button", "w");
    w.setAttribute("data-state", state);
    w.type = "button";
    var full = W.fmt.inspector(date) + ", 오늘 일정 " + d.count + "건, 확인 필요 " + d.needsTask + "건" +
               (d.next ? ", 다음 " + d.next.time + " " + d.next.title : ", 다음 일정 없음");
    w.setAttribute("aria-label", full);

    var left = el("div");
    var p = date.split("-");
    add(left, el("div", "w-date", (+p[1]) + "월 " + (+p[2]) + "일"), el("div", "w-dow", "(" + W.WD_KO[W.weekdayISO(date) - 1] + ")"));

    var right = el("div", "w-right");
    if (opts.error) {
      add(right, el("div", "w-err", "데이터를 열 수 없음 · 클릭해 자세히"));
    } else if (d.count === 0) {
      var n = W.nextBusyDay(date);
      var nx = el("div", "w-next");
      nx.appendChild(el("span", "n", "오늘 일정 없음"));
      var sub0 = el("div", "w-sub", n ? "다음 " + W.fmt.short(n.date) + " " + n.label : "예정된 일정 없음");
      if (n) sub0.title = "다음 " + W.fmt.inspector(n.date) + " " + n.label;
      add(right, nx, sub0);
    } else {
      var counts = el("div", "w-counts");
      var b = el("b", null, d.count + "건"); counts.appendChild(b);
      counts.appendChild(el("span", null, "·"));
      var nd = el("span", "w-needs");
      add(nd, el("span", "mk mk-needs"), el("span", null, "확인 " + d.needsTask));
      counts.appendChild(nd);
      var next = el("div", "w-next");
      var mainLabel = d.next.vendor_id ? W.vendorById(d.next.vendor_id).name : d.next.title;
      var nEl = el("span", "n", mainLabel); nEl.title = mainLabel;
      add(next, el("span", "t num", d.next.time), nEl);
      var sub = el("div", "w-sub", d.next.vendor_id ? d.next.title : (W.eventById(d.next.event_id) ? W.eventById(d.next.event_id).name : ""));
      add(right, counts, next, sub);
    }
    add(w, left, right);

    var cmds = el("div", "w-cmds");
    add(cmds, el("span", "kbd", "Ctrl+Alt+D"), el("span", "kbd", "N"));
    w.appendChild(cmds);
    var lock = el("div", "w-lock");
    lock.appendChild(lockGlyph());
    w.appendChild(lock);
    var mode = el("div", "w-mode", "위치 조정");
    mode.title = "방향키 1px · Shift+방향키 8px · Enter 저장 · Esc 취소·원위치";
    w.appendChild(mode);
    var hd = el("div", "w-handle"); hd.appendChild(handleGlyph()); w.appendChild(hd);
    w.addEventListener("click", function () { go(1); });
    return w;
  }
  /* 아이콘 자리표시(기하 SVG). 단계 2에서 Fluent System Icons regular/filled로 교체 — 이모지 금지 */
  function svg(d, size) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("width", size || 12); s.setAttribute("height", size || 12); s.setAttribute("viewBox", "0 0 12 12");
    s.setAttribute("fill", "none"); s.setAttribute("aria-hidden", "true");
    var pth = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pth.setAttribute("d", d); pth.setAttribute("stroke", "currentColor"); pth.setAttribute("stroke-width", "1");
    s.appendChild(pth); return s;
  }
  function lockGlyph() { return svg("M3.5 5.5V4a2.5 2.5 0 015 0v1.5M2.5 5.5h7v5h-7z"); }
  function handleGlyph() { return svg("M5 2v8M7 2v8"); }

  function renderL0() {
    var box = document.getElementById("l0-specimens"); box.textContent = "";
    [["rest", "rest — 평소 상태. 테두리·그림자·버튼 0"],
     ["hover", "hover/focus — 예약 슬롯에 명령 2개만 opacity 100ms"],
     ["locked", "Locked — 클릭 통과 중. 표시는 잠금 글리프 하나"],
     ["edit", "Layout Edit — 1px 경계 + 핸들 + 모드 라벨"]
    ].forEach(function (s) {
      var f = el("figure", "specimen"); f.style.margin = "0";
      var desk = el("div", "desk"); desk.appendChild(widget(s[0]));
      add(f, desk, el("figcaption", null, s[1])); box.appendChild(f);
    });
    [["2026-09-27", "빈 상태 — 빈 위젯은 존재하지 않는다. 다음으로 유용한 사실을 쓴다"],
     ["2026-10-10", "23건인 날 — 숫자가 늘어도 조판이 흔들리지 않는다"]
    ].forEach(function (s) {
      var f = el("figure", "specimen"); f.style.margin = "0";
      var desk = el("div", "desk"); desk.appendChild(widget("rest", { date: s[0] }));
      add(f, desk, el("figcaption", null, s[1])); box.appendChild(f);
    });
    var f2 = el("figure", "specimen"); f2.style.margin = "0";
    var d2 = el("div", "desk"); d2.appendChild(widget("rest", { error: true }));
    add(f2, d2, el("figcaption", null, "DB 오류 — 날짜는 계속 보이고 다음 행동을 말한다")); box.appendChild(f2);
  }

  /* ════ Layer 1 ════════════════════════════════════════════════════ */
  var MONO = W.monogramMap();
  function taskRow(t, sel) {
    var r = el("button", "row"); r.type = "button";
    if (sel) r.setAttribute("aria-selected", "true");
    var v = t.vendor_id ? W.vendorById(t.vendor_id) : null;
    r.appendChild(el("span", "time num", t.time));
    if (v) { var m = el("span", "mono", MONO[v.id]); m.title = v.name; r.appendChild(m); }
    else { r.appendChild(el("span", "office-mk")); }
    var nm = el("span", "name t-body", v ? v.name : t.title);
    nm.title = v ? v.name + " — " + t.title : t.title;
    r.appendChild(nm);
    var st = el("span", "st");
    var needs = t.status === "needs_confirmation";
    add(st, el("span", "mk " + (needs ? "mk-needs" : "mk-confirmed")), el("span", "st-label", needs ? "확인 필요" : "확정"));
    if (needs) { r.classList.add("rail-needs"); st.classList.add("st-needs"); }
    r.appendChild(st);
    var c = el("span", "cmds");
    var b1 = el("button", null, "확인"); b1.type = "button"; b1.title = "확인 처리 (Space) — 즉시 저장 후 되돌리기 8초";
    var b2 = el("button", null, "열기"); b2.type = "button"; b2.title = "인스펙터에서 열기 (Enter)";
    add(c, b1, b2); r.appendChild(c);
    return r;
  }
  function l1(date, caption) {
    var d = W.derived(date);
    var box = el("section", "l1");
    add(box, el("h3", null, W.summary.day(date)), el("p", "sub", W.fmt.inspector(date) + " · " + W.NOW + " 기준"));
    var sc = el("div", "scroll");
    if (d.count === 0) {
      var e = el("div", "empty");
      var n = W.nextBusyDay(date);
      add(e, el("div", "lead", n ? "다음 " + W.fmt.short(n.date) + " " + n.label : "예정된 일정 없음"),
             el("div", "t-caption", "다음 3건을 아래에 보여줍니다"));
      sc.appendChild(e);
      var shown = 0;
      sc.appendChild(el("div", "sec-label", "다음 일정"));
      for (var i = 1; i <= 40 && shown < 3; i++) {
        var dd = W.addDays(date, i), ts = W.tasksOn(dd);
        if (!ts.length) continue;
        var nx = el("div", "rows");
        for (var j = 0; j < ts.length && shown < 3; j++) { nx.appendChild(taskRow(ts[j])); shown++; }
        sc.appendChild(el("div", "sec-label", W.fmt.short(dd)));
        sc.appendChild(nx);
      }
    } else {
      var needs = d.tasks.filter(function (t) { return t.status === "needs_confirmation"; });
      var rest = d.tasks.filter(function (t) { return t.status !== "needs_confirmation"; });
      if (needs.length) {
        var r1 = el("div", "rows");
        needs.forEach(function (t, i) { r1.appendChild(taskRow(t, i === 0)); });
        add(sc, el("div", "sec-label", "확인 · 연락 필요 " + needs.length), r1);
      }
      var r2 = el("div", "rows");
      rest.forEach(function (t) { r2.appendChild(taskRow(t)); });
      add(sc, el("div", "sec-label", "오늘 나머지 " + rest.length), r2);
      var st = W.orphanExceptions().length + W.overlapConflicts().length + W.invalidPlans().length;
      if (st) {
        var r0 = el("div", "rows");
        W.orphanExceptions().forEach(function (x) {
          var p = W.planById(x.plan_id), v = W.vendorById(p.vendor_id);
          var r = el("button", "row rail-needs"); r.type = "button";
          add(r, el("span", "time", ""), el("span", "mono", MONO[v.id]),
                 (function () { var t = v.name + " — 계획 밖 예외 " + W.fmt.short(x.date); var n2 = el("span", "name t-body", t); n2.title = t + " (계획 기간 " + W.fmt.range(p.start_date, p.end_date) + " 밖)"; return n2; })());
          var s2 = el("span", "st st-needs"); add(s2, el("span", "mk mk-needs"), el("span", "st-label", "확인 필요")); r.appendChild(s2);
          r.appendChild(el("span", "cmds")); r0.appendChild(r);
        });
        W.overlapConflicts().forEach(function (pr) {
          var v = W.vendorById(pr[0].vendor_id);
          var r = el("button", "row rail-needs"); r.type = "button";
          add(r, el("span", "time", ""), el("span", "mono", MONO[v.id]),
                 (function () { var t = v.name + " — 기간이 겹치는 계획 2건"; var n2 = el("span", "name t-body", t); n2.title = t + ": " + W.fmt.range(pr[0].start_date, pr[0].end_date) + " / " + W.fmt.range(pr[1].start_date, pr[1].end_date); return n2; })());
          var s2 = el("span", "st st-needs"); add(s2, el("span", "mk mk-needs"), el("span", "st-label", "확인 필요")); r.appendChild(s2);
          r.appendChild(el("span", "cmds")); r0.appendChild(r);
        });
        W.invalidPlans().forEach(function (p) {
          var v = W.vendorById(p.vendor_id);
          var r = el("button", "row rail-needs"); r.type = "button";
          add(r, el("span", "time", ""), el("span", "mono", MONO[v.id]),
                 (function () { var t = v.name + " — 참가 요일 0개(참가일 계산 불가)"; var n2 = el("span", "name t-body", t); n2.title = t; return n2; })());
          var s2 = el("span", "st st-needs"); add(s2, el("span", "mk mk-needs"), el("span", "st-label", "확인 필요")); r.appendChild(s2);
          r.appendChild(el("span", "cmds")); r0.appendChild(r);
        });
        add(sc, el("div", "sec-label", "날짜와 무관한 충돌 " + st + " — 오늘 건수에 포함되지 않습니다"), r0);
      }
      var ps = W.participationsOn(date);
      if (ps.length) {
        var r3 = el("div", "rows");
        ps.slice(0, 6).forEach(function (p) {
          var r = el("button", "row"); r.type = "button";
          r.appendChild(el("span", "time", ""));
          var m = el("span", "mono", MONO[p.vendor.id]); m.title = p.vendor.name; r.appendChild(m);
          var nm = el("span", "name t-body", p.vendor.name); nm.title = p.vendor.name;
          if (p.state === "cancelled") nm.classList.add("is-cancelled");
          r.appendChild(nm);
          var st = el("span", "st");
          add(st, el("span", "mk mk-" + (p.state === "needs_attention" ? "needs" : p.state)),
                  el("span", "st-label", W.STATUS_CELL[p.state === "needs_attention" ? "needs_attention" : p.state]));
          r.appendChild(st); r.appendChild(el("span", "cmds"));
          r3.appendChild(r);
        });
        add(sc, el("div", "sec-label", "오늘 참가 업체 " + ps.length + "곳"), r3);
      }
    }
    box.appendChild(sc);
    var f = el("footer");
    var cta = el("button", "btn btn-primary", "캘린더 열기"); cta.type = "button";
    cta.addEventListener("click", function () { go(2); });
    var qa = el("button", "btn", "일정 추가"); qa.type = "button";
    add(f, cta, qa, el("span", "kbd spacer", "Ctrl+2"), el("span", "kbd", "Ctrl+N"), el("span", "kbd", "Ctrl+K"));
    box.appendChild(f);
    var fig = el("figure", "specimen"); fig.style.margin = "0";
    add(fig, box, el("figcaption", null, caption));
    return fig;
  }
  function quickAdd() {
    var q = el("section", "qa");
    add(q, el("div", "t-caption", "일정 추가 — 비모달. 제목 + 일시만으로 저장"));
    var l = el("label", null, "제목"); q.appendChild(l);
    var i = el("input"); i.value = "부스 전기인입 재협의"; i.setAttribute("aria-label", "제목"); q.appendChild(i);
    var g = el("div", "grid2");
    var d1 = el("div"), d2 = el("div");
    add(d1, el("label", null, "날짜"), (function () { var x = el("input"); x.value = "2026-09-24"; x.type = "text"; x.setAttribute("aria-label", "날짜"); return x; })());
    add(d2, el("label", null, "시각 (5분 단위 · 빈 값 = 종일)"), (function () { var x = el("input"); x.value = "15:30"; x.setAttribute("aria-label", "시각"); return x; })());
    add(g, d1, d2); q.appendChild(g);
    q.appendChild(el("div", "t-caption", "연결… (업체 · 행사 — 선택)"));
    q.appendChild(el("div", "echo", "→ 9월 24일 (목) 15:30 · 업체 연결 없음 · 가을 직거래장터"));
    var f = el("footer");
    var s = el("button", "btn btn-primary", "저장"); s.type = "button";
    var c = el("button", "btn", "취소"); c.type = "button";
    add(f, s, c, el("span", "kbd spacer", "Enter"), el("span", "kbd", "Ctrl+Enter"), el("span", "kbd", "Esc"));
    q.appendChild(f);
    q.appendChild(el("div", "t-caption", "한글 조합 중 Enter는 무시 — compositionend 이후에만 저장"));
    var fig = el("figure", "specimen"); fig.style.margin = "0";
    add(fig, q, el("figcaption", null, "Quick Add — 입력 아래 해석 결과가 상시 보인다(저장 전에 무엇이 저장되는지 읽게 한다)"));
    return fig;
  }
  function renderL1() {
    var box = document.getElementById("l1-specimens"); box.textContent = "";
    add(box, l1(W.TODAY, "오늘 7건 · 확인 필요 3 — 기본 상태"),
             l1("2026-09-27", "0건 — 빈 상태는 '다음 3건'을 대신 보여준다"),
             l1("2026-10-10", "23건 — 가상 스크롤 · 페이지네이션 없음"),
             quickAdd());
  }
  /* ════ Layer 2 — 월간 / 주간 / 기간표 ════════════════════════════ */
  var MONTH = "2026-09";
  function monthDays(ym) {
    var p = ym.split("-"), first = ym + "-01";
    var lastDay = new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate();
    var last = ym + "-" + String(lastDay).padStart(2, "0");
    var gridStart = W.addDays(first, -(W.weekdayISO(first) - 1));          // 주 시작 = 월 (기본값 ①)
    var gridEnd = W.addDays(last, 7 - W.weekdayISO(last));
    return { first: first, last: last, start: gridStart, end: gridEnd, dates: W.eachDate(gridStart, gridEnd) };
  }
  function cellItems(date) {
    var ps = W.participationsOn(date).map(function (p) { return { kind: "v", name: p.vendor.name, state: p.state, vid: p.vendor.id }; });
    var ts = W.tasksOn(date).map(function (t) { return { kind: "o", name: t.title, state: t.status === "needs_confirmation" ? "needs_attention" : "confirmed" }; });
    return ts.concat(ps);
  }
  function renderMonth() {
    var m = monthDays(MONTH), box = el("div");
    var grid = el("div", "month-grid");
    W.WD_KO.forEach(function (w) { grid.appendChild(el("div", "dow", w)); });
    /* 주별 최대 항목 수로 2열·행 성장 임계 판정 (grid: 9곳↑ 2열 / 17곳↑ 행 성장) */
    var weekMax = {};
    m.dates.forEach(function (d, i) { var wk = Math.floor(i / 7); var n = cellItems(d).length; if (n > (weekMax[wk] || 0)) weekMax[wk] = n; });
    m.dates.forEach(function (d, i) {
      var wk = Math.floor(i / 7), items = cellItems(d), wd = W.weekdayISO(d);
      var c = el("button", "cell"); c.type = "button";
      if (i % 7 === 0) c.classList.add("wk-start");
      if (wd >= 6) c.classList.add("weekend");
      if (d === W.TODAY) c.classList.add("today");
      if (d < m.first || d > m.last) c.classList.add("other");
      if (d === SEL.date) c.setAttribute("aria-selected", "true");
      /* 2열은 '이름이 들어갈 폭이 있을 때'만. 토큰의 임계(9곳)만 보고 2열로 접으면
       * 18자 업체명이 2~3자로 잘려 +N more와 같은 실패가 된다 — 이 시안에서 실측으로 드러난 것. */
      var longest = 0; items.forEach(function (it) { if (it.name.length > longest) longest = it.name.length; });
      if (items.length >= 9 && longest <= 7) c.classList.add("two");
      c.appendChild(el("span", "d", W.fmt.cell(d)));
      var ul = el("ul");
      items.forEach(function (it) {
        var li = el("li");
        li.appendChild(el("span", "mk mk-" + (it.state === "needs_attention" ? "needs" : it.state)));
        var nm = el("span", "name", it.name); nm.title = it.name;
        if (it.state === "cancelled") nm.classList.add("is-cancelled");
        li.appendChild(nm); ul.appendChild(li);
      });
      c.appendChild(ul);
      if (weekMax[wk] >= 17 && i % 7 === 6) {
        var mh = el("button", "more-hint", "이 주를 기간표에서 보기");
        mh.type = "button";
        mh.addEventListener("click", function (e) { e.stopPropagation(); H.dataset.view = "matrix"; draw(); rove(); });
        c.appendChild(mh);
      }
      c.addEventListener("click", function () { SEL = { date: d, vendor: items[0] && items[0].vid ? items[0].vid : SEL.vendor }; draw(); });
      grid.appendChild(c);
    });
    box.appendChild(grid);
    var twoCols = grid.querySelectorAll(".cell.two").length;
    box.appendChild(el("p", "t-caption", "주 최대 항목 " + Object.keys(weekMax).map(function (k) { return weekMax[k]; }).join(" / ") +
      " — 9곳↑이고 그 칸의 가장 긴 이름이 7자 이하일 때만 2열(이번 달 " + twoCols + "칸). 그 밖에는 1열 전체폭 + 주 행 성장. " +
      "'+N 외'는 어디에도 없고, 이름을 2~3자로 자르는 것도 같은 실패로 본다."));
    return box;
  }
  function renderWeek() {
    var base = SEL.date || W.TODAY;
    var start = W.addDays(base, -(W.weekdayISO(base) - 1)), dates = W.eachDate(start, W.addDays(start, 6));
    var box = el("div"), grid = el("div", "month-grid");
    dates.forEach(function (d) { grid.appendChild(el("div", "dow" + (d === W.TODAY ? " today" : ""), W.fmt.header(d))); });
    dates.forEach(function (d, i) {
      var items = cellItems(d), wd = W.weekdayISO(d);
      var c = el("button", "cell"); c.type = "button"; c.style.minBlockSize = "260px";
      if (i === 0) c.classList.add("wk-start");
      if (wd >= 6) c.classList.add("weekend");
      if (d === W.TODAY) c.classList.add("today");
      if (d === SEL.date) c.setAttribute("aria-selected", "true");
      var ul = el("ul");
      items.forEach(function (it) {
        var li = el("li");
        li.appendChild(el("span", "mk mk-" + (it.state === "needs_attention" ? "needs" : it.state)));
        var nm = el("span", "name", it.name); nm.title = it.name;
        if (it.state === "cancelled") nm.classList.add("is-cancelled");
        li.appendChild(nm); ul.appendChild(li);
      });
      c.appendChild(ul);
      c.addEventListener("click", function () { SEL = { date: d, vendor: SEL.vendor }; draw(); });
      grid.appendChild(c);
    });
    box.appendChild(grid);
    box.appendChild(el("p", "t-caption", "주간 — 같은 업체명을 같은 x에서 읽는다. 시간 그리드가 아니라 '누가 오는가'가 축이다."));
    return box;
  }
  function renderMatrix() {
    var m = monthDays(MONTH), dates = W.eachDate(m.first, m.last);
    /* 계획 있는 업체만, 업체명 가나다 */
    var ids = {}; W.plans.forEach(function (p) { if (p.start_date <= m.last && p.end_date >= m.first) ids[p.vendor_id] = true; });
    var vs = W.vendors.filter(function (v) { return ids[v.id]; }).sort(function (a, b) { return a.name.localeCompare(b.name, "ko"); });
    /* 날짜별 상태 맵을 한 번만 계산 */
    var cellState = {};
    dates.forEach(function (d) {
      W.participationsOn(d).forEach(function (p) { cellState[p.vendor.id + "|" + d] = p.state; });
    });
    var wrap = el("div", "matrix-wrap"), t = el("table", "matrix");
    t.setAttribute("role", "grid");
    t.setAttribute("aria-label", "업체 × 날짜 기간표");
    /* 헤더 2행: 32px 열에 'd(E)'는 들어가지 않는다 → 요일 1자 행 + 날짜 숫자 행으로 분리 */
    var thead = el("thead");
    var r1 = el("tr", "dowrow"), r2 = el("tr", "dayrow");
    var c1 = el("th", "vcol", "업체 " + vs.length + "곳"); c1.setAttribute("scope", "col"); c1.rowSpan = 2; r1.appendChild(c1);
    dates.forEach(function (d) {
      var wd = W.weekdayISO(d);
      var a = el("th", null, W.WD_KO[wd - 1]); a.setAttribute("scope", "col"); a.setAttribute("aria-label", W.fmt.header(d));
      var b = el("th", null, W.fmt.cell(d)); b.setAttribute("scope", "col"); b.setAttribute("aria-hidden", "true");
      [a, b].forEach(function (th) {
        if (wd === 1) th.classList.add("wk-start");
        if (wd >= 6) th.classList.add("weekend");
        if (d === W.TODAY) th.classList.add("today");
      });
      r1.appendChild(a); r2.appendChild(b);
    });
    add(thead, r1, r2); t.appendChild(thead);
    var tb = el("tbody");
    vs.forEach(function (v) {
      var tr = el("tr"); tr.setAttribute("role", "row");
      var th = el("th", "vcol"); th.setAttribute("scope", "row");
      var nm = el("span", "nm", v.name); nm.title = v.name; th.appendChild(nm);
      tr.appendChild(th);
      dates.forEach(function (d) {
        var td = el("td"); td.setAttribute("role", "gridcell"); td.tabIndex = -1;
        var wd = W.weekdayISO(d);
        if (wd === 1) td.classList.add("wk-start");
        if (wd >= 6) td.classList.add("weekend");
        if (d === W.TODAY) td.classList.add("today");
        var st = cellState[v.id + "|" + d];
        if (st) {
          td.appendChild(el("span", "mk mk-" + (st === "needs_attention" ? "needs" : st)));
          td.setAttribute("aria-label", W.fmt.header(d) + " " + v.name + " " + W.STATUS_CELL[st]);
          td.title = W.fmt.inspector(d) + " · " + v.name + " · " + W.STATUS_KO[st];
        } else { td.setAttribute("aria-label", W.fmt.header(d) + " " + v.name + " 참가 없음"); }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t);
    var box = el("div"); box.appendChild(wrap);
    box.appendChild(el("p", "t-caption", "기간표 — 셀 테두리 없음(주 경계·오늘·주말 열 배경만). 방향키 셀 이동 · Enter 인스펙터 · Space는 '이 날짜만 변경' 대화상자를 연다(즉시 저장 아님). 색 범례를 상시 노출하지 않는다 — 마커 모양이 1차 신호다."));
    return box;
  }
  function renderCmdRow() {
    var row = document.getElementById("cmdrow"); row.textContent = "";
    var tabs = el("div", "tabs");
    [["month", "월간", "1"], ["week", "주간", "2"], ["matrix", "기간표", "3"]].forEach(function (v) {
      var b = el("button", "tab", v[1]); b.type = "button"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", H.dataset.view === v[0] ? "true" : "false");
      b.addEventListener("click", function () { H.dataset.view = v[0]; draw(); });
      tabs.appendChild(b);
    });
    var nav = el("div", "nav");
    var prev = el("button", "icon-btn", "◀"); prev.type = "button"; prev.setAttribute("aria-label", "이전 달");
    var next = el("button", "icon-btn", "▶"); next.type = "button"; next.setAttribute("aria-label", "다음 달");
    var today = el("button", "btn", "오늘"); today.type = "button";
    var mp = MONTH.split("-");
    prev.addEventListener("click", function () { MONTH = shiftMonth(-1); draw(); });
    next.addEventListener("click", function () { MONTH = shiftMonth(1); draw(); });
    today.addEventListener("click", function () { MONTH = W.TODAY.slice(0, 7); SEL = { date: W.TODAY, vendor: SEL.vendor }; draw(); });
    add(nav, prev, el("span", "month num", (+mp[0]) + "년 " + (+mp[1]) + "월"), next, today, el("span", "kbd", "T"));
    var rv = el("div", "reveal");
    add(rv, (function () { var b = el("button", "btn", "검색"); b.type = "button"; return b; })(), el("span", "kbd", "/"),
            (function () { var b = el("button", "btn", "명령"); b.type = "button"; return b; })(), el("span", "kbd", "Ctrl+K"));
    rv.style.display = "flex"; rv.style.gap = "var(--sp-4)"; rv.style.alignItems = "center";
    var insp = el("button", "btn", H.dataset.inspector === "on" ? "인스펙터 접기" : "인스펙터 펼치기"); insp.type = "button";
    insp.addEventListener("click", function () { H.dataset.inspector = H.dataset.inspector === "on" ? "off" : "on"; draw(); });
    var sp = el("span", "spacer");
    add(row, tabs, nav, rv, sp, insp, el("span", "kbd", "F6"));
  }
  function shiftMonth(n) {
    var p = MONTH.split("-"), y = +p[0], mm = +p[1] + n;
    if (mm < 1) { mm = 12; y--; } if (mm > 12) { mm = 1; y++; }
    return y + "-" + String(mm).padStart(2, "0");
  }

  /* ════ Layer 3 — Inspector ════════════════════════════════════════ */
  var SEL = { date: W.TODAY, vendor: "V01" };
  function renderInspector() {
    var box = document.getElementById("l3"); box.textContent = "";
    var v = W.vendorById(SEL.vendor), date = SEL.date;
    if (!v) { box.appendChild(el("p", "none", "날짜 · 업체 · 행사를 선택하면 여기에 표시됩니다.")); return; }
    box.appendChild(el("div", "ent", v.name));
    box.appendChild(el("div", "t-caption", W.fmt.inspector(date) + " 선택"));
    var dup = W.vendors.filter(function (x) { return x.name === v.name; }).length > 1;
    if (dup) {
      var mb = el("div", "msgbar"); mb.style.marginBlockStart = "var(--sp-8)";
      add(mb, el("span", null, "같은 이름 1곳 있음 — 모노그램이 2음절(" + MONO[v.id] + ")로 승격되었습니다."),
              (function () { var a = el("a", null, "기존 업체 열기"); a.href = "#"; return a; })());
      box.appendChild(mb);
    }
    var s1 = el("div", "sec");
    s1.appendChild(el("div", "lbl", "기본 정보"));
    var dl = el("dl");
    add(dl, el("dt", null, "담당자"), el("dd", "t-body", v.contact_name),
            el("dt", null, "연락처"), (function () { var d = el("dd", "t-body num", mask(v.contact_phone)); d.title = "기본 마스킹 — 명시 조작 시 원문"; return d; })(),
            el("dt", null, "품목"), el("dd", "t-body", v.products.join(" · ")));
    s1.appendChild(dl); box.appendChild(s1);

    var plans = W.plans.filter(function (p) { return p.vendor_id === v.id; });
    plans.forEach(function (p) {
      var ev = W.eventById(p.event_id), r = W.expandPlan(p, W.exceptions, null);
      var s = el("div", "sec");
      s.appendChild(el("div", "lbl", "참가계획 — " + ev.name));
      s.appendChild(el("div", "sum", W.summary.plan(p)));
      s.appendChild(el("div", "t-caption", "기간 " + W.fmt.range(p.start_date, p.end_date) + " · 요일 " + (p.weekdays.length ? W.summary.weekdays(p.weekdays) : "없음")));
      var eb = el("button", "btn", "계획 편집"); eb.type = "button"; eb.style.marginBlockStart = "var(--sp-8)";
      eb.title = "전체 일정 변경의 유일한 진입점 — 날짜 셀 컨텍스트 메뉴에는 없다";
      s.appendChild(eb);
      if (r.dates.length) {
        var ul = el("ul", "list"); ul.style.marginBlockStart = "var(--sp-8)";
        r.dates.forEach(function (d) {
          var li = el("li");
          var left = el("span", "num", W.fmt.short(d));
          var tag = r.added.indexOf(d) !== -1 ? "이 날짜만 변경" : "확정";
          add(li, left, el("span", "t-caption", tag));
          ul.appendChild(li);
        });
        s.appendChild(el("div", "lbl", "참가일 " + r.dates.length + "일"));
        s.appendChild(ul);
      }
      box.appendChild(s);
    });

    /* 충돌 섹션 — 고아 예외 · 중첩 계획 · 무효 계획 */
    var orph = W.orphanExceptions().filter(function (x) { var p = W.planById(x.plan_id); return p && p.vendor_id === v.id; });
    var ovl = W.overlapConflicts().filter(function (pr) { return pr[0].vendor_id === v.id; });
    var inv = W.invalidPlans().filter(function (p) { return p.vendor_id === v.id; });
    var sc = el("div", "sec");
    sc.appendChild(el("div", "lbl", "충돌"));
    if (!orph.length && !ovl.length && !inv.length) sc.appendChild(el("div", "none", "없음"));
    orph.forEach(function (x) {
      var p = W.planById(x.plan_id);
      sc.appendChild(el("div", "conflict t-body", "계획 밖 예외 — " + W.fmt.short(x.date) + "는 계획 기간(" + W.fmt.range(p.start_date, p.end_date) + ") 밖입니다. 해결: 예외 삭제 또는 기간 연장"));
    });
    ovl.forEach(function (pr) { sc.appendChild(el("div", "conflict t-body", "같은 행사에 기간이 겹치는 계획 2건 — " + W.fmt.range(pr[0].start_date, pr[0].end_date) + " / " + W.fmt.range(pr[1].start_date, pr[1].end_date))); });
    inv.forEach(function (p) { sc.appendChild(el("div", "conflict t-body", "참가 요일이 0개 — 참가일이 계산되지 않습니다. 해결: 요일 1개 이상 선택")); });
    box.appendChild(sc);

    var sa = el("div", "sec");
    var atts = W.attachments.filter(function (a) { return a.owner_id === v.id; });
    sa.appendChild(el("div", "lbl", "첨부 " + atts.length + "개"));
    if (!atts.length) sa.appendChild(el("div", "none", "없음"));
    else {
      var ul2 = el("ul", "list");
      atts.forEach(function (a) {
        var li = el("li");
        add(li, el("span", null, a.filename), el("span", "t-caption num", a.missing ? "파일 없음 · 위치 찾기" : Math.round(a.file_size / 1024) + " KB"));
        if (a.missing) li.classList.add("conflict");
        ul2.appendChild(li);
      });
      sa.appendChild(ul2);
    }
    box.appendChild(sa);

    var sh = el("div", "sec");
    var logs = W.audit.filter(function (l) { return l.entity_id === v.id; });
    sh.appendChild(el("div", "lbl", "변경 이력 " + logs.length + "건"));
    var ul3 = el("ul", "list");
    logs.slice(0, 40).forEach(function (l) {
      var li = el("li");
      add(li, el("span", null, l.action + " · " + l.previous_value + " → " + l.new_value),
              el("span", "t-caption num", l.timestamp));
      ul3.appendChild(li);
    });
    sh.appendChild(ul3);
    sh.appendChild(el("div", "t-caption", "항목마다 [이 값으로 되돌리기] · 행위자 " + logs[0].actor + " 기록"));
    box.appendChild(sh);
  }

  function drawCal() {
    var c = document.getElementById("cal"); c.textContent = "";
    c.appendChild(H.dataset.view === "matrix" ? renderMatrix() : H.dataset.view === "week" ? renderWeek() : renderMonth());
  }

  /* ════ 대화상자 ═══════════════════════════════════════════════════ */
  function dlgPlanEdit() {
    var p = W.planById("P01"), v = W.vendorById(p.vendor_id), ev = W.eventById(p.event_id);
    var before = W.expandPlan(p, W.exceptions, null);
    var proposed = { id: p.id, event_id: p.event_id, vendor_id: p.vendor_id, start_date: p.start_date, end_date: p.end_date, weekdays: [4, 5] };
    var after = W.expandPlan(proposed, W.exceptions, null);
    var bset = {}; before.dates.forEach(function (d) { bset[d] = 1; });
    var aset = {}; after.dates.forEach(function (d) { aset[d] = 1; });
    var added = after.dates.filter(function (d) { return !bset[d]; });
    var removed = before.dates.filter(function (d) { return !aset[d]; });
    /* 같은 의미가 된 예외: 새 요일 집합에서 기준일이 아예 참가일이 아니게 된 exclude 예외 */
    var stale = W.exceptions.filter(function (x) {
      if (x.plan_id !== p.id) return false;
      return x.type === "exclude" && proposed.weekdays.indexOf(W.weekdayISO(x.date)) === -1;
    });

    var d = el("section", "dlg");
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "계획 편집");
    add(d, el("h4", null, "계획 편집 — " + v.name + " × " + ev.name),
           el("div", "scope", W.fmt.range(p.start_date, p.end_date) + " · " + before.dates.length + "일 · 현재 " + W.summary.weekdays(p.weekdays)));
    var body = el("div", "body");
    var fields = el("div"); fields.style.display = "grid"; fields.style.gap = "var(--sp-8)";
    var wk = el("div");
    wk.appendChild(el("div", "t-caption", "참가 요일 — 7개 토글(자유 입력 없음)"));
    var togg = el("div"); togg.style.display = "flex"; togg.style.gap = "var(--sp-4)"; togg.style.marginBlockStart = "var(--sp-4)";
    W.WD_KO.forEach(function (name, i) {
      var b = el("button", "tgl", name); b.type = "button";
      b.setAttribute("aria-pressed", proposed.weekdays.indexOf(i + 1) !== -1 ? "true" : "false");
      togg.appendChild(b);
    });
    wk.appendChild(togg);
    wk.appendChild(el("div", "t-caption", "변경: " + W.summary.weekdays(p.weekdays) + " → " + W.summary.weekdays(proposed.weekdays)));
    fields.appendChild(wk);
    body.appendChild(fields);

    var diff = el("div", "diff");
    var c1 = el("div", "col"), c2 = el("div", "col");
    c1.appendChild(el("div", "h", "추가되는 날 " + added.length + "일"));
    var u1 = el("ul"); added.forEach(function (x) { u1.appendChild(el("li", null, W.fmt.short(x))); }); c1.appendChild(u1);
    c2.appendChild(el("div", "h", "빠지는 날 " + removed.length + "일"));
    var u2 = el("ul"); removed.forEach(function (x) { u2.appendChild(el("li", "ghost", W.fmt.short(x))); }); c2.appendChild(u2);
    add(diff, c1, c2); body.appendChild(diff);

    if (stale.length) {
      var cf = el("div");
      cf.appendChild(el("div", "t-caption", "기존 예외 " + stale.length + "건이 의미를 잃습니다 — 선택 전에는 저장할 수 없습니다(기본 유지)"));
      stale.forEach(function (x) {
        var r = el("div"); r.style.display = "flex"; r.style.gap = "var(--sp-8)"; r.style.alignItems = "center"; r.style.marginBlockStart = "var(--sp-4)";
        var keep = el("button", "btn btn-primary", "유지"); keep.type = "button";
        var del = el("button", "btn", "삭제"); del.type = "button";
        add(r, el("span", "t-body", W.fmt.short(x.date) + " 불참 (" + x.reason + ")"), keep, del);
        cf.appendChild(r);
      });
      body.appendChild(cf);
    }
    d.appendChild(body);
    var f = el("footer");
    var cancel = el("button", "btn", "취소"); cancel.type = "button"; cancel.autofocus = true;
    var save = el("button", "btn btn-primary", "계획 저장 · +" + added.length + "일 −" + removed.length + "일"); save.type = "button";
    add(f, cancel, save, el("span", "kbd spacer", "Esc"));
    d.appendChild(f);
    var fig = el("figure", "specimen"); fig.style.margin = "0";
    add(fig, d, el("figcaption", null, "전체 일정 변경 — 진입점은 인스펙터 [계획 편집]뿐. 제목이 범위를, 버튼이 영향 수를 말한다. 취소가 기본 포커스."));
    return fig;
  }

  function dlgOneDay() {
    var date = "2026-10-03", v = W.vendorById("V01"), p = W.planById("P01");
    var cur = W.participationsOn(date).filter(function (x) { return x.vendor.id === v.id; })[0];
    var planned = p.weekdays.indexOf(W.weekdayISO(date)) !== -1 ? "참가" : "불참";
    var d = el("section", "dlg"); d.style.inlineSize = "460px";
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "이 날짜만 수정");
    add(d, el("div", "big-date", W.fmt.inspector(date)),
           el("h4", null, v.name), el("div", "scope", "다른 날짜에는 영향 없음"));
    var body = el("div", "body");
    body.appendChild(el("div", "ghost t-body", "계획: " + planned + " (" + W.summary.weekdays(p.weekdays) + " 참가)"));
    var rg = el("div", "radio"); rg.setAttribute("role", "radiogroup"); rg.setAttribute("aria-label", "이 날짜 참가 여부");
    var effect = el("div", "effect");
    var saveLabel = null;
    function syncEffect(choice) {
      if (choice === planned) effect.textContent = "계획과 같습니다 — 저장해도 달라지는 것이 없습니다.";
      else effect.textContent = "이 날짜만 " + choice + "으로 표시됩니다. 계획은 바뀌지 않습니다.";
      if (saveLabel) saveLabel.disabled = false;
    }
    [["참가", planned === "참가"], ["불참", planned !== "참가"]].forEach(function (o) {
      var lab = el("label");
      var r = document.createElement("input"); r.type = "radio"; r.name = "oneday"; r.checked = o[1];
      r.addEventListener("change", function () { syncEffect(o[0]); });
      add(lab, r, el("span", "t-body", "이 날만 " + o[0]));
      rg.appendChild(lab);
    });
    body.appendChild(rg);
    var rs = el("div");
    rs.appendChild(el("div", "t-caption", "이유 · 메모 (선택)"));
    var ta = document.createElement("textarea"); ta.rows = 2; ta.style.inlineSize = "100%"; ta.style.font = "inherit";
    ta.style.border = "1px solid var(--stroke1)"; ta.style.borderRadius = "var(--r-control)";
    ta.style.background = "var(--bg1)"; ta.style.color = "var(--fg1)"; ta.style.padding = "var(--sp-6)";
    ta.setAttribute("aria-label", "이유 메모");
    rs.appendChild(ta); body.appendChild(rs);
    body.appendChild(effect);
    syncEffect(planned);
    var lk = el("a", "t-caption", "반복 요일을 바꾸려면 계획 편집 →"); lk.href = "#"; body.appendChild(lk);
    d.appendChild(body);
    var f = el("footer");
    var c = el("button", "btn", "취소"); c.type = "button";
    var s = el("button", "btn btn-primary", W.fmt.md(date) + " 하루만 저장"); s.type = "button";
    add(f, c, s);
    d.appendChild(f);
    var fig = el("figure", "specimen"); fig.style.margin = "0";
    add(fig, d, el("figcaption", null, "하루만 변경 — 큰 날짜 하나가 제목. 계획 필드(기간·요일)는 절대 노출하지 않는다. 계획 편집과 시각 골격이 다르다."));
    return fig;
  }

  function dlgRestore() {
    var d = el("section", "dlg"); d.style.inlineSize = "460px";
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "백업에서 복원");
    add(d, el("h4", null, "백업에서 복원"), el("div", "scope", "선택만으로는 아무것도 덮어쓰지 않습니다"));
    var body = el("div", "body");
    var ul = el("ul", "list");
    [["2026-09-24 02:00", "오늘 02:00", "4.2 MB", true], ["2026-09-23 02:00", "어제 02:00", "4.1 MB", false], ["2026-09-17 02:00", "9/17(목) 02:00", "3.9 MB", false]].forEach(function (b) {
      var li = el("li");
      if (b[3]) li.style.boxShadow = "inset 2px 0 0 var(--ac-rest)";
      add(li, el("span", "t-body", b[1]), el("span", "t-caption num", b[0] + " · " + b[2]));
      ul.appendChild(li);
    });
    body.appendChild(ul);
    var pv = el("div");
    pv.appendChild(el("div", "t-caption", "변경량 preview"));
    var dl = el("dl"); dl.style.display = "grid"; dl.style.gridTemplateColumns = "9ch auto"; dl.style.gap = "var(--sp-2) var(--sp-8)";
    [["업체", "+2 / −0"], ["행사", "±0"], ["참가계획", "+3 / −1"], ["예외", "+1 / −2"], ["일정", "+7 / −0"], ["첨부", "20개 중 1개 누락"]].forEach(function (r) {
      add(dl, el("dt", "t-caption", r[0]), el("dd", "t-body num", r[1]));
    });
    pv.appendChild(dl); body.appendChild(pv);
    body.appendChild(el("div", "effect", "현재 상태를 스냅샷으로 저장합니다."));
    d.appendChild(body);
    var f = el("footer");
    var c = el("button", "btn", "취소"); c.type = "button";
    var s = el("button", "btn btn-primary", "현재 상태를 스냅샷으로 저장하고 복원"); s.type = "button";
    add(f, c, s);
    d.appendChild(f);
    var fig = el("figure", "specimen"); fig.style.margin = "0";
    add(fig, d, el("figcaption", null, "복원 — 되돌릴 수 없으므로 보여주고 묻는다. preview 전에는 확인 버튼이 비활성이고 옆에 사유가 붙는다."));
    return fig;
  }

  function feedbackSpecimens() {
    var box = el("div"); box.style.display = "grid"; box.style.gap = "var(--sp-12)"; box.style.maxInlineSize = "520px";
    var t = el("div", "toast");
    add(t, el("span", null, "저장됨 · 10/3 고성수산 이 날짜만 불참"), (function () { var b = el("button", null, "실행 취소"); b.type = "button"; return b; })(), el("span", "kbd", "Ctrl+Z"));
    box.appendChild(t);
    var mb = el("div", "msgbar");
    add(mb, el("span", null, "복원됨 · 2026-09-24 02:00 백업"), (function () { var b = el("button", null, "복원 취소(스냅샷으로 되돌리기)"); b.type = "button"; b.style.background = "none"; b.style.border = "0"; b.style.color = "var(--ac-rest)"; b.style.textDecoration = "underline"; b.style.cursor = "pointer"; b.style.font = "inherit"; b.style.padding = "0"; return b; })());
    box.appendChild(mb);
    var err = el("div", "msgbar");
    err.appendChild(el("span", null, "데이터베이스를 열 수 없습니다 — 파일이 다른 프로그램에서 사용 중입니다. 다시 시도하거나 앱을 재시작하세요."));
    var rb = el("button", "btn", "다시 시도"); rb.type = "button"; err.appendChild(rb);
    box.appendChild(err);
    var rsn = el("div"); rsn.style.display = "flex"; rsn.style.gap = "var(--sp-8)"; rsn.style.alignItems = "center";
    var disabled = el("button", "btn", "업체 저장"); disabled.type = "button";
    add(rsn, disabled, el("span", "reason t-caption", "참가 요일을 1개 이상 선택 — 버튼은 눌리고 첫 오류 필드로 포커스가 갑니다"));
    box.appendChild(rsn);
    var fig = el("figure", "specimen"); fig.style.margin = "0";
    add(fig, box, el("figcaption", null, "되돌리기 토스트 8초 · 복원 MessageBar(세션 내 상시) · 오류는 사라지지 않는 MessageBar · 비활성 대신 사유"));
    return fig;
  }

  function renderDialogs() {
    var box = document.getElementById("dlg-specimens"); box.textContent = "";
    add(box, dlgPlanEdit(), dlgOneDay(), dlgRestore(), feedbackSpecimens());
  }

  /* ════ 판정 메모 ══════════════════════════════════════════════════ */
  function renderNotes() {
    var n = document.getElementById("notes"); n.textContent = "";
    var font = detectFont();
    document.getElementById("fontguard").textContent = "렌더 서체: " + font + (font.indexOf("Malgun") === 0 || font.indexOf("맑은") === 0 ? " (실기)" : " — 대체 렌더. 조판 승인은 Windows 열람 후");
    var amb = (function () {
      var c = {}; W.vendors.forEach(function (v) { c[MONO[v.id]] = (c[MONO[v.id]] || 0) + 1; });
      return Object.keys(c).filter(function (k) { return c[k] > 1; });
    })();
    function block(title, items) {
      var s = el("div", "sec"); s.style.marginBlockStart = "var(--sp-16)";
      s.appendChild(el("div", "t-strong", title));
      var ul = el("ul"); ul.style.marginBlockStart = "var(--sp-4)";
      items.forEach(function (t) { var li = el("li", "t-body"); li.style.lineHeight = "var(--lh-prose)"; li.textContent = "· " + t; ul.appendChild(li); });
      s.appendChild(ul); n.appendChild(s);
    }
    block("이 시안이 하드코딩한 기본값 5개 — 정오표 미결 항목이므로 언제든 뒤집을 수 있습니다", [
      "① 주 시작 = 월요일 (캘린더 첫 열)",
      "② 밀도 기본 = normal (업체 20곳↑이면 compact 제안)",
      "③ 위젯의 '확인 필요 N' = 오늘 Task(status=needs_confirmation)만 — 지금 " + W.derived(W.TODAY).needsTask + "건. 날짜와 무관한 구조적 충돌(고아 예외·중첩 계획·요일 0개) " + W.derived(W.TODAY).structural + "건은 Layer 1의 별도 섹션과 인스펙터 '충돌'에서만 보인다. [최초안에서 정정: 둘을 합산하니 위젯 '확인 6'과 Layer 1 '3건 확인 필요'가 어긋났다 — 위젯 정보 4칸 상한을 지키면서 두 숫자를 일치시키려면 분리가 유일한 해법]",
      "④ 월간 오버플로 임계 = 9곳↑ 셀 내부 2열 / 17곳↑ 주 행 성장 + 기간표 전환 제안",
      "⑤ 위젯의 '가장 가까운 일정' = 1건 (spec의 '1~2건' 중 1건 선택)"
    ]);
    block("이 시안을 만들며 드러난 것", [
      "모노그램이 이 업체 집합을 구분하지 못합니다: '고성'으로 시작하는 업체가 5곳이어서 1음절→2음절 승격 후에도 " + amb.join(" / ") + " 가 중복됩니다. 모노그램은 식별자가 아니라 시선 앵커로만 쓰고, 이름이 들어갈 폭이 있으면 항상 이름이 우선이어야 합니다(독트린 모노그램 절과 일치). 기간표·월간 셀에 모노그램을 쓰지 않는 규칙이 여기서 정당화됩니다.",
      "월간 뷰가 이 데이터에서는 한 화면에 들어가지 않습니다. 2026년 9월을 1366px 폭에 그리면 세로 약 2,400px — 1366×768 화면의 3배입니다. 토요일마다 21~25곳이 참가하므로 '17곳↑ 주 행 성장'은 예외가 아니라 평시 상태입니다.",
      "토큰의 '9곳↑ 셀 내부 2열' 규칙은 이 데이터에서 한 칸도 적용되지 않았습니다(0칸). 7열 × 1366px이면 칸 폭이 약 195px, 2열로 접으면 90px이라 업체명이 2~3자로 잘립니다. 이름을 자르는 것은 '+N 외'와 같은 실패이므로, 2열은 '그 칸의 가장 긴 이름이 7자 이하일 때만'으로 좁혔습니다 — 토큰 month_cell_two_column_threshold 개정 필요.",
      "결론: 업체 20곳↑ 운영에서는 기간표가 기본 뷰여야 합니다. 같은 10월 데이터가 기간표에서는 26곳 × 31일이 1366×768 한 화면에 들어가고 업체명이 전부 읽힙니다. C 스위스 운영 방향의 근거입니다.",
      "expandPlan이 계산한 값만 화면에 올렸습니다. 참가일·건수·요약 문장에 손으로 적은 숫자는 없습니다."
    ]);
    block("이 환경에서 검증할 수 없는 것 (미검증 — Linux 작성)", [
      "맑은 고딕 실기 조판(현재 렌더: " + font + "), tabular-nums 동작, 혼합 문자 한 줄의 700 굵기·기준선",
      "always-on-bottom · 클릭 통과 · Win+D 생존 · 트레이 · 전역 단축키 · 작업표시줄 숨김 · 한글 IME 실기",
      "Mica 재질(위젯 배경은 현재 불투명 폴백), Windows 고대비 테마 4종 실측, 멀티모니터 DPI 전환"
    ]);
  }

  /* ════ 제어·공개 리듬·키보드 ═══════════════════════════════════════ */
  function go(stage) {
    if (H.dataset.mode !== "flow") return;
    H.dataset.stage = String(stage);
    applyFlow();
  }
  function applyFlow() {
    var flow = H.dataset.mode === "flow", st = H.dataset.stage || "0";
    ["s-l0", "s-l1", "s-l2", "s-dlg", "s-notes"].forEach(function (id, i) {
      var sec = document.getElementById(id);
      sec.hidden = flow ? String(i) !== st : false;
    });
  }
  function draw() {
    renderL0(); renderL1(); renderCmdRow(); drawCal(); renderInspector(); renderDialogs(); renderNotes();
    syncRig(); applyFlow();
  }
  function syncRig() {
    var btns = document.querySelectorAll("#rig button[data-set]");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], k = b.getAttribute("data-set"), v = b.getAttribute("data-val");
      b.setAttribute("aria-pressed", H.dataset[k] === v ? "true" : "false");
    }
  }
  document.getElementById("rig").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-set]"); if (!b) return;
    var k = b.getAttribute("data-set"), v = b.getAttribute("data-val");
    if (k === "gray") H.dataset.gray = H.dataset.gray === "on" ? "off" : "on";
    else if (k === "mode") { H.dataset.mode = H.dataset.mode === "flow" ? "all" : "flow"; H.dataset.stage = "0"; }
    else H.dataset[k] = v;
    if (k === "density" && v === "compact" && H.dataset.direction !== "C") { /* 밀도는 방향과 독립 */ }
    draw();
  });
  /* Escape 사다리: 한 번에 한 단계 (대화상자 → 인스펙터 → Layer 1 → 위젯) */
  document.addEventListener("keydown", function (e) {
    if (e.isComposing || e.keyCode === 229) return;            // 한글 조합 중 무시(U5)
    if (e.code === "Escape" && H.dataset.mode === "flow") {
      var st = +(H.dataset.stage || 0);
      if (st > 0) { H.dataset.stage = String(st - 1); applyFlow(); e.preventDefault(); }
      return;
    }
    var cell = document.activeElement;
    if (cell && cell.getAttribute && cell.getAttribute("role") === "gridcell") {
      var tr = cell.parentElement, idx = Array.prototype.indexOf.call(tr.children, cell), tb = tr.parentElement;
      var rowIdx = Array.prototype.indexOf.call(tb.children, tr), next = null;
      if (e.code === "ArrowRight") next = tr.children[idx + 1];
      else if (e.code === "ArrowLeft") next = tr.children[idx - 1];
      else if (e.code === "ArrowDown" && tb.children[rowIdx + 1]) next = tb.children[rowIdx + 1].children[idx];
      else if (e.code === "ArrowUp" && tb.children[rowIdx - 1]) next = tb.children[rowIdx - 1].children[idx];
      else if (e.code === "Home") next = tr.children[1];
      else if (e.code === "End") next = tr.children[tr.children.length - 1];
      if (next && next.getAttribute("role") === "gridcell") { cell.tabIndex = -1; next.tabIndex = 0; next.focus(); e.preventDefault(); }
    }
  });
  /* 기간표 첫 셀만 tab 진입점(roving tabindex) */
  function rove() {
    var first = document.querySelector('table.matrix td[role="gridcell"]');
    if (first) first.tabIndex = 0;
  }

  /* URL 해시로 상태 지정 — shot.mjs가 쓴다. 예: #direction=C&view=matrix&theme=dark&month=2026-10 */
  function applyHash() {
    var h = location.hash.replace(/^#/, ""); if (!h) return;
    h.split("&").forEach(function (kv) {
      var p = kv.split("="); if (p.length !== 2) return;
      var k = p[0], v = decodeURIComponent(p[1]);
      if (k === "month") MONTH = v;
      else if (k === "date") { SEL = { date: v, vendor: SEL.vendor }; }
      else if (k === "vendor") { SEL = { date: SEL.date, vendor: v }; }
      else H.dataset[k] = v;
    });
  }
  /* 촬영 전용 단독 렌더: #only=widget&state=rest&date=... */
  function applySolo() {
    if (H.dataset.only !== "widget") return;
    var host = document.getElementById("solo");
    if (!host) { host = el("div"); host.id = "solo"; document.querySelector("main").appendChild(host); }
    host.textContent = "";
    var q = {}; location.hash.replace(/^#/, "").split("&").forEach(function (kv) { var p = kv.split("="); if (p.length === 2) q[p[0]] = decodeURIComponent(p[1]); });
    host.appendChild(widget(q.state || "rest", { date: q.date || W.TODAY, error: q.error === "1" }));
  }
  applyHash();
  window.addEventListener("hashchange", function () { applyHash(); draw(); rove(); applySolo(); });
  draw(); rove(); applySolo();
})();
