const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const FIXTURES = [3, 8, 20];
const ARRANGEMENTS = ['free', 'stack', 'grouped'];

test.describe('MUST 9 — 어떤 fixture 크기에서도 pin 이 조용히 사라지지 않는다', () => {
  for (const f of FIXTURES) {
    for (const arr of ARRANGEMENTS) {
      test(`fixture ${f} / ${arr}: DOM pin 수 == fixture 수`, async ({ page }) => {
        await H.open(page, { f, arr });
        await expect(page.locator('.pin')).toHaveCount(f);
        expect((await H.pinIds(page)).slice().sort()).toEqual(H.FIXTURE_IDS[f].slice().sort());

        const ledger = page.locator('#ledger');
        await expect(ledger).toHaveAttribute('data-total', String(f));
        const m = await page.evaluate(() => window.__spike.metrics());
        expect(m.visiblePins + m.collapsedPins + m.offscreenPins).toBe(f);
        expect(m.domPins).toBe(f);
      });
    }
  }
});

test.describe('collapse — 접힌 group 도 모든 pin 을 계속 책임진다', () => {
  for (const f of FIXTURES) {
    for (const axis of ['urgency', 'event']) {
      test(`fixture ${f} / group by ${axis}: 전부 접어도 pin 수 유지`, async ({ page }) => {
        await H.open(page, { f, arr: 'grouped', axis, collapsed: 'all' });

        await expect(page.locator('.pin')).toHaveCount(f);
        const collapsedFlags = await page.$$eval('.group', (els) =>
          els.map((e) => e.getAttribute('data-collapsed')));
        expect(collapsedFlags.every((v) => v === 'true')).toBe(true);

        // group header 의 건수 합계 == fixture 수
        const counts = await page.$$eval('.group', (els) =>
          els.map((e) => Number(e.getAttribute('data-count'))));
        expect(counts.reduce((a, b) => a + b, 0)).toBe(f);

        // 접힌 상태에서 pin 본문은 보이지 않지만 DOM 에 남아 있다
        await expect(page.locator('.pin').first()).toBeHidden();
        const m = await page.evaluate(() => window.__spike.metrics());
        expect(m.collapsedPins).toBe(f);

        // 접힘 요약에 모든 pin 제목이 이름으로 남아 있다 (숫자만으로 대체하지 않는다)
        const summaries = (await page.$$eval('.group-summary', (els) =>
          els.map((e) => e.textContent))).join(' :: ');
        const titles = await page.evaluate((n) =>
          window.FIXTURES[n].map((p) => p.title), f);
        for (const t of titles) expect(summaries).toContain(t);
      });

      test(`fixture ${f} / group by ${axis}: collapse -> expand 왕복 후 pin 집합 동일`, async ({ page }) => {
        await H.open(page, { f, arr: 'grouped', axis });
        const before = (await H.pinIds(page)).slice().sort();
        expect(before.length).toBe(f);

        await page.click('#collapse-all');
        await expect(page.locator('.pin')).toHaveCount(f);

        await page.click('#expand-all');
        await expect(page.locator('.pin')).toHaveCount(f);
        const after = (await H.pinIds(page)).slice().sort();
        expect(after).toEqual(before);
        await expect(page.locator('.pin').first()).toBeVisible();
      });
    }
  }

  test('fixture 20 / 개별 group 접기: 그 group 만 접히고 총 수는 그대로', async ({ page }) => {
    await H.open(page, { f: 20, arr: 'grouped', axis: 'urgency' });
    const first = page.locator('.group').first();
    const count = Number(await first.getAttribute('data-count'));
    await first.locator('.group-toggle').click();
    await expect(first).toHaveAttribute('data-collapsed', 'true');
    await expect(page.locator('.group[data-collapsed="true"]')).toHaveCount(1);
    await expect(page.locator('.pin')).toHaveCount(20);
    const m = await page.evaluate(() => window.__spike.metrics());
    expect(m.collapsedPins).toBe(count);
  });
});

