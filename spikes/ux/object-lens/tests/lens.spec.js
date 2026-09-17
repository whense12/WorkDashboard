const { test, expect } = require('@playwright/test');
const { boot, overlapArea, shot } = require('./helpers');

const VENDOR = '[data-entry="v-hansol@2026-09-12"]';
const EVENT = '[data-entry="e-autumn@2026-09-19"]';
const SCHEDULE = '[data-entry="s-visit@2026-09-17"]';
const TRACKROW = '[data-track-row="t-h2"]';

async function originStaysIntact(page, originSel) {
  const origin = page.locator(originSel);
  await expect(origin).toBeVisible();
  await expect(origin).toBeInViewport();
  await expect(origin).toHaveAttribute('data-origin', 'true');
  const ob = await origin.boundingBox();
  const lenses = page.locator('[data-testid="lens"]');
  const n = await lenses.count();
  let occluded = 0;
  for (let i = 0; i < n; i++) occluded += overlapArea(ob, await lenses.nth(i).boundingBox());
  expect(occluded, 'origin must not be covered by any lens').toBe(0);
}

test.describe('rest state', () => {
  test('no lens and no permanent inspector at rest (KERNEL NEVER 2)', async ({ page }) => {
    await boot(page);
    await expect(page.locator('[data-testid="lens"]')).toHaveCount(0);
    await expect(page.locator('#scrim')).toBeHidden();
    // the sheet itself is the surface; nothing persistently docked on the right
    const bodyW = await page.evaluate(() => document.body.clientWidth);
    const rightMost = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('main *'));
      return Math.max(...nodes.map(n => n.getBoundingClientRect().right));
    });
    expect(rightMost).toBeLessThan(bodyW);
    await shot(page, '00-rest-calendar-sheet');
  });

  test('calendar shows vendor / event names as text, not +N (KERNEL NEVER 3)', async ({ page }) => {
    await boot(page);
    await expect(page.locator(VENDOR)).toContainText('한솔농원');
    await expect(page.locator(EVENT)).toContainText('가을 로컬푸드 장터');
    const day19 = page.locator('[data-cell="2026-09-19"]');
    await expect(day19).toContainText('돌산수산');
    await expect(day19).not.toContainText('+2');
  });

  test('work track carries future / current / done work (MUST 7, EXPERIENCE 3)', async ({ page }) => {
    await boot(page);
    for (const s of ['future', 'active', 'done']) {
      await expect(page.locator(`[data-track-row][data-state="${s}"]:not([hidden])`).first()).toBeVisible();
    }
    await page.click('[data-testid="filter-done"]');
    await expect(page.locator('[data-track-row][data-state="future"]:not([hidden])')).toHaveCount(0);
    await expect(page.locator('[data-track-row][data-state="done"]:not([hidden])').first()).toBeVisible();
  });
});

test.describe('three lens kinds keep their origin', () => {
  const cases = [
    { name: 'vendor', sel: VENDOR, kind: 'vendor', shot: '01-lens-vendor', must: '한솔농원' },
    { name: 'event', sel: EVENT, kind: 'event', shot: '02-lens-event', must: '가을 로컬푸드 장터' },
    { name: 'schedule', sel: SCHEDULE, kind: 'schedule', shot: '03-lens-schedule', must: '현장 점검 방문' }
  ];

  for (const c of cases) {
    test(`${c.name} lens: opens without losing origin, key facts need no further click`, async ({ page }) => {
      await boot(page);
      await page.click(c.sel);
      const lens = page.locator('[data-testid="lens"]');
      await expect(lens).toHaveCount(1);
      await expect(lens).toHaveAttribute('data-lens-kind', c.kind);
      await expect(lens).toContainText(c.must);

      await originStaysIntact(page, c.sel);

      // fast information check: every key fact is already rendered, zero extra clicks
      const facts = lens.locator('.lens-facts dd');
      expect(await facts.count()).toBeGreaterThanOrEqual(6);
      for (let i = 0; i < await facts.count(); i++) await expect(facts.nth(i)).toBeVisible();
      await expect(lens.locator('[data-testid="lens-status"]')).toBeVisible();
      await expect(lens.locator('[data-testid="lens-tasks"]')).toContainText('완료');
      // MUST 8: attachment existence is indicated (no file handling built)
      await expect(lens.locator('[data-testid="lens-attachments"]')).toBeVisible();
      await shot(page, c.shot);
    });
  }

  test('lens can also be opened from the work track row, row stays the origin', async ({ page }) => {
    await boot(page);
    await page.click(TRACKROW);
    await expect(page.locator('[data-testid="lens"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="lens"]')).toHaveAttribute('data-lens', 'v-hansol');
    await originStaysIntact(page, TRACKROW);
    await expect(page.locator('[data-testid="lens-origin-line"]')).toContainText('업무트랙');
    await shot(page, '04-lens-from-work-track');
  });

  test('closing the lens returns focus to the origin and clears the origin mark', async ({ page }) => {
    await boot(page);
    await page.click(VENDOR);
    await page.click('[data-testid="lens-close"]');
    await expect(page.locator('[data-testid="lens"]')).toHaveCount(0);
    await expect(page.locator(VENDOR)).toBeFocused();
    await expect(page.locator(VENDOR)).not.toHaveAttribute('data-origin', 'true');
    await expect(page.locator('#scrim')).toBeHidden();
  });
});

