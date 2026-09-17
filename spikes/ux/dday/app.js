/* SPIKE D — Desktop D-day pin surface.
   탐색용 프로토타입. 최종 디자인이 아니다. 저장소/백엔드 없음(메모리 상태만).

   PRIORITY RULE (명시 규칙, 이 프로토타입 전체에 동일 적용)
     P1. days 오름차순 (음수 = 기한 지남이 가장 앞)
     P2. 동률이면 title 코드포인트 오름차순
     P3. group 순서는 그 group 의 최우선 pin(P1/P2) 기준. 동률이면 group key 코드포인트.
     P4. Layout Edit 에서 사용자가 옮긴 배치/순서는 P1~P3 을 덮어쓰지만
         어떤 pin 도 목록에서 사라지게 하지 않는다.
*/
(function () {
  'use strict';

  var PIN_W = 220, PIN_H = 94, GAP = 14, PAD = 18;

  var BUCKETS = [
    { key: 'overdue', label: '기한 지남', test: function (d) { return d < 0; } },
    { key: 'today',   label: '오늘',      test: function (d) { return d === 0; } },
    { key: 'week',    label: '7일 이내',  test: function (d) { return d <= 7; } },
    { key: 'month',   label: '30일 이내', test: function (d) { return d <= 30; } },
    { key: 'later',   label: '그 이후',   test: function () { return true; } }
  ];

  function bucketOf(days) {
    for (var i = 0; i < BUCKETS.length; i++) if (BUCKETS[i].test(days)) return BUCKETS[i];
    return BUCKETS[BUCKETS.length - 1];
  }

  var state = {
    fixture: 3,
    arrangement: 'free',   // free | stack | grouped
    axis: 'urgency',       // urgency | event
    layoutEdit: false,
    collapsed: {},         // "fixture|axis|groupKey" -> true
    placements: {},        // "fixture|pinId" -> {x,y}
    groupOrder: null       // 수동 group 순서 (Layout Edit 에서만 생김)
  };

  var body = document.body;
  var rail = document.getElementById('rail');
  var ledger = document.getElementById('ledger');
  var ledgerText = document.getElementById('ledger-text');

  function pins() { return (window.FIXTURES[state.fixture] || []).slice(); }

  function byPriority(a, b) {
    if (a.days !== b.days) return a.days - b.days;
    return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0);
  }

  function sortedPins() { return pins().sort(byPriority); }

  function dLabel(d) { return d < 0 ? 'D+' + (-d) : (d === 0 ? 'D-DAY' : 'D-' + d); }

  function placeKey(id) { return state.fixture + '|' + id; }
  function collapseKey(k) { return state.fixture + '|' + state.axis + '|' + k; }

  function groupsOf() {
    var list = sortedPins(), map = {}, order = [];
    list.forEach(function (p) {
      var b = bucketOf(p.days);
      var k = state.axis === 'urgency' ? b.key : p.event;
      var label = state.axis === 'urgency' ? b.label : p.event;
      if (!map[k]) { map[k] = { key: k, label: label, pins: [] }; order.push(k); }
      map[k].pins.push(p);
    });
    var groups = order.map(function (k) { return map[k]; });
    groups.sort(function (a, b) {
      var d = a.pins[0].days - b.pins[0].days;
      if (d !== 0) return d;
      return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
    });
    if (state.groupOrder) {
      var manual = state.groupOrder;
      groups.sort(function (a, b) {
        var ia = manual.indexOf(a.key), ib = manual.indexOf(b.key);
        if (ia < 0) ia = 999; if (ib < 0) ib = 999;
        return ia - ib;
      });
    }
    return groups;
  }

  function makePin(p, priorityIndex) {
    var el = document.createElement('article');
    el.className = 'pin';
    el.setAttribute('data-pin-id', p.id);
    el.setAttribute('data-days', String(p.days));
    el.setAttribute('data-event', p.event);
    el.setAttribute('data-bucket', bucketOf(p.days).key);
    el.setAttribute('data-priority', String(priorityIndex));
    el.setAttribute('data-draggable', 'false');
    el.setAttribute('draggable', 'false');

    var d = document.createElement('span');
    d.className = 'pin-d';
    d.textContent = dLabel(p.days);

    var t = document.createElement('span');
    t.className = 'pin-title';
    t.textContent = p.title;

    var e = document.createElement('span');
    e.className = 'pin-event';
    e.textContent = p.event;

    el.appendChild(d); el.appendChild(t); el.appendChild(e);
    return el;
  }

  /* ---------- arrangements ---------- */

  function renderFree() {
    rail.className = 'rail rail--free';
    var canvas = document.createElement('div');
    canvas.className = 'canvas';
    canvas.id = 'canvas';
    var list = sortedPins();
    list.forEach(function (p, i) {
      var el = makePin(p, i);
      el.setAttribute('data-draggable', state.layoutEdit ? 'true' : 'false');
      canvas.appendChild(el);
    });
    rail.appendChild(canvas);
    layoutFree();
  }

  function layoutFree() {
    var canvas = document.getElementById('canvas');
    if (!canvas) return;
    var railW = rail.clientWidth;
    var cols = Math.max(1, Math.floor((railW - 2 * PAD + GAP) / (PIN_W + GAP)));
    var els = canvas.querySelectorAll('.pin');
    var maxBottom = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var pos = state.placements[placeKey(el.getAttribute('data-pin-id'))];
      if (!pos) {
        pos = { x: PAD + (i % cols) * (PIN_W + GAP), y: PAD + Math.floor(i / cols) * (PIN_H + GAP) };
      }
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      maxBottom = Math.max(maxBottom, pos.y + PIN_H);
    }
    canvas.style.height = (maxBottom + PAD) + 'px';
  }

  function renderStack() {
    rail.className = 'rail rail--stack';
    sortedPins().forEach(function (p, i) {
      var el = makePin(p, i);
      el.classList.add('pin--row');
      rail.appendChild(el);
    });
  }

  function renderGrouped() {
    rail.className = 'rail rail--grouped';
    var priorityIndex = {};
    sortedPins().forEach(function (p, i) { priorityIndex[p.id] = i; });

    groupsOf().forEach(function (g) {
      var collapsed = !!state.collapsed[collapseKey(g.key)];
      var sec = document.createElement('section');
      sec.className = 'group';
      sec.setAttribute('data-group-key', g.key);
      sec.setAttribute('data-count', String(g.pins.length));
      sec.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
      sec.setAttribute('data-draggable',
        (state.layoutEdit && state.arrangement === 'grouped') ? 'true' : 'false');

      var head = document.createElement('header');
      head.className = 'group-head';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'group-toggle';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('data-toggle-for', g.key);
      btn.textContent = g.label;

      var cnt = document.createElement('span');
      cnt.className = 'group-count';
      cnt.textContent = g.pins.length + '건';

      var lead = document.createElement('span');
      lead.className = 'group-lead';
      lead.textContent = dLabel(g.pins[0].days);

      head.appendChild(btn); head.appendChild(lead); head.appendChild(cnt);
      sec.appendChild(head);

      /* 접힌 상태에서도 어떤 pin 이 그 안에 있는지 이름으로 남긴다.
         숫자만으로 대체하지 않는다. */
      var summary = document.createElement('p');
      summary.className = 'group-summary';
      summary.textContent = g.pins.map(function (p) { return p.title; }).join(' · ');
      sec.appendChild(summary);

      var bodyEl = document.createElement('div');
      bodyEl.className = 'group-body';
      g.pins.forEach(function (p) {
        var el = makePin(p, priorityIndex[p.id]);
        el.classList.add('pin--row');
        bodyEl.appendChild(el);
      });
      sec.appendChild(bodyEl);
      rail.appendChild(sec);
    });
  }

  /* ---------- ledger (아무 pin 도 조용히 사라지지 않았음을 화면에 남긴다) ---------- */

  function updateLedger() {
    var all = rail.querySelectorAll('.pin');
    var railRect = rail.getBoundingClientRect();
    var total = all.length, collapsedCount = 0, visible = 0;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var grp = el.closest ? el.closest('.group') : null;
      if (grp && grp.getAttribute('data-collapsed') === 'true') { collapsedCount++; continue; }
      var r = el.getBoundingClientRect();
      if (r.height > 0 && r.top >= railRect.top - 0.5 && r.bottom <= railRect.bottom + 0.5) visible++;
    }
    var offscreen = total - collapsedCount - visible;
    ledger.setAttribute('data-total', String(total));
    ledger.setAttribute('data-visible', String(visible));
    ledger.setAttribute('data-collapsed', String(collapsedCount));
    ledger.setAttribute('data-offscreen', String(offscreen));
    ledgerText.textContent =
      '총 ' + total + '건 — 지금 보이는 것 ' + visible + '건, 접힘 ' + collapsedCount +
      '건, 스크롤 밖 ' + offscreen + '건';
  }

  /* ---------- render ---------- */

  function render() {
    body.setAttribute('data-arrangement', state.arrangement);
    body.setAttribute('data-axis', state.axis);
    body.setAttribute('data-edit', state.layoutEdit ? 'on' : 'off');
    body.setAttribute('data-ambient', state.layoutEdit ? 'off' : 'on');
    body.setAttribute('data-fixture', String(state.fixture));

    var t = document.getElementById('layout-edit-toggle');
    t.setAttribute('aria-pressed', state.layoutEdit ? 'true' : 'false');

    Array.prototype.forEach.call(document.querySelectorAll('.hud [data-set]'), function (b) {
      var on = String(state[b.getAttribute('data-set')]) === b.getAttribute('data-value');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    rail.innerHTML = '';
    if (state.arrangement === 'free') renderFree();
    else if (state.arrangement === 'stack') renderStack();
    else renderGrouped();
    updateLedger();
  }

  /* ---------- Layout Edit + drag ---------- */
  /* 평상시에는 어떤 요소에도 drag handler 가 붙지 않는다.
     모든 drag 진입점은 state.layoutEdit 를 먼저 확인하고 즉시 빠져나간다. */

  var drag = null;

  rail.addEventListener('mousedown', function (ev) {
    if (!state.layoutEdit) return;              // NEVER 5 — 평상시 drag 없음
    if (ev.button !== 0) return;

    if (state.arrangement === 'free') {
      var pin = ev.target.closest('.pin');
      if (!pin) return;
      ev.preventDefault();
      var id = pin.getAttribute('data-pin-id');
      drag = {
        kind: 'pin', el: pin, id: id,
        sx: ev.clientX, sy: ev.clientY,
        ox: parseFloat(pin.style.left) || 0,
        oy: parseFloat(pin.style.top) || 0
      };
      pin.classList.add('is-dragging');
    } else if (state.arrangement === 'grouped') {
      var head = ev.target.closest('.group-head');
      if (!head) return;
      if (ev.target.closest('.group-toggle')) return;  // 접기 버튼은 drag 가 아니다
      var sec = head.closest('.group');
      ev.preventDefault();
      drag = { kind: 'group', el: sec, key: sec.getAttribute('data-group-key'), sy: ev.clientY, dy: 0 };
      sec.classList.add('is-dragging');
    }
  });

  window.addEventListener('mousemove', function (ev) {
    if (!drag || !state.layoutEdit) return;
    if (drag.kind === 'pin') {
      var dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      var x = Math.max(0, Math.min(drag.ox + dx, Math.max(0, rail.clientWidth - PIN_W)));
      var y = Math.max(0, drag.oy + dy);
      drag.el.style.left = x + 'px';
      drag.el.style.top = y + 'px';
      state.placements[placeKey(drag.id)] = { x: x, y: y };
    } else {
      drag.dy = ev.clientY - drag.sy;
      drag.el.style.transform = 'translateY(' + drag.dy + 'px)';
    }
  });

  window.addEventListener('mouseup', function () {
    if (!drag) return;
    var d = drag; drag = null;
    if (d.kind === 'pin') {
      d.el.classList.remove('is-dragging');
      layoutFree();
      updateLedger();
      return;
    }
    d.el.classList.remove('is-dragging');
    d.el.style.transform = '';
    var secs = Array.prototype.slice.call(rail.querySelectorAll('.group'));
    var keys = secs.map(function (s) { return s.getAttribute('data-group-key'); });
    var from = keys.indexOf(d.key);
    var movedCenter = d.el.getBoundingClientRect().top + d.el.offsetHeight / 2 + d.dy;
    var to = 0;
    secs.forEach(function (s, i) {
      if (i === from) return;
      var r = s.getBoundingClientRect();
      if (movedCenter > r.top + r.height / 2) to = i;
    });
    if (movedCenter < secs[0].getBoundingClientRect().top) to = 0;
    keys.splice(from, 1);
    keys.splice(to, 0, d.key);
    state.groupOrder = keys;
    render();
  });

  /* ---------- HUD ---------- */

  document.getElementById('hud').addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'layout-edit-toggle') { state.layoutEdit = !state.layoutEdit; render(); return; }
    if (b.id === 'collapse-all') { setAllCollapsed(true); return; }
    if (b.id === 'expand-all') { setAllCollapsed(false); return; }
    var k = b.getAttribute('data-set');
    if (!k) return;
    var v = b.getAttribute('data-value');
    state[k] = (k === 'fixture') ? parseInt(v, 10) : v;
    if (k === 'axis' || k === 'fixture') state.groupOrder = null;
    render();
  });

  function setAllCollapsed(flag) {
    groupsOf().forEach(function (g) {
      if (flag) state.collapsed[collapseKey(g.key)] = true;
      else delete state.collapsed[collapseKey(g.key)];
    });
    render();
  }

  rail.addEventListener('click', function (ev) {
    var t = ev.target.closest('.group-toggle');
    if (!t) return;
    var key = collapseKey(t.getAttribute('data-toggle-for'));
    if (state.collapsed[key]) delete state.collapsed[key]; else state.collapsed[key] = true;
    render();
  });

  rail.addEventListener('scroll', updateLedger, { passive: true });
  window.addEventListener('resize', function () {
    if (state.arrangement === 'free') layoutFree();
    updateLedger();
  });

  /* ---------- URL 로 초기 조건 고정 (테스트/스크린샷 재현용) ---------- */

  var q = new URLSearchParams(location.search);
  if (q.get('f')) state.fixture = parseInt(q.get('f'), 10);
  if (q.get('arr')) state.arrangement = q.get('arr');
  if (q.get('axis')) state.axis = q.get('axis');
  if (q.get('edit') === '1') state.layoutEdit = true;
  render();
  if (q.get('collapsed') === 'all') setAllCollapsed(true);

  /* 테스트 계측용 훅 (제품 기능 아님) */
  window.__spike = {
    state: state,
    render: render,
    priorityOrder: function () { return sortedPins().map(function (p) { return p.id; }); },
    metrics: function () {
      var railRect = rail.getBoundingClientRect();
      var all = rail.querySelectorAll('.pin');
      var vis = 0, col = 0;
      for (var i = 0; i < all.length; i++) {
        var g = all[i].closest('.group');
        if (g && g.getAttribute('data-collapsed') === 'true') { col++; continue; }
        var r = all[i].getBoundingClientRect();
        if (r.height > 0 && r.top >= railRect.top - 0.5 && r.bottom <= railRect.bottom + 0.5) vis++;
      }
      return {
        arrangement: state.arrangement,
        axis: state.axis,
        fixture: state.fixture,
        domPins: all.length,
        visiblePins: vis,
        collapsedPins: col,
        offscreenPins: all.length - vis - col,
        groups: rail.querySelectorAll('.group').length,
        railClientWidth: rail.clientWidth,
        railClientHeight: rail.clientHeight,
        railScrollHeight: rail.scrollHeight,
        overflowPx: Math.max(0, rail.scrollHeight - rail.clientHeight),
        scrollable: rail.scrollHeight > rail.clientHeight + 1
      };
    }
  };
})();
