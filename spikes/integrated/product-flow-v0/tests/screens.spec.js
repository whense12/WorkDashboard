'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const H = require('./helpers');
const { DENSE_DATE, TODAY } = H;

const SIZES = [
  { w: 1280, h: 800, dir: '' },
  { w: 1600, h: 1000, dir: '1600x1000' }
];

for (const sz of SIZES) {
  test.describe(`screenshots ${sz.w}x${sz.h}`, () => {
    test.use({ viewport: { width: sz.w, height: sz.h } });

    test(`15개 상태를 한 세션에서 걸어가며 찍는다 (${sz.w}x${sz.h})`, async ({ page }) => {
      const shot = async name => {
        const p = sz.dir ? path.join('screenshots', sz.dir, name + '.png') : path.join('screenshots', name + '.png');
        await page.screenshot({ path: p });
      };

      /* 1 Desktop Idle */
      await page.goto('/index.html');
      await expect(page.locator('#ambient')).toHaveAttribute('data-mode', 'rest');
      await page.waitForTimeout(250);
      await shot('01-desktop-idle');

      /* 2 Ambient Active */
      await page.click('[data-act="wake"]');
      await expect(page.locator('#ambient')).toHaveAttribute('data-mode', 'active');
      await page.waitForTimeout(250);
      await shot('02-ambient-active');

      /* 3 Quick */
      await page.click('.amb-acts [data-act="quick"]');
      await expect(page.locator('#quick')).toBeVisible();
      await shot('03-quick');

      /* 4 Calendar Month */
      await page.click('.q-foot [data-act="calendar"]');
      await expect(page.locator('#sheet')).toBeVisible();
      await shot('04-calendar-month');

      /* 5 Dense Calendar (20 vendors on one day) */
      // 밀집 주 행을 캘린더 본문 맨 위로 (spike B 의 측정 조건과 같은 상태)
      await page.evaluate(d => {
        const cell = document.querySelector(`.day[data-date="${d}"]`);
        const row = cell.closest('.week-row');
        const cb = document.getElementById('calBody');
        cb.scrollTop += row.getBoundingClientRect().top - cb.getBoundingClientRect().top;
      }, DENSE_DATE);
      await expect(page.locator(`.day[data-date="${DENSE_DATE}"] .it-v`)).toHaveCount(20);
      await shot('05-calendar-dense20');

      /* 6 Vendor Matrix */
      await page.click('[data-act="view-matrix"]');
      await expect(page.locator('table.mx')).toBeVisible();
      await shot('06-vendor-matrix');

      /* 7 Vendor Lens */
      await page.click('[data-act="view-month"]');
      await page.locator(`.day[data-date="${DENSE_DATE}"] .it-v`).first().scrollIntoViewIfNeeded();
      await page.click(`[data-lens-origin="v:v01@${DENSE_DATE}"]`);
      await expect(page.locator('.lens')).toHaveAttribute('data-kind', 'vendor');
      await shot('07-vendor-lens');

      /* 8 Event Lens — 같은 자리에서 교체된다 */
      await page.click(`[data-lens-origin="e:e1@${DENSE_DATE}"]`);
      await expect(page.locator('.lens')).toHaveCount(1);
      await expect(page.locator('.lens')).toHaveAttribute('data-kind', 'event');
      await shot('08-event-lens');

      /* 9 General Schedule Lens */
      await page.locator(`.day[data-date="${TODAY}"]`).scrollIntoViewIfNeeded();
      await page.click(`[data-lens-origin="s:s08@${TODAY}"]`);
      await expect(page.locator('.lens')).toHaveAttribute('data-kind', 'schedule');
      await shot('09-schedule-lens');

      /* 10 Focus Surface */
      await page.locator(`.day[data-date="${DENSE_DATE}"] .it-v`).first().scrollIntoViewIfNeeded();
      await page.click(`[data-lens-origin="v:v01@${DENSE_DATE}"]`);
      await page.click('[data-act="focus-open"]');
      await expect(page.locator('#focus')).toBeVisible();
      await shot('10-focus-surface');

      /* 11 Quick Add — 빈 날짜 클릭, 날짜 미리 채움 */
      await page.keyboard.press('Escape');            // focus -> lens
      await page.keyboard.press('Escape');            // lens -> calendar
      await expect(page.locator('#sheet')).toBeVisible();
      await page.locator('#calBody').evaluate(e => { e.scrollTop = 0; });
      await page.locator('.day[data-date="2026-09-02"] .day-empty').click();
      await expect(page.locator('#qa-date')).toHaveValue('2026-09-02');
      await shot('11-quick-add');

      /* 12 D-day 3 */
      await page.keyboard.press('Escape');            // quick add 닫기
      await page.keyboard.press('Escape');            // calendar -> quick
      await page.keyboard.press('Escape');            // quick -> ambient
      await expect(page.locator('body')).toHaveAttribute('data-stage', 'ambient');
      await page.click('.amb-acts [data-act="dday"]');
      await page.click('[data-act="dd-3"]');
      await expect(page.locator('#ddLedger')).toHaveAttribute('data-total', '3');
      await shot('12-dday-3');

      /* 13 D-day 20 */
      await page.click('[data-act="dd-20"]');
      await expect(page.locator('#ddLedger')).toHaveAttribute('data-total', '20');
      await shot('13-dday-20');

      /* 14 Layout Edit */
      await page.click('#dday [data-act="layout"]');
      await expect(page.locator('#editbar')).toBeVisible();
      await H.dragBy(page, page.locator('#dday .pin').nth(2), 120, 6);
      await shot('14-layout-edit');

      /* 15 Return path — Layout Edit 을 나와 Ambient 로 돌아온다 */
      await page.keyboard.press('Escape');
      await expect(page.locator('body')).toHaveAttribute('data-layout-edit', '0');
      await expect(page.locator('body')).toHaveAttribute('data-stage', 'ambient');
    });
  });
}
