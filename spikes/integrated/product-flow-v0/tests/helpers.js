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

async function dragBy(page, locator, dx, dy) {
  const b = await locator.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 8);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + 8 + dy, { steps: 8 });
  await page.mouse.up();
  return b;
}

module.exports = { DENSE_DATE, TODAY, walkIn, rightInspectors, vendorOverflowMarkers,
  overlapWithLens, vendorNamesOn, dragBy };
