/* Shared probes for the spike tests. */
const DENSITY_DATES = {
  1: "2026-09-03",
  5: "2026-09-09",
  10: "2026-09-16",
  20: "2026-09-23",
  40: "2026-09-30"
};
const DENSITIES = [1, 5, 10, 20, 40];

/* Patterns the kernel forbids as a REPLACEMENT for vendor names (NEVER 3). */
const FORBIDDEN = [
  { re: /\+\s*\d+/, label: "+N" },
  { re: /\d+\s*(more|건\s*더|개\s*더|외)\b/, label: "N more" },
  { re: /[…⋯]/, label: "ellipsis" }
];

async function fixtureVendors(page, date) {
  return page.evaluate((d) => window.FIXTURES.byDate[d].vendors, date);
}

async function setUI(page, { view, density, rowmode, focus }) {
  await page.evaluate((s) => {
    if (s.density) window.__app.setDensity(s.density);
    if (s.rowmode) window.__app.setRowMode(s.rowmode);
    if (s.view) window.__app.setView(s.view);
    if (s.focus) window.__app.setFocus(s.focus);
  }, { view, density, rowmode, focus });
  await page.waitForTimeout(60); // let layout settle
}

async function probeDay(page, date) {
  return page.evaluate((date) => {
    const cs = (e) => getComputedStyle(e);
    const cell = document.querySelector(`.day-cell[data-date="${date}"]`);
    const body = document.getElementById("calBody");
    const weekRow = cell.closest(".week-row");
    const scroller = cell.querySelector(".day-scroll");
    const items = cell.querySelector(".day-items");
    const rows = Array.from(cell.querySelectorAll(".item.vendor"));

    const rowMetrics = rows.map((r) => {
      const nameEl = r.querySelector(".vendor-name");
      const s = cs(r);
      return {
        text: nameEl.textContent.trim(),
        nameH: +nameEl.getBoundingClientRect().height.toFixed(2),
        rowH: +r.getBoundingClientRect().height.toFixed(2),
        fontSize: parseFloat(cs(nameEl).fontSize),
        scrollH: r.scrollHeight,
        clientH: r.clientHeight,
        textOverflow: s.textOverflow,
        lineClamp: s.webkitLineClamp,
        whiteSpace: s.whiteSpace
      };
    });

    const clipped = [];
    let node = cell;
    while (node && node !== document.body) {
      const s = cs(node);
      const hidden = s.overflowY === "hidden" || s.overflow === "hidden" || s.overflowY === "clip";
      if (hidden && node.scrollHeight > node.clientHeight + 1) {
        clipped.push({ sel: node.className, scrollH: node.scrollHeight, clientH: node.clientHeight });
      }
      node = node.parentElement;
    }

    const names = Array.from(cell.querySelectorAll(".vendor-name")).map((n) => n.textContent.trim());
    const pitch = rowMetrics.length > 1
      ? +(rowMetrics.reduce((a, r) => a + r.rowH, 0) / rowMetrics.length).toFixed(2)
      : (rowMetrics[0] ? rowMetrics[0].rowH : 0);

    return {
      date,
      names,
      count: names.length,
      cellText: cell.innerText,
      cellH: +cell.getBoundingClientRect().height.toFixed(1),
      weekRowH: +weekRow.getBoundingClientRect().height.toFixed(1),
      weekBusiest: +weekRow.dataset.busiest,
      dayScrollH: scroller.scrollHeight,
      dayClientH: scroller.clientHeight,
      dayOverflowY: cs(scroller).overflowY,
      columnCount: cs(items).columnCount,
      itemsH: +items.getBoundingClientRect().height.toFixed(1),
      bodyScrollH: body.scrollHeight,
      bodyClientH: body.clientHeight,
      bodyOverflowY: cs(body).overflowY,
      minNameH: rowMetrics.length ? Math.min(...rowMetrics.map((r) => r.nameH)) : null,
      fontSize: rowMetrics.length ? rowMetrics[0].fontSize : null,
      pitch,
      rowMetrics,
      clipped,
      countNote: (cell.querySelector(".count-note") || {}).textContent || null
    };
  }, date);
}

async function probeMatrix(page, date) {
  return page.evaluate((date) => {
    const cells = Array.from(document.querySelectorAll(`.matrix td[data-date="${date}"]`));
    const on = cells.filter((c) => c.dataset.participating === "true");
    const rowHeaderNames = on.map((c) =>
      c.closest("tr").querySelector("th .vendor-name").textContent.trim());
    const allRowNames = Array.from(document.querySelectorAll(".matrix tbody th .vendor-name"))
      .map((n) => n.textContent.trim());
    const table = document.querySelector(".matrix");
    const body = document.getElementById("calBody");
    const minH = Math.min(...Array.from(document.querySelectorAll(".matrix tbody th .vendor-name"))
      .map((n) => n.getBoundingClientRect().height));
    return {
      date,
      participating: rowHeaderNames,
      participatingCount: on.length,
      cellCount: cells.length,
      allRowNames,
      rowTotal: allRowNames.length,
      tableW: Math.round(table.getBoundingClientRect().width),
      tableH: Math.round(table.getBoundingClientRect().height),
      bodyScrollH: body.scrollHeight,
      bodyClientH: body.clientHeight,
      bodyScrollW: body.scrollWidth,
      bodyClientW: body.clientWidth,
      minNameH: +minH.toFixed(2)
    };
  }, date);
}

module.exports = { DENSITY_DATES, DENSITIES, FORBIDDEN, fixtureVendors, setUI, probeDay, probeMatrix };