test.describe('fast state change from inside the lens', () => {
  test('vendor date status changes in the lens and the calendar reflects it immediately', async ({ page }) => {
    await boot(page);
    await expect(page.locator(VENDOR)).toHaveAttribute('data-status', '확정');
    await page.click(VENDOR);
    await page.click('[data-testid="lens-status-cycle"]');
    // calendar updated while the lens is still open
    await expect(page.locator('[data-testid="lens"]')).toHaveCount(1);
    await expect(page.locator(VENDOR)).toHaveAttribute('data-status', '보류');
    await expect(page.locator(VENDOR)).toContainText('보류');
    await expect(page.locator('[data-testid="lens-status"]')).toHaveText('보류');
    await originStaysIntact(page, VENDOR);
    await shot(page, '05-state-change-in-lens');

    await page.click('[data-testid="lens-status-cycle"]');
    await expect(page.locator(VENDOR)).toHaveAttribute('data-status', '불참');
  });

  test('schedule lens state change also lands on the calendar', async ({ page }) => {
    await boot(page);
    await expect(page.locator(SCHEDULE)).toHaveAttribute('data-status', '진행');
    await page.click(SCHEDULE);
    await page.click('[data-testid="lens-status-cycle"]');
    await expect(page.locator(SCHEDULE)).toHaveAttribute('data-status', '완료');
  });
});

test.describe('focus surface', () => {
  test('entered from the lens and exited back to the same lens', async ({ page }) => {
    await boot(page);
    await page.click(EVENT);
    await page.click('[data-testid="lens-focus-open"]');
    const fs = page.locator('[data-testid="focus-surface"]');
    await expect(fs).toBeVisible();
    await expect(fs).toContainText('가을 로컬푸드 장터');
    // MUST 7 inside the focus surface
    await expect(fs.locator('[data-testid="focus-tasks"]')).toContainText('예정');
    await expect(fs.locator('[data-testid="focus-tasks"]')).toContainText('진행');
    await expect(fs.locator('[data-testid="focus-tasks"]')).toContainText('완료');
    // MUST 8: existence indication only
    await expect(fs.locator('[data-testid="focus-attachments"]')).toContainText('존재');
    await expect(page.locator('[data-testid="lens"]')).toBeHidden();
    await shot(page, '06-focus-surface');

    await page.click('[data-testid="focus-back"]');
    await expect(fs).toBeHidden();
    const lens = page.locator('[data-testid="lens"]');
    await expect(lens).toHaveCount(1);
    await expect(lens).toHaveAttribute('data-lens', 'e-autumn');
    await originStaysIntact(page, EVENT);
    await shot(page, '07-back-from-focus-to-lens');
  });

  test('plan-wide edit in the focus surface is distinct from the single-date edit (MUST 4)', async ({ page }) => {
    await boot(page);
    // single-date edit first: 09-12 확정 -> 보류, from inside the lens
    await page.click(VENDOR);
    await page.click('[data-testid="lens-status-cycle"]');
    await expect(page.locator(VENDOR)).toHaveAttribute('data-status', '보류');

    // plan-wide edit from the focus surface: restores 09-12, keeps both date exceptions
    await page.click('[data-testid="lens-focus-open"]');
    await page.click('[data-testid="plan-scope-all"]');
    await page.click('[data-testid="focus-back"]');
    await expect(page.locator(VENDOR)).toHaveAttribute('data-status', '확정');
    await expect(page.locator('[data-entry="v-hansol@2026-09-19"]')).toHaveAttribute('data-status', '불참');
    await expect(page.locator('[data-entry="v-hansol@2026-09-26"]')).toHaveAttribute('data-status', '보류');
  });
});

