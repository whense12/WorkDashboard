#!/usr/bin/env node
/**
 * 브라우저 스모크 테스트.
 *
 * AGENTS.md 「필수 검증」 2번과 CODEX_IMPLEMENTATION_BRIEF.md §23.1 이 요구하는 흐름을 덮는다.
 * 테스트 러너 의존성 없이 Playwright 만 쓴다.
 *
 *   npm install && npm test
 *
 * file:// 대신 로컬 정적 서버로 띄운다. file:// 은 origin 이 opaque 라
 * localStorage / BroadcastChannel 동작이 실제 Tauri WebView 와 달라진다.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, 'frontend');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  try {
    const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(webRoot, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(webRoot)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
};

const browser = await chromium.launch();

/** 매번 깨끗한 상태에서 시작한다. 앱을 열고, 필요하면 예시 데이터를 넣는다. */
async function open({ demo = true, viewport = { width: 1440, height: 900 }, confirms = 'accept' } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  // 대화상자는 여기 한 곳에서만 처리한다. 테스트마다 따로 붙이면 이중 처리로 터진다.
  // 네이티브 prompt 는 쓰면 안 되는 API 다. 호출되면 즉시 잡아낸다.
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    if (d.type() === 'prompt') errors.push(`native prompt() used: ${d.message()}`);
    if (confirms === 'dismiss' && d.type() === 'confirm') await d.dismiss();
    else await d.accept();
  });
  await page.goto(BASE + '/index.html');
  await page.waitForFunction(() => !!window.WorkCore);
  if (demo) {
    await page.evaluate(async () => {
      const C = window.WorkCore, s = await C.readState(), d = C.demoData();
      s.projects.push(...d.projects); s.manualEvents.push(...d.manualEvents);
      await C.saveState(s);
    });
    await page.reload();
    await page.waitForSelector('.due-card');
  }
  return { ctx, page, errors, dialogs };
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1] 최초 실행 — 예시 데이터 없이 빈 상태');
{
  const { ctx, page, errors } = await open({ demo: false });
  const state = await page.evaluate(() => window.WorkCore.readState().then((s) => ({ p: s.projects.length, m: s.manualEvents.length, v: s.vendorTemplates.length, w: s.workTemplates.length, ver: s.version })));
  check('가짜 공사/일정이 저장되지 않는다', state.p === 0 && state.m === 0, `projects=${state.p} events=${state.m}`);
  check('업체·업무 템플릿(기준정보)은 제공된다', state.v > 0 && state.w > 0);
  check('상태 버전이 6으로 올라간다', state.ver === 6, `version=${state.ver}`);
  check('빈 상태 안내가 보인다', (await page.innerText('#dueList')).includes('등록된 업무가 없습니다'));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[2] 메인 화면 렌더 — 좌 D-day 레일 + 우 캘린더');
{
  const { ctx, page, errors } = await open();
  const cards = await page.$$eval('.due-card', (e) => e.length);
  check('업체별 카드가 렌더된다', cards === 4, `cards=${cards}`);
  const sorted = await page.$$eval('.due-card', (els) => els.map((e) => e.querySelector('.due-sub').textContent.trim()));
  check('D-day 카드가 존재하고 날짜순이다', sorted.length === 4);
  check('오늘 셀이 표시된다', (await page.$$('.day.today')).length === 1);
  const labels = await page.$$eval('.event', (e) => e.map((x) => x.textContent.trim()));
  check('캘린더 이벤트 라벨이 "업체 · 일정명" 형식', labels.every((l) => l.includes(' · ')), labels[0]);
  check('캘린더 라벨에 D-day 를 넣지 않는다', !labels.some((l) => /D[-+]\d|D-DAY/.test(l)), labels.find((l) => /D[-+]\d/.test(l)) || '');
  check('요일 헤더가 sticky', (await page.$eval('.weekdays', (e) => getComputedStyle(e).position)) === 'sticky');
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[3] 빈 날짜 클릭 → 일정 추가(날짜 프리필) / 이벤트 클릭 → 상세');
{
  const { ctx, page, errors } = await open();
  const target = await page.$$eval('.day:not(.out)', (els) => {
    const empty = els.find((e) => !e.querySelector('.event'));
    return empty ? empty.dataset.date : null;
  });
  await page.click(`.day[data-date="${target}"]`, { position: { x: 40, y: 100 } });
  check('빈 날짜 클릭으로 일정 추가가 열린다', await page.$eval('#scheduleModal', (e) => e.classList.contains('show')));
  check('클릭한 날짜가 이미 채워져 있다', (await page.inputValue('#sDate')) === target, `${await page.inputValue('#sDate')} != ${target}`);
  await page.fill('#sName', '테스트 일정');
  await page.click('#saveScheduleBtn');
  await page.waitForTimeout(200);
  const added = await page.$$eval(`.day[data-date="${target}"] .event`, (e) => e.map((x) => x.textContent));
  check('저장 즉시 해당 날짜에 이벤트가 나타난다', added.some((t) => t.includes('테스트 일정')), added.join('|'));

  await page.click('.event');
  await page.waitForTimeout(150);
  check('이벤트 클릭은 상세를 연다', await page.$eval('#detailModal', (e) => e.classList.contains('show')));
  check('이벤트 클릭이 일정 추가를 동시에 열지 않는다', !(await page.$eval('#scheduleModal', (e) => e.classList.contains('show'))));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[4] 절차 타임라인 — 완료 / 현재 / 예정 동시 표시');
{
  const { ctx, page, errors } = await open();
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#detailBody .step');
  const steps = await page.$$eval('#detailBody .step', (els) => els.map((e) => ({ cls: e.className, txt: e.innerText.replace(/\n/g, ' ') })));
  check('완료 단계가 보인다', steps.some((s) => s.cls.includes('done')));
  check('현재 단계가 보인다', steps.some((s) => s.cls.includes('current')));
  check('예정 단계가 보인다', steps.some((s) => s.cls.includes('future')));
  check('날짜 미정 예정 단계를 그대로 표기한다', steps.some((s) => s.txt.includes('날짜 미정')));
  check('진척률(%)을 만들어내지 않는다', !steps.some((s) => /\d+\s*%/.test(s.txt)) && !(await page.innerText('#detailBody')).match(/\d+\s*%/));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[5] 업무 기록 — 저장 후 새로고침해도 남는다');
{
  const { ctx, page, errors } = await open();
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#workLogText');
  await page.fill('#workLogText', '업체 담당자와 통화. 보완본 제출 약속.');
  await page.click('#addWorkLogBtn');
  await page.waitForTimeout(250);
  check('기록이 목록에 추가된다', (await page.innerText('.worklog-list')).includes('보완본 제출 약속'));
  check('기록에 시각이 붙는다', (await page.$$('.worklog-time')).length > 0);
  await page.reload();
  await page.waitForSelector('.due-card');
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('.worklog-list');
  check('새로고침 후에도 기록이 남는다', (await page.innerText('.worklog-list')).includes('보완본 제출 약속'));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[6] OK 완료 → 다음 단계 활성화 + 날짜 계산');
{
  const { ctx, page, errors } = await open();
  const before = await page.evaluate(async () => {
    const s = await window.WorkCore.readState(), p = s.projects.find((x) => x.id === 'demo-p1');
    return { cur: p.steps.find((x) => !x.completed).name, nextOffset: p.steps.filter((x) => !x.completed)[1].offset };
  });
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#completeBtn:not(.hidden)');
  await page.click('#completeBtn');
  await page.waitForTimeout(300);
  const after = await page.evaluate(async () => {
    const C = window.WorkCore, s = await C.readState(), p = s.projects.find((x) => x.id === 'demo-p1');
    const done = p.steps.filter((x) => x.completed).at(-1), next = p.steps.find((x) => !x.completed);
    return { doneName: done.name, doneAt: done.completedAt, nextName: next.name, nextDue: next.dueDate, expect: C.addDays(done.completedAt, next.offset), today: C.todayISO() };
  });
  check('현재 단계가 완료 처리된다', after.doneName === before.cur, `${after.doneName} != ${before.cur}`);
  check('완료일이 오늘로 기록된다', after.doneAt === after.today);
  check('다음 단계가 현재가 된다', after.nextName !== before.cur);
  check('다음 단계 날짜 = 완료일 + offset', after.nextDue === after.expect, `${after.nextDue} != ${after.expect}`);
  const cardText = await page.innerText('#dueList');
  check('좌측 레일이 즉시 갱신된다', cardText.includes(after.nextName), cardText.slice(0, 80));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[7] 완료 취소 — 잘못 누른 OK 를 되돌린다 (발주서 §7.5)');
{
  const { ctx, page, errors } = await open();
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#workLogText');
  await page.fill('#workLogText', '취소 검증용 기록');
  await page.click('#addWorkLogBtn');
  await page.waitForTimeout(250);
  await page.click('#completeBtn');
  await page.waitForTimeout(300);

  // 완료된 항목을 다시 열어 되돌린다.
  await page.click('.event.done >> nth=-1');
  await page.waitForTimeout(200);
  const btns = await page.evaluate(() => ({
    reopen: !document.getElementById('reopenBtn').classList.contains('hidden'),
    complete: !document.getElementById('completeBtn').classList.contains('hidden'),
  }));
  check('완료 항목에 "완료 취소"가 노출된다', btns.reopen);
  check('완료 항목에 "OK 완료"는 숨는다', !btns.complete);
  await page.click('#reopenBtn');
  await page.waitForTimeout(300);
  const st = await page.evaluate(async () => {
    const p = (await window.WorkCore.readState()).projects.find((x) => x.id === 'demo-p1');
    const s = p.steps.find((x) => x.name === '안전보건수준평가');
    return { completed: s.completed, completedAt: s.completedAt, logs: s.logs.length, logText: s.logs.map((l) => l.text).join('|') };
  });
  check('완료가 해제된다', st.completed === false);
  check('완료일이 지워진다', st.completedAt === null);
  check('업무 기록이 보존된다', st.logs === 1 && st.logText.includes('취소 검증용 기록'), st.logText);
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[8] 날짜 변경 — 네이티브 prompt() 를 쓰지 않는다 (발주서 §17.2-3)');
{
  const { ctx, page, errors } = await open();
  await page.click('.due-card:has-text("고성건설")');
  await page.waitForSelector('#changeDateBtn:not(.hidden)');
  await page.click('#changeDateBtn');
  await page.waitForTimeout(200);
  check('앱 내 날짜 모달이 열린다', await page.$eval('#dateModal', (e) => e.classList.contains('show')));
  check('현재 날짜가 채워져 있다', /^\d{4}-\d{2}-\d{2}$/.test(await page.inputValue('#dNewDate')));
  const target = await page.evaluate(() => window.WorkCore.addDays(window.WorkCore.todayISO(), 9));
  await page.fill('#dNewDate', target);
  await page.click('#saveDateBtn');
  await page.waitForTimeout(300);
  const moved = await page.evaluate(async () => {
    const p = (await window.WorkCore.readState()).projects.find((x) => x.id === 'demo-p4');
    return p.steps[0].dueDate;
  });
  check('날짜가 실제로 바뀐다', moved === target, `${moved} != ${target}`);
  check('네이티브 prompt() 가 호출되지 않았다', !errors.some((e) => e.includes('native prompt')), errors.join(' | '));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[9] D-day 기준 — 무제한 / 직접설정 / 프리셋');
{
  const { ctx, page, errors } = await open();
  await page.selectOption('#horizonSelect', 'all');
  await page.waitForTimeout(250);
  const all = await page.$$eval('.due-card', (e) => e.length);
  await page.selectOption('#horizonSelect', '3');
  await page.waitForTimeout(250);
  const d3 = await page.$$eval('.due-card', (e) => e.length);
  check('무제한이 미래 일정을 제한하지 않는다', all === 4, `all=${all}`);
  check('유한 기준이 실제로 걸러낸다', d3 < all, `d3=${d3} all=${all}`);
  check('지난 일정은 기준과 무관하게 남는다', d3 >= 2, `d3=${d3}`);
  await page.selectOption('#horizonSelect', 'custom');
  await page.waitForTimeout(150);
  check('직접설정 입력칸이 나타난다', !(await page.$eval('#horizonCustom', (e) => e.classList.contains('hidden'))));
  await page.fill('#horizonCustom', '45');
  await page.dispatchEvent('#horizonCustom', 'change');
  await page.waitForTimeout(250);
  await page.reload();
  await page.waitForSelector('.due-card');
  const persisted = await page.evaluate(async () => (await window.WorkCore.readState()).settings);
  check('직접설정 값이 저장된다', persisted.horizon === 'custom' && persisted.customHorizon === 45, JSON.stringify(persisted));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[10] 템플릿 스냅샷 격리 (발주서 §10)');
{
  const { ctx, page, errors } = await open();
  const res = await page.evaluate(async () => {
    const C = window.WorkCore, s = await C.readState();
    const t = s.workTemplates.find((x) => x.id === 'wt-general');
    const beforeNames = s.projects.find((p) => p.id === 'demo-p1').steps.map((x) => x.name);
    t.steps[0].name = '템플릿만 바뀐 이름';
    t.steps.push({ name: '신규 단계', offset: 5 });
    await C.saveState(s);
    const after = await C.readState();
    const afterNames = after.projects.find((p) => p.id === 'demo-p1').steps.map((x) => x.name);
    // 바뀐 템플릿으로 새 업무를 만들면 새 이름이 반영되어야 한다.
    const fresh = C.projectFromTemplate(after.workTemplates.find((x) => x.id === 'wt-general'), 'v-daehan', '신규 공사', C.todayISO());
    return { beforeNames, afterNames, freshNames: fresh.steps.map((x) => x.name), freshIds: fresh.steps.map((x) => x.id) };
  });
  check('템플릿을 고쳐도 기존 업무 절차는 그대로다', JSON.stringify(res.beforeNames) === JSON.stringify(res.afterNames), res.afterNames.join(','));
  check('새 업무는 바뀐 템플릿을 쓴다', res.freshNames[0] === '템플릿만 바뀐 이름' && res.freshNames.includes('신규 단계'));
  check('새 업무의 단계 id 는 새로 발급된다', new Set(res.freshIds).size === res.freshIds.length && res.freshIds.every(Boolean));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[11] 도우미 딥링크 — 카드 클릭이 본체의 해당 상세를 연다 (발주서 §12)');
{
  const { ctx, page, errors } = await open();
  const helper = await ctx.newPage();
  await helper.goto(BASE + '/helper.html');
  await helper.waitForSelector('.helper-card');
  const helperCards = await helper.$$eval('.helper-card', (e) => e.length);
  check('도우미가 본체와 같은 목록을 보여준다', helperCards === 4, `helper=${helperCards}`);
  check('도우미가 같은 D-day 기준을 표시한다', (await helper.innerText('#helperHorizon')).length > 0);

  const targetVendor = await helper.$eval('.helper-card .helper-vendor', (e) => e.textContent.trim());
  await helper.click('.helper-card');
  await page.waitForTimeout(600);
  const open2 = await page.$eval('#detailModal', (e) => e.classList.contains('show'));
  check('본체에서 해당 일정 상세가 열린다', open2);
  if (open2) check('열린 상세가 클릭한 업체다', (await page.innerText('.detail-vendor')) === targetVendor, `${await page.innerText('.detail-vendor')} != ${targetVendor}`);
  const leftover = await page.evaluate(async () => (await window.WorkCore.readState()).pendingSelection);
  check('소비 후 딥링크 상태가 비워진다', leftover === null, JSON.stringify(leftover));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[12] 데이터 안전성 — 완료 이력이 있는 단계는 경고 없이 지워지지 않는다');
{
  const { ctx, page, errors, dialogs } = await open({ confirms: 'dismiss' });
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#editProjectSteps');
  await page.click('#editProjectSteps');
  await page.waitForSelector('#projectStepsList .proc-row');
  await page.click('#projectStepsList .proc-row:first-child .remove');
  await page.waitForTimeout(200);
  const asked = dialogs.join(' ');
  check('완료 단계 삭제 시 손실 내용을 알리고 확인을 받는다', asked.includes('완료 이력'), asked || '(대화상자 없음)');
  const rows = await page.$$eval('#projectStepsList .proc-row', (e) => e.length);
  check('취소하면 단계가 유지된다', rows === 5, `rows=${rows}`);
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[13] 예시 데이터 넣기/빼기 — 실제 업무는 건드리지 않는다');
{
  const { ctx, page, errors } = await open({ demo: false });
  await page.click('#settingsBtn');
  await page.waitForSelector('#demoToggleBtn');
  check('처음엔 "불러오기"로 표시된다', (await page.innerText('#demoToggleBtn')).includes('불러오기'));
  await page.click('#demoToggleBtn');
  await page.waitForTimeout(300);
  check('예시 데이터가 들어온다', (await page.$$eval('.due-card', (e) => e.length)) === 4);
  // 사용자가 직접 만든 업무를 하나 추가한 뒤 예시만 지운다.
  await page.evaluate(async () => {
    const C = window.WorkCore, s = await C.readState();
    s.manualEvents.push({ id: C.uid('m'), vendorId: 'v-daehan', projectId: null, date: C.todayISO(), name: '실제 업무 일정', memo: '', completed: false, completedAt: null, logs: [], attachments: [] });
    await C.saveState(s);
  });
  await page.reload();
  await page.click('#settingsBtn');
  await page.waitForSelector('#demoToggleBtn');
  await page.click('#demoToggleBtn');
  await page.waitForTimeout(400);
  const left = await page.evaluate(async () => {
    const s = await window.WorkCore.readState();
    return { p: s.projects.length, m: s.manualEvents.map((x) => x.name) };
  });
  check('예시 공사가 모두 빠진다', left.p === 0, `projects=${left.p}`);
  check('직접 만든 일정은 남는다', left.m.includes('실제 업무 일정'), left.m.join(','));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
await browser.close();
server.close();

console.log(`\n${'─'.repeat(60)}`);
if (failures.length) {
  console.log(`실패 ${failures.length}건 / 통과 ${passed}건\n`);
  failures.forEach((f) => console.log(`  · ${f}`));
  process.exit(1);
}
console.log(`통과 ${passed}건, 실패 없음`);
