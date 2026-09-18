/* Integrated UX Prototype v0
   Ambient -> Quick -> Calendar Sheet -> Object Lens -> Focus Surface
   plain HTML/CSS/vanilla JS. no framework / bundler / CDN. */
'use strict';

const F = window.FIX;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ic = (id, extra) => `<svg class="ic ${extra || ''}" viewBox="0 0 18 18" aria-hidden="true"><use href="#${id}"></use></svg>`;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/* ------------------------------------------------------------------ state */
const S = {
  stage: 'idle',             // idle | ambient | quick | calendar
  ym: { y: 2026, m: 9 },
  calView: 'month',          // month | matrix
  density: 'compact',        // compact(기본) | comfortable | dense2(비기본)
  lens: null,                // { kind, id, date, originKey }
  focus: null,               // { kind, id, date, originKey }
  quickAdd: null,            // { date, expanded }
  dday: { open: false, count: 20, collapsed: {} },
  layoutEdit: false,
  cameFromQuick: false,
  matrixHiDate: null,
  added: [],                 // Quick / Quick Add 로 추가된 일정 (메모리)
  pinPos: {},                // Layout Edit 에서 옮긴 pin 좌표
  ambientPos: null,          // Layout Edit 에서 옮긴 ambient 좌표
  ddayPos: null,
  statusOverride: {}         // 'v:v01@2026-09-23' -> '보류'  (이 날짜만)
};
const DDAY_SMALL = ['d04', 'd01', 'd03'];   // 3건 픽스처 (pin 1 + 그룹 2)

/* ------------------------------------------------------------- data helpers */
function schedulesOn(d) { return F.schedulesOn(d).concat(S.added.filter(s => s.date === d)); }
function allSchedules() { return F.SCHEDULES.concat(S.added); }
function schedById(id) { return allSchedules().find(s => s.id === id); }
function vendorById(id) { return F.VENDORS.find(v => v.id === id); }
function eventById(id) { return F.EVENTS.find(e => e.id === id); }
function partStatus(vendorId, date) {
  const k = `v:${vendorId}@${date}`;
  if (S.statusOverride[k]) return S.statusOverride[k];
  const p = F.PLANS.find(p => p.vendorId === vendorId && p.dates.includes(date));
  const ex = p && p.exceptions.find(e => e.date === date);
  return ex ? ex.status : '확정';
}
function workRoll(kind, id) {
  const w = F.worksOf(kind, id);
  return { done: w.filter(x => x.state === 'done').length, doing: w.filter(x => x.state === 'doing').length,
           planned: w.filter(x => x.state === 'planned').length, all: w };
}
function attOf(id) { return F.ATTACHMENTS[id] || { folder: 0, zip: 0, doc: 0 }; }
function attTotal(id) { const a = attOf(id); return a.folder + a.zip + a.doc; }
function ddaySet() {
  const list = S.dday.count === 20 ? F.DDAY : F.DDAY.filter(d => DDAY_SMALL.includes(d.id));
  return list.map(d => ({ ...d, days: F.daysUntil(d.date) })).sort(prioCmp);
}
/* PRIORITY RULE — P1 days 오름차순, P2 title 코드포인트 오름차순 (spike D 규칙 그대로) */
function prioCmp(a, b) { return a.days - b.days || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0); }
const BUCKETS = [
  { key: 'overdue', name: '기한 지남', test: d => d < 0 },
  { key: 'today',   name: '오늘',      test: d => d === 0 },
  { key: 'week',    name: '7일 이내',  test: d => d >= 1 && d <= 7 },
  { key: 'month',   name: '30일 이내', test: d => d >= 8 && d <= 30 },
  { key: 'later',   name: '그 이후',   test: d => d > 30 }
];
function ddayLabel(n) { return n === 0 ? 'D-DAY' : n < 0 ? `D+${-n}` : `D-${n}`; }
function todayItems() {
  const t = F.TODAY, out = [];
  schedulesOn(t).forEach(s => out.push({ kind: 'schedule', id: s.id, date: t, time: s.time, title: s.title, status: s.status, sub: s.repeat || '일반 사무일정' }));
  F.eventsOn(t).forEach(e => out.push({ kind: 'event', id: e.id, date: t, time: '', title: e.name, status: e.status, sub: e.place }));
  F.participationOn(t).forEach(p => out.push({ kind: 'vendor', id: p.vendorId, date: t, time: '', title: p.vendor.name, status: partStatus(p.vendorId, t), sub: eventById(p.eventId).name }));
  return out.sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
}
function nextItems(n) {
  const out = [];
  allSchedules().filter(s => s.date > F.TODAY).forEach(s => out.push({ kind: 'schedule', id: s.id, date: s.date, time: s.time, title: s.title, status: s.status }));
  F.EVENTS.filter(e => e.from > F.TODAY).forEach(e => out.push({ kind: 'event', id: e.id, date: e.from, time: '', title: e.name, status: e.status }));
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).slice(0, n);
}
function needsConfirm() {
  const out = [];
  allSchedules().filter(s => s.status === '확인 필요').forEach(s => out.push({ kind: 'schedule', id: s.id, date: s.date, title: s.title }));
  F.EVENTS.filter(e => e.status === '확인 필요').forEach(e => out.push({ kind: 'event', id: e.id, date: e.from, title: e.name }));
  F.PLANS.forEach(p => p.exceptions.filter(x => x.status === '보류').forEach(x =>
    out.push({ kind: 'vendor', id: p.vendorId, date: x.date, title: `${vendorById(p.vendorId).name} — ${x.date.slice(5)} 보류` })));
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
function monthGrid(y, m) {
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(Date.UTC(y, m - 1, 1 - first.getUTCDay()));
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start.getTime() + (w * 7 + d) * 86400000);
      row.push({ iso: dt.toISOString().slice(0, 10), dom: dt.getUTCDate(), out: dt.getUTCMonth() !== m - 1, dow: d });
    }
    weeks.push(row);
  }
  while (weeks.length > 4 && weeks[weeks.length - 1].every(c => c.out)) weeks.pop();
  return weeks;
}

/* ------------------------------------------------------------------ render */
function render() {
  const b = document.body;
  b.dataset.stage = S.stage;
  b.dataset.density = S.density;
  b.dataset.calView = S.calView;
  b.dataset.layoutEdit = S.layoutEdit ? '1' : '0';

  renderDesktop();
  renderAmbient();
  renderDday();
  renderQuick();
  renderSheet();
  renderEditbar();

  const sc = $('#scrim');
  sc.hidden = !(S.stage === 'calendar' || S.focus);
  sc.style.zIndex = S.focus ? '45' : '30';
  positionPanels();
  if (S.lens) drawLens();
  if (S.focus) drawFocus(); else $('#focus').hidden = true;
  if (S.quickAdd) drawQuickAdd(); else $('#quickAdd').hidden = true;
  measureDdayLedger();
}

