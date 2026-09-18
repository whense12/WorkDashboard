'use strict';
const { expect } = require('@playwright/test');

const DENSE_DATE = '2026-09-23';   // 이 날 참가 업체 20곳
const TODAY = '2026-09-18';

/* Idle -> Ambient -> Quick -> Calendar 를 실제로 걸어서 들어간다 */
async function walkIn(page, stopAt = 'calendar') {
  await page.goto('/index.html');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'idle');
  if (stopAt === 'idle') return;
  await page.click('[data-act="wake"]');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'ambient');
  if (stopAt === 'ambient') return;
  await page.click('.amb-acts [data-act="quick"]');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'quick');
  if (stopAt === 'quick') return;
  await page.click('.q-foot [data-act="calendar"]');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'calendar');
  await expect(page.locator('#sheet')).toBeVisible();
}

/* 화면 오른쪽에 붙어 화면 높이의 대부분을 차지하는 고정 패널 = permanent right inspector.
   어떤 상태에서도 0개여야 한다 (KERNEL NEVER 2). */
async function rightInspectors(page) {
  return page.evaluate(() => {
    const W = innerWidth, H = innerHeight, bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 200 || r.width > 560) continue;
      if (r.height < H * 0.6) continue;
      if (r.right < W - 24) continue;
      bad.push(el.id || el.className || el.tagName);
    }
    return bad;
  });
}

/* +N / 외 N건 / N건 더 / 말줄임 같은 업체명 대체 표현이 달력에 있는지 */
async function vendorOverflowMarkers(page) {
  return page.evaluate(() => {
    const pat = /(\+\s*\d+)|(외\s*\d+\s*(건|개|곳))|(\d+\s*(건|개|곳)\s*더)|(더\s*보기)|(…)|(\.\.\.)/;
    const hits = [];
    for (const el of document.querySelectorAll('#sheet .day, #sheet .v-list, #sheet .v-lab, #sheet table.mx')) {
      const txt = el.textContent || '';
      if (pat.test(txt)) hits.push(txt.slice(0, 80));
    }
    // 시각적 잘라내기도 금지
    for (const vn of document.querySelectorAll('#sheet .it-v .vn')) {
      const cs = getComputedStyle(vn);
      if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') hits.push('clip:' + vn.textContent);
    }
    return hits;
  });
}

async function overlapWithLens(page, originKey) {
  return page.evaluate(k => {
    const o = document.querySelector(`[data-lens-origin="${k}"]`);
    const l = document.querySelector('.lens');
    if (!o || !l) return { ok: false };
    const a = o.getBoundingClientRect(), b = l.getBoundingClientRect();
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return { ok: true, covered: Math.round(x * y),
      inViewport: a.top >= 0 && a.left >= 0 && a.bottom <= innerHeight && a.right <= innerWidth,
      w: Math.round(a.width), h: Math.round(a.height) };
  }, originKey);
}

/* 셀 안의 업체명 전부가 스크롤로 도달 가능한지 (숨김 0) */
async function vendorNamesOn(page, date) {
  return page.locator(`.day[data-date="${date}"] .it-v .vn`).allTextContents();
}

/* 조상의 overflow clip 과 viewport 까지 반영한, 실제로 눈에 보이는 박스.
   getBoundingClientRect 만 보면 overflow:hidden 으로 잘려 사라진 요소도 정상으로 보인다. */
function visibleBoxOf(el) {
  const r = el.getBoundingClientRect();
  let l = r.left, t = r.top, rr = r.right, b = r.bottom;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
    const q = p.getBoundingClientRect();
    l = Math.max(l, q.left); t = Math.max(t, q.top);
    rr = Math.min(rr, q.right); b = Math.min(b, q.bottom);
  }
  l = Math.max(l, 0); t = Math.max(t, 0);
  rr = Math.min(rr, innerWidth); b = Math.min(b, innerHeight);
  return { w: r.width, h: r.height,
    vw: Math.max(0, rr - l), vh: Math.max(0, b - t),
    fs: parseFloat(getComputedStyle(el).fontSize),
    text: (el.textContent || '').replace(/\s+/g, ' ').trim() };
}

/* 한 항목이 "도달 가능" 한지 실제 기하로 확인한다:
   스크롤해서 끌어온 뒤, 한 줄 이상의 높이를 갖고, 조상 clip·viewport 어디에서도 잘리지 않는다. */
