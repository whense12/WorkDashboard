const { test, expect } = require("@playwright/test");
const H = require("./helpers");

const MONTH_MODES = [
  { rowmode: "flow", density: "comfortable" },
  { rowmode: "flow", density: "compact" },
  { rowmode: "cap", density: "comfortable" },
  { rowmode: "cap", density: "compact" },
  { rowmode: "flow", density: "columns" }
];

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForSelector(".week-row");
});

for (const density of H.DENSITIES) {
  const date = H.DENSITY_DATES[density];

  test.describe(`density ${density} (${date})`, () => {
    for (const mode of MONTH_MODES) {
      const tag = `${mode.rowmode}/${mode.density}`;

      test(`[${density}] ${tag}: every vendor name is in the DOM, none replaced by +N / dot / bare number`,
        async ({ page }) => {
          const expected = await H.fixtureVendors(page, date);
          expect(expected.length).toBe(density);
          await H.setUI(page, { view: "month", ...mode, focus: date });
          await expect(page.locator("#monthGrid")).toBeVisible();
          await expect(page.locator("#matrixWrap")).toBeHidden();
          const p = await H.probeDay(page, date);

          expect(p.count).toBe(density);
          expect(p.names).toEqual(expected);
          for (const name of expected) expect(p.cellText).toContain(name);

          for (const f of H.FORBIDDEN) {
            expect(p.cellText, `forbidden ${f.label} in ${date} ${tag}`).not.toMatch(f.re);
          }
          // a count may exist, but only as context BESIDE the full list of names
          if (p.countNote) {
            expect(p.countNote).toBe(`업체 ${density}`);
            expect(p.count).toBe(density);
          }
        });

      test(`[${density}] ${tag}: no name clipped to zero height, nothing hidden by overflow`,
        async ({ page }) => {
          await H.setUI(page, { view: "month", ...mode, focus: date });
          const p = await H.probeDay(page, date);

          expect(p.clipped, `content cut off by overflow:hidden in ${tag}`).toEqual([]);
          for (const r of p.rowMetrics) {
            expect(r.nameH, `${r.text} height in ${tag}`).toBeGreaterThan(0);
            expect(r.nameH).toBeGreaterThanOrEqual(r.fontSize);      // at least one full line
            expect(r.scrollH).toBeLessThanOrEqual(r.clientH + 1);    // text not cut inside its row
            expect(r.textOverflow).not.toBe("ellipsis");
            expect(r.lineClamp).toBe("none");
            expect(r.whiteSpace).not.toBe("nowrap");
          }
          expect(p.minNameH).toBeGreaterThanOrEqual(p.fontSize);
        });
    }

    test(`[${density}] flow: week row grows and the calendar body scrolls instead of squashing`,
      async ({ page }) => {
        await H.setUI(page, { view: "month", rowmode: "flow", density: "comfortable", focus: date });
        const p = await H.probeDay(page, date);

        expect(p.bodyOverflowY).toBe("auto");
        // rows are never compressed below one readable line per vendor
        expect(p.pitch).toBeGreaterThanOrEqual(p.fontSize);
        // the row is tall enough to hold every vendor of its busiest day
        expect(p.weekRowH).toBeGreaterThanOrEqual(p.pitch * density);
        if (density >= 10) {
          expect(p.bodyScrollH, "body must scroll at high density").toBeGreaterThan(p.bodyClientH);
        }
        expect(p.bodyScrollH).toBeGreaterThanOrEqual(p.bodyClientH);
      });

    test(`[${density}] cap: the dense cell scrolls in place, names stay reachable`,
      async ({ page }) => {
        await H.setUI(page, { view: "month", rowmode: "cap", density: "comfortable", focus: date });
        const p = await H.probeDay(page, date);

        expect(p.dayOverflowY).toBe("auto");
        expect(p.clipped).toEqual([]);
        expect(p.count).toBe(density);
        if (density >= 20) {
          expect(p.dayScrollH, "overflow must go to an in-cell scroller, not to hiding")
            .toBeGreaterThan(p.dayClientH);
        }
      });

    test(`[${density}] density switch changes layout but preserves the same vendor names`,
      async ({ page }) => {
        await H.setUI(page, { view: "month", rowmode: "flow", density: "comfortable", focus: date });
        const comf = await H.probeDay(page, date);
        await H.setUI(page, { view: "month", rowmode: "flow", density: "compact", focus: date });
        const comp = await H.probeDay(page, date);

        expect(comp.names).toEqual(comf.names);
        expect(new Set(comp.names).size).toBe(density);
        expect(comp.fontSize).toBeLessThan(comf.fontSize);           // type scale changed
        expect(comp.pitch).toBeLessThan(comf.pitch);                 // row pitch changed
        expect(comp.cellH).not.toBe(comf.cellH);                     // layout changed
        expect(comp.clipped).toEqual([]);
        expect(comp.minNameH).toBeGreaterThanOrEqual(comp.fontSize); // still readable lines
      });

    test(`[${density}] the columns density level keeps the identical vendor name set`,
      async ({ page }) => {
        await H.setUI(page, { view: "month", rowmode: "flow", density: "compact", focus: date });
        const compact = await H.probeDay(page, date);
        await H.setUI(page, { view: "month", rowmode: "flow", density: "columns", focus: date });
        const cols = await H.probeDay(page, date);

        expect(cols.names).toEqual(compact.names);
        expect(cols.clipped).toEqual([]);
        for (const r of cols.rowMetrics) {
          expect(r.nameH).toBeGreaterThanOrEqual(r.fontSize);
          expect(r.textOverflow).not.toBe("ellipsis");
        }
        // it is an option, not a winner: only the column count must actually change at scale
        if (density >= 14) expect(Number(cols.columnCount)).toBe(2);
      });

    test(`[${density}] matrix view shows the same vendors as the month view for ${date}`,
      async ({ page }) => {
        await H.setUI(page, { view: "month", rowmode: "flow", density: "comfortable", focus: date });
        const month = await H.probeDay(page, date);
        await H.setUI(page, { view: "matrix", focus: date });
        // the switch must really swap the surface, not just the DOM state
        await expect(page.locator("#matrixWrap")).toBeVisible();
        await expect(page.locator("#monthGrid")).toBeHidden();
        await expect(page.locator(`.matrix th[data-vendor="${month.names[0]}"]`)).toBeVisible();
        const m = await H.probeMatrix(page, date);

        expect(m.participatingCount).toBe(density);
        expect([...m.participating].sort()).toEqual([...month.names].sort());
        for (const name of month.names) expect(m.allRowNames).toContain(name);
        expect(m.minNameH).toBeGreaterThan(0);
      });
  });
}

