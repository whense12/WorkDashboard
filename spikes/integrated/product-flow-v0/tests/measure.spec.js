'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const H = require('./helpers');
const { DENSE_DATE, TODAY } = H;

/* 이 파일은 손으로 쓴 수치를 만들지 않는다. 실제 렌더 결과만 기록한다. */
test('measurements.json — 실측', async ({ page }) => {
  const out = { generatedBy: 'tests/measure.spec.js', viewport: '1280x800', rows: {} };

  await H.walkIn(page);
  out.rows.calendar = {};
  for (const den of ['compact', 'comfortable', 'dense2']) {
    await page.click(`[data-act="den-${den}"]`);
    out.rows.calendar[den] = await page.evaluate(d => {
      const cell = document.querySelector(`.day[data-date="${d}"]`);
      const list = cell.querySelector('.v-list');
      const names = [...cell.querySelectorAll('.it-v')];
      const row = cell.closest('.week-row');
      const cb = document.getElementById('calBody');
      const rows = [...document.querySelectorAll('.week-row')].map(r => Math.round(r.getBoundingClientRect().height));
      const cs = getComputedStyle(names[0].querySelector('.vn'));
      return {
        vendorNames: names.length,
        fontSizePx: parseFloat(cs.fontSize),
        rowPitchPx: (() => {
          const cols = getComputedStyle(list).gridTemplateColumns === 'none' ? 1
            : getComputedStyle(list).gridTemplateColumns.split(' ').length;
          return +(names[cols].getBoundingClientRect().top - names[0].getBoundingClientRect().top).toFixed(2);
        })(),
        vendorListHeightPx: Math.round(list.getBoundingClientRect().height),
        denseWeekRowPx: Math.round(row.getBoundingClientRect().height),
        weekRowHeightsPx: rows,
        calBodyClientPx: cb.clientHeight,
        calBodyScrollPx: cb.scrollHeight - cb.clientHeight,
        columnCount: getComputedStyle(list).gridTemplateColumns === 'none' ? 1
          : getComputedStyle(list).gridTemplateColumns.split(' ').length,
        namesFullyInBodyViewport: (() => {
          const cb2 = document.getElementById('calBody');
          const r0 = cb2.getBoundingClientRect();
          cb2.scrollTop += cell.closest('.week-row').getBoundingClientRect().top - r0.top;
          const r = cb2.getBoundingClientRect();
          return names.filter(n => { const b = n.getBoundingClientRect(); return b.top >= r.top - .5 && b.bottom <= r.bottom + .5; }).length;
        })(),
        cellsWithOwnScrollbar: [...document.querySelectorAll('#sheet .day')].filter(dd => {
          const c = getComputedStyle(dd);
          return (c.overflowY === 'auto' || c.overflowY === 'scroll') && dd.scrollHeight > dd.clientHeight + 1;
        }).length
      };
    }, DENSE_DATE);
  }
  await page.click('[data-act="den-compact"]');

  await page.click('[data-act="view-matrix"]');
  out.rows.matrix = await page.evaluate(() => {
    const w = document.querySelector('.mx-wrap'), t = document.querySelector('table.mx');
    return { vendorRows: document.querySelectorAll('table.mx tbody th.vh').length,
      dateColumns: document.querySelectorAll('table.mx thead th').length - 1,
      tablePx: [Math.round(t.getBoundingClientRect().width), Math.round(t.getBoundingClientRect().height)],
      verticalScrollPx: w.scrollHeight - w.clientHeight, horizontalScrollPx: w.scrollWidth - w.clientWidth };
  });
  await page.click('[data-act="view-month"]');

  /* lens 위치: origin 가림 / 다른 항목 가림 / 시선 이동 */
  out.rows.lens = [];
  const keys = [[`v:v01@${DENSE_DATE}`, 'vendor'], [`v:v20@${DENSE_DATE}`, 'vendor'],
    [`e:e1@${DENSE_DATE}`, 'event'], [`e:e2@2026-09-11`, 'event'],
    [`s:s08@${TODAY}`, 'schedule'], [`s:s01@2026-09-01`, 'schedule'], [`s:s14@2026-09-29`, 'schedule']];
  for (const [k, kind] of keys) {
    await page.click(`[data-lens-origin="${k}"]`);
    out.rows.lens.push(await page.evaluate(key => {
      const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
                           Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const o = document.querySelector(`[data-lens-origin="${key}"]`).getBoundingClientRect();
      const l = document.querySelector('.lens');
      const lr = l.getBoundingClientRect();
      const others = [...document.querySelectorAll('#sheet [data-lens-origin]')]
        .filter(e => e.dataset.lensOrigin !== key).map(e => e.getBoundingClientRect());
      return { origin: key, anchor: l.dataset.anchor, activeLenses: document.querySelectorAll('.lens').length,
        originCoveredPx: Math.round(ov(o, lr)),
        originInViewport: o.top >= 0 && o.bottom <= innerHeight && o.left >= 0 && o.right <= innerWidth,
        factsVisible: l.querySelectorAll('.lens-facts dd').length, clicksToFacts: 0,
        otherItemsMostlyHidden: others.filter(q => q.width && ov(q, lr) > q.width * q.height * 0.5).length,
        sheetItems: others.length + 1,
        originToLensCenterPx: Math.round(Math.hypot((lr.left + lr.right) / 2 - (o.left + o.right) / 2,
                                                     (lr.top + lr.bottom) / 2 - (o.top + o.bottom) / 2)),
        lensPx: [Math.round(lr.width), Math.round(lr.height)] };
    }, k));
  }

  /* D-day */
  out.rows.dday = [];
  for (const n of [3, 20]) {
    for (const collapsed of [false, true]) {
      await page.goto(`/index.html?stage=ambient&dday=${n}${collapsed ? '&collapsed=all' : ''}`);
      out.rows.dday.push(await page.evaluate(c => {
        const led = document.getElementById('ddLedger'), g = document.getElementById('ddGroups');
        const gr = g.getBoundingClientRect();
        const items = [...g.querySelectorAll('.dd-item')];
        return { fixture: +led.dataset.total, collapsed: c,
          domItems: items.length + document.querySelectorAll('.pin').length,
          pinned: +led.dataset.pinned, grouped: +led.dataset.grouped,
          collapsedItems: +led.dataset.collapsed, offscreenItems: +led.dataset.offscreen,
          groups: document.querySelectorAll('.dd-group').length,
          groupsScrollHeight: g.scrollHeight, groupsClientHeight: g.clientHeight,
          overflowPx: Math.max(0, g.scrollHeight - g.clientHeight),
          visibleItems: items.filter(i => { const b = i.getBoundingClientRect();
            return b.height > 0 && b.top >= gr.top - 1 && b.bottom <= gr.bottom + 1; }).length };
      }, collapsed));
    }
  }

  /* 패널 기하 — 상시 우측 column 이 아님을 수치로 남긴다 */
  await page.goto('/index.html?stage=ambient&dday=20');
  out.rows.panels = await page.evaluate(() => {
    const g = id => { const e = document.getElementById(id), r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right),
        heightPctOfViewport: +(r.height / innerHeight).toFixed(3), distanceFromRightEdgePx: Math.round(innerWidth - r.right) }; };
    return { viewport: [innerWidth, innerHeight], ambient: g('ambient'), dday: g('dday') };
  });
  out.rows.rightInspectorsFound = await H.rightInspectors(page);

  fs.writeFileSync('measurements.json', JSON.stringify(out, null, 2) + '\n');
  expect(out.rows.rightInspectorsFound).toEqual([]);
  expect(out.rows.calendar.compact.vendorNames).toBe(20);
});
