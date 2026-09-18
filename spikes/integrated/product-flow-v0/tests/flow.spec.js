'use strict';
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const { DENSE_DATE, TODAY } = H;

/* ---------------- 1. 흐름이 실제로 이어지는가 ---------------- */
test('Idle -> Ambient -> Quick -> Calendar 가 한 화면에서 이어진다', async ({ page }) => {
  await page.goto('/index.html');
  // 1. Desktop Idle — 다른 업무가 보이고 ambient 는 물러나 있다
  await expect(page.locator('#win1')).toBeVisible();
  await expect(page.locator('#win2')).toBeVisible();
  await expect(page.locator('#ambient')).toHaveAttribute('data-mode', 'rest');
  const restOpacity = await page.locator('#ambient').evaluate(e => +getComputedStyle(e).opacity);
  expect(restOpacity).toBeLessThan(1);
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('#quick')).toBeHidden();

  // 2. Ambient Active — 오늘 / 다음 / 확인 필요 / 중요 D-day
  await page.click('[data-act="wake"]');
  await expect(page.locator('#ambient')).toHaveAttribute('data-mode', 'active');
  await expect(page.locator('#ambient')).toHaveText(/오늘/);
  await expect(page.locator('#ambient')).toHaveText(/다음/);
  await expect(page.locator('#ambient')).toHaveText(/확인 필요/);
  await expect(page.locator('#ambient')).toHaveText(/중요 D-day/);
  expect(await page.locator('#ambient .amb-sec').count()).toBe(4);
  await expect.poll(() => page.locator('#ambient').evaluate(e => +getComputedStyle(e).opacity)).toBe(1);

  // 3. Quick — 오늘 + 빠른 추가 + 캘린더 진입
  await page.click('.amb-acts [data-act="quick"]');
  await expect(page.locator('#quick')).toBeVisible();
  expect(await page.locator('#quick .q-item').count()).toBeGreaterThan(2);
  await expect(page.locator('#qfast')).toBeVisible();
  await expect(page.locator('.q-foot [data-act="calendar"]')).toBeVisible();

  // 4. Calendar Month
  await page.click('.q-foot [data-act="calendar"]');
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('.week-row').first()).toBeVisible();
});

test('Quick 의 빠른 추가가 오늘 목록과 캘린더에 함께 반영된다', async ({ page }) => {
  await H.walkIn(page, 'quick');
  const before = await page.locator('#quick .q-item').count();
  await page.fill('#qfast', '테스트 협의 (빠른 추가)');
  await page.click('[data-act="qfast-add"]');
  await expect(page.locator('#quick .q-item')).toHaveCount(before + 1);
  await page.click('.q-foot [data-act="calendar"]');
  await expect(page.locator(`.day[data-date="${TODAY}"]`)).toContainText('테스트 협의 (빠른 추가)');
});

/* ---------------- 4/5. Calendar ---------------- */
test('Calendar 는 사무일정·행사·업체 참가를 한 캘린더에 담는다 (기본값: 가변 높이 행 + 본문 스크롤 + 1열 업체명)', async ({ page }) => {
  await H.walkIn(page);
  // 한 셀 안에 행사·일반일정·업체가 함께 있다
  const dense = page.locator(`.day[data-date="${DENSE_DATE}"]`);
  await expect(dense.locator('.it-ev')).toHaveCount(1);
  expect(await dense.locator('.it-sc').count()).toBeGreaterThan(0);
  expect(await dense.locator('.it-v').count()).toBe(20);

  // 기본 밀도는 조밀(1열). v-list 가 1열이어야 한다
  await expect(page.locator('body')).toHaveAttribute('data-density', 'compact');
  const cols = await dense.locator('.v-list').evaluate(e => getComputedStyle(e).gridTemplateColumns);
  expect(cols === 'none' || cols.split(' ').length === 1).toBeTruthy();

  // 가변 높이 week row: 밀집 주 행이 한산한 주 행보다 높다
  const heights = await page.locator('.week-row').evaluateAll(rs => rs.map(r => Math.round(r.getBoundingClientRect().height)));
  const denseRow = await page.locator('.week-row', { has: page.locator(`.day[data-date="${DENSE_DATE}"]`) })
    .evaluate(r => Math.round(r.getBoundingClientRect().height));
  expect(denseRow).toBe(Math.max(...heights));
  expect(denseRow).toBeGreaterThan(Math.min(...heights));

  // 캘린더 본문이 유일한 세로 스크롤러다 (셀마다 독립 스크롤바를 두지 않는다)
  const body = page.locator('#calBody');
  const m = await body.evaluate(e => ({ s: e.scrollHeight, c: e.clientHeight }));
  expect(m.s).toBeGreaterThan(m.c);
  const cellScrollers = await page.locator('#sheet .day').evaluateAll(ds => ds.filter(d => {
    const cs = getComputedStyle(d);
    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 1;
  }).length);
  expect(cellScrollers).toBe(0);
});

