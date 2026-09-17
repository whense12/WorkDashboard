const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const H = require('./helpers');

const SHOTS = path.join(__dirname, '..', 'screenshots');
const OUT = path.join(__dirname, '..', 'measurements.json');
const rows = [];

test.beforeAll(() => { fs.mkdirSync(SHOTS, { recursive: true }); });

async function shot(page, name) {
  await page.mouse.move(10, 880);          // 휴지 상태(ambient)로 촬영
  await page.waitForTimeout(220);          // opacity transition 안정화
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

test.describe('측정 + 스크린샷', () => {
  for (const f of [3, 8, 20]) {
    for (const arr of ['free', 'stack', 'grouped']) {
      test(`measure f${f} ${arr}`, async ({ page }) => {
        await H.open(page, { f, arr, axis: 'urgency' });
        const m = await page.evaluate(() => window.__spike.metrics());
        expect(m.domPins).toBe(f);
        rows.push(Object.assign({ case: `f${f}-${arr}`, collapsed: false }, m));
        await shot(page, `f${f}-${arr}`);
      });
    }

    test(`measure f${f} grouped-collapsed`, async ({ page }) => {
      await H.open(page, { f, arr: 'grouped', axis: 'urgency', collapsed: 'all' });
      const m = await page.evaluate(() => window.__spike.metrics());
      expect(m.domPins).toBe(f);
      expect(m.collapsedPins).toBe(f);
      rows.push(Object.assign({ case: `f${f}-grouped-collapsed`, collapsed: true }, m));
      await shot(page, `f${f}-grouped-collapsed`);
    });

    test(`measure f${f} grouped-by-event`, async ({ page }) => {
      await H.open(page, { f, arr: 'grouped', axis: 'event' });
      const m = await page.evaluate(() => window.__spike.metrics());
      expect(m.domPins).toBe(f);
      rows.push(Object.assign({ case: `f${f}-grouped-event`, collapsed: false }, m));
      await shot(page, `f${f}-grouped-event`);
    });
  }

  test('screenshot: Layout Edit off / on (independent, 20 pins)', async ({ page }) => {
    await H.open(page, { f: 20, arr: 'free' });
    await shot(page, 'f20-free-edit-off');
    await page.click('#layout-edit-toggle');
    await expect(page.locator('.pin[data-draggable="true"]')).toHaveCount(20);
    await shot(page, 'f20-free-edit-on');
    await page.click('#layout-edit-toggle');
    await expect(page.locator('.pin[data-draggable="true"]')).toHaveCount(0);
    await shot(page, 'f20-free-edit-relocked');
  });

  test('screenshot: Layout Edit off / on (group, 20 pins)', async ({ page }) => {
    await H.open(page, { f: 20, arr: 'grouped', axis: 'urgency' });
    await shot(page, 'f20-grouped-edit-off');
    await page.click('#layout-edit-toggle');
    await expect(page.locator('.group[data-draggable="true"]').first()).toBeVisible();
    await shot(page, 'f20-grouped-edit-on');
  });

  test('screenshot: ambient 휴지 vs 의도(hover)', async ({ page }) => {
    await H.open(page, { f: 8, arr: 'stack' });
    await shot(page, 'f8-ambient-at-rest');
    await page.locator('.surface').hover();
    await page.waitForTimeout(260);
    await page.screenshot({ path: path.join(SHOTS, 'f8-ambient-on-intent.png') });
  });

  test.afterAll(() => {
    rows.sort((a, b) => (a.case < b.case ? -1 : 1));
    fs.writeFileSync(OUT, JSON.stringify({
      note: 'SPIKE D 측정값. viewport 1440x900, surface 760px, rail 560px 고정.',
      priorityRule: 'P1 days 오름차순, P2 title 코드포인트 오름차순, P3 group 은 최우선 pin 기준',
      rows: rows
    }, null, 2) + '\n');
  });
});