test.describe('priority ordering — 명시 규칙(P1 days 오름차순, P2 title 코드포인트)', () => {
  for (const f of FIXTURES) {
    test(`fixture ${f} / independent: DOM 순서가 규칙과 정확히 일치`, async ({ page }) => {
      await H.open(page, { f, arr: 'free' });
      expect(await H.pinIds(page)).toEqual(H.EXPECTED_PRIORITY[f]);
    });

    test(`fixture ${f} / stack: DOM 순서가 규칙과 정확히 일치`, async ({ page }) => {
      await H.open(page, { f, arr: 'stack' });
      expect(await H.pinIds(page)).toEqual(H.EXPECTED_PRIORITY[f]);
    });

    test(`fixture ${f} / group by urgency: bucket 이 단조라 평탄화 순서도 규칙과 일치`, async ({ page }) => {
      await H.open(page, { f, arr: 'grouped', axis: 'urgency' });
      expect(await H.pinIds(page)).toEqual(H.EXPECTED_PRIORITY[f]);
    });
  }

  test('fixture 20 / urgency group 순서는 overdue → today → week → month → later', async ({ page }) => {
    await H.open(page, { f: 20, arr: 'grouped', axis: 'urgency' });
    expect(await H.groupKeys(page)).toEqual(['overdue', 'today', 'week', 'month', 'later']);
    const counts = await page.$$eval('.group', (els) =>
      els.map((e) => Number(e.getAttribute('data-count'))));
    expect(counts).toEqual([3, 2, 5, 7, 3]);
  });

  test('fixture 8 / event group 순서는 각 group 의 최우선 pin 기준(P3)', async ({ page }) => {
    await H.open(page, { f: 8, arr: 'grouped', axis: 'event' });
    expect(await H.groupKeys(page)).toEqual([
      '가을 농특산물 대축제', // b1  D+3
      '정산',                  // b2  D+1
      '지도점검',              // b5  D-4
      '직거래장터',            // b6  D-11
      '수급대책',              // b7  D-23
      '사업계획'               // b8  D-45
    ]);
    // event 축으로 묶으면 평탄화 순서는 전역 우선순위와 더 이상 같지 않다 (측정된 trade-off)
    expect(await H.pinIds(page)).not.toEqual(H.EXPECTED_PRIORITY[8]);
  });

  test('fixture 20 / independent 배치 좌표도 우선순위 순으로 흐른다 (위->아래, 왼->오른쪽)', async ({ page }) => {
    await H.open(page, { f: 20, arr: 'free' });
    const boxes = await page.$$eval('.pin', (els) => els.map((e) => ({
      id: e.getAttribute('data-pin-id'),
      x: parseFloat(e.style.left),
      y: parseFloat(e.style.top)
    })));
    for (let i = 1; i < boxes.length; i++) {
      const prev = boxes[i - 1], cur = boxes[i];
      expect(cur.y > prev.y || (cur.y === prev.y && cur.x > prev.x)).toBe(true);
    }
  });
});

test.describe('scroll — 자리가 모자라면 잘라내지 않고 스크롤로 넘긴다', () => {
  test('fixture 20 은 세 배치 모두에서 스크롤이 생기고, 스크롤해도 총 수는 20', async ({ page }) => {
    for (const arr of ['free', 'stack', 'grouped']) {
      await H.open(page, { f: 20, arr });
      const m = await page.evaluate(() => window.__spike.metrics());
      expect(m.domPins).toBe(20);
      expect(m.scrollable).toBe(true);
      expect(m.overflowPx).toBeGreaterThan(0);
      await page.evaluate(() => { document.getElementById('rail').scrollTop = 99999; });
      await expect(page.locator('.pin')).toHaveCount(20);
      const m2 = await page.evaluate(() => window.__spike.metrics());
      expect(m2.visiblePins + m2.collapsedPins + m2.offscreenPins).toBe(20);
      expect(m2.visiblePins).toBeGreaterThan(0);
    }
  });

  test('fixture 3 은 어떤 배치에서도 스크롤이 생기지 않는다', async ({ page }) => {
    for (const arr of ['free', 'stack', 'grouped']) {
      await H.open(page, { f: 3, arr });
      const m = await page.evaluate(() => window.__spike.metrics());
      expect(m.scrollable).toBe(false);
      expect(m.visiblePins).toBe(3);
    }
  });
});