test('Dense Calendar — 20개 업체명이 모두 화면에서 도달 가능하다 (숨김 0)', async ({ page }) => {
  await H.walkIn(page);
  const names = await H.vendorNamesOn(page, DENSE_DATE);
  expect(names).toHaveLength(20);
  expect(new Set(names).size).toBe(20);
  const cells = page.locator(`.day[data-date="${DENSE_DATE}"] .it-v .vn`);
  for (let i = 0; i < 20; i++) {
    const n = cells.nth(i);
    await n.scrollIntoViewIfNeeded();
    await expect(n).toBeVisible();
    const box = await n.boundingBox();
    const fs = await n.evaluate(e => parseFloat(getComputedStyle(e).fontSize));
    expect(box.height).toBeGreaterThanOrEqual(fs);   // 0 높이로 눌리지 않았다
    expect(box.width).toBeGreaterThan(20);
  }
});

test('ZERO +N 업체 overflow — 어떤 밀도·뷰에서도 업체명을 숫자/말줄임으로 대체하지 않는다', async ({ page }) => {
  await H.walkIn(page);
  for (const den of ['compact', 'comfortable', 'dense2']) {
    await page.click(`[data-act="den-${den}"]`);
    await expect(page.locator('body')).toHaveAttribute('data-density', den);
    expect(await H.vendorOverflowMarkers(page)).toEqual([]);
    expect(await H.vendorNamesOn(page, DENSE_DATE)).toHaveLength(20);
  }
  await page.click('[data-act="view-matrix"]');
  expect(await H.vendorOverflowMarkers(page)).toEqual([]);
});

/* ---------------- 6. Matrix ---------------- */
test('Calendar <-> Vendor Matrix 는 같은 데이터의 두 표면이다', async ({ page }) => {
  await H.walkIn(page);
  const monthNames = (await H.vendorNamesOn(page, DENSE_DATE)).sort();

  await page.click('[data-act="view-matrix"]');
  await expect(page.locator('body')).toHaveAttribute('data-cal-view', 'matrix');
  await expect(page.locator('table.mx')).toBeVisible();
  await expect(page.locator('#calBody')).toHaveCount(0);
  const rows = await page.locator('table.mx tbody th.vh').count();
  expect(rows).toBeGreaterThanOrEqual(20);

  // 같은 날짜 열의 업체 집합이 월 뷰와 동일하다
  const mxNames = await page.evaluate(d => {
    const ths = [...document.querySelectorAll('table.mx thead th')];
    const idx = ths.findIndex(t => t.textContent.trim().startsWith(d.slice(5).replace('-', '.')));
    return [...document.querySelectorAll('table.mx tbody tr')]
      .filter(tr => tr.children[idx] && tr.children[idx].classList.contains('on'))
      .map(tr => tr.children[0].firstChild.textContent.trim());
  }, DENSE_DATE);
  expect(mxNames.sort()).toEqual(monthNames);

  // 가로 스크롤 없이 업체명 행 헤더가 끝까지 남는다
  const wrap = await page.locator('.mx-wrap').evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
  expect(wrap.sw - wrap.cw).toBeLessThanOrEqual(1);

  await page.click('[data-act="view-month"]');
  await expect(page.locator('#calBody')).toBeVisible();
  expect(await H.vendorNamesOn(page, DENSE_DATE)).toHaveLength(20);
});

