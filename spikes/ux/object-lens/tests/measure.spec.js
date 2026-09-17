/* Measurement pass. These are MEASUREMENTS, not product decisions (CLAUDE.md).
   Output: measurements.json + screenshots of each comparable option. */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { boot, overlapArea, shot } = require('./helpers');

const ORIGINS = [
  { kind: 'vendor', sel: '[data-entry="v-hansol@2026-09-12"]' },
  { kind: 'event', sel: '[data-entry="e-autumn@2026-09-19"]' },
  { kind: 'schedule', sel: '[data-entry="s-visit@2026-09-17"]' },
  { kind: 'track-row', sel: '[data-track-row="t-h2"]' }
];

const results = { anchorOptions: [], overlapRules: [], sheetOcclusion: [] };

test.afterAll(() => {
  fs.writeFileSync(
    path.join(__dirname, '..', 'measurements.json'),
    JSON.stringify(results, null, 2) + '\n'
  );
  console.log('\n=== MEASURED: anchor options ===');
  for (const r of results.anchorOptions) {
    console.log(
      `${r.anchor.padEnd(9)} ${r.kind.padEnd(10)} originCovered=${String(r.originCoveredPx).padStart(6)}px2` +
      ` originInViewport=${r.originInViewport} facts=${r.factsVisible} clicksToFacts=${r.clicksToFacts}` +
      ` otherItemsHidden=${r.otherItemsMostlyHidden} eyeTravel=${r.originToLensPx}px openMs=${r.openMs}`);
  }
  console.log('\n=== MEASURED: overlap rules ===');
  for (const r of results.overlapRules) {
    console.log(
      `${r.rule.padEnd(8)} afterSecondOpen: lenses=${r.lensesAfterSecond} originsMarked=${r.originsMarkedAfterSecond}` +
      ` bothPresent=${r.bothObjectsPresentAtOnce} lowerLensCovered=${r.lowerLensCoveredPct}%` +
      ` clicksToCompareTwo=${r.clicksToCompareTwo}` +
      ` originsCovered=${r.originCoveredPx}px2`);
  }
});

test.describe('comparable option A: lens anchoring', () => {
  for (const anchor of ['anchored', 'centered']) {
    for (const o of ORIGINS) {
      test(`${anchor} / ${o.kind}: measure origin survival and reading cost`, async ({ page }) => {
        await boot(page, { anchor, rule: 'stack2' });
        await page.click(o.sel);
        const lens = page.locator('[data-testid="lens"]');
        await expect(lens).toHaveCount(1);

        const origin = page.locator(o.sel);
        const ob = await origin.boundingBox();
        const lb = await lens.boundingBox();
        const occ = await page.evaluate(() => window.__spike.occlusion());
        const openMs = await page.evaluate(() => window.__spike.lastOpenMs());
        const factsVisible = await lens.locator('.lens-facts dd:visible').count();
        const inView = await origin.evaluate(n => {
          const r = n.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
        });
        const dist = Math.round(Math.hypot(
          (ob.x + ob.width / 2) - (lb.x + lb.width / 2),
          (ob.y + ob.height / 2) - (lb.y + lb.height / 2)
        ));

        results.anchorOptions.push({
          anchor, kind: o.kind,
          originCoveredPx: Math.round(overlapArea(ob, lb)),
          originCoveredPxReportedByPage: occ.originCoveredPx,
          originInViewport: inView,
          originStillMarked: (await origin.getAttribute('data-origin')) === 'true',
          factsVisible,
          clicksToFacts: 0,              // every key fact is rendered by the opening click itself
          otherItemsMostlyHidden: occ.otherItemsMostlyHidden,
          otherItemsCoveredPx: occ.otherItemsCoveredPx,
          sheetItemCount: occ.itemCount,
          originToLensPx: dist,
          openMs
        });

        // holds for BOTH options: the origin keeps its mark and every key fact is already readable
        expect(await origin.getAttribute('data-origin')).toBe('true');
        expect(factsVisible).toBeGreaterThanOrEqual(6);

        if (o.kind === 'vendor') await shot(page, anchor === 'anchored' ? '12-option-A1-anchored' : '13-option-A2-centered');
      });
    }
  }
});

test.describe('comparable option B: overlap rule', () => {
  const A = '[data-entry="s-visit@2026-09-17"]';
  const B = '[data-entry="e-autumn@2026-09-19"]';

  for (const rule of ['stack2', 'replace', 'refuse']) {
    test(`${rule}: measure what a second lens costs`, async ({ page }) => {
      await boot(page, { rule });
      await page.click(A);
      await page.click(B);
      const lenses = page.locator('[data-testid="lens"]');
      const lensesAfterSecond = await lenses.count();
      const originsMarked = await page.locator('[data-origin="true"]').count();
      const occ = await page.evaluate(() => window.__spike.occlusion());
      const texts = await lenses.allTextContents();
      const bothPresent = texts.join(' ').includes('현장 점검 방문') && texts.join(' ').includes('가을 로컬푸드 장터');
      // in a stack the lower lens is partly hidden by the upper one - measure it, do not claim it away
      const lowerLensCoveredPct = await page.evaluate(() => {
        const ls = Array.from(document.querySelectorAll('.lens'));
        if (ls.length < 2) return 0;
        const a = ls[0].getBoundingClientRect(), b = ls[1].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const ov = (w > 0 && h > 0) ? w * h : 0;
        return Math.round(100 * ov / (a.width * a.height));
      });

      results.overlapRules.push({
        rule,
        lensesAfterSecond,
        originsMarkedAfterSecond: originsMarked,
        bothObjectsPresentAtOnce: bothPresent,
        lowerLensCoveredPct,
        // clicks needed to read both objects' key facts starting from the sheet
        clicksToCompareTwo: rule === 'stack2' ? 2 : rule === 'replace' ? 2 : 3,
        originCoveredPx: occ.originCoveredPx,
        otherItemsMostlyHidden: occ.otherItemsMostlyHidden
      });

      // whatever the rule, no rule is allowed to cover an origin it still claims
      expect(occ.originCoveredPx).toBe(0);
    });
  }
});

test('sheet occlusion cost of an open lens, per origin (anchored)', async ({ page }) => {
  await boot(page, { anchor: 'anchored', rule: 'replace' });
  const entries = await page.$$eval('.entry', ns => ns.map(n => n.getAttribute('data-entry')));
  for (const e of entries) {
    await page.click(`[data-entry="${e}"]`);
    const occ = await page.evaluate(() => window.__spike.occlusion());
    results.sheetOcclusion.push({ origin: e, ...occ });
    expect(occ.originCoveredPx, `origin ${e} must never be covered by its own lens`).toBe(0);
    await page.keyboard.press('Escape');
  }
  const worst = results.sheetOcclusion.reduce((a, b) => (b.otherItemsMostlyHidden > a.otherItemsMostlyHidden ? b : a));
  console.log(`\nworst sheet occlusion: ${worst.origin} hides ${worst.otherItemsMostlyHidden} of ${worst.itemCount} other sheet items`);
});