test.describe('overlapping lenses — three candidate rules (OPTIONS, not a decision)', () => {
  // A / B / C are chosen so that none of them sits under an already-open lens.
  // (A lens DOES cover other sheet items - that cost is measured in measure.spec.js.)
  const A = SCHEDULE;                                 // s-visit   2026-09-17
  const B = EVENT;                                    // e-autumn  2026-09-19
  const C = '[data-entry="v-baram@2026-09-02"]';      // v-baram   2026-09-02

  test('O2 stack with depth cap 2 (prototype default): second stacks, third replaces the top', async ({ page }) => {
    await boot(page, { rule: 'stack2' });
    await page.click(A);
    await page.click(B);
    await expect(page.locator('[data-testid="lens"]')).toHaveCount(2);
    expect(await page.evaluate(() => window.__spike.stackDepth)).toBe(2);
    // both origins stay marked, in view, and uncovered
    await originStaysIntact(page, A);
    await originStaysIntact(page, B);
    await expect(page.locator('.lens[data-depth="0"]')).toHaveAttribute('data-lens', 's-visit');
    await expect(page.locator('.lens[data-depth="1"]')).toHaveAttribute('data-lens', 'e-autumn');
    await shot(page, '08-overlap-stack-depth2');

    await page.click(C);
    await expect(page.locator('[data-testid="lens"]')).toHaveCount(2);
    expect(await page.evaluate(() => window.__spike.stackDepth)).toBe(2);
    await expect(page.locator('.lens[data-depth="0"]')).toHaveAttribute('data-lens', 's-visit');
    await expect(page.locator('.lens[data-depth="1"]')).toHaveAttribute('data-lens', 'v-baram');
    // the replaced lens released its origin, the surviving ones keep theirs
    await expect(page.locator(B)).not.toHaveAttribute('data-origin', 'true');
    await expect(page.locator(A)).toHaveAttribute('data-origin', 'true');
    await originStaysIntact(page, A);
    await originStaysIntact(page, C);
    await shot(page, '09-overlap-stack-cap-third-replaces-top');

    // closing the top lens returns to the lens below it, which keeps its own origin
    await page.click('.lens[data-depth="1"] [data-testid="lens-close"]');
    await expect(page.locator('[data-testid="lens"]')).toHaveCount(1);
    await expect(page.locator('.lens[data-depth="0"]')).toBeFocused();
    await expect(page.locator('.lens[data-depth="0"]')).toHaveAttribute('data-lens', 's-visit');
    await originStaysIntact(page, A);
  });

  test('O1 replace: the second lens replaces the first and releases its origin', async ({ page }) => {
    await boot(page, { rule: 'replace' });
    await page.click(A);
    await page.click(B);
    await expect(page.locator('[data-testid="lens"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="lens"]')).toHaveAttribute('data-lens', 'e-autumn');
    await expect(page.locator(A)).not.toHaveAttribute('data-origin', 'true');
    await originStaysIntact(page, B);
    await shot(page, '10-overlap-replace');
  });

  test('O3 refuse: the second lens is not opened and the first keeps focus', async ({ page }) => {
    await boot(page, { rule: 'refuse' });
    await page.click(A);
    await page.click(B);
    await expect(page.locator('[data-testid="lens"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="lens"]')).toHaveAttribute('data-lens', 's-visit');
    await expect(page.locator('[data-testid="refuse-hint"]')).toBeVisible();
    await expect(page.locator('[data-testid="lens"]')).toBeFocused();
    await expect(page.locator(B)).not.toHaveAttribute('data-origin', 'true');
    await originStaysIntact(page, A);
    await shot(page, '11-overlap-refuse');
  });
});
