/* Produces one screenshot per density per view, plus measurements.json. */
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const H = require("./helpers");

const SHOTS = path.join(__dirname, "..", "screenshots");
const OUT = path.join(__dirname, "..", "measurements.json");

const MONTH_VIEWS = [
  { id: "month-flow-comfortable", view: "month", rowmode: "flow", density: "comfortable" },
  { id: "month-flow-compact", view: "month", rowmode: "flow", density: "compact" },
  { id: "month-cap-comfortable", view: "month", rowmode: "cap", density: "comfortable" },
  { id: "month-cap-compact", view: "month", rowmode: "cap", density: "compact" },
  { id: "month-flow-columns", view: "month", rowmode: "flow", density: "columns" }
];

const results = [];

test.describe.configure({ mode: "serial" });

test("capture every density in every view and record measurements", async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.goto("/index.html");
  await page.waitForSelector(".week-row");

  for (const density of H.DENSITIES) {
    const date = H.DENSITY_DATES[density];
    const pad = String(density).padStart(2, "0");

    for (const v of MONTH_VIEWS) {
      await H.setUI(page, { view: v.view, rowmode: v.rowmode, density: v.density, focus: date });
      await page.evaluate((d) => {
        const cell = document.querySelector(`.day-cell[data-date="${d}"]`);
        cell.closest(".week-row").scrollIntoView({ block: "start" });
      }, date);
      await page.waitForTimeout(80);
      const p = await H.probeDay(page, date);
      const visibleNow = await page.evaluate((d) => {
        const cell = document.querySelector(`.day-cell[data-date="${d}"]`);
        const bodyRect = document.getElementById("calBody").getBoundingClientRect();
        return Array.from(cell.querySelectorAll(".vendor-name")).filter((n) => {
          const r = n.getBoundingClientRect();
          return r.top >= bodyRect.top - 0.5 && r.bottom <= bodyRect.bottom + 0.5 && r.height > 0;
        }).length;
      }, date);
      const scrollToLast = await page.evaluate((d) => {
        const cell = document.querySelector(`.day-cell[data-date="${d}"]`);
        const names = cell.querySelectorAll(".vendor-name");
        if (!names.length) return 0;
        const first = names[0].getBoundingClientRect().top;
        const last = names[names.length - 1].getBoundingClientRect().bottom;
        return Math.round(last - first);
      }, date);

      results.push({
        density, date, view: v.id,
        namesRendered: p.count,
        namesReadableWithoutAnyScrolling: visibleNow,
        fontSizePx: p.fontSize,
        rowPitchPx: p.pitch,
        dayCellHeightPx: p.cellH,
        weekRowHeightPx: p.weekRowH,
        inCellScroll: p.dayScrollH > p.dayClientH + 1,
        inCellScrollHiddenPx: Math.max(0, p.dayScrollH - p.dayClientH),
        bodyScrollHeightPx: p.bodyScrollH,
        bodyClientHeightPx: p.bodyClientH,
        bodyScrollsPx: Math.max(0, p.bodyScrollH - p.bodyClientH),
        columnCount: p.columnCount,
        itemsBlockHeightPx: p.itemsH,
        pxPerVendorByBlock: p.count ? +(p.itemsH / p.count).toFixed(1) : null,
        verticalExtentOfDayListPx: scrollToLast,
        pxPerVendor: p.count ? +(scrollToLast / p.count).toFixed(1) : null,
        clippedAncestors: p.clipped.length,
        countNote: p.countNote
      });

      await page.screenshot({ path: path.join(SHOTS, `B-d${pad}-${v.id}.png`) });
      expect(p.count).toBe(density);
    }

    // vendor x date matrix, focused on the same date
    await H.setUI(page, { view: "matrix", focus: date });
    await page.evaluate(() => { document.getElementById("calBody").scrollTop = 0; });
    await page.waitForTimeout(80);
    const m = await H.probeMatrix(page, date);
    results.push({
      density, date, view: "matrix",
      namesRendered: m.participatingCount,
      matrixRowsTotal: m.rowTotal,
      matrixWidthPx: m.tableW,
      matrixHeightPx: m.tableH,
      bodyScrollHeightPx: m.bodyScrollH,
      bodyClientHeightPx: m.bodyClientH,
      bodyScrollsPx: Math.max(0, m.bodyScrollH - m.bodyClientH),
      horizontalScrollPx: Math.max(0, m.bodyScrollW - m.bodyClientW),
      minNameHeightPx: m.minNameH,
      clippedAncestors: 0
    });
    await page.screenshot({ path: path.join(SHOTS, `B-d${pad}-matrix.png`) });
    expect(m.participatingCount).toBe(density);
  }

  // two whole-month overviews for at-a-glance comparison
  for (const v of [MONTH_VIEWS[0], MONTH_VIEWS[1]]) {
    await H.setUI(page, { view: "month", rowmode: v.rowmode, density: v.density });
    await page.evaluate(() => { document.getElementById("calBody").scrollTop = 0; });
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(SHOTS, `B-overview-${v.id}.png`) });
  }
});

test.afterAll(async () => {
  if (results.length) {
    fs.writeFileSync(OUT, JSON.stringify({ generatedBy: "tests/measure.spec.js", viewport: "1280x800", results }, null, 2));
  }
});