/* ---------------- 7/8/9. Object Lens ---------------- */
test('Vendor / Event / General Schedule 세 가지 lens 가 열리고 핵심 사실이 추가 클릭 없이 보인다', async ({ page }) => {
  await H.walkIn(page);
  const cases = [
    { key: `v:v01@${DENSE_DATE}`, kind: 'vendor', kindLabel: '업체', must: ['참가계획', '날짜예외', '업무', '첨부'] },
    { key: `e:e1@${DENSE_DATE}`, kind: 'event', kindLabel: '행사', must: ['기간', '장소', '참가 업체'] },
    { key: `s:s08@${TODAY}`, kind: 'schedule', kindLabel: '일반 사무일정', must: ['일시', '반복', '상태'] }
  ];
  for (const c of cases) {
    await page.click(`[data-lens-origin="${c.key}"]`);
    const lens = page.locator('.lens');
    await expect(lens).toHaveCount(1);
    await expect(lens).toHaveAttribute('data-kind', c.kind);
    await expect(lens.locator('.lens-kind')).toContainText(c.kindLabel);
    expect(await lens.locator('.lens-facts dd').count()).toBeGreaterThanOrEqual(5);
    for (const m of c.must) await expect(lens).toContainText(m);
    for (const dd of await lens.locator('.lens-facts dd').all()) await expect(dd).toBeVisible();
    await expect(lens).toContainText('범위: 이 날짜만');
  }
});

test('lens 는 정확히 하나다 — 새 객체 선택은 교체한다', async ({ page }) => {
  await H.walkIn(page);
  const keys = [`v:v01@${DENSE_DATE}`, `e:e1@${DENSE_DATE}`, `v:v07@${DENSE_DATE}`, `s:s12@${DENSE_DATE}`];
  for (const k of keys) {
    await page.click(`[data-lens-origin="${k}"]`);
    await expect(page.locator('.lens')).toHaveCount(1);
    await expect(page.locator('.lens')).toHaveAttribute('data-origin', k);
    await expect(page.locator('.it.is-origin')).toHaveCount(1);
  }
  await page.click('[data-act="lens-close"]');
  await expect(page.locator('.lens')).toHaveCount(0);
});

test('lens 를 열어도 origin 이 화면에 남고 한 픽셀도 가려지지 않는다', async ({ page }) => {
  await H.walkIn(page);
  const keys = [`v:v01@${DENSE_DATE}`, `v:v20@${DENSE_DATE}`, `e:e2@2026-09-11`, `s:s01@2026-09-01`, `s:s14@2026-09-29`];
  for (const k of keys) {
    await page.click(`[data-lens-origin="${k}"]`);
    const r = await H.overlapWithLens(page, k);
    expect(r.ok, k).toBeTruthy();
    expect(r.covered, `${k} covered`).toBe(0);
    expect(r.inViewport, `${k} in viewport`).toBeTruthy();
    await expect(page.locator(`[data-lens-origin="${k}"]`)).toHaveClass(/is-origin/);
  }
});

test('lens 를 닫으면 focus 가 origin 으로 돌아온다', async ({ page }) => {
  await H.walkIn(page);
  const k = `v:v01@${DENSE_DATE}`;
  await page.click(`[data-lens-origin="${k}"]`);
  await page.click('[data-act="lens-close"]');
  await expect(page.locator(`[data-lens-origin="${k}"]`)).toBeFocused();
});

test('상시 우측 inspector 는 어떤 상태에도 없다', async ({ page }) => {
  await H.walkIn(page, 'idle');
  expect(await H.rightInspectors(page)).toEqual([]);
  for (const step of ['ambient', 'quick', 'calendar']) {
    await H.walkIn(page, step);
    expect(await H.rightInspectors(page), step).toEqual([]);
  }
  await page.click(`[data-lens-origin="v:v01@${DENSE_DATE}"]`);
  expect(await H.rightInspectors(page), 'lens').toEqual([]);
  await page.click('[data-act="focus-open"]');
  expect(await H.rightInspectors(page), 'focus').toEqual([]);
  await page.goto(`/index.html?stage=ambient&dday=20`);
  expect(await H.rightInspectors(page), 'dday').toEqual([]);
});

