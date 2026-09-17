/* SPIKE C — Object Lens.
   Calendar Sheet -> Object Lens (transient, origin-anchored) -> Focus Surface.
   Exactly three lens kinds: vendor | event | schedule.
   No persistence, no backend. Everything in memory from fixtures.js. */
(function () {
  'use strict';

  var F = window.SPIKE_FIXTURES;
  var LENS_W = 344;
  var GAP = 12;

  var state = null;
  function initState() {
    state = {
      entryStatus: {},          // "objectId@date" -> status
      taskState: {},            // taskId -> 'future'|'active'|'done'
      stack: [],                // [{objectId, date, originKey, originEl, node}]
      focus: null,              // {objectId, date}
      filter: 'all',
      anchorMode: 'anchored',
      overlapRule: 'stack2'
    };
    Object.keys(F.ENTRIES).forEach(function (d) {
      F.ENTRIES[d].forEach(function (e) { state.entryStatus[e.objectId + '@' + d] = e.status; });
    });
    Object.keys(F.OBJECTS).forEach(function (id) {
      (F.OBJECTS[id].tasks || []).forEach(function (t) { state.taskState[t.id] = t.state; });
    });
  }

  var metrics = { opens: [], events: [] };
  function note(kind, data) { metrics.events.push(Object.assign({ kind: kind, t: Math.round(performance.now()) }, data || {})); }

  /* ---------------- helpers ---------------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function objectOf(id) { return F.OBJECTS[id]; }
  function statusCycleFor(obj) { return obj.kind === 'vendor' ? F.VENDOR_STATUS_CYCLE : F.WORK_STATUS_CYCLE; }
  function nextStatus(obj, cur) {
    var cyc = statusCycleFor(obj);
    var i = cyc.indexOf(cur);
    return cyc[(i + 1) % cyc.length];
  }
  function taskCounts(obj) {
    var c = { done: 0, active: 0, future: 0 };
    (obj.tasks || []).forEach(function (t) { c[state.taskState[t.id]]++; });
    return c;
  }
  function countsText(obj) {
    var c = taskCounts(obj);
    return '완료 ' + c.done + ' · 진행 ' + c.active + ' · 예정 ' + c.future;
  }
  function clipText(obj) {
    return obj.attachments.count > 0 ? '첨부 ' + obj.attachments.count : '첨부 없음';
  }

  /* ---------------- Calendar Sheet ---------------- */
  function renderCalendar() {
    var grid = document.getElementById('cal-grid');
    grid.textContent = '';
    var y = F.MONTH.year, m = F.MONTH.month;
    var first = new Date(y, m - 1, 1);
    var start = new Date(y, m - 1, 1 - first.getDay());
    for (var i = 0; i < 35; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var key = iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
      var out = (d.getMonth() + 1) !== m;
      var cell = el('div', 'cell' + (out ? ' is-out' : '') + (key === F.MONTH.today ? ' is-today' : ''));
      cell.setAttribute('data-cell', key);
      cell.appendChild(el('div', 'daynum', String(d.getDate())));
      var box = el('div', 'cell-entries');
      (F.ENTRIES[key] || []).forEach(function (e) {
        box.appendChild(entryButton(e.objectId, key));
      });
      cell.appendChild(box);
      grid.appendChild(cell);
    }
  }

  function entryButton(objectId, date) {
    var obj = objectOf(objectId);
    var b = el('button', 'entry');
    b.type = 'button';
    b.setAttribute('data-entry', objectId + '@' + date);
    b.setAttribute('data-kind', obj.kind);
    b.setAttribute('data-object', objectId);
    b.setAttribute('data-date', date);
    var st = state.entryStatus[objectId + '@' + date];
    b.setAttribute('data-status', st);
    /* 업체명/행사명을 그대로 노출한다 (NEVER 3) */
    b.appendChild(el('span', 'nm', obj.name));
    b.appendChild(el('span', 'st', st));
    if (obj.attachments.count > 0) b.appendChild(el('span', 'clip', '첨부' + obj.attachments.count));
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      requestLens(objectId, date, b, performance.now());
    });
    return b;
  }

  function refreshEntry(objectId, date) {
    var sel = '[data-entry="' + objectId + '@' + date + '"]';
    var old = document.querySelector(sel);
    if (!old) return null;
    var wasOrigin = old.getAttribute('data-origin') === 'true';
    var fresh = entryButton(objectId, date);
    if (wasOrigin) fresh.setAttribute('data-origin', 'true');
    old.replaceWith(fresh);
    state.stack.forEach(function (fr) { if (fr.originKey === 'entry:' + objectId + '@' + date) fr.originEl = fresh; });
    return fresh;
  }

  /* ---------------- Work Track (second surface; not Calendar-only) ---------------- */
  function allWorkRows() {
    var rows = [];
    Object.keys(F.OBJECTS).forEach(function (id) {
      var obj = F.OBJECTS[id];
      (obj.tasks || []).forEach(function (t) {
        rows.push({ taskId: t.id, objectId: id, title: t.title, due: t.due, owner: obj.name, kind: obj.kind });
      });
    });
    rows.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
    return rows;
  }

  var STATE_LABEL = { future: '예정', active: '진행', done: '완료' };

  function renderTrack() {
    var host = document.getElementById('track-rows');
    host.textContent = '';
    allWorkRows().forEach(function (r) {
      var b = el('button', 'track-row');
      b.type = 'button';
      b.setAttribute('data-track-row', r.taskId);
      b.setAttribute('data-object', r.objectId);
      b.setAttribute('data-state', state.taskState[r.taskId]);
      b.appendChild(el('span', 'tr-state', STATE_LABEL[state.taskState[r.taskId]]));
      b.appendChild(el('span', 'tr-title', r.title));
      b.appendChild(el('span', 'tr-owner', r.owner));
      b.appendChild(el('span', 'tr-due', r.due));
      b.appendChild(el('span', 'tr-clip', clipText(objectOf(r.objectId))));
      b.hidden = !(state.filter === 'all' || state.filter === state.taskState[r.taskId]);
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        requestLens(r.objectId, r.due, b, performance.now());
      });
      host.appendChild(b);
    });
  }

  function refreshTrackRow(taskId) {
    renderTrack();
    var fresh = document.querySelector('[data-track-row="' + taskId + '"]');
    state.stack.forEach(function (fr) {
      if (fr.originKey === 'track:' + taskId) {
        if (fresh) { fresh.setAttribute('data-origin', 'true'); fr.originEl = fresh; }
      }
    });
    return fresh;
  }

  /* ---------------- Object Lens ---------------- */
  function originKeyOf(node) {
    if (node.hasAttribute('data-entry')) return 'entry:' + node.getAttribute('data-entry');
    if (node.hasAttribute('data-track-row')) return 'track:' + node.getAttribute('data-track-row');
    return 'other:' + (node.id || 'x');
  }

  /* OVERLAP RULE (OPTION, not a decision — see NOTES.md):
     O1 replace | O2 stack with depth cap 2 (default) | O3 refuse */
  function requestLens(objectId, date, originEl, t0) {
    var rule = state.overlapRule;
    if (state.stack.length > 0) {
      if (rule === 'refuse') {
        showRefuse();
        note('lens-refused', { objectId: objectId });
        var top = state.stack[state.stack.length - 1];
        top.node.focus();
        return;
      }
      if (rule === 'replace') closeAllLenses({ restoreFocus: false });
      if (rule === 'stack2' && state.stack.length >= 2) closeTopLens({ restoreFocus: false });
    }
    openLens(objectId, date, originEl, t0);
  }

  function openLens(objectId, date, originEl, t0) {
    var obj = objectOf(objectId);
    originEl.setAttribute('data-origin', 'true');
    var frame = {
      objectId: objectId, date: date,
      originKey: originKeyOf(originEl), originEl: originEl, node: null
    };
    var node = buildLens(frame);
    document.getElementById('lens-stack').appendChild(node);
    frame.node = node;
    state.stack.push(frame);
    syncStackChrome();
    document.getElementById('scrim').hidden = false;
    positionAll();
    node.focus();
    var depth = state.stack.length - 1;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        metrics.opens.push({
          objectId: objectId, kind: obj.kind, depth: depth,
          anchorMode: state.anchorMode, rule: state.overlapRule,
          ms: +(performance.now() - t0).toFixed(2)
        });
      });
    });
    note('lens-open', { objectId: objectId, depth: depth, rule: state.overlapRule });
  }

  function buildLens(frame) {
    var obj = objectOf(frame.objectId);
    var lens = el('div', 'lens');
    lens.tabIndex = -1;
    lens.setAttribute('data-lens', obj.id);
    lens.setAttribute('data-lens-kind', obj.kind);
    lens.setAttribute('data-testid', 'lens');
    lens.setAttribute('role', 'dialog');
    lens.setAttribute('aria-label', obj.name + ' lens');

    var close = el('button', 'lens-close', '닫기');
    close.type = 'button';
    close.setAttribute('data-testid', 'lens-close');
    close.addEventListener('click', function (ev) { ev.stopPropagation(); closeTopLens({ restoreFocus: true }); });
    lens.appendChild(close);

    var KIND_LABEL = { vendor: 'Vendor lens', event: 'Event lens', schedule: 'General schedule lens' };
    lens.appendChild(el('div', 'lens-kind', KIND_LABEL[obj.kind]));
    lens.appendChild(el('div', 'lens-title', obj.name));
    var originLine = el('div', 'lens-origin', 'origin · ' + frame.originKey.replace('entry:', '달력 ').replace('track:', '업무트랙 '));
    originLine.setAttribute('data-testid', 'lens-origin-line');
    lens.appendChild(originLine);

    var dl = el('dl', 'lens-facts');
    dl.setAttribute('data-testid', 'lens-facts');
    function fact(k, v, testid) {
      dl.appendChild(el('dt', null, k));
      var dd = el('dd', 'fact', v);
      if (testid) dd.setAttribute('data-testid', testid);
      dl.appendChild(dd);
    }
    var statusKey = obj.id + '@' + frame.date;
    if (obj.kind === 'vendor') {
      fact('분류', obj.category);
      fact('담당', obj.contact);
      fact('참가계획', obj.plan);
      fact('날짜예외', obj.planExceptions.length ? obj.planExceptions.join(' / ') : '없음');
      fact('이 날짜(' + frame.date + ')', state.entryStatus[statusKey] || '해당 없음', 'lens-status');
      fact('연결 행사', obj.linkedEventIds.length ? obj.linkedEventIds.map(function (i) { return objectOf(i).name; }).join(', ') : '없음');
    } else if (obj.kind === 'event') {
      fact('기간', obj.period);
      fact('장소', obj.venue);
      fact('참가업체', obj.vendorIds.length ? obj.vendorIds.map(function (i) { return objectOf(i).name; }).join(', ') : '없음');
      fact('이 날짜(' + frame.date + ')', state.entryStatus[statusKey] || '해당 없음', 'lens-status');
    } else {
      fact('일시', frame.date + ' ' + obj.time);
      fact('장소', obj.place);
      fact('담당', obj.owner);
      fact('이 날짜(' + frame.date + ')', state.entryStatus[statusKey] || '해당 없음', 'lens-status');
    }
    fact('업무', countsText(obj), 'lens-tasks');
    fact('첨부', obj.attachments.count > 0 ? obj.attachments.count + '건 · ' + obj.attachments.kinds : '없음', 'lens-attachments');
    lens.appendChild(dl);

    var actions = el('div', 'lens-actions');
    var hasEntry = !!state.entryStatus[statusKey];
    var cyc = el('button', null, hasEntry ? '이 날짜 상태 바꾸기' : '이 날짜 항목 없음');
    cyc.type = 'button';
    cyc.setAttribute('data-testid', 'lens-status-cycle');
    cyc.disabled = !hasEntry;
    cyc.addEventListener('click', function (ev) {
      ev.stopPropagation();
      cycleStatus(frame);
    });
    actions.appendChild(cyc);

    var fs = el('button', null, 'Focus Surface 열기');
    fs.type = 'button';
    fs.setAttribute('data-testid', 'lens-focus-open');
    fs.addEventListener('click', function (ev) { ev.stopPropagation(); openFocus(frame); });
    actions.appendChild(fs);

    actions.appendChild(el('span', 'scope-note', '범위: 이 날짜만'));
    lens.appendChild(actions);

    var dep = el('div', 'lens-depth', '');
    dep.setAttribute('data-testid', 'lens-depth-line');
    lens.appendChild(dep);

    lens.addEventListener('click', function (ev) { ev.stopPropagation(); });
    return lens;
  }

  function cycleStatus(frame) {
    var obj = objectOf(frame.objectId);
    var key = obj.id + '@' + frame.date;
    if (!state.entryStatus[key]) return;
    var next = nextStatus(obj, state.entryStatus[key]);
    state.entryStatus[key] = next;
    refreshEntry(obj.id, frame.date);
    var dd = frame.node.querySelector('[data-testid="lens-status"]');
    if (dd) dd.textContent = next;
    note('status-change', { objectId: obj.id, date: frame.date, to: next });
    positionAll();
  }

  function syncStackChrome() {
    state.stack.forEach(function (fr, i) {
      fr.node.setAttribute('data-depth', String(i));
      fr.node.classList.toggle('has-above', i < state.stack.length - 1);
      var d = fr.node.querySelector('[data-testid="lens-depth-line"]');
      if (d) d.textContent = '스택 깊이 ' + (i + 1) + ' / 상한 ' + (state.overlapRule === 'stack2' ? 2 : 1) + ' · 규칙 ' + state.overlapRule;
    });
  }

  function closeTopLens(opts) {
    if (!state.stack.length) return;
    var fr = state.stack.pop();
    fr.node.remove();
    if (fr.originEl && fr.originEl.isConnected) fr.originEl.removeAttribute('data-origin');
    syncStackChrome();
    if (!state.stack.length) {
      document.getElementById('scrim').hidden = true;
      document.getElementById('tether').hidden = true;
    }
    if (opts && opts.restoreFocus) {
      if (state.stack.length) state.stack[state.stack.length - 1].node.focus();
      else if (fr.originEl && fr.originEl.isConnected) fr.originEl.focus();
    }
    positionAll();
    note('lens-close', { objectId: fr.objectId, remaining: state.stack.length });
  }

  function closeAllLenses(opts) {
    while (state.stack.length) closeTopLens({ restoreFocus: false });
    if (opts && opts.restoreFocus === true) { /* nothing to restore */ }
  }

  function showRefuse() {
    var h = document.getElementById('refuse-hint');
    h.hidden = false;
    clearTimeout(showRefuse._t);
    showRefuse._t = setTimeout(function () { h.hidden = true; }, 2500);
  }

  /* ---------------- positioning ---------------- */
  function rectOf(n) { var r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }
  function overlapArea(a, b) {
    var w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    var h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    return (w > 0 && h > 0) ? w * h : 0;
  }

  function positionAll() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var avoid = state.stack
      .filter(function (fr) { return fr.originEl && fr.originEl.isConnected; })
      .map(function (fr) { return rectOf(fr.originEl); });

    if (state.anchorMode === 'centered') {
      state.stack.forEach(function (fr, i) {
        var h = fr.node.offsetHeight || 260;
        var x = Math.round((vw - LENS_W) / 2) + i * 26;
        var y = Math.round((vh - h) / 2) + i * 26;
        fr.node.style.left = x + 'px';
        fr.node.style.top = y + 'px';
      });
      drawTether();
      return;
    }

    document.getElementById('tether').hidden = true;
    /* Other clickable sheet items also matter: a lens that covers them makes the sheet
       unusable while it is open, which is the same failure as losing the origin. */
    var others = Array.prototype.slice.call(document.querySelectorAll('.entry, .track-row'))
      .filter(function (n) { return n.getAttribute('data-origin') !== 'true' && !n.hidden; })
      .map(rectOf)
      .filter(function (r) { return r.b > 0 && r.t < vh && r.w > 0; });

    state.stack.forEach(function (fr) {
      if (!fr.originEl || !fr.originEl.isConnected) return;
      var o = rectOf(fr.originEl);
      var h = fr.node.offsetHeight || 260;
      var cands = [
        { l: o.r + GAP, t: clamp(o.t - 8, 8, Math.max(8, vh - h - 8)) },
        { l: o.l - LENS_W - GAP, t: clamp(o.t - 8, 8, Math.max(8, vh - h - 8)) },
        { l: clamp(o.l, 8, vw - LENS_W - 8), t: o.b + GAP },
        { l: clamp(o.l, 8, vw - LENS_W - 8), t: o.t - h - GAP }
      ];
      var best = null;
      cands.forEach(function (c) {
        var fits = c.l >= 8 && c.l + LENS_W <= vw - 8 && c.t >= 8 && c.t + h <= vh - 8;
        var box = { l: c.l, t: c.t, r: c.l + LENS_W, b: c.t + h };
        var pen = 0;
        avoid.forEach(function (a) { pen += overlapArea(box, a) * 8; });      /* origins: hard */
        others.forEach(function (a) { pen += overlapArea(box, a); });          /* other items: soft */
        var score = (fits ? 0 : 1e9) + pen;
        if (!best || score < best.score) best = { c: c, score: score };
      });
      fr.node.style.left = Math.round(best.c.l) + 'px';
      fr.node.style.top = Math.round(best.c.t) + 'px';
    });
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function drawTether() {
    var svg = document.getElementById('tether');
    var line = document.getElementById('tether-line');
    if (!state.stack.length) { svg.hidden = true; return; }
    var fr = state.stack[state.stack.length - 1];
    if (!fr.originEl || !fr.originEl.isConnected) { svg.hidden = true; return; }
    var o = rectOf(fr.originEl), l = rectOf(fr.node);
    svg.hidden = false;
    line.setAttribute('x1', String(o.l + o.w / 2));
    line.setAttribute('y1', String(o.t + o.h / 2));
    line.setAttribute('x2', String(l.l + l.w / 2));
    line.setAttribute('y2', String(l.t + l.h / 2));
  }

  /* ---------------- Focus Surface ---------------- */
  function openFocus(frame) {
    var obj = objectOf(frame.objectId);
    state.focus = { objectId: frame.objectId, date: frame.date };
    var host = document.getElementById('focus-surface');
    host.textContent = '';

    var head = el('div', 'focus-head');
    var titleWrap = el('div');
    titleWrap.appendChild(el('div', 'focus-kind', obj.kind));
    titleWrap.appendChild(el('h2', null, obj.name));
    head.appendChild(titleWrap);
    var back = el('button', 'focus-back', 'Lens 로 돌아가기');
    back.type = 'button';
    back.setAttribute('data-testid', 'focus-back');
    back.addEventListener('click', function (ev) { ev.stopPropagation(); closeFocus(); });
    head.appendChild(back);
    host.appendChild(head);

    var cols = el('div', 'focus-cols');

    var c1 = el('div');
    c1.setAttribute('data-testid', 'focus-tasks');
    c1.appendChild(el('h3', null, '업무 / 절차 (예정 · 진행 · 완료)'));
    var ul = el('ul');
    (obj.tasks || []).forEach(function (t) {
      var li = el('li');
      li.setAttribute('data-focus-task', t.id);
      li.appendChild(document.createTextNode(t.title));
      li.appendChild(el('span', 'st', STATE_LABEL[state.taskState[t.id]] + ' · ' + t.due));
      ul.appendChild(li);
    });
    if (!(obj.tasks || []).length) ul.appendChild(el('li', null, '등록된 업무 없음'));
    c1.appendChild(ul);
    cols.appendChild(c1);

    var c2 = el('div');
    c2.setAttribute('data-testid', 'focus-links');
    c2.appendChild(el('h3', null, '연결 (행사 · 업체 · 파일)'));
    var ul2 = el('ul');
    if (obj.kind === 'vendor') {
      obj.linkedEventIds.forEach(function (i) { ul2.appendChild(el('li', null, '행사 · ' + objectOf(i).name)); });
    } else if (obj.kind === 'event') {
      obj.vendorIds.forEach(function (i) { ul2.appendChild(el('li', null, '업체 · ' + objectOf(i).name)); });
    }
    var fileLi = el('li', null, obj.attachments.count > 0
      ? '파일/폴더/압축 ' + obj.attachments.count + '건 존재 (' + obj.attachments.kinds + ')'
      : '연결된 파일 없음');
    fileLi.setAttribute('data-testid', 'focus-attachments');
    ul2.appendChild(fileLi);
    c2.appendChild(ul2);
    cols.appendChild(c2);

    var c3 = el('div');
    c3.setAttribute('data-testid', 'focus-history');
    c3.appendChild(el('h3', null, '변경 이력'));
    var ul3 = el('ul');
    (obj.history || []).forEach(function (h) { ul3.appendChild(el('li', null, h)); });
    c3.appendChild(ul3);
    cols.appendChild(c3);

    host.appendChild(cols);

    if (obj.kind === 'vendor') {
      var scope = el('div', 'plan-scope');
      var allBtn = el('button', null, '전체 참가계획을 확정으로');
      allBtn.type = 'button';
      allBtn.setAttribute('data-testid', 'plan-scope-all');
      allBtn.addEventListener('click', function (ev) { ev.stopPropagation(); applyPlanWide(obj.id); });
      scope.appendChild(allBtn);
      scope.appendChild(document.createTextNode('날짜예외로 표시된 날짜는 유지된다 (특정 날짜 수정과 전체 계획 수정을 구별).'));
      host.appendChild(scope);
    }

    host.hidden = false;
    document.getElementById('lens-stack').style.display = 'none';
    document.getElementById('scrim').hidden = true;
    document.getElementById('tether').hidden = true;
    back.focus();
    note('focus-open', { objectId: obj.id });
  }

  function applyPlanWide(vendorId) {
    var obj = objectOf(vendorId);
    var exceptDates = obj.planExceptions.map(function (s) { return s.split(' ')[0]; });
    Object.keys(F.ENTRIES).forEach(function (d) {
      F.ENTRIES[d].forEach(function (e) {
        if (e.objectId !== vendorId) return;
        if (exceptDates.indexOf(d) >= 0) return;
        state.entryStatus[vendorId + '@' + d] = '확정';
        refreshEntry(vendorId, d);
      });
    });
    note('plan-wide', { objectId: vendorId });
  }

  function closeFocus() {
    var host = document.getElementById('focus-surface');
    host.hidden = true;
    host.textContent = '';
    state.focus = null;
    document.getElementById('lens-stack').style.display = '';
    if (state.stack.length) {
      document.getElementById('scrim').hidden = false;
      /* rebuild top lens so facts reflect any change made in the Focus Surface */
      var top = state.stack[state.stack.length - 1];
      var fresh = buildLens(top);
      top.node.replaceWith(fresh);
      top.node = fresh;
      syncStackChrome();
      positionAll();
      fresh.focus();
    }
    note('focus-close', {});
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    /* the scrim is visual only (pointer-events:none) so the sheet under the lens stays clickable.
       click-outside is handled here instead. */
    document.addEventListener('click', function (ev) {
      if (!state.stack.length || state.focus) return;
      var t = ev.target;
      if (!t || !t.isConnected) return; /* the node was removed by its own handler */
      if (t.closest && t.closest('#spike-bar, .track-filters, .lens, #focus-surface')) return;
      closeTopLens({ restoreFocus: true });
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (state.focus) closeFocus();
      else if (state.stack.length) closeTopLens({ restoreFocus: true });
    });
    document.getElementById('anchor-mode').addEventListener('change', function (ev) {
      state.anchorMode = ev.target.value;
      positionAll();
      note('anchor-mode', { to: state.anchorMode });
    });
    document.getElementById('overlap-rule').addEventListener('change', function (ev) {
      state.overlapRule = ev.target.value;
      closeAllLenses({ restoreFocus: false });
      syncStackChrome();
      note('overlap-rule', { to: state.overlapRule });
    });
    document.getElementById('reset-state').addEventListener('click', function () {
      var am = state.anchorMode, or_ = state.overlapRule;
      closeAllLenses({ restoreFocus: false });
      if (state.focus) closeFocus();
      initState();
      state.anchorMode = am; state.overlapRule = or_;
      renderCalendar(); renderTrack();
    });
    Array.prototype.forEach.call(document.querySelectorAll('.filter'), function (b) {
      b.addEventListener('click', function () {
        state.filter = b.getAttribute('data-filter');
        Array.prototype.forEach.call(document.querySelectorAll('.filter'), function (x) {
          x.classList.toggle('is-on', x === b);
        });
        renderTrack();
        state.stack.forEach(function (fr) {
          if (fr.originKey.indexOf('track:') === 0) {
            var n = document.querySelector('[data-track-row="' + fr.originKey.slice(6) + '"]');
            if (n) { n.setAttribute('data-origin', 'true'); fr.originEl = n; }
          }
        });
        positionAll();
      });
    });
    window.addEventListener('resize', positionAll);
    window.addEventListener('scroll', positionAll, { passive: true });
  }

  /* test/measurement surface */
  window.__spike = {
    metrics: metrics,
    get stackDepth() { return state.stack.length; },
    get overlapRule() { return state.overlapRule; },
    get anchorMode() { return state.anchorMode; },
    statusOf: function (objectId, date) { return state.entryStatus[objectId + '@' + date]; },
    lastOpenMs: function () { return metrics.opens.length ? metrics.opens[metrics.opens.length - 1].ms : null; },
    opens: function () { return metrics.opens.slice(); },
    occlusion: function () {
      function rect(n) { var r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }
      function ov(a, b) {
        var w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        return (w > 0 && h > 0) ? w * h : 0;
      }
      var lenses = Array.prototype.slice.call(document.querySelectorAll('.lens')).map(rect);
      var items = Array.prototype.slice.call(document.querySelectorAll('.entry, .track-row'))
        .filter(function (n) { return !n.hidden; });
      var originArea = 0, itemsHidden = 0, itemArea = 0;
      items.forEach(function (n) {
        var r = rect(n), a = (r.r - r.l) * (r.b - r.t), cov = 0;
        lenses.forEach(function (L) { cov += ov(r, L); });
        if (n.getAttribute('data-origin') === 'true') originArea += cov;
        else { itemArea += cov; if (a > 0 && cov / a >= 0.5) itemsHidden++; }
      });
      return { originCoveredPx: Math.round(originArea), otherItemsCoveredPx: Math.round(itemArea), otherItemsMostlyHidden: itemsHidden, itemCount: items.length };
    },
    ready: false
  };

  document.addEventListener('DOMContentLoaded', function () {
    initState();
    document.getElementById('month-label').textContent = F.MONTH.label;
    renderCalendar();
    renderTrack();
    wire();
    window.__spike.ready = true;
    document.body.setAttribute('data-ready', '1');
  });
})();