test("week rows are variable height: a busier week is taller (option 1)", async ({ page }) => {
  await H.setUI(page, { view: "month", rowmode: "flow", density: "comfortable" });
  const rows = await page.$$eval(".week-row", (els) =>
    els.map((r) => ({
      week: r.dataset.week,
      busiest: +r.dataset.busiest,
      h: +r.getBoundingClientRect().height.toFixed(1)
    })));
  const byBusy = [...rows].sort((a, b) => a.busiest - b.busiest);
  for (let i = 1; i < byBusy.length; i++) {
    expect(byBusy[i].h, `week with ${byBusy[i].busiest} vendors vs ${byBusy[i - 1].busiest}`)
      .toBeGreaterThanOrEqual(byBusy[i - 1].h);
  }
  expect(byBusy[byBusy.length - 1].h).toBeGreaterThan(byBusy[0].h);
});

test("no +N / more-link affordance exists anywhere in the month view", async ({ page }) => {
  await H.setUI(page, { view: "month", rowmode: "flow", density: "comfortable" });
  const text = await page.$eval("#monthGrid", (e) => e.innerText);
  for (const f of H.FORBIDDEN) expect(text).not.toMatch(f.re);
  expect(await page.locator('[class*="more"], [data-more]').count()).toBe(0);
  const totalNames = await page.locator("#monthGrid .vendor-name").count();
  const fixtureTotal = await page.evaluate(() =>
    window.FIXTURES.days.reduce((a, d) => a + d.vendors.length, 0));
  expect(totalNames).toBe(fixtureTotal);
});