/* ---------------- 10. Focus Surface ---------------- */
test('Focus Surface 진입과 복귀 — 절차/업무/첨부 존재/변경 이력/참가계획', async ({ page }) => {
  await H.walkIn(page);
  const k = `v:v01@${DENSE_DATE}`;
  await page.click(`[data-lens-origin="${k}"]`);
  await page.click('[data-act="focus-open"]');
  const f = page.locator('#focus');
  await expect(f).toBeVisible();
  await expect(page.locator('.lens')).toHaveCount(0);
  for (const s of ['절차', '업무', '첨부 존재', '변경 이력', '참가계획']) await expect(f).toContainText(s);
  expect(await f.locator('.proc .step').count()).toBeGreaterThanOrEqual(4);
  for (const st of ['planned', 'doing', 'done']) expect(await f.locator(`.wk[data-state="${st}"]`).count()).toBeGreaterThan(0);
  expect(await f.locator('.hist li').count()).toBeGreaterThan(0);
  await expect(f.locator('.plan-tbl .ex')).toContainText('불참');
  await expect(f).toContainText('전체 참가계획');

  // Focus -> Lens -> Calendar -> Ambient 로 걸어서 돌아온다
  await page.click('[data-act="focus-back"]');
  await expect(page.locator('.lens')).toHaveCount(1);
  await expect(page.locator('.lens')).toHaveAttribute('data-origin', k);
  await expect(page.locator('#focus')).toBeHidden();
  await page.click('[data-act="lens-close"]');
  await expect(page.locator('#sheet')).toBeVisible();
  await page.click('.sh-head [data-act="back"]');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'quick');
  await page.click('.q-head [data-act="back"]');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'ambient');
  await expect(page.locator('#ambient')).toHaveAttribute('data-mode', 'active');
});

test('Focus 의 연결 chip 이 다른 객체의 lens 로 이어진다 (lens 는 여전히 1개)', async ({ page }) => {
  await H.walkIn(page);
  await page.click(`[data-lens-origin="e:e1@${DENSE_DATE}"]`);
  await page.click('[data-act="focus-open"]');
  await page.locator('#focus .chip').first().click();
  await expect(page.locator('#focus')).toBeHidden();
  await expect(page.locator('.lens')).toHaveCount(1);
  await expect(page.locator('.lens')).toHaveAttribute('data-kind', 'vendor');
});

/* ---------------- 11. Quick Add ---------------- */
test('빈 날짜를 클릭하면 Quick Add 가 그 날짜로 채워져 열린다 (첫 항목은 제목 + 날짜/시간만)', async ({ page }) => {
  await H.walkIn(page);
  const empty = '2026-09-02';
  expect(await page.locator(`.day[data-date="${empty}"] .it`).count()).toBe(0);
  await page.locator(`.day[data-date="${empty}"] .day-empty`).click();
  const qa = page.locator('#quickAdd');
  await expect(qa).toBeVisible();
  await expect(page.locator('#qa-date')).toHaveValue(empty);
  await expect(page.locator('#qa-title')).toBeFocused();
  // 처음 보이는 입력은 제목 + 날짜 + 시간 3개뿐
  expect(await qa.locator('.qa-body input, .qa-body select').count()).toBe(3);
  await expect(page.locator('#qa-extra')).toHaveCount(0);
  await page.click('[data-act="qa-more"]');
  await expect(page.locator('#qa-extra')).toBeVisible();
  expect(await qa.locator('#qa-extra input, #qa-extra select').count()).toBe(4);

  await page.fill('#qa-title', '절임배추 사전협의');
  await page.click('[data-act="qa-save"]');
  await expect(qa).toBeHidden();
  await expect(page.locator(`.day[data-date="${empty}"]`)).toContainText('절임배추 사전협의');
});

test('밀집한 날짜에서도 + 버튼으로 그 날짜의 Quick Add 를 연다', async ({ page }) => {
  await H.walkIn(page);
  await page.locator(`.day[data-date="${DENSE_DATE}"] .day-n`).hover();
  await page.locator(`.day[data-date="${DENSE_DATE}"] .day-add`).click();
  await expect(page.locator('#qa-date')).toHaveValue(DENSE_DATE);
});

