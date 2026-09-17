const path = require('path');
const SHOTS = path.join(__dirname, '..', 'screenshots');

async function boot(page, opts = {}) {
  await page.goto('/');
  await page.waitForSelector('body[data-ready="1"]');
  if (opts.rule) await page.selectOption('[data-testid="overlap-rule"]', opts.rule);
  if (opts.anchor) await page.selectOption('[data-testid="anchor-mode"]', opts.anchor);
}

function overlapArea(a, b) {
  if (!a || !b) return 0;
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return (w > 0 && h > 0) ? w * h : 0;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false });
}

module.exports = { boot, overlapArea, shot, SHOTS };
