const FIXTURE_IDS = {
  3: ['a1', 'a2', 'a3'],
  8: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'],
  20: ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10',
       'c11', 'c12', 'c13', 'c14', 'c15', 'c16', 'c17', 'c18', 'c19', 'c20']
};

/* PRIORITY RULE 을 손으로 적어둔 기대값.
   구현을 호출해서 만들지 않는다 — 규칙이 지켜지는지 확인하기 위한 독립 기준이다.
   P1 days 오름차순, P2 동률이면 title 코드포인트 오름차순.
   f8:  days 4 동률 = b4 '가판대 임차 계약' vs b5 '가격표시제 점검 통보' -> '격'(U+ACA9) < '판'(U+D310) 이므로 b5 먼저
   f20: days 0 동률 = c04 '행사장…' vs c05 '가격표시제…' -> '가' < '행' 이므로 c05 먼저
        days 5 동률 = c08 '직거래장터…' vs c09 '천막…'   -> '직'(U+C9C1) < '천'(U+CC9C) 이므로 c08 먼저 */
const EXPECTED_PRIORITY = {
  3: ['a1', 'a2', 'a3'],
  8: ['b1', 'b2', 'b3', 'b5', 'b4', 'b6', 'b7', 'b8'],
  20: ['c01', 'c02', 'c03', 'c05', 'c04', 'c06', 'c07', 'c08', 'c09', 'c10',
       'c11', 'c12', 'c13', 'c14', 'c15', 'c16', 'c17', 'c18', 'c19', 'c20']
};

async function open(page, params) {
  const q = new URLSearchParams(params || {}).toString();
  await page.goto('/index.html' + (q ? '?' + q : ''));
  await page.waitForFunction(() => window.__spike && document.querySelectorAll('.pin').length > 0);
  await page.mouse.move(10, 880); // surface 밖 — ambient(휴지) 상태 유지
}

async function pinIds(page) {
  return page.$$eval('.pin', (els) => els.map((e) => e.getAttribute('data-pin-id')));
}

async function groupKeys(page) {
  return page.$$eval('.group', (els) => els.map((e) => e.getAttribute('data-group-key')));
}

async function dragBy(page, box, dx, dy) {
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 6 });
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

module.exports = { FIXTURE_IDS, EXPECTED_PRIORITY, open, pinIds, groupKeys, dragBy };