/* ---------------- 12/13. D-day ---------------- */
for (const n of [3, 20]) {
  test(`D-day ${n}건 — HYBRID (독립 pin + 긴급도 그룹), 누락 0`, async ({ page }) => {
    await H.walkIn(page, 'ambient');
    await page.click('.amb-acts [data-act="dday"]');
    await expect(page.locator('#dday')).toBeVisible();
    await page.click(`[data-act="dd-${n}"]`);
    const led = page.locator('#ddLedger');
    await expect(led).toHaveAttribute('data-total', String(n));
    const pinned = +(await led.getAttribute('data-pinned'));
    const grouped = +(await led.getAttribute('data-grouped'));
    expect(pinned).toBeGreaterThanOrEqual(1);
    expect(pinned + grouped).toBe(n);
    expect(await page.locator('#dday .pin').count()).toBe(pinned);
    expect(await page.locator('#dday .dd-item').count()).toBe(grouped);
    expect(await page.locator('#dday .dd-group').count()).toBeGreaterThanOrEqual(1);
    // 기능적 상한 없음: 남는 것은 스크롤 뒤에 있고 ledger 가 세 숫자로 전부 설명한다
    const off = +(await led.getAttribute('data-offscreen'));
    const col = +(await led.getAttribute('data-collapsed'));
    expect(off).toBeLessThanOrEqual(grouped);
    expect(col).toBe(0);
  });
}

test('D-day 20건: group 을 접어도 항목이 하나도 사라지지 않는다', async ({ page }) => {
  await page.goto('/index.html?stage=ambient&dday=20');
  const total = 20;
  const before = await page.locator('#dday .dd-item').allTextContents();
  const pins = await page.locator('#dday .pin').count();
  expect(before.length + pins).toBe(total);

  const groups = await page.locator('#dday .dd-group').count();
  for (let i = 0; i < groups; i++) await page.locator('#dday .dd-gh').nth(i).click();
  for (let i = 0; i < groups; i++) await expect(page.locator('#dday .dd-group').nth(i)).toHaveAttribute('data-collapsed', '1');

  const after = await page.locator('#dday .dd-item').allTextContents();
  expect(after.length).toBe(before.length);
  expect(new Set(after)).toEqual(new Set(before));
  await expect(page.locator('#ddLedger')).toHaveAttribute('data-collapsed', String(before.length));
  // 접힌 머리줄에 항목 제목이 텍스트로 남는다 (숫자로 치환하지 않는다)
  const summary = (await page.locator('#dday .dd-gh .gs').allTextContents()).join(' · ');
  for (const t of before) {
    const title = t.replace(/^D[-+]?\S*/, '').trim();
    expect(summary).toContain(title.split('  ')[0].trim().slice(0, 8));
  }
  // 접힌 뒤 스크롤이 사라진다 (measured: 접힘이 압축률을 준다)
  const g = await page.locator('#ddGroups').evaluate(e => ({ s: e.scrollHeight, c: e.clientHeight }));
  expect(g.s - g.c).toBeLessThanOrEqual(1);

  // 되돌리면 그대로 복귀
  for (let i = 0; i < groups; i++) await page.locator('#dday .dd-gh').nth(i).click();
  expect((await page.locator('#dday .dd-item').allTextContents()).length).toBe(before.length);
});