async function expectReachable(locator, label) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator, label).toBeVisible();
  const g = await locator.evaluate(visibleBoxOf);
  expect(g.text.length, `${label} 텍스트 없음`).toBeGreaterThan(0);
  expect(g.h, `${label} 자체 높이(${Math.round(g.h)}) < 글자 크기(${g.fs})`).toBeGreaterThanOrEqual(g.fs);
  expect(g.vh, `${label} 세로 잘림: 보이는 ${Math.round(g.vh)} / 실제 ${Math.round(g.h)}`)
    .toBeGreaterThanOrEqual(g.h - 1);
  expect(g.vw, `${label} 가로 잘림: 보이는 ${Math.round(g.vw)} / 실제 ${Math.round(g.w)}`)
    .toBeGreaterThanOrEqual(g.w - 1);
  return g;
}

/* lens 자신의 위치. viewport 밖 px, 캘린더 본문 영역 밖 px, origin 과의 최단 간격. */
async function lensPlacement(page) {
  return page.evaluate(() => {
    const L = document.querySelector('.lens');
    if (!L) return { ok: false };
    const o = document.querySelector(`[data-lens-origin="${L.dataset.origin}"]`);
    if (!o) return { ok: false };
    const l = L.getBoundingClientRect(), a = o.getBoundingClientRect();
    const reg = document.querySelector('#calBody') || document.querySelector('.mx-wrap');
    const r = reg ? reg.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    return { ok: true,
      outViewport: Math.round(Math.max(0, -l.top, -l.left, l.bottom - innerHeight, l.right - innerWidth)),
      outRegion: Math.round(Math.max(0, r.top - l.top, r.left - l.left, l.bottom - r.bottom, l.right - r.right)),
      gap: Math.round(Math.hypot(Math.max(0, a.left - l.right, l.left - a.right),
                                 Math.max(0, a.top - l.bottom, l.top - a.bottom))),
      w: Math.round(l.width), h: Math.round(l.height), anchor: L.dataset.anchor };
  });
}

/* 현재 surface 의 모든 origin 을 차례로 열어 lens 위치를 검사한다. 위반 목록을 돌려준다. */
async function lensPlacementViolations(page, maxGap) {
  return page.evaluate(maxGap => {
    const bad = [];
    const keys = [...document.querySelectorAll('#sheet [data-lens-origin]')].map(e => e.dataset.lensOrigin);
    if (!keys.length) return ['origin 이 하나도 없다'];
    for (const k of keys) {
      const el = document.querySelector(`[data-lens-origin="${k}"]`);
      if (!el) { bad.push(`${k}: origin 사라짐`); continue; }
      el.click();
      const L = document.querySelector('.lens');
      if (!L) { bad.push(`${k}: lens 가 열리지 않음`); continue; }
      const a = document.querySelector(`[data-lens-origin="${k}"]`).getBoundingClientRect();
      const l = L.getBoundingClientRect();
      const reg = document.querySelector('#calBody') || document.querySelector('.mx-wrap');
      const r = reg.getBoundingClientRect();
      const outV = Math.max(0, -l.top, -l.left, l.bottom - innerHeight, l.right - innerWidth);
      const outR = Math.max(0, r.top - l.top, r.left - l.left, l.bottom - r.bottom, l.right - r.right);
      const gap = Math.hypot(Math.max(0, a.left - l.right, l.left - a.right),
                             Math.max(0, a.top - l.bottom, l.top - a.bottom));
      if (l.width < 80 || l.height < 80) bad.push(`${k}: lens 가 ${Math.round(l.width)}x${Math.round(l.height)} 로 찌그러짐`);
      if (outV > 1) bad.push(`${k}: lens 가 viewport 밖으로 ${Math.round(outV)}px`);
      if (outR > 1) bad.push(`${k}: lens 가 캘린더 본문 밖으로 ${Math.round(outR)}px`);
      if (gap > maxGap) bad.push(`${k}: lens 가 origin 에서 ${Math.round(gap)}px 떨어짐`);
    }
    return bad;
  }, maxGap);
}

async function dragBy(page, locator, dx, dy) {
  const b = await locator.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 8);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + 8 + dy, { steps: 8 });
  await page.mouse.up();
  return b;
}

module.exports = { DENSE_DATE, TODAY, walkIn, rightInspectors, vendorOverflowMarkers,
  overlapWithLens, vendorNamesOn, dragBy,
  visibleBoxOf, expectReachable, lensPlacement, lensPlacementViolations };