/* 1. Desktop ------------------------------------------------------------- */
let deskDone = false;
function renderDesktop() {
  if (deskDone) return; deskDone = true;
  const d1 = F.DESKWORK[0], d2 = F.DESKWORK[1];
  $('#win1').innerHTML =
    `<div class="deskwin-bar">${ic('i-doc')}<span>${esc(d1.title)}</span><span class="sp">한글</span></div>
     <div class="deskwin-body"><div class="ttl">2026년 농특산물 유통지원 계획(안)</div>
     ${d1.lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
  $('#win2').innerHTML =
    `<div class="deskwin-bar">${ic('i-grid')}<span>${esc(d2.title)}</span><span class="sp">표계산</span></div>
     <div class="deskwin-body"><table><thead><tr>${d2.rows[0].map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
     <tbody>${d2.rows.slice(1).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#taskbar').innerHTML =
    `<span class="tb-item">${ic('i-grid')}시작</span>
     <span class="tb-item">${ic('i-doc')}유통지원 계획(안)</span>
     <span class="tb-item">${ic('i-grid')}업체참가현황</span>
     <span class="tb-item">${ic('i-cal')}WorkDashboard</span>
     <span class="tb-clock"><div>오후 4:12</div><div>2026-09-18</div></span>`;
}

/* 2. Ambient ------------------------------------------------------------- */
function renderAmbient() {
  const a = $('#ambient');
  const active = S.stage !== 'idle';
  a.dataset.mode = active ? 'active' : 'rest';
  const t = todayItems(), nc = needsConfirm();
  const pins = ddaySet().filter(d => d.pinned);
  const head = `<div class="amb-head">
      <span class="amb-date">9월 18일</span><span class="amb-dow">금요일</span>
      <span class="amb-drag" data-drag="ambient">${ic('i-edit', 'ic-sm')} 위치 이동</span>
    </div>`;
  if (!active) {
    const p0 = pins[0];
    a.innerHTML = head + `<div class="amb-rest" data-act="wake" role="button" tabindex="0">
      오늘 <b>${t.length}</b><span class="sep">·</span>확인 필요 <b>${nc.length}</b>
      <span class="sep">·</span><b>${p0 ? ddayLabel(p0.days) : ''}</b> ${esc(p0 ? p0.title : '')}</div>`;
    return;
  }
  const row = (o, right) => `<button class="amb-row" data-open="${o.kind}" data-id="${esc(o.id)}" data-date="${o.date}">
      <span class="t">${esc(o.time || o.date.slice(5).replace('-', '.'))}</span>
      <span class="n">${esc(o.title)}</span>${right ? `<span class="d">${right}</span>` : ''}</button>`;
  a.innerHTML = head + `<div class="amb-body">
      <div class="amb-sec"><div class="amb-lab">오늘 <span class="n">${Math.min(3, t.length)} / ${t.length}</span></div>
        ${t.slice(0, 3).map(o => row(o)).join('')}
        ${t.length > 3 ? `<button class="amb-more" data-act="quick">Quick 에서 오늘 ${t.length}건 전부 보기</button>` : ''}</div>
      <div class="amb-sec"><div class="amb-lab">다음</div>
        ${nextItems(1).map(o => row(o, ddayLabel(F.daysUntil(o.date)))).join('')}</div>
      <div class="amb-sec needs"><div class="amb-lab">확인 필요 <span class="n">${Math.min(2, nc.length)} / ${nc.length}</span></div>
        ${nc.slice(0, 2).map(o => row(o)).join('')}
        ${nc.length > 2 ? `<button class="amb-more" data-act="quick">Quick 에서 ${nc.length}건 전부 보기</button>` : ''}</div>
      <div class="amb-sec"><div class="amb-lab">중요 D-day <span class="n">${pins.length}</span></div>
        ${pins.map(p => `<button class="amb-row" data-act="dday">
          <span class="n">${esc(p.title)}</span><span class="d">${ddayLabel(p.days)}</span></button>`).join('')}</div>
    </div>
    <div class="amb-acts">
      <button class="btn btn-out" data-act="quick">${ic('i-clock')}Quick</button>
      <button class="btn btn-out" data-act="calendar">${ic('i-cal')}캘린더</button>
      <button class="btn btn-out" data-act="dday">${ic('i-pin')}D-day</button>
      <button class="btn btn-ghost" data-act="layout">${ic('i-edit')}배치 편집</button>
    </div>`;
}

/* 3. Quick --------------------------------------------------------------- */
function renderQuick() {
  const q = $('#quick');
  q.hidden = S.stage !== 'quick';
  if (q.hidden) return;
  const t = todayItems();
  q.innerHTML = `<div class="q-head">${ic('i-clock')}<h2>Quick</h2>
      <span class="sub">오늘 · 2026-09-18 (금)</span>
      <button class="btn btn-ghost" data-act="back" aria-label="닫기">${ic('i-x')}</button></div>
    <div class="q-list">${t.map(o => `<button class="q-item" data-open="${o.kind}" data-id="${esc(o.id)}" data-date="${o.date}">
        <span class="t">${esc(o.time || '—')}</span><span class="n">${esc(o.title)}</span>
        <span class="k">${esc(o.kind === 'vendor' ? '업체' : o.kind === 'event' ? '행사' : '일정')}${o.status === '확인 필요' ? ' · 확인 필요' : ''}</span>
      </button>`).join('')}</div>
    <div class="q-add"><div class="q-add-row">
        <input type="text" id="qfast" placeholder="오늘 일정 한 줄 추가" style="flex:1">
        <button class="btn btn-pri" data-act="qfast-add">${ic('i-add')}추가</button>
      </div></div>
    <div class="q-foot">
      <button class="btn btn-out" data-act="calendar">${ic('i-cal')}캘린더로 들어가기</button>
      <button class="btn btn-out" data-act="dday">${ic('i-pin')}D-day</button></div>`;
}

/* 4/5/6. Calendar Sheet -------------------------------------------------- */
function renderSheet() {
  const sh = $('#sheet');
  sh.hidden = S.stage !== 'calendar';
  if (sh.hidden) return;
  const { y, m } = S.ym;
  const parts = F.PLANS.reduce((n, p) => n + p.dates.filter(d => d.startsWith(`${y}-${String(m).padStart(2, '0')}`)).length, 0);
  sh.innerHTML = `
    <div class="sh-head">
      <button class="btn" data-act="prev-month" aria-label="이전 달">${ic('i-back')}</button>
      <button class="btn" data-act="next-month" aria-label="다음 달"><svg class="ic" viewBox="0 0 18 18" style="transform:rotate(180deg)"><use href="#i-back"></use></svg></button>
      <div class="sh-title"><h2>${y}년 ${m}월</h2>
        <span class="sub">일반 사무일정 · 행사 · 업체 참가계획을 한 캘린더에서</span></div>
      <span class="grow"></span>
      <span class="seg" role="group" aria-label="뷰">
        <button class="btn" data-act="view-month" aria-pressed="${S.calView === 'month'}">${ic('i-cal')}월</button>
        <button class="btn" data-act="view-matrix" aria-pressed="${S.calView === 'matrix'}">${ic('i-grid')}업체 매트릭스</button>
      </span>
      <span class="seg" role="group" aria-label="밀도">
        <button class="btn" data-act="den-compact" aria-pressed="${S.density === 'compact'}">조밀</button>
        <button class="btn" data-act="den-comfortable" aria-pressed="${S.density === 'comfortable'}">여유</button>
        <button class="btn" data-act="den-dense2" aria-pressed="${S.density === 'dense2'}">조밀 2열</button>
      </span>
      <button class="btn btn-ghost" data-act="back" aria-label="캘린더 닫기">${ic('i-x')}</button>
    </div>
    <div class="sh-meta">
      <span>행사 <b>${F.EVENTS.length}</b></span><span>일반 사무일정 <b>${allSchedules().length}</b></span>
      <span>업체 <b>${F.VENDORS.length}</b></span><span>업체 참가 <b>${parts}</b>건</span>
      <span>${S.calView === 'month' ? '기본: 가변 높이 week row · 업체명 1열 직접 표기 · 본문 세로 스크롤' : '보조 뷰: 업체 × 날짜. 업체명이 행 헤더로 끝까지 남는다'}</span>
    </div>
    ${S.calView === 'month' ? monthMarkup(y, m) : matrixMarkup(y, m)}
    <div class="sh-foot">
      <span>항목 클릭 → Object Lens · 빈 날짜 클릭 → Quick Add</span><span class="grow"></span>
      <span><kbd>Esc</kbd> 뒤로</span></div>`;
}

function monthMarkup(y, m) {
  const weeks = monthGrid(y, m);
  return `<div class="week-head">${DOW.map((d, i) => `<div class="${i === 0 ? 'sun' : ''}">${d}</div>`).join('')}</div>
    <div class="cal-body" id="calBody">${weeks.map(w => `<div class="week-row">${w.map(c => dayMarkup(c)).join('')}</div>`).join('')}</div>`;
}

function dayMarkup(c) {
  const scs = schedulesOn(c.iso), evs = F.eventsOn(c.iso), ps = F.participationOn(c.iso);
  const isToday = c.iso === F.TODAY;
  const items = evs.map(e => {
    const st = e.status;
    return `<button class="it it-ev" data-status="${esc(st)}" data-open="event" data-id="${e.id}" data-date="${c.iso}"
      data-lens-origin="e:${e.id}@${c.iso}">${esc(e.name)}
      <span class="ev-ph">${esc(e.place)}</span>${st === '확인 필요' ? '<span class="st">확인 필요</span>' : ''}
      ${attTotal(e.id) ? `<span class="att">${ic('i-doc', 'ic-sm')}첨부 ${attTotal(e.id)}</span>` : ''}</button>`;
  }).join('') + scs.map(s =>
    `<button class="it it-sc" data-status="${esc(s.status)}" data-open="schedule" data-id="${s.id}" data-date="${c.iso}"
      data-lens-origin="s:${s.id}@${c.iso}"><span class="t">${esc(s.time)}</span>${esc(s.title)}
      ${s.status === '확인 필요' ? '<span class="st">확인 필요</span>' : s.status === '진행' ? '<span class="st">진행</span>' : s.status === '완료' ? '<span class="st">완료</span>' : ''}
      ${s.attach ? `<span class="att">${ic('i-doc', 'ic-sm')}${s.attach}</span>` : ''}</button>`).join('');

  const vend = ps.length ? `<div class="v-lab">참가 업체 ${ps.length}<span class="line"></span></div>
    <div class="v-list">${ps.map(p => {
      const st = partStatus(p.vendorId, c.iso);
      return `<button class="it it-v" data-status="${esc(st)}" data-open="vendor" data-id="${p.vendorId}" data-date="${c.iso}"
        data-lens-origin="v:${p.vendorId}@${c.iso}"><span class="vn">${esc(p.vendor.name)}</span>${st !== '확정' ? `<span class="st">${esc(st)}</span>` : ''}</button>`;
    }).join('')}</div>` : '';

  const n = items ? '' : '';
  return `<div class="day ${c.out ? 'out' : ''} ${isToday ? 'today' : ''}" data-date="${c.iso}" data-vendors="${ps.length}">
      <div class="day-n">${c.dom}${ps.length ? `<span class="cnt">업체 ${ps.length}</span>` : ''}</div>
      <button class="day-add" data-act="quick-add" data-date="${c.iso}" aria-label="${c.iso} 일정 추가">${ic('i-add', 'ic-sm')}</button>
      ${items}${vend}${n}
      <button class="day-empty" data-act="quick-add" data-date="${c.iso}" aria-label="${c.iso} 빈 날짜에 추가"></button>
    </div>`;
}

function matrixMarkup(y, m) {
  const pre = `${y}-${String(m).padStart(2, '0')}`;
  const dates = F.participationDates().filter(d => d.startsWith(pre));
  const rows = F.VENDORS.filter(v => F.planOf(v.id).some(p => p.dates.some(d => d.startsWith(pre))));
  return `<div class="mx-wrap"><table class="mx">
    <thead><tr><th class="vh">업체 ${rows.length}</th>
      ${dates.map(d => `<th class="${d === S.matrixHiDate ? 'hi' : ''}">${d.slice(5).replace('-', '.')}<br><span style="font-weight:400;color:var(--ink-4)">${DOW[new Date(d + 'T00:00:00Z').getUTCDay()]}</span></th>`).join('')}</tr></thead>
    <tbody>${rows.map(v => `<tr><th class="vh">${esc(v.name)}<span class="va">${esc(v.area)}</span></th>
      ${dates.map(d => {
        const on = F.planOf(v.id).some(p => p.dates.includes(d));
        if (!on) return `<td class="off ${d === S.matrixHiDate ? 'hi' : ''}">·</td>`;
        const st = partStatus(v.id, d);
        return `<td class="on ${d === S.matrixHiDate ? 'hi' : ''}" data-status="${esc(st)}" data-open="vendor" data-id="${v.id}" data-date="${d}"
          data-lens-origin="v:${v.id}@${d}">${esc(st)}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* 7/8/9. Object Lens ----------------------------------------------------- */
function originEl(key) { return document.querySelector(`[data-lens-origin="${key}"]`); }

function openLens(kind, id, date, key) {
  S.lens = { kind, id, date, originKey: key };   // 정확히 하나. 새 객체 선택은 교체다.
  S.focus = null;
  render();
}
function closeLens(returnFocus) {
  const key = S.lens && S.lens.originKey;
  S.lens = null;
  $('#lensLayer').innerHTML = '';
  render();
  if (returnFocus !== false && key) { const o = originEl(key); if (o && o.focus) o.focus(); }
}

function lensBody(kind, id, date) {
  const roll = workRoll(kind, id), att = attOf(id);
  const attTxt = attTotal(id) ? `${attTotal(id)}건 · 폴더 ${att.folder} · 압축 ${att.zip} · 문서 ${att.doc}` : '없음';
  const wk = `완료 ${roll.done} · 진행 ${roll.doing} · 예정 ${roll.planned}`;
  if (kind === 'vendor') {
    const v = vendorById(id), plans = F.planOf(id);
    const evNames = [...new Set(plans.map(p => eventById(p.eventId).name))].join(', ');
    const days = plans.reduce((n, p) => n + p.dates.length, 0);
    const exs = plans.flatMap(p => p.exceptions);
    return { kind: '업체', title: v.name, facts: [
      ['지역 · 대표', `${v.area} · ${v.rep}`], ['참가 행사', evNames],
      ['참가계획', plans.map(p => p.pattern).join(' / ')], ['참가일수', `${days}일`],
      ['이 날짜', `${date} — ${partStatus(id, date)}`],
      ['날짜예외', exs.length ? exs.map(e => `${e.date.slice(5)} ${e.status}(${e.reason})`).join(', ') : '없음'],
      ['업무', wk], ['첨부', attTxt]] };
  }
  if (kind === 'event') {
    const e = eventById(id);
    const vs = [...new Set(F.PLANS.filter(p => p.eventId === id).map(p => p.vendorId))];
    return { kind: '행사', title: e.name, facts: [
      ['기간', `${e.from} ~ ${e.to}`], ['장소', e.place], ['담당', e.owner],
      ['상태', e.status], ['참가 업체', `${vs.length}개소`], ['업무', wk], ['첨부', attTxt]] };
  }
  const s = schedById(id);
  return { kind: '일반 사무일정', title: s.title, facts: [
    ['일시', `${s.date} ${s.time}`], ['반복', s.repeat || '없음'], ['상태', s.status],
    ['업무', wk], ['첨부', attTxt]] };
}

function drawLens() {
  const L = S.lens, layer = $('#lensLayer');
  const o = originEl(L.originKey);
  if (!o) { layer.innerHTML = ''; return; }
  o.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const d = lensBody(L.kind, L.id, L.date);
  layer.innerHTML = `<div class="lens" data-kind="${L.kind}" data-id="${esc(L.id)}" data-origin="${esc(L.originKey)}"
      role="dialog" aria-label="${esc(d.kind)} Lens" style="visibility:hidden">
    <div class="lens-head"><div><span class="lens-kind">${esc(d.kind)} LENS</span><h3>${esc(d.title)}</h3></div>
      <button class="btn btn-ghost x" data-act="lens-close" aria-label="Lens 닫기">${ic('i-x')}</button></div>
    <dl class="lens-facts">${d.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="lens-scope"><span>범위: 이 날짜만 (${esc(L.date)})</span>
      <select data-act="lens-status">${(L.kind === 'vendor' ? ['확정', '보류', '불참'] : ['예정', '진행', '확인 필요', '완료']).map(s =>
        `<option${curStatus(L) === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="lens-acts"><button class="btn btn-pri" data-act="focus-open">${ic('i-open')}자세히 보기</button>
      <span class="grow"></span><button class="btn btn-out" data-act="lens-close">닫기</button></div>
  </div>`;
  const lens = layer.firstElementChild;
  placeLens(lens, o);
  lens.style.visibility = 'visible';
  $$('.it.is-origin').forEach(e => e.classList.remove('is-origin'));
  o.classList.add('is-origin');
}
function curStatus(L) {
  if (L.kind === 'vendor') return partStatus(L.id, L.date);
  if (L.kind === 'event') return eventById(L.id).status;
  return schedById(L.id).status;
}

function rectOf(e) { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }
function overlap(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}
/* 위치 점수 (프로토타입 가중치, 제품 규칙 아님):
   origin 가림 px² × 100  — origin 을 덮는 후보는 사실상 실격
   다른 sheet 항목 가림 px² ÷ 200 — 업체명 한 줄(약 2,600px²)을 덮으면 13점
   origin 중심 ↔ lens 중심 거리 ÷ 10 — 500px 떨어지면 50점
   즉 "가까운 자리"와 "덜 가리는 자리"를 실제로 맞바꾼다. */
function placeLens(lens, origin) {
  const GAP = 10;
  const sh = $('#sheet');
  const region = $('#calBody') || $('.mx-wrap');
  const box = (!sh.hidden && region) ? region.getBoundingClientRect()
    : (!sh.hidden ? sh.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight });
  const PAD = 8;
  const minX = box.left + PAD, minY = box.top + PAD, W = box.right - PAD, H = box.bottom - PAD;
  const lw = lens.offsetWidth, lh = lens.offsetHeight, o = rectOf(origin);
  const others = $$('#sheet [data-lens-origin]').filter(e => e !== origin).map(rectOf)
    .filter(r => r.right > 0 && r.left < W && r.bottom > 0 && r.top < H);
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const cands = [
    { n: 'right', x: o.right + GAP, y: o.top - 4 },
    { n: 'left', x: o.left - GAP - lw, y: o.top - 4 },
    { n: 'below', x: o.left, y: o.bottom + GAP },
    { n: 'above', x: o.left, y: o.top - GAP - lh }
  ];
  let best = null;
  for (const c of cands) {
    const x = cl(c.x, minX, Math.max(minX, W - lw)), y = cl(c.y, minY, Math.max(minY, H - lh));
    const r = { left: x, top: y, right: x + lw, bottom: y + lh };
    const cx = x + lw / 2, cy = y + lh / 2;
    const ox = (o.left + o.right) / 2, oy = (o.top + o.bottom) / 2;
    const sc = overlap(r, o) * 100
      + others.reduce((n, q) => n + overlap(r, q), 0) / 200
      + Math.hypot(cx - ox, cy - oy) / 10;
    if (!best || sc < best.sc) best = { sc, x, y, n: c.n };
  }
  lens.style.left = best.x + 'px';
  lens.style.top = best.y + 'px';
  lens.dataset.anchor = best.n;
}

/* 10. Focus Surface ------------------------------------------------------ */
function drawFocus() {
  const P = S.focus, f = $('#focus');
  f.hidden = false;
  const d = lensBody(P.kind, P.id, P.date);
  const roll = workRoll(P.kind, P.id);
  const proc = F.PROCEDURES[P.id];
  const att = attOf(P.id);
  const hist = F.HISTORY[P.id] || [];
  const col = (lab, st) => `<div class="wk-col"><h4>${lab} <span class="n">${roll.all.filter(w => w.state === st).length}</span></h4>
    ${roll.all.filter(w => w.state === st).map(w => `<div class="wk" data-state="${st}">${esc(w.title)}
      <span class="due">${esc(w.due.slice(5))}</span>${w.attach ? `<span class="due">첨부 ${w.attach}</span>` : ''}</div>`).join('') || '<div class="wk" style="color:var(--ink-4)">없음</div>'}</div>`;
  let planSec = '';
  if (P.kind === 'vendor') {
    const plans = F.planOf(P.id);
    planSec = `<div class="fo-sec wide"><div class="fo-lab">${ic('i-cal', 'ic-sm')}참가계획 — 전체 계획 vs 날짜예외</div>
      <table class="plan-tbl"><thead><tr><th>행사</th><th>반복 패턴</th><th>날짜</th><th>날짜예외</th></tr></thead>
      <tbody>${plans.map(p => `<tr><td>${esc(eventById(p.eventId).name)}</td><td>${esc(p.pattern)}</td>
        <td>${p.dates.map(x => x.slice(5)).join(' ')}</td>
        <td class="${p.exceptions.length ? 'ex' : ''}">${p.exceptions.length ? p.exceptions.map(e => `${e.date.slice(5)} ${e.status} (${e.reason})`).join(' / ') : '없음'}</td></tr>`).join('')}</tbody></table>
      <div class="scope-note">여기서의 수정은 <b>전체 참가계획</b> 범위다. 특정 날짜만 바꾸는 것은 Lens 의 <b>이 날짜만</b> 범위에서 한다. 전체 계획을 바꿔도 날짜예외는 보존된다.</div>
      <div style="margin-top:8px;display:flex;gap:5px"><button class="btn btn-out" data-act="noop">${ic('i-edit')}전체 참가계획 수정</button>
        <button class="btn btn-out" data-act="noop">${ic('i-add')}날짜예외 추가</button></div></div>`;
  }
  const linkChips = [];
  if (P.kind === 'vendor') F.planOf(P.id).forEach(p => linkChips.push(['event', p.eventId, eventById(p.eventId).name]));
  if (P.kind === 'event') [...new Set(F.PLANS.filter(p => p.eventId === P.id).map(p => p.vendorId))].slice(0, 8)
    .forEach(v => linkChips.push(['vendor', v, vendorById(v).name]));
  if (P.kind === 'schedule') F.EVENTS.slice(0, 2).forEach(e => linkChips.push(['event', e.id, e.name]));

  f.innerHTML = `<div class="fo-head"><div><span class="kind">${esc(d.kind)} · FOCUS SURFACE</span>
      <h2>${esc(d.title)}</h2><div class="sub">${esc(d.facts.slice(0, 2).map(x => x[1]).join(' · '))}</div></div>
    <div class="acts">
      <button class="btn btn-out" data-act="focus-back">${ic('i-back')}Lens 로 돌아가기</button>
      <button class="btn btn-ghost" data-act="focus-close" aria-label="닫기">${ic('i-x')}</button></div></div>
    <div class="fo-body"><div class="fo-grid">
      <div class="fo-sec wide"><div class="fo-lab">${ic('i-lens', 'ic-sm')}절차 <span class="n">${proc ? proc.name : '등록된 절차 없음'}</span></div>
        <div class="proc">${proc ? proc.steps.map((s, i) => `<span class="step" data-state="${s.state}"><span class="bul"></span>${esc(s.title)}</span>${i < proc.steps.length - 1 ? '<span class="arr">›</span>' : ''}`).join('') : '<span class="step">없음</span>'}</div></div>
      <div class="fo-sec wide"><div class="fo-lab">${ic('i-grid', 'ic-sm')}업무 <span class="n">미래 · 현재 · 완료 전부</span></div>
        <div class="wk-cols">${col('예정', 'planned')}${col('진행', 'doing')}${col('완료', 'done')}</div></div>
      <div class="fo-sec"><div class="fo-lab">${ic('i-folder', 'ic-sm')}첨부 존재</div>
        <div class="att-row"><span>${ic('i-folder', 'ic-sm')}폴더 ${att.folder}</span>
          <span>${ic('i-zip', 'ic-sm')}압축 ${att.zip}</span><span>${ic('i-doc', 'ic-sm')}문서 ${att.doc}</span></div>
        <div class="att-note">존재만 표시한다. 이 프로토타입은 파일을 열거나 다루지 않는다.</div></div>
      <div class="fo-sec"><div class="fo-lab">${ic('i-hist', 'ic-sm')}변경 이력 <span class="n">${hist.length}</span></div>
        <ul class="hist">${hist.map(h => `<li><span class="at">${esc(h.at)}</span><span>${esc(h.what)}</span></li>`).join('') || '<li><span>기록 없음</span></li>'}</ul></div>
      ${planSec}
      <div class="fo-sec wide" style="border-bottom:0"><div class="fo-lab">${ic('i-open', 'ic-sm')}연결</div>
        <div class="links">${linkChips.map(([k, id, nm]) => `<button class="chip" data-open="${k}" data-id="${esc(id)}" data-date="${esc(P.date)}">${esc(nm)}</button>`).join('') || '없음'}</div></div>
    </div></div>`;
}

/* 11. Quick Add ---------------------------------------------------------- */
function drawQuickAdd() {
  const qa = $('#quickAdd'), Q = S.quickAdd;
  qa.hidden = false;
  qa.innerHTML = `<div class="qa-head">${ic('i-add')}<h3>일정 추가</h3>
      <button class="btn btn-ghost x" data-act="qa-close" aria-label="닫기">${ic('i-x')}</button></div>
    <div class="qa-body">
      <div><label for="qa-title">제목</label><input type="text" id="qa-title" placeholder="제목"></div>
      <div class="row">
        <div><label for="qa-date">날짜</label><input type="date" id="qa-date" value="${esc(Q.date)}"></div>
        <div><label for="qa-time">시간</label><input type="time" id="qa-time" value="09:00"></div>
      </div>
      <button class="btn btn-ghost" data-act="qa-more" aria-expanded="${Q.expanded ? 'true' : 'false'}">
        ${ic('i-chev')}${Q.expanded ? '자세한 항목 접기' : '자세한 항목 (분류 · 연결 · 반복 · 첨부)'}</button>
    </div>
    ${Q.expanded ? `<div class="qa-more" id="qa-extra">
      <div><label for="qa-kind">분류</label><select id="qa-kind"><option>일반 사무일정</option><option>행사</option><option>업체 참가</option></select></div>
      <div><label for="qa-link">연결</label><select id="qa-link"><option>연결 없음</option>${F.EVENTS.map(e => `<option>${esc(e.name)}</option>`).join('')}</select></div>
      <div><label for="qa-rep">반복</label><input type="text" id="qa-rep" placeholder="예: 매주 화 09:30"></div>
      <div><label for="qa-att">첨부 폴더 경로</label><input type="text" id="qa-att" placeholder="예: D:\\유통\\2026\\대축제"></div>
    </div>` : ''}
    <div class="qa-foot"><button class="btn btn-pri" data-act="qa-save">추가</button>
      <span class="grow"></span><button class="btn btn-out" data-act="qa-close">취소</button></div>`;
  const cell = document.querySelector(`.day[data-date="${Q.date}"]`);
  const r = cell ? cell.getBoundingClientRect() : { left: innerWidth / 2 - 160, bottom: 160, top: 160, right: 0 };
  const w = qa.offsetWidth, h = qa.offsetHeight, M = 12;
  qa.style.left = Math.max(M, Math.min(r.left, innerWidth - w - M)) + 'px';
  qa.style.top = Math.max(M, Math.min(r.top + 24, innerHeight - h - M)) + 'px';
  const ti = $('#qa-title'); if (ti) ti.focus();
}

/* 12/13. D-day ----------------------------------------------------------- */
function renderDday() {
  const dd = $('#dday');
  dd.hidden = !(S.dday.open && S.stage !== 'calendar');
  if (dd.hidden) return;
  dd.dataset.mode = S.stage === 'idle' ? 'rest' : 'active';
  const items = ddaySet();
  const pins = items.filter(i => i.pinned), grouped = items.filter(i => !i.pinned);
  const groups = BUCKETS.map(b => ({ ...b, items: grouped.filter(i => b.test(i.days)) }))
    .filter(g => g.items.length).sort((a, b) => prioCmp(a.items[0], b.items[0]));
  const collapsedCount = groups.reduce((n, g) => n + (S.dday.collapsed[g.key] ? g.items.length : 0), 0);
  const PW = 176, PH = 74, GAPX = 12, GAPY = 8, COLS = 2;
  const pinRows = Math.ceil(pins.length / COLS) || 1;

  dd.innerHTML = `<div class="dd-head"><div class="top">${ic('i-pin')}<h2>D-day</h2>
      <span class="seg"><button class="btn" data-act="dd-3" aria-pressed="${S.dday.count === 3}">3건</button>
        <button class="btn" data-act="dd-20" aria-pressed="${S.dday.count === 20}">20건</button></span>
      <button class="btn btn-ghost" data-act="layout" aria-label="배치 편집">${ic('i-edit')}</button>
      <button class="btn btn-ghost" data-act="dd-close" aria-label="닫기">${ic('i-x')}</button></div>
      <div class="dd-ledger" id="ddLedger" data-total="${items.length}" data-pinned="${pins.length}"
        data-grouped="${grouped.length}" data-collapsed="${collapsedCount}" data-offscreen="0">
        총 <b>${items.length}</b>건 — 고정 <b>${pins.length}</b> · 그룹 <b>${grouped.length}</b>
        (접힘 <b>${collapsedCount}</b> · 스크롤 밖 <b id="ddOff">0</b>)</div></div>
    <div class="dd-pins" style="height:${pinRows * PH + (pinRows - 1) * GAPY + 34}px">
      <div class="dd-pins-lab">중요 표시 — 독립 pin ${pins.length}건 (이동은 배치 편집에서만)</div>
      ${pins.map((p, i) => {
        const pos = S.pinPos[p.id] || { x: (i % COLS) * (PW + GAPX), y: Math.floor(i / COLS) * (PH + GAPY) };
        return `<div class="pin" data-pin="${p.id}" data-draggable="${S.layoutEdit}" draggable="false"
          style="left:${12 + pos.x}px;top:${26 + pos.y}px;width:${PW}px;height:${PH}px">
          <div class="d ${p.days < 0 ? 'past' : ''}">${ddayLabel(p.days)}</div>
          <div class="t">${esc(p.title)}</div><div class="o">${esc(p.owner)}</div></div>`;
      }).join('')}
    </div>
    <div class="dd-groups" id="ddGroups">${groups.map(g => {
      const c = S.dday.collapsed[g.key] ? '1' : '0';
      return `<div class="dd-group" data-group="${g.key}" data-collapsed="${c}">
        <button class="dd-gh" data-act="dd-toggle" data-group="${g.key}" aria-expanded="${c === '0'}">
          ${ic('i-chev', 'ic-sm chev')}<span class="gn">${g.name}</span><span class="gc">${g.items.length}건</span>
          <span class="gs">${g.items.map(i => esc(i.title)).join(' · ')}</span></button>
        <div class="dd-items"${c === '1' ? ' hidden' : ''}>${g.items.map(i =>
          `<button class="dd-item" data-dday="${i.id}"><span class="d ${i.days < 0 ? 'past' : ''}">${ddayLabel(i.days)}</span>
            <span class="n">${esc(i.title)}</span><span class="o">${esc(i.owner)}</span></button>`).join('')}</div></div>`;
    }).join('')}</div>`;
}

/* 접힌 group 안의 항목도 DOM 에 남는다 — ledger 의 세 숫자 합은 항상 총 건수다 */
function measureDdayLedger() {
  const g = $('#ddGroups'), led = $('#ddLedger');
  if (!g || !led) return;
  const gr = g.getBoundingClientRect();
  let off = 0;
  $$('#ddGroups .dd-item').forEach(it => {
    const r = it.getBoundingClientRect();
    if (r.height === 0) return;                       // 접힘은 별도 집계
    if (r.top < gr.top - 1 || r.bottom > gr.bottom + 1) off++;
  });
  led.dataset.offscreen = String(off);
  const o = $('#ddOff'); if (o) o.textContent = String(off);
}

/* 14. Layout Edit -------------------------------------------------------- */
function renderEditbar() {
  const e = $('#editbar');
  e.hidden = !S.layoutEdit;
  if (e.hidden) return;
  e.innerHTML = `${ic('i-edit')}<span class="t">배치 편집</span>
    <span class="s">pin 이동 · ambient 위치. 평상시에는 어떤 요소도 끌 수 없다.</span>
    <button class="btn btn-pri" data-act="layout-done">완료</button>`;
}
function setLayoutEdit(on) {
  S.layoutEdit = on;
  if (on) { S.stage = S.stage === 'idle' ? 'ambient' : S.stage; S.dday.open = true; S.lens = null; S.focus = null; }
  render();
}

/* --------------------------------------------------------------- position */
function positionPanels() {
  const W = innerWidth, H = innerHeight, M = 20, AMBW = 352, RAIL = 396, BASE = 56;
  const amb = $('#ambient'), dd = $('#dday'), q = $('#quick');
  // ambient 는 어떤 화면 높이에서도 화면을 지배하지 않는다 (EXPERIENCE 2)
  amb.style.maxHeight = Math.round(H * 0.56) + 'px';
  if (S.ambientPos) { amb.style.left = S.ambientPos.x + 'px'; amb.style.top = S.ambientPos.y + 'px'; amb.style.bottom = 'auto'; }
  else { amb.style.left = (W - AMBW - M) + 'px'; amb.style.top = 'auto'; amb.style.bottom = BASE + 'px'; }
  // D-day / Quick 은 ambient 열 왼쪽에 선다. 화면 오른쪽 가장자리에 붙는 상시 column 을 만들지 않는다.
  const railLeft = Math.max(M, W - M - AMBW - 12 - RAIL);
  if (S.ddayPos) { dd.style.left = S.ddayPos.x + 'px'; dd.style.top = S.ddayPos.y + 'px'; dd.style.bottom = 'auto'; }
  else { dd.style.left = railLeft + 'px'; dd.style.top = 'auto'; dd.style.bottom = BASE + 'px'; }
  dd.style.maxHeight = Math.min(560, H - BASE - 24) + 'px';
  q.style.left = railLeft + 'px';
  q.style.bottom = BASE + 'px';
}

/* ------------------------------------------------------------------ events */
function goto(stage) {
  if (stage === 'calendar') { S.cameFromQuick = S.stage === 'quick'; }
  S.stage = stage;
  if (stage === 'calendar') S.dday.open = false;
  render();
}
function back() {
  if (S.quickAdd) { S.quickAdd = null; render(); return; }
  if (S.layoutEdit) { setLayoutEdit(false); return; }
  if (S.focus) { const f = S.focus; S.focus = null; S.lens = { ...f }; render(); return; }
  if (S.lens) { closeLens(true); return; }
  if (S.stage === 'calendar') { S.stage = S.cameFromQuick ? 'quick' : 'ambient'; render(); return; }
  if (S.dday.open) { S.dday.open = false; render(); return; }
  if (S.stage === 'quick') { S.stage = 'ambient'; render(); return; }
  if (S.stage === 'ambient') { S.stage = 'idle'; render(); return; }
}
function openObject(kind, id, date) {
  if (S.stage !== 'calendar') { S.cameFromQuick = S.stage === 'quick'; S.stage = 'calendar'; S.dday.open = false; }
  if (kind === 'vendor' && S.calView === 'month' && date) S.matrixHiDate = date;
  render();
  const key = `${kind[0]}:${id}@${date}`;
  if (!originEl(key)) {
    // 그 날짜 셀에 origin 이 없으면(예: 다른 달) 캘린더만 열어 둔다.
    if (kind === 'schedule') { const s = schedById(id); if (s) date = s.date; }
    if (kind === 'event') { const e = eventById(id); if (e) date = e.from; }
    render();
  }
  const k2 = `${kind[0]}:${id}@${date}`;
  if (originEl(k2)) openLens(kind, id, date, k2);
}

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-act],[data-open],[data-dday]');
  if (!t) {
    if (S.lens && !ev.target.closest('.lens') && !ev.target.closest('#focus')) closeLens(false);
    return;
  }
  const act = t.dataset.act;
  if (t.dataset.open) {
    ev.stopPropagation();
    openObject(t.dataset.open, t.dataset.id, t.dataset.date);
    return;
  }
  if (t.dataset.dday) { const d = F.DDAY.find(x => x.id === t.dataset.dday); if (d) { S.dday.open = false; goto('ambient'); } return; }
  switch (act) {
    case 'wake': goto('ambient'); break;
    case 'quick': goto('quick'); break;
    case 'calendar': goto('calendar'); break;
    case 'dday': S.dday.open = true; S.stage = 'ambient'; render(); break;
    case 'dd-close': S.dday.open = false; render(); break;
    case 'dd-3': S.dday.count = 3; render(); break;
    case 'dd-20': S.dday.count = 20; render(); break;
    case 'dd-toggle': { const g = t.dataset.group; S.dday.collapsed[g] = !S.dday.collapsed[g]; render(); break; }
    case 'layout': setLayoutEdit(true); break;
    case 'layout-done': setLayoutEdit(false); break;
    case 'view-month': S.calView = 'month'; render(); break;
    case 'view-matrix': S.calView = 'matrix'; S.lens = null; render(); break;
    case 'den-compact': S.density = 'compact'; render(); break;
    case 'den-comfortable': S.density = 'comfortable'; render(); break;
    case 'den-dense2': S.density = 'dense2'; render(); break;
    case 'prev-month': S.ym = S.ym.m === 1 ? { y: S.ym.y - 1, m: 12 } : { y: S.ym.y, m: S.ym.m - 1 }; S.lens = null; render(); break;
    case 'next-month': S.ym = S.ym.m === 12 ? { y: S.ym.y + 1, m: 1 } : { y: S.ym.y, m: S.ym.m + 1 }; S.lens = null; render(); break;
    case 'lens-close': ev.stopPropagation(); closeLens(true); break;
    case 'focus-open': ev.stopPropagation(); S.focus = { ...S.lens }; S.lens = null; $('#lensLayer').innerHTML = ''; render(); break;
    case 'focus-back': ev.stopPropagation(); { const f = S.focus; S.focus = null; S.lens = { ...f }; render(); } break;
    case 'focus-close': ev.stopPropagation(); S.focus = null; render(); break;
    case 'quick-add': ev.stopPropagation(); S.quickAdd = { date: t.dataset.date, expanded: false }; S.lens = null; render(); break;
    case 'qa-close': ev.stopPropagation(); S.quickAdd = null; render(); break;
    case 'qa-more': ev.stopPropagation(); S.quickAdd.expanded = !S.quickAdd.expanded; render(); break;
    case 'qa-save': {
      ev.stopPropagation();
      const ti = $('#qa-title'), da = $('#qa-date'), tm = $('#qa-time');
      const title = (ti.value || '새 일정').trim();
      S.added.push({ id: 'n' + (S.added.length + 1), date: da.value, time: tm.value || '09:00', title, status: '예정', repeat: ($('#qa-rep') || {}).value || '', attach: 0 });
      S.quickAdd = null; render(); break;
    }
    case 'qfast-add': {
      const i = $('#qfast'); const v = (i.value || '').trim();
      if (v) { S.added.push({ id: 'n' + (S.added.length + 1), date: F.TODAY, time: '09:00', title: v, status: '예정', repeat: '', attach: 0 }); }
      render(); break;
    }
    case 'back': back(); break;
    case 'noop': ev.stopPropagation(); break;
  }
});

document.addEventListener('change', ev => {
  const sel = ev.target.closest('[data-act="lens-status"]');
  if (!sel || !S.lens) return;
  const L = S.lens;
  if (L.kind === 'vendor') S.statusOverride[`v:${L.id}@${L.date}`] = sel.value;   // 이 날짜만
  else if (L.kind === 'event') eventById(L.id).status = sel.value;
  else { const s = schedById(L.id); if (s) s.status = sel.value; }
  render();
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { ev.preventDefault(); back(); return; }
  if (ev.key === 'Enter' && ev.target.id === 'qfast') { $('[data-act="qfast-add"]').click(); return; }
  if (ev.key === 'Enter' && ev.target.id === 'qa-title') { $('[data-act="qa-save"]').click(); return; }
  if (ev.key === 'Enter' && ev.target.closest('[data-act="wake"]')) goto('ambient');
});

/* drag — Layout Edit 안에서만. 평상시에는 즉시 빠져나간다 (NEVER 5) */
let drag = null;
document.addEventListener('mousedown', ev => {
  if (!S.layoutEdit) return;                     // 평상시 drag 불가
  const pin = ev.target.closest('.pin');
  const ambHead = ev.target.closest('#ambient .amb-head');
  const ddHead = ev.target.closest('#dday .dd-head');
  if (pin) {
    const p = $('#dday .dd-pins').getBoundingClientRect(), r = pin.getBoundingClientRect();
    drag = { kind: 'pin', id: pin.dataset.pin, dx: ev.clientX - r.left, dy: ev.clientY - r.top, base: { x: p.left + 12, y: p.top + 26 } };
  } else if (ambHead) {
    const r = $('#ambient').getBoundingClientRect();
    drag = { kind: 'ambient', dx: ev.clientX - r.left, dy: ev.clientY - r.top };
  } else if (ddHead && !ev.target.closest('button')) {
    const r = $('#dday').getBoundingClientRect();
    drag = { kind: 'dday', dx: ev.clientX - r.left, dy: ev.clientY - r.top };
  }
  if (drag) ev.preventDefault();
});
document.addEventListener('mousemove', ev => {
  if (!drag) return;
  if (drag.kind === 'pin') {
    S.pinPos[drag.id] = { x: Math.max(0, ev.clientX - drag.dx - drag.base.x), y: Math.max(0, ev.clientY - drag.dy - drag.base.y) };
    const el = document.querySelector(`.pin[data-pin="${drag.id}"]`);
    if (el) { el.style.left = (12 + S.pinPos[drag.id].x) + 'px'; el.style.top = (26 + S.pinPos[drag.id].y) + 'px'; }
  } else if (drag.kind === 'ambient') {
    S.ambientPos = { x: ev.clientX - drag.dx, y: ev.clientY - drag.dy };
    const a = $('#ambient'); a.style.left = S.ambientPos.x + 'px'; a.style.top = S.ambientPos.y + 'px'; a.style.bottom = 'auto';
  } else {
    S.ddayPos = { x: ev.clientX - drag.dx, y: ev.clientY - drag.dy };
    const a = $('#dday'); a.style.left = S.ddayPos.x + 'px'; a.style.top = S.ddayPos.y + 'px';
  }
});
document.addEventListener('mouseup', () => { if (drag) { drag = null; } });

/* ambient: 의도(hover/focus)에 반응한다. 평상시에는 물러나 있다. */
$('#ambient').addEventListener('mouseenter', () => { if (S.stage === 'idle') $('#ambient').dataset.mode = 'active'; });
$('#ambient').addEventListener('mouseleave', () => { if (S.stage === 'idle') $('#ambient').dataset.mode = 'rest'; });
addEventListener('resize', () => render());

/* URL 로 상태 고정 — 스크린샷/테스트용 */
function applyUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('stage')) S.stage = p.get('stage');
  if (p.get('view')) S.calView = p.get('view');
  if (p.get('density')) S.density = p.get('density');
  if (p.get('dday')) { S.dday.open = true; S.dday.count = +p.get('dday'); }
  if (p.get('edit') === '1') { S.layoutEdit = true; S.dday.open = true; if (S.stage === 'idle') S.stage = 'ambient'; }
  if (p.get('collapsed') === 'all') BUCKETS.forEach(b => S.dday.collapsed[b.key] = true);
  render();
  const o = p.get('open');
  if (o) { const [k, id, date] = o.split(','); openObject(k, id, date); }
  if (p.get('focus') === '1' && S.lens) { S.focus = { ...S.lens }; S.lens = null; $('#lensLayer').innerHTML = ''; render(); }
  if (p.get('qa')) { S.quickAdd = { date: p.get('qa'), expanded: false }; render(); }
}
applyUrl();
window.__S = S;
