const { test, expect } = require('@playwright/test');
const H = require('./helpers');

/* EXPERIENCE 6 — 자유 배치는 별도 Layout Edit 상태에서만.
   NEVER 5  — 평상시 모든 요소를 draggable 상태로 두지 않는다. */

test('평상시에는 pin 을 끌어도 움직이지 않는다 (양방향 중 "불가능" 쪽)', async ({ page }) => {
  await H.open(page, { f: 8, arr: 'free' });
  await expect(page.locator('body')).toHaveAttribute('data-edit', 'off');

  const pin = page.locator('.pin').first();
  await expect(pin).toHaveAttribute('data-draggable', 'false');
  await expect(pin).toHaveAttribute('draggable', 'false');
  // 모든 pin 이 잠겨 있다
  await expect(page.locator('.pin[data-draggable="true"]')).toHaveCount(0);

  const before = await pin.boundingBox();
  await H.dragBy(page, before, 160, 120);
  const after = await pin.boundingBox();

  expect(Math.abs(after.x - before.x)).toBeLessThan(0.5);
  expect(Math.abs(after.y - before.y)).toBeLessThan(0.5);
  await expect(page.locator('.pin')).toHaveCount(8);
});

test('Layout Edit 안에서는 pin 을 끌어 옮길 수 있다 ("가능" 쪽)', async ({ page }) => {
  await H.open(page, { f: 8, arr: 'free' });
  await page.click('#layout-edit-toggle');
  await expect(page.locator('body')).toHaveAttribute('data-edit', 'on');
  await expect(page.locator('#layout-edit-toggle')).toHaveAttribute('aria-pressed', 'true');

  const pin = page.locator('.pin').first();
  await expect(pin).toHaveAttribute('data-draggable', 'true');

  const before = await pin.boundingBox();
  await H.dragBy(page, before, 160, 120);
  const after = await pin.boundingBox();

  expect(after.x - before.x).toBeGreaterThan(150);
  expect(after.x - before.x).toBeLessThan(170);
  expect(after.y - before.y).toBeGreaterThan(110);
  expect(after.y - before.y).toBeLessThan(130);
  await expect(page.locator('.pin')).toHaveCount(8);
});

test('Layout Edit 을 나가면 배치는 유지되고 다시 잠긴다', async ({ page }) => {
  await H.open(page, { f: 8, arr: 'free' });

  await page.click('#layout-edit-toggle');
  const pin = page.locator('.pin').first();
  const start = await pin.boundingBox();
  await H.dragBy(page, start, 140, 100);
  const moved = await pin.boundingBox();
  expect(moved.x - start.x).toBeGreaterThan(130);

  await page.click('#layout-edit-toggle');           // Layout Edit 나가기
  await expect(page.locator('body')).toHaveAttribute('data-edit', 'off');
  await expect(page.locator('.pin[data-draggable="true"]')).toHaveCount(0);

  const relocked = await pin.boundingBox();
  expect(Math.abs(relocked.x - moved.x)).toBeLessThan(0.5);   // 옮긴 배치는 남는다
  expect(Math.abs(relocked.y - moved.y)).toBeLessThan(0.5);

  await H.dragBy(page, relocked, 130, 90);                    // 다시 끌어도
  const afterLock = await pin.boundingBox();
  expect(Math.abs(afterLock.x - relocked.x)).toBeLessThan(0.5);
  expect(Math.abs(afterLock.y - relocked.y)).toBeLessThan(0.5);
  await expect(page.locator('.pin')).toHaveCount(8);
});

test('fixture 20 에서도 잠금/해제가 같게 동작한다', async ({ page }) => {
  await H.open(page, { f: 20, arr: 'free' });
  const pin = page.locator('.pin').first();
  const b0 = await pin.boundingBox();
  await H.dragBy(page, b0, 100, 60);
  const b1 = await pin.boundingBox();
  expect(Math.abs(b1.x - b0.x)).toBeLessThan(0.5);

  await page.click('#layout-edit-toggle');
  const b2 = await pin.boundingBox();
  await H.dragBy(page, b2, 100, 60);
  const b3 = await pin.boundingBox();
  expect(b3.x - b2.x).toBeGreaterThan(90);
  await expect(page.locator('.pin')).toHaveCount(20);
});

test('group 배치도 Layout Edit 밖에서는 재정렬되지 않고, 안에서는 된다', async ({ page }) => {
  await H.open(page, { f: 8, arr: 'grouped', axis: 'urgency' });
  const initial = await H.groupKeys(page);
  expect(initial[0]).toBe('overdue');

  const head = page.locator('.group').first().locator('.group-head');
  const hb = await head.boundingBox();
  await H.dragBy(page, hb, 0, 180);
  expect(await H.groupKeys(page)).toEqual(initial);          // 잠김
  await expect(page.locator('.pin')).toHaveCount(8);

  await page.click('#layout-edit-toggle');
  await expect(page.locator('.group').first()).toHaveAttribute('data-draggable', 'true');
  const hb2 = await page.locator('.group').first().locator('.group-head').boundingBox();
  await H.dragBy(page, hb2, 0, 180);

  const reordered = await H.groupKeys(page);
  expect(reordered.slice().sort()).toEqual(initial.slice().sort());  // group 이 사라지지 않는다
  expect(reordered.indexOf('overdue')).toBeGreaterThan(0);           // 순서는 바뀌었다
  await expect(page.locator('.pin')).toHaveCount(8);                 // pin 도 사라지지 않는다
});

test('Ambient — 평상시에는 surface 가 물러나 있고, Layout Edit 에서는 전면에 온다', async ({ page }) => {
  await H.open(page, { f: 8, arr: 'stack' });
  await expect(page.locator('body')).toHaveAttribute('data-ambient', 'on');
  const opacity = () => page.locator('.surface')
    .evaluate((e) => Number(getComputedStyle(e).opacity));
  await expect.poll(opacity).toBeLessThan(1);   // 휴지 상태에서는 뒤로 물러나 있다

  await page.click('#layout-edit-toggle');
  await expect(page.locator('body')).toHaveAttribute('data-ambient', 'off');
  await expect.poll(opacity).toBe(1);           // 의도가 있으면 전면에 온다 (transition 종료 후)
});