/* ---------------- 14. Layout Edit ---------------- */
test('평상시에는 drag 가 불가능하고, Layout Edit 안에서만 pin 이 움직인다', async ({ page }) => {
  await page.goto('/index.html?stage=ambient&dday=20');
  const pin = page.locator('#dday .pin').first();
  await expect(pin).toHaveAttribute('data-draggable', 'false');
  await expect(pin).toHaveAttribute('draggable', 'false');
  const cur = await pin.evaluate(e => getComputedStyle(e).cursor);
  expect(cur).not.toBe('grab');
  const b0 = await H.dragBy(page, pin, 120, 90);
  const b1 = await pin.boundingBox();
  expect(Math.round(b1.x)).toBe(Math.round(b0.x));
  expect(Math.round(b1.y)).toBe(Math.round(b0.y));

  // Layout Edit 진입
  await page.click('#dday [data-act="layout"]');
  await expect(page.locator('body')).toHaveAttribute('data-layout-edit', '1');
  await expect(page.locator('#editbar')).toBeVisible();
  const p2 = page.locator('#dday .pin').first();
  await expect(p2).toHaveAttribute('data-draggable', 'true');
  const c0 = await H.dragBy(page, p2, 120, 90);
  const c1 = await p2.boundingBox();
  expect(Math.round(c1.x - c0.x)).toBe(120);
  expect(Math.round(c1.y - c0.y)).toBe(90);

  // ambient 위치도 Layout Edit 안에서만 움직인다
  const amb = page.locator('#ambient');
  const a0 = await amb.boundingBox();
  await page.mouse.move(a0.x + 60, a0.y + 12);
  await page.mouse.down();
  await page.mouse.move(a0.x + 60 - 180, a0.y + 12 - 60, { steps: 6 });
  await page.mouse.up();
  const a1 = await amb.boundingBox();
  expect(Math.round(a1.x - a0.x)).toBe(-180);

  // 나가면 배치는 남고 다시 잠긴다
  await page.click('[data-act="layout-done"]');
  await expect(page.locator('body')).toHaveAttribute('data-layout-edit', '0');
  await expect(page.locator('#dday .pin').first()).toHaveAttribute('data-draggable', 'false');
  const c2 = await page.locator('#dday .pin').first().boundingBox();
  expect(Math.round(c2.x)).toBe(Math.round(c1.x));
  const a2 = await amb.boundingBox();
  expect(Math.round(a2.x)).toBe(Math.round(a1.x));
  await H.dragBy(page, page.locator('#dday .pin').first(), 70, 70);
  const c3 = await page.locator('#dday .pin').first().boundingBox();
  expect(Math.round(c3.x)).toBe(Math.round(c2.x));
});

test('평상시 어떤 요소에도 drag 가 걸려 있지 않다', async ({ page }) => {
  await H.walkIn(page);
  const draggables = await page.evaluate(() =>
    [...document.querySelectorAll('body *')].filter(e =>
      e.draggable === true || e.getAttribute('data-draggable') === 'true' ||
      getComputedStyle(e).cursor === 'grab' || getComputedStyle(e).cursor === 'move').length);
  expect(draggables).toBe(0);
});

/* ---------------- 15. Return path / Esc ---------------- */
test('Esc 로 Focus -> Lens -> Calendar -> Quick -> Ambient -> Idle 까지 되돌아간다', async ({ page }) => {
  await H.walkIn(page);
  await page.click(`[data-lens-origin="v:v01@${DENSE_DATE}"]`);
  await page.click('[data-act="focus-open"]');
  await expect(page.locator('#focus')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.lens')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lens')).toHaveCount(0);
  await expect(page.locator('#sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'quick');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'ambient');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'idle');
  await expect(page.locator('#ambient')).toHaveAttribute('data-mode', 'rest');
});

test('Esc 가 Quick Add 와 Layout Edit 도 되돌린다', async ({ page }) => {
  await H.walkIn(page);
  await page.locator('.day[data-date="2026-09-02"] .day-empty').click();
  await expect(page.locator('#quickAdd')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#quickAdd')).toBeHidden();
  await expect(page.locator('#sheet')).toBeVisible();

  await page.goto('/index.html?stage=ambient&dday=20&edit=1');
  await expect(page.locator('#editbar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-layout-edit', '0');
});

/* ---------------- KERNEL MUST 3/4 ---------------- */
test('이 날짜만 수정과 전체 참가계획 수정이 구별된다', async ({ page }) => {
  await H.walkIn(page);
  const k = `v:v07@${DENSE_DATE}`;
  await page.click(`[data-lens-origin="${k}"]`);
  await expect(page.locator('.lens')).toContainText('범위: 이 날짜만');
  await page.locator('[data-act="lens-status"]').selectOption('보류');
  await expect(page.locator(`[data-lens-origin="${k}"]`)).toHaveAttribute('data-status', '보류');
  // 같은 업체의 다른 날짜는 그대로다
  await expect(page.locator('[data-lens-origin="v:v07@2026-09-24"]')).toHaveAttribute('data-status', '확정');
  // 전체 계획 수정은 Focus Surface 에 있고, 날짜예외를 보존한다고 명시한다
  await page.click(`[data-lens-origin="v:v01@${DENSE_DATE}"]`);
  await page.click('[data-act="focus-open"]');
  await expect(page.locator('#focus')).toContainText('전체 참가계획');
  await expect(page.locator('#focus')).toContainText('날짜예외는 보존');
});
