/* Spike B — calendar density prototype. Vanilla JS, no framework, no persistence. */
(function () {
  "use strict";

  var F = window.FIXTURES;
  var DOW = ["일", "월", "화", "수", "목", "금", "토"];

  var state = {
    view: "month",        // month | matrix
    density: "comfortable", // comfortable | compact
    rowmode: "flow",      // flow | cap
    focusDate: null
  };

  var el = {
    body: document.body,
    monthGrid: document.getElementById("monthGrid"),
    matrixWrap: document.getElementById("matrixWrap"),
    weekdayHead: document.getElementById("weekdayHead"),
    title: document.getElementById("monthTitle"),
    sub: document.getElementById("monthSub"),
    calBody: document.getElementById("calBody"),
    measure: document.getElementById("measure")
  };

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0");
  }

  function band(n) {
    if (n >= 30) return "extreme";
    if (n >= 14) return "high";
    return "normal";
  }

  /* ---------- month view ---------- */

  function buildWeeks() {
    var first = new Date(F.year, F.month - 1, 1);
    var last = new Date(F.year, F.month, 0);
    var start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    var end = new Date(last);
    end.setDate(last.getDate() + (6 - last.getDay()));
    var weeks = [], cur = new Date(start);
    while (cur <= end) {
      var week = [];
      for (var i = 0; i < 7; i++) {
        week.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }

  function dayCell(date) {
    var key = iso(date);
    var data = F.byDate[key] || { general: [], vendors: [] };
    var outside = (date.getMonth() + 1) !== F.month;

    var cell = document.createElement("div");
    cell.className = "day-cell";
    cell.dataset.date = key;
    cell.dataset.dow = String(date.getDay());
    cell.dataset.outside = String(outside);
    cell.dataset.vendorCount = String(data.vendors.length);
    cell.setAttribute("data-testid", "day-" + key);

    var head = document.createElement("div");
    head.className = "day-head";
    var num = document.createElement("span");
    num.className = "day-num";
    num.textContent = String(date.getDate());
    head.appendChild(num);
    if (data.vendors.length) {
      // extra context, sitting BESIDE the names — never instead of them
      var note = document.createElement("span");
      note.className = "count-note";
      note.dataset.testid = "count-note-" + key;
      note.textContent = "업체 " + data.vendors.length;
      head.appendChild(note);
    }
    cell.appendChild(head);

    var scroll = document.createElement("div");
    scroll.className = "day-scroll";
    var items = document.createElement("div");
    items.className = "day-items";
    items.dataset.band = band(data.vendors.length);

    data.general.forEach(function (g) {
      var row = document.createElement("div");
      row.className = "item general";
      row.textContent = g;
      items.appendChild(row);
    });

    if (data.vendors.length) {
      var label = document.createElement("div");
      label.className = "sec-label";
      label.textContent = "참가 업체";
      items.appendChild(label);
      data.vendors.forEach(function (v) {
        var row = document.createElement("div");
        row.className = "item vendor";
        var name = document.createElement("span");
        name.className = "vendor-name";
        name.dataset.vendor = v;
        name.textContent = v;
        row.appendChild(name);
        items.appendChild(row);
      });
    }

    scroll.appendChild(items);
    cell.appendChild(scroll);
    cell.addEventListener("click", function () { setFocus(key); });
    return cell;
  }

  function renderMonth() {
    el.weekdayHead.innerHTML = "";
    DOW.forEach(function (d) {
      var s = document.createElement("span");
      s.textContent = d;
      el.weekdayHead.appendChild(s);
    });

    el.monthGrid.innerHTML = "";
    buildWeeks().forEach(function (week, i) {
      var row = document.createElement("div");
      row.className = "week-row";
      row.dataset.week = String(i + 1);
      row.setAttribute("data-testid", "week-" + (i + 1));
      var busiest = 0;
      week.forEach(function (d) {
        var f = F.byDate[iso(d)];
        if (f && f.vendors.length > busiest) busiest = f.vendors.length;
        row.appendChild(dayCell(d));
      });
      row.dataset.busiest = String(busiest);
      el.monthGrid.appendChild(row);
    });
  }

  /* ---------- vendor x date matrix ---------- */

  function renderMatrix() {
    var dates = F.days.filter(function (d) { return d.vendors.length; })
      .map(function (d) { return d.date; }).sort();
    var seen = {}, vendorRows = [];
    F.vendorPool.forEach(function (v) {
      var participates = dates.some(function (dt) {
        return F.byDate[dt].vendors.indexOf(v) !== -1;
      });
      if (participates && !seen[v]) { seen[v] = 1; vendorRows.push(v); }
    });

    var html = ['<p class="matrix-note">업체 × 날짜. 이름은 행으로 끝까지 남고, 날짜 열은 가로로 늘어난다.</p>'];
    html.push('<table class="matrix" data-testid="matrix-table"><thead><tr>');
    html.push('<th scope="col">업체 (' + vendorRows.length + ')</th>');
    dates.forEach(function (dt) {
      var n = F.byDate[dt].vendors.length;
      var d = new Date(dt + "T00:00:00");
      html.push('<th scope="col" data-date="' + dt + '" data-testid="matrix-col-' + dt + '">' +
        (d.getMonth() + 1) + "/" + d.getDate() + '<br><span class="count-note">업체 ' + n + "</span></th>");
    });
    html.push("</tr></thead><tbody>");
    vendorRows.forEach(function (v) {
      html.push('<tr><th scope="row" data-vendor="' + v + '"><span class="vendor-name" data-vendor="' + v + '">' + v + "</span></th>");
      dates.forEach(function (dt) {
        var on = F.byDate[dt].vendors.indexOf(v) !== -1;
        html.push('<td data-date="' + dt + '" data-vendor="' + v + '" data-participating="' + on + '">' +
          (on ? "참가" : "") + "</td>");
      });
      html.push("</tr>");
    });
    html.push("</tbody></table>");
    el.matrixWrap.innerHTML = html.join("");
  }

  /* ---------- state ---------- */

  function applyFocus() {
    Array.prototype.forEach.call(el.monthGrid.querySelectorAll(".day-cell"), function (c) {
      c.dataset.focus = String(c.dataset.date === state.focusDate);
    });
    Array.prototype.forEach.call(el.matrixWrap.querySelectorAll("[data-date]"), function (c) {
      c.dataset.focusCol = String(c.dataset.date === state.focusDate);
    });
  }

  function setFocus(date) {
    state.focusDate = date;
    applyFocus();
    if (state.view === "matrix" && date) {
      var col = el.matrixWrap.querySelector('thead th[data-date="' + date + '"]');
      if (col) col.scrollIntoView({ block: "nearest", inline: "center" });
    }
    updateMeasure();
  }

  function setView(v) {
    state.view = v;
    el.body.dataset.view = v;
    el.monthGrid.hidden = (v !== "month");
    el.matrixWrap.hidden = (v !== "matrix");
    syncButtons();
    if (v === "matrix" && state.focusDate) setFocus(state.focusDate);
    updateMeasure();
  }

  function setDensity(d) { state.density = d; el.body.dataset.density = d; syncButtons(); updateMeasure(); }
  function setRowMode(m) { state.rowmode = m; el.body.dataset.rowmode = m; syncButtons(); updateMeasure(); }

  function syncButtons() {
    [["view-btn", state.view], ["density-btn", state.density], ["rowmode-btn", state.rowmode]]
      .forEach(function (pair) {
        Array.prototype.forEach.call(document.querySelectorAll("[data-" + pair[0] + "]"), function (b) {
          b.classList.toggle("on", b.dataset[pair[0].replace(/-b/, "B")] === pair[1]);
        });
      });
  }

  function updateMeasure() {
    var names = document.querySelectorAll(
      (state.view === "month" ? "#monthGrid" : "#matrixWrap") + " .vendor-name").length;
    var body = el.calBody;
    el.measure.textContent =
      "view=" + state.view + " · density=" + state.density + " · rows=" + state.rowmode +
      " · 화면에 렌더된 업체명 " + names + "개 · body scrollHeight " + body.scrollHeight +
      " / clientHeight " + body.clientHeight +
      (state.focusDate ? " · focus " + state.focusDate : "");
  }

  /* ---------- wiring ---------- */

  document.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.viewBtn) setView(b.dataset.viewBtn);
    if (b.dataset.densityBtn) setDensity(b.dataset.densityBtn);
    if (b.dataset.rowmodeBtn) setRowMode(b.dataset.rowmodeBtn);
  });

  renderMonth();
  renderMatrix();
  setView("month");
  el.title.textContent = F.label;
  el.sub.textContent = "밀도 벤치마크: " + F.benchmarks.map(function (b) {
    return b.date.slice(5) + " → " + b.density + "개";
  }).join(" · ");
  updateMeasure();
  window.addEventListener("resize", updateMeasure);

  window.__app = {
    state: state,
    setView: setView,
    setDensity: setDensity,
    setRowMode: setRowMode,
    setFocus: setFocus
  };
})();
