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
// tauri.conf.json 의 CSP 를 그대로 실어 보낸다. Tauri 를 여기서 띄울 수 없으니
// 최소한 같은 정책 아래에서 화면이 깨지지 않는지 확인한다(실물 확인은 Windows E2E 에서).
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  "font-src 'self'", "img-src 'self' data: blob:", "connect-src 'self'",
].join('; ');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  try {
    const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(webRoot, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(webRoot)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'content-security-policy': CSP }).end(body);
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

/** 검색되는 선택 칸을 사람처럼 조작한다: 치고 → 걸러진 첫 줄을 Enter. */
async function combo(page, id, text) {
  await page.click(`#${id}Input`);
  await page.fill(`#${id}Input`, text);
  await page.waitForTimeout(80);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60);
}

/** 매번 깨끗한 상태에서 시작한다. 앱을 열고, 필요하면 예시 데이터를 넣는다. */
async function open({ demo = true, viewport = { width: 1440, height: 900 }, confirms = 'accept' } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) errors.push(`CSP: ${m.text()}`); });
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
  check('상태 버전이 8로 올라간다', state.ver === 8, `version=${state.ver}`);
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

// 실제 렌더된 글자 크기를 재는 브라우저 측 함수. [14] 와 [26] 이 함께 쓴다.
const FLOOR = 13;
const measure = () => {
  const bad = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && el !== document.body) continue;      // 숨은 요소 제외
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;                                          // 자기 텍스트가 있는 요소만
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 13) {
      const key = `${el.tagName.toLowerCase()}.${el.className || '(no class)'}`;
      if (!bad.has(key)) bad.set(key, px);
    }
  }
  return [...bad].map(([k, v]) => `${k} = ${v}px`);
};

console.log('\n[14] 타이포그래피 하한 — 화면의 모든 글자가 13px 이상 (발주서 §19.3 / KRDS PC 최소 본문)');
{
  // 이 프로젝트가 거부당한 핵심 이유가 마이크로텍스트였다. 회귀를 눈으로 잡을 수 없으니
  // 재서 고정한다.
  const { ctx, page, errors } = await open();
  const main = await page.evaluate(measure);
  check(`메인 화면에 ${FLOOR}px 미만 텍스트가 없다`, main.length === 0, main.join(' | '));

  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#detailBody .step');
  const detail = await page.evaluate(measure);
  check(`상세 모달에 ${FLOOR}px 미만 텍스트가 없다`, detail.length === 0, detail.join(' | '));

  const calEvent = await page.$eval('.event', (e) => parseFloat(getComputedStyle(e).fontSize));
  check('캘린더 이벤트가 13px 이상이다', calEvent >= FLOOR, `${calEvent}px`);
  const vendor = await page.$eval('.due-vendor', (e) => parseFloat(getComputedStyle(e).fontSize));
  const task = await page.$eval('.due-task', (e) => parseFloat(getComputedStyle(e).fontSize));
  const sub = await page.$eval('.due-sub', (e) => parseFloat(getComputedStyle(e).fontSize));
  check('정보 계층이 크기로 드러난다 (업체 > 일정명 > 부제)', vendor > task && task > sub, `${vendor}/${task}/${sub}`);

  const helper = await ctx.newPage();
  await helper.setViewportSize({ width: 330, height: 430 });
  await helper.goto(BASE + '/helper.html');
  await helper.waitForSelector('.helper-card');
  const hp = await helper.evaluate(measure);
  check(`도우미 창에 ${FLOOR}px 미만 텍스트가 없다`, hp.length === 0, hp.join(' | '));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[15] 레이아웃 — 좁은 화면에서도 가로 스크롤이 생기지 않는다');
{
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    const { ctx, page } = await open({ viewport: vp });
    const over = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: (() => { const t = document.querySelector('.topbar'); return t.scrollWidth - t.clientWidth; })(),
    }));
    check(`${vp.width}x${vp.height} 가로 넘침 없음`, over.doc <= 0, `문서 +${over.doc}px`);
    check(`${vp.width}x${vp.height} 헤더 버튼이 넘치지 않음`, over.header <= 0, `헤더 +${over.header}px`);
    // 발주서 §13: 캘린더는 하나의 세로 스크롤 컨테이너를 가지고, 주 행을 억지로 눌러
    // 담지 않는다. 화면이 크면 한 달이 통째로 들어와 스크롤이 안 생기는 게 정상이다.
    const cal = await page.$eval('.calendar-scroll', (e) => ({
      overflowY: getComputedStyle(e).overflowY,
      scrolls: e.scrollHeight > e.clientHeight + 4,
    }));
    check(`${vp.width}x${vp.height} 캘린더가 세로 스크롤 컨테이너다`, cal.overflowY === 'auto' || cal.overflowY === 'scroll', cal.overflowY);
    if (vp.height <= 900) check(`${vp.width}x${vp.height} 넘치는 달이 실제로 스크롤된다`, cal.scrolls);
    // 주 행 높이를 줄여 억지로 맞추지 않는다.
    const rowH = await page.$eval('.day', (e) => e.getBoundingClientRect().height);
    check(`${vp.width}x${vp.height} 날짜 칸이 눌리지 않는다 (>=146px)`, rowH >= 146, `${Math.round(rowH)}px`);
    await ctx.close();
  }
}

console.log('\n[16] ZIP — 의존성 없는 읽기/쓰기가 왕복한다');
{
  const { ctx, page, errors } = await open({ demo: false });
  const r = await page.evaluate(async () => {
    const Z = window.WorkZip;
    if (!Z.supported()) return { skipped: true };
    const enc = new TextEncoder();
    const big = enc.encode('가나다라마바사'.repeat(500));       // 압축이 이득인 크기
    const tiny = enc.encode('짧음');                             // 저장 방식으로 남을 크기
    const bin = new Uint8Array(1024).map((_, i) => (i * 7) % 256);
    const zip = await Z.create([
      { name: 'manifest.json', data: enc.encode('{"a":1}') },
      { name: 'big.txt', data: big },
      { name: 'tiny.txt', data: tiny },
      { name: 'attachments/att-1.bin', data: bin },
    ]);
    const back = await Z.read(zip);
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    return {
      zipSize: zip.length, names: [...back.keys()].sort(),
      bigOk: same(back.get('big.txt'), big),
      tinyOk: same(back.get('tiny.txt'), tiny),
      binOk: same(back.get('attachments/att-1.bin'), bin),
      compressed: zip.length < big.length,   // 실제로 압축이 걸렸는가
    };
  });
  if (r.skipped) check('ZIP 지원 환경', false, 'CompressionStream 없음');
  else {
    check('네 항목이 모두 돌아온다', JSON.stringify(r.names) === JSON.stringify(['attachments/att-1.bin', 'big.txt', 'manifest.json', 'tiny.txt']), r.names.join(','));
    check('압축된 텍스트가 그대로 복원된다', r.bigOk);
    check('압축 안 한 짧은 항목도 복원된다', r.tinyOk);
    check('이진 데이터가 손상되지 않는다', r.binOk);
    check('실제로 압축이 적용된다', r.compressed, `${r.zipSize} bytes`);
  }
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[17] 백업/복원 — 첨부 실물까지 담기고 되살아난다 (발주서 §16.3)');
{
  const { ctx, page, errors } = await open();
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#detailFiles', { state: 'attached' }); // 파일 입력은 hidden 이다
  await page.setInputFiles('#detailFiles', { name: '평가서.txt', mimeType: 'text/plain', buffer: Buffer.from('보완본 제출 확인용 첨부 내용', 'utf8') });
  await page.waitForTimeout(400);
  check('첨부가 목록에 나타난다', (await page.innerText('.attachment-list')).includes('평가서.txt'));

  const r = await page.evaluate(async () => {
    const C = window.WorkCore;
    const before = await C.readState();
    const { bytes, manifest } = await C.buildBackup(before);

    // 전부 지운 상태를 만든다 — 복원이 실제로 되살리는지 보려면 비워야 한다.
    const wiped = C.clone(before); wiped.projects = []; wiped.manualEvents = [];
    await C.saveState(wiped);
    const afterWipe = (await C.readState()).projects.length;

    const { state: restored, manifest: mf } = await C.restoreBackup(bytes);
    await C.saveState(restored);

    const step = restored.projects.find((p) => p.id === 'demo-p1').steps.find((s) => s.attachments.length);
    const meta = step.attachments[0];
    const { bytes: fileBytes } = await C.readAttachment(meta);
    return {
      manifestTotal: manifest.attachmentsTotal, manifestIncluded: manifest.attachmentsIncluded,
      manifestMissing: manifest.attachmentsMissing.length, format: manifest.format,
      afterWipe, projects: restored.projects.length, events: restored.manualEvents.length,
      logs: restored.projects.find((p) => p.id === 'demo-p1').steps.reduce((n, s) => n + s.logs.length, 0),
      fileName: meta.name, backend: meta.backend,
      fileText: new TextDecoder().decode(fileBytes),
      restoredVersion: mf.stateVersion,
    };
  });

  check('manifest 가 첨부 개수를 기록한다', r.manifestTotal === 1 && r.manifestIncluded === 1 && r.manifestMissing === 0, JSON.stringify(r));
  check('백업 형식을 식별할 수 있다', r.format === 'work-calendar-backup');
  check('복원 전에 실제로 비워졌다', r.afterWipe === 0);
  check('업무가 되살아난다', r.projects === 4, `projects=${r.projects}`);
  check('수동 일정도 되살아난다', r.events === 1);
  check('첨부 메타데이터가 되살아난다', r.fileName === '평가서.txt', r.fileName);
  check('첨부 실물 내용이 그대로다', r.fileText === '보완본 제출 확인용 첨부 내용', r.fileText);
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[18] 첨부 삭제 — 메타데이터와 실물이 함께 사라진다 (인수조건 D-3)');
{
  const { ctx, page, errors } = await open();
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#detailFiles', { state: 'attached' }); // 파일 입력은 hidden 이다
  await page.setInputFiles('#detailFiles', { name: '삭제대상.txt', mimeType: 'text/plain', buffer: Buffer.from('지워져야 함', 'utf8') });
  await page.waitForTimeout(400);
  const meta = await page.evaluate(async () => {
    const s = await window.WorkCore.readState();
    return s.projects.find((p) => p.id === 'demo-p1').steps.flatMap((x) => x.attachments)[0];
  });
  check('첨부 메타데이터에 backend 가 기록된다', !!meta.backend, JSON.stringify(meta));

  await page.click('[data-delete-file]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(async (m) => {
    const C = window.WorkCore, s = await C.readState();
    const left = s.projects.find((p) => p.id === 'demo-p1').steps.flatMap((x) => x.attachments).length;
    let physical = 'gone';
    try { await C.readAttachment(m); physical = 'still-there'; } catch (e) { physical = String(e.message); }
    return { left, physical };
  }, meta);
  check('메타데이터가 사라진다', after.left === 0);
  check('실물도 사라진다', after.physical === 'ATTACHMENT_MISSING', after.physical);
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[19] 첨부 실물이 없을 때 — 파괴적이지 않게 알린다 (인수조건 D-4)');
{
  const { ctx, page, errors } = await open();
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#detailFiles', { state: 'attached' }); // 파일 입력은 hidden 이다
  await page.setInputFiles('#detailFiles', { name: '유실.txt', mimeType: 'text/plain', buffer: Buffer.from('x', 'utf8') });
  await page.waitForTimeout(400);
  // 실물만 몰래 지워 "메타데이터는 있는데 파일이 없는" 상태를 만든다.
  await page.evaluate(async () => {
    const s = await window.WorkCore.readState();
    const m = s.projects.find((p) => p.id === 'demo-p1').steps.flatMap((x) => x.attachments)[0];
    await new Promise((res, rej) => { const r = indexedDB.open('work-calendar-attachments-v1', 1);
      r.onsuccess = () => { const tx = r.result.transaction('files', 'readwrite'); tx.objectStore('files').delete(m.id); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; r.onerror = () => rej(r.error); });
  });
  await page.click('[data-download-file]');
  await page.waitForTimeout(400);
  check('안내 문구가 뜬다', (await page.innerText('#toast')).includes('찾을 수 없습니다'), await page.innerText('#toast'));
  const stillListed = await page.evaluate(async () => (await window.WorkCore.readState()).projects.find((p) => p.id === 'demo-p1').steps.flatMap((x) => x.attachments).length);
  check('메타데이터를 멋대로 지우지 않는다', stillListed === 1, `남은 항목 ${stillListed}`);
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[20] 모달 접근성 — 포커스가 들어가고, 갇히고, 돌아온다 (발주서 §17.2-4)');
{
  const { ctx, page, errors } = await open();
  const inside = (sel) => page.evaluate((s) => !!document.activeElement?.closest(s), sel);

  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#detailBody .step');
  check('열면 포커스가 모달 안으로 들어간다', await inside('#detailModal'));

  // Tab 을 충분히 눌러도 모달 밖으로 새지 않는다.
  let leaked = false;
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (!(await inside('#detailModal'))) { leaked = true; break; } }
  check('Tab 이 모달 안에 갇힌다 (40회)', !leaked);
  await page.keyboard.down('Shift');
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); if (!(await inside('#detailModal'))) { leaked = true; break; } }
  await page.keyboard.up('Shift');
  check('Shift+Tab 도 갇힌다', !leaked);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Escape 로 닫힌다', !(await page.$eval('#detailModal', (e) => e.classList.contains('show'))));
  check('닫으면 포커스가 눌렀던 카드로 돌아간다', await inside('.due-card'), await page.evaluate(() => document.activeElement?.className || '(none)'));

  // 상세 위에 날짜 모달을 겹쳐 띄우고 Escape — 나중에 연 쪽이 닫혀야 한다.
  await page.click('.due-card:has-text("고성건설")');
  await page.waitForSelector('#changeDateBtn:not(.hidden)');
  await page.click('#changeDateBtn');
  await page.waitForTimeout(200);
  check('겹쳐 열면 위쪽 모달로 포커스가 간다', await inside('#dateModal'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ date: document.getElementById('dateModal').classList.contains('show'), detail: document.getElementById('detailModal').classList.contains('show') }));
  check('Escape 가 나중에 연 모달만 닫는다', st.date === false && st.detail === true, JSON.stringify(st));
  check('아래 모달로 포커스가 돌아온다', await inside('#detailModal'));
  check('콘솔/페이지/CSP 위반 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[21] CSP — tauri.conf.json 과 같은 정책 아래에서 화면이 깨지지 않는다 (§26)');
{
  // 서버가 실제 CSP 헤더를 실어 보낸다. 위반은 open() 의 콘솔 수집에서 errors 로 들어온다.
  const { ctx, page, errors } = await open();
  check('설정한 CSP 가 실제로 적용된다', (await page.evaluate(() => performance.getEntriesByType('navigation').length >= 0)) === true);
  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#detailBody .step');
  await page.click('#settingsBtn').catch(() => {});
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  const font = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.includes('Pretendard') && f.status === 'loaded'); });
  check('번들 폰트가 CSP 아래에서 로드된다', font);
  check('CSP 위반 0건', errors.filter((e) => e.startsWith('CSP:')).length === 0, errors.filter((e) => e.startsWith('CSP:')).join(' | '));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[22] 용어 설정화 — 다른 업무에도 쓸 수 있고, 조사가 맞는다 (발주서 §1)');
{
  const { ctx, page, errors } = await open();
  const before = await page.evaluate(async () => (await window.WorkCore.readState()).projects.length);

  await page.click('#templateBtn');
  await page.click('[data-template-tab="terms"]');
  await page.waitForSelector('#termsPane:not(.hidden) [data-term="vendor"]');

  await page.fill('[data-term="app"]', '거래처별 계약 일정');
  await page.fill('[data-term="vendor"]', '거래처');
  await page.fill('[data-term="project"]', '계약건');
  await page.fill('[data-term="step"]', '단계');
  await page.waitForTimeout(150);

  const preview = await page.innerText('#termsPreview');
  check('미리보기가 조사를 맞춰 보여준다', preview.includes('거래처별 가장 가까운 일정이') && preview.includes('계약건과 무관한 일정은'), preview.replace(/\n/g, ' | '));
  check('“거래처을” 같은 문장이 나오지 않는다', !/처을|건이 등록|무가 없/.test(preview), preview.replace(/\n/g, ' | '));

  await page.click('#termsSave');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const ui = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1').textContent,
    addProject: document.querySelector('#addWorkBtn .label').textContent,
    addEvent: document.querySelector('#addScheduleBtn .label').textContent,
    caption: document.querySelector('.side-caption').textContent,
    upcoming: document.querySelector('.side-title').textContent,
  }));
  check('앱 이름이 바뀐다', ui.title === '거래처별 계약 일정' && ui.h1 === '거래처별 계약 일정', JSON.stringify(ui));
  check('헤더 버튼이 바뀐다', ui.addProject === '계약건 추가' && ui.addEvent === '일정 추가', `${ui.addProject} / ${ui.addEvent}`);
  check('좌 레일 문구의 조사가 맞는다', ui.caption === '거래처별 가장 가까운 일정이 날짜순으로 표시됩니다.', ui.caption);

  await page.click('.due-card >> nth=0');
  await page.waitForSelector('#detailBody .step');
  const detail = await page.evaluate(() => ({
    title: document.getElementById('detailTitle').textContent,
    steps: document.querySelector('.steps-title').textContent,
    edit: document.getElementById('editProjectSteps').textContent,
  }));
  check('상세 문구도 함께 바뀐다', detail.steps === '전체 계약건 단계' && detail.edit === '단계 편집', JSON.stringify(detail));

  const after = await page.evaluate(async () => (await window.WorkCore.readState()).projects.length);
  check('기존 데이터는 그대로 남는다', after === before, `${before} -> ${after}`);
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[23] 업체 커스텀 항목 — 추가한 항목이 상세에 나타난다');
{
  const { ctx, page, errors } = await open();
  await page.click('#templateBtn');
  await page.click('[data-template-tab="terms"]');
  await page.waitForSelector('#vfAdd');
  await page.click('#vfAdd');
  const rows = await page.$$('#vfList .proc-row');
  await page.fill(`#vfList .proc-row:nth-child(${rows.length}) input`, '사업자번호');
  await page.click('#termsSave');
  await page.waitForTimeout(400);

  // 새 항목에 값을 넣는다.
  await page.click('[data-template-tab="vendor"]');
  await page.waitForSelector('[data-vf]');
  const last = await page.$$('[data-vf]');
  await last[last.length - 1].fill('123-45-67890');
  await page.click('#saveVendorTemplate');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const stored = await page.evaluate(async () => {
    const s = await window.WorkCore.readState();
    return { fields: s.vendorFields.map((f) => f.label), values: s.vendorTemplates[0].values };
  });
  check('항목이 추가된다', stored.fields.includes('사업자번호'), stored.fields.join(','));
  check('값이 저장된다', Object.values(stored.values).includes('123-45-67890'), JSON.stringify(stored.values));

  await page.click('.due-card:has-text("대한건설")');
  await page.waitForSelector('#detailBody');
  const info = await page.innerText('#detailBody');
  check('상세에 새 항목이 나타난다', info.includes('사업자번호') && info.includes('123-45-67890'));
  check('값이 빈 항목은 상세를 어지럽히지 않는다', !/사업자번호[\s\S]{0,3}$/.test(info));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[24] v6 -> v7 이관 — 담당자·연락처 값이 보존된다 (발주서 §21)');
{
  const { ctx, page, errors } = await open({ demo: false });
  // 구버전 모양 상태를 직접 심는다.
  await page.evaluate(() => {
    localStorage.setItem('work-calendar-state-v5', JSON.stringify({
      version: 6,
      settings: { horizon: '14', customHorizon: 45, helperAlwaysOnTop: true, autostart: false },
      vendorTemplates: [{ id: 'v-old', name: '옛업체', person: '홍길동', contact: '010-9999-8888', memo: '이관 확인용' }],
      workTemplates: [{ id: 'wt-x', name: '옛 템플릿', steps: [{ name: '1단계', offset: 0 }] }],
      projects: [{ id: 'p-old', vendorId: 'v-old', name: '옛 공사', templateId: 'wt-x', steps: [{ id: 'p-old-s1', name: '1단계', offset: 0, dueDate: '2026-08-20', completed: false, completedAt: null }] }],
      manualEvents: [],
    }));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.WorkCore);

  const m = await page.evaluate(async () => {
    const s = await window.WorkCore.readState();
    const v = s.vendorTemplates[0];
    return {
      version: s.version,
      fieldLabels: s.vendorFields.map((f) => f.label),
      values: v.values,
      legacyKept: { person: v.person, contact: v.contact, memo: v.memo },
      projects: s.projects.length, steps: s.projects[0]?.steps.length,
      terms: s.terms,
      budget: s.budget, spends: s.spends,
    };
  });
  check('버전이 8로 올라간다', m.version === 8, `version=${m.version}`);
  check('예산이 빈 상태로 만들어진다', !!m.budget && Array.isArray(m.budget.items) && m.budget.items.length === 0, JSON.stringify(m.budget));
  check('지출 원장이 빈 배열로 만들어진다', Array.isArray(m.spends) && m.spends.length === 0);
  check('예산 용어 기본값도 채워진다', m.terms.budgetItem === '예산항목' && m.terms.spend === '지출', JSON.stringify(m.terms));
  check('기본 항목 3개가 생긴다', JSON.stringify(m.fieldLabels) === JSON.stringify(['담당자', '연락처', '메모']), m.fieldLabels.join(','));
  check('담당자 값이 옮겨진다', m.values['vf-person'] === '홍길동', JSON.stringify(m.values));
  check('연락처 값이 옮겨진다', m.values['vf-contact'] === '010-9999-8888');
  check('메모 값이 옮겨진다', m.values['vf-memo'] === '이관 확인용');
  check('원본 키를 지우지 않는다 (되돌릴 수 있게)', m.legacyKept.person === '홍길동' && m.legacyKept.contact === '010-9999-8888', JSON.stringify(m.legacyKept));
  check('업무와 절차가 온전하다', m.projects === 1 && m.steps === 1);
  check('용어 기본값이 채워진다', m.terms.vendor === '업체' && m.terms.event === '일정', JSON.stringify(m.terms));

  const shown = await page.innerText('#dueList');
  check('이관된 데이터가 화면에 뜬다', shown.includes('옛업체'), shown.slice(0, 60));
  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[25] 도우미 — 창이 아니라 악세사리로 보이고, 거기서 바로 일정을 적을 수 있다');
{
  const { ctx, page, errors } = await open();
  const helper = await ctx.newPage();
  await helper.setViewportSize({ width: 318, height: 460 });
  await helper.goto(BASE + '/helper.html');
  await helper.waitForSelector('.helper-card');

  // 모양 — 창처럼 보이게 하던 것들이 없어야 한다.
  const look = await helper.evaluate(() => {
    const cs = (sel) => getComputedStyle(document.querySelector(sel));
    const shell = cs('.helper-shell');
    return {
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: cs('body').backgroundColor,
      radius: parseFloat(shell.borderTopLeftRadius),
      shadow: shell.boxShadow,
      pad: parseFloat(cs('body').paddingTop),
      hasTitleBar: !!document.querySelector('.helper-bar'),
    };
  });
  const transparent = (c) => /rgba\(0, 0, 0, 0\)|transparent/.test(c);
  check('창 배경이 투명하다 (검은 사각형이 남지 않는다)', transparent(look.html) && transparent(look.body), `${look.html} / ${look.body}`);
  check('모서리가 둥글다', look.radius >= 12, `${look.radius}px`);
  check('그림자가 그려진다', look.shadow !== 'none' && look.shadow.length > 0);
  check('그림자가 그려질 여백이 있다', look.pad >= 8, `${look.pad}px`);
  check('제목표시줄 모양의 헤더가 없다', look.hasTitleBar === false);

  // 끌기 — data-tauri-drag-region 은 mousedown 대상 요소 자신에 있어야 동작한다.
  const drag = await helper.evaluate(() => {
    const need = ['.helper-shell', '.helper-grip', '.helper-grip strong', '.helper-list', '.helper-footer'];
    return need.filter((s) => !document.querySelector(s)?.hasAttribute('data-tauri-drag-region'));
  });
  check('바탕 어디를 잡아도 끌 수 있다', drag.length === 0, drag.join(', '));
  const noDrag = await helper.evaluate(() =>
    ['.helper-card', '#helperQuick', '#helperHide', '#helperOpenMain']
      .filter((s) => document.querySelector(s)?.hasAttribute('data-tauri-drag-region')));
  check('누를 것들은 끌기 영역이 아니다', noDrag.length === 0, noDrag.join(', '));

  // 빠른 추가
  const before = await helper.$$eval('.helper-card', (e) => e.length);
  // hidden 속성만 보면 안 된다. .helper-quick 에 display 를 지정한 순간
  // UA 의 [hidden]{display:none} 을 이겨 폼이 늘 펼쳐진 채로 남는다.
  check('빠른 추가 폼은 처음엔 접혀 있다',
    await helper.$eval('#helperQuickForm', (e) => e.hidden && getComputedStyle(e).display === 'none'));
  await helper.click('#helperQuick');
  check('+ 를 누르면 펼쳐진다',
    await helper.$eval('#helperQuickForm', (e) => !e.hidden && getComputedStyle(e).display !== 'none'));
  const vendorOpts = await helper.$$eval('#qVendor option', (e) => e.length);
  check('업체 목록이 채워진다 (미지정 포함)', vendorOpts === 5, `${vendorOpts}`);
  check('날짜가 오늘로 미리 채워진다', await helper.$eval('#qDate', (e) => !!e.value));

  await helper.click('button[type="submit"].q-save');
  check('이름 없이 저장하면 막고 알린다', (await helper.innerText('#qMsg')).length > 0);
  check('막혔을 때 폼이 닫히지 않는다', await helper.$eval('#helperQuickForm', (e) => !e.hidden));

  await helper.fill('#qName', '비료 수급 확인');
  await helper.selectOption('#qVendor', { index: 1 });
  await helper.fill('#qDate', new Date().toISOString().slice(0, 10));
  await helper.click('button[type="submit"].q-save');
  await helper.waitForFunction(() => document.getElementById('helperQuickForm').hidden);
  check('저장하면 폼이 닫힌다', true);
  const after = await helper.$$eval('.helper-card', (e) => e.length);
  check('도우미 목록에 곧바로 반영된다', after >= before, `${before} -> ${after}`);

  const saved = await helper.evaluate(async () => {
    const s = await window.WorkCore.readState();
    const m = s.manualEvents.find((x) => x.name === '비료 수급 확인');
    return m ? { name: m.name, vendorId: m.vendorId, date: m.date, completed: m.completed, logs: Array.isArray(m.logs) } : null;
  });
  check('일정이 상태에 저장된다', !!saved, JSON.stringify(saved));
  if (saved) {
    check('선택한 업체가 함께 저장된다', !!saved.vendorId, saved.vendorId);
    check('완료되지 않은 상태로 들어간다', saved.completed === false && saved.logs === true);
  }

  await page.waitForTimeout(600);
  const inMain = await page.innerText('#dueList');
  check('본체 목록에도 나타난다', inMain.includes('비료 수급 확인'), inMain.slice(0, 80));

  // Escape 는 도우미를 치우는 게 아니라 폼만 닫는다.
  await helper.click('#helperQuick');
  await helper.keyboard.press('Escape');
  check('Escape 가 폼만 닫는다', await helper.$eval('#helperQuickForm', (e) => e.hidden));

  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[26] 대시보드 업체별 요약 — 캘린더와 토글로 오가고, 펼쳐서 상세까지 간다');
{
  const { ctx, page, errors } = await open();

  const shown = () => page.evaluate(() => ({
    cal: !document.getElementById('calendarScroll').classList.contains('hidden'),
    board: !document.getElementById('vendorBoard').classList.contains('hidden'),
    nav: !document.getElementById('calNav').classList.contains('hidden'),
    hint: document.getElementById('calHint').textContent,
  }));
  const before = await shown();
  check('처음에는 캘린더다 (기존 화면이 말없이 바뀌지 않는다)', before.cal && !before.board, JSON.stringify(before));

  await page.click('[data-board="vendor"]');
  await page.waitForSelector('.board-row');
  const after = await shown();
  check('업체별로 바뀐다', after.board && !after.cal, JSON.stringify(after));
  check('업체별에서는 월 이동이 숨는다', after.nav === false);
  check('안내 문구도 모드에 맞게 바뀐다', after.hint !== before.hint && after.hint.includes('업체별'), after.hint);

  // 저장되어 다시 켜도 유지된다
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector('.board-row');
  const kept = await shown();
  check('선택이 저장되어 새로고침 후에도 유지된다', kept.board && !kept.cal, JSON.stringify(kept));

  // 예시 데이터는 업체 4곳에 업무 4건. 템플릿만 있고 업무가 없는 업체는 나오지 않는다.
  const rowNames = await page.$$eval('.board-row .bh-name', (e) => e.map((x) => x.textContent.trim()));
  const expected = await page.evaluate(async () => {
    const s = await window.WorkCore.readState();
    const used = new Set([...s.projects.map((p) => p.vendorId), ...s.manualEvents.map((m) => m.vendorId)]);
    return { used: used.size, templates: s.vendorTemplates.length };
  });
  check('업무나 일정이 있는 업체만 나온다', rowNames.length === expected.used, `${rowNames.length} != ${expected.used} (템플릿 ${expected.templates})`);

  // 지연이 있는 업체가 위로
  const late = await page.$$eval('.board-row', (rows) => rows.map((r) => !!r.querySelector('.bh-late')));
  const firstClean = late.indexOf(false);
  check('지연 있는 업체가 맨 위에 온다', firstClean === -1 || !late.slice(firstClean).some(Boolean), JSON.stringify(late));

  // 숫자가 상태와 일치하는가
  const agree = await page.evaluate(async () => {
    const C = window.WorkCore, s = await C.readState();
    const rows = C.vendorSummaries(s);
    return rows.map((b) => {
      const ps = s.projects.filter((p) => p.vendorId === b.vendorId);
      const openCount = ps.filter((p) => C.currentStep(p)).length;
      const stepsTotal = ps.reduce((n, p) => n + p.steps.length, 0);
      const stepsDone = ps.reduce((n, p) => n + p.steps.filter((x) => x.completed).length, 0);
      return { ok: b.openCount === openCount && b.stepsTotal === stepsTotal && b.stepsDone === stepsDone, name: b.vendor?.name };
    });
  });
  check('진행 중 건수와 절차 진행률이 상태와 일치한다', agree.every((x) => x.ok), JSON.stringify(agree.filter((x) => !x.ok)));

  // 펼치기 → 업무 목록 → 클릭 → 상세
  check('처음에는 접혀 있다', await page.$$eval('.board-row.open', (e) => e.length) === 0);
  await page.click('.board-row .board-head');
  await page.waitForSelector('.board-row.open .board-item');
  const items = await page.$$eval('.board-row.open .board-item', (e) => e.length);
  check('펼치면 그 업체의 업무가 나온다', items >= 1, `${items}`);

  const vendorOfRow = await page.$eval('.board-row.open .bh-name', (e) => e.textContent.trim());
  await page.click('.board-row.open .board-item[data-due-id]');
  await page.waitForTimeout(400);
  const opened = await page.$eval('#detailModal', (e) => e.classList.contains('show'));
  check('클릭하면 지금 쓰던 상세 모달이 열린다', opened);
  if (opened) check('열린 상세가 그 업체다', (await page.innerText('.detail-vendor')) === vendorOfRow, `${await page.innerText('.detail-vendor')} != ${vendorOfRow}`);
  await page.keyboard.press('Escape');

  // 13px 하한과 가로 스크롤이 새 화면에서도 지켜지는가
  const tiny = await page.evaluate(measure);
  check('업체별 화면에 13px 미만 텍스트가 없다', tiny.length === 0, tiny.join(' | '));
  for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(120);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${vp.width}px 에서 가로 스크롤이 없다`, over <= 1, `${over}px`);
  }

  // 용어를 바꾸면 토글과 화면 문구가 함께 바뀐다
  const terms = await page.evaluate(() => {
    const L = window.WorkCore.labels({ vendor: '거래처', project: '계약건', step: '단계', event: '일정' });
    return { tab: L.viewVendor, caption: L.boardCaption, empty: L.boardEmpty, open: L.boardOpen };
  });
  check('토글 이름이 용어를 따른다', terms.tab === '거래처별', terms.tab);
  check('업체별 문구에 하드코딩 "업체"가 남지 않는다', !/업체/.test(terms.caption + terms.empty + terms.open), terms.caption);
  check('조사가 맞는다 (계약건이/계약건가 아님)', terms.empty.includes('계약건이'), terms.empty);

  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[27] 기간 일정 — 시작과 끝이 있는 일을 한 건으로 적는다');
{
  const { ctx, page, errors } = await open();

  // (1) 회귀가 먼저다. 종료일이 없는 기존 일정의 D-day 는 하나도 달라지면 안 된다.
  const same = await page.evaluate(() => {
    const C = window.WorkCore, iso = (n) => C.addDays(C.todayISO(), n);
    const out = {};
    for (const n of [-3, -1, 0, 1, 14]) out[n] = [C.ddayLabel(iso(n)), C.ddayClass(iso(n))];
    return out;
  });
  check('종료일 없는 일정의 D-day 가 그대로다',
    JSON.stringify(same) === JSON.stringify({ '-3': ['D+3', 'overdue'], '-1': ['D+1', 'overdue'], 0: ['D-DAY', 'today'], 1: ['D-1', ''], 14: ['D-14', ''] }),
    JSON.stringify(same));

  // (2) 기간의 세 국면
  const phases = await page.evaluate(() => {
    const C = window.WorkCore, d = (n) => C.addDays(C.todayISO(), n);
    const mk = (a, b) => ({ date: d(a), endDate: d(b) });
    return {
      before: [C.ddayLabel(mk(3, 9)), C.ddayClass(mk(3, 9)), C.phaseOf(mk(3, 9))],
      during: [C.ddayLabel(mk(-2, 4)), C.ddayClass(mk(-2, 4)), C.phaseOf(mk(-2, 4))],
      startsToday: [C.ddayLabel(mk(0, 5)), C.phaseOf(mk(0, 5))],
      endsToday: [C.ddayLabel(mk(-5, 0)), C.phaseOf(mk(-5, 0))],
      after: [C.ddayLabel(mk(-9, -3)), C.ddayClass(mk(-9, -3)), C.phaseOf(mk(-9, -3))],
      days: C.periodDays(mk(0, 4)),
      notPeriod: C.isPeriod({ date: d(0), endDate: d(0) }),
    };
  });
  check('시작 전에는 시작까지 D-n', JSON.stringify(phases.before) === JSON.stringify(['D-3', '', 'before']), JSON.stringify(phases.before));
  check('기간 중에는 진행중', JSON.stringify(phases.during) === JSON.stringify(['진행중', 'today', 'during']), JSON.stringify(phases.during));
  check('시작일 당일도 진행중', JSON.stringify(phases.startsToday) === JSON.stringify(['진행중', 'during']), JSON.stringify(phases.startsToday));
  check('종료일 당일도 진행중', JSON.stringify(phases.endsToday) === JSON.stringify(['진행중', 'during']), JSON.stringify(phases.endsToday));
  check('종료 후에는 종료일 기준 D+n', JSON.stringify(phases.after) === JSON.stringify(['D+3', 'overdue', 'after']), JSON.stringify(phases.after));
  check('기간 일수는 양끝을 포함한다 (오늘~+4 = 5일)', phases.days === 5, `${phases.days}`);
  check('시작=종료면 기간이 아니다', phases.notPeriod === false);

  // (3) 캘린더에서 시작~종료 모든 칸에 뜬다
  await page.evaluate(async () => {
    const C = window.WorkCore, s = await C.readState();
    const t = C.parse(C.todayISO()), y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, '0');
    s.manualEvents.push({ id: 'per-1', vendorId: s.vendorTemplates[0].id, projectId: null,
      date: `${y}-${m}-05`, endDate: `${y}-${m}-09`, name: '행사참여기간', memo: '',
      completed: false, completedAt: null, logs: [], attachments: [] });
    await C.saveState(s);
  });
  await page.reload();
  await page.waitForSelector('.due-card');
  const cells = await page.$$eval('.day', (days) =>
    days.filter((d) => !d.classList.contains('out') && d.innerText.includes('행사참여기간')).map((d) => d.dataset.date));
  check('기간 일정이 시작~종료 5칸에 모두 뜬다', cells.length === 5, cells.join(','));
  check('범위 밖 날짜에는 뜨지 않는다', cells.every((d) => d.slice(-2) >= '05' && d.slice(-2) <= '09'), cells.join(','));
  const edges = await page.evaluate(() => {
    const hit = [...document.querySelectorAll('.event')].filter((e) => e.textContent.includes('행사참여기간'));
    return { total: hit.length, start: hit.filter((e) => e.classList.contains('start')).length,
      end: hit.filter((e) => e.classList.contains('end')).length,
      cont: hit.filter((e) => e.classList.contains('cont')).length,
      allPeriod: hit.every((e) => e.classList.contains('period')) };
  });
  check('시작 칸과 종료 칸이 하나씩이고 나머지는 이어짐 표시', edges.start === 1 && edges.end === 1 && edges.cont === 4 && edges.allPeriod, JSON.stringify(edges));
  check('시작 칩에만 일수가 붙는다', (await page.$eval('.event.period.start', (e) => e.textContent)).includes('(5일)'));

  // (4) 이미 시작한 건이 기준일 필터에서 밀려나지 않는다.
  // 좌측 레일은 업체당 한 건만 세우므로, 업체가 겹치지 않는 최소 상태로 확인한다.
  const kept = await page.evaluate(async () => {
    const C = window.WorkCore, s = await C.readState(), t = C.todayISO();
    const ev = (id, vi, name, date, endDate) => ({ id, vendorId: s.vendorTemplates[vi].id, projectId: null,
      date, endDate, name, memo: '', completed: false, completedAt: null, logs: [], attachments: [] });
    s.settings.horizon = '3';
    s.projects = [];
    s.manualEvents = [
      ev('per-2', 1, '장기 접수기간', C.addDays(t, -20), C.addDays(t, 40)),  // 이미 진행 중
      ev('per-3', 2, '먼 일정', C.addDays(t, 40), null),                     // 아직 멀었다
    ];
    return C.dueCards(s).map((c) => c.name);
  });
  check('D-3 기준이어도 진행 중인 기간 건은 남는다', kept.includes('장기 접수기간'), kept.join(','));
  check('아직 오지 않은 먼 일정은 D-3 기준 밖이다', !kept.includes('먼 일정'), kept.join(','));

  // (5) 행사 기간은 일정 칩이 아니라 상단 띠다
  await page.evaluate(async () => {
    const C = window.WorkCore, s = await C.readState();
    const t = C.parse(C.todayISO()), y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, '0');
    s.projects.push({ id: 'pj-band', vendorId: s.vendorTemplates[0].id, name: '가을 축제', memo: '',
      templateId: null, startDate: `${y}-${m}-10`, endDate: `${y}-${m}-12`, steps: [] });
    await C.saveState(s);
  });
  await page.reload();
  await page.waitForSelector('.day-band');
  const bandDays = await page.$$eval('.day', (days) =>
    days.filter((d) => !d.classList.contains('out') && d.querySelector('.day-band')).map((d) => d.dataset.date));
  check('행사 기간이 3칸에 띠로 그려진다', bandDays.length === 3, bandDays.join(','));
  check('띠는 일정 칩 목록 밖에 있다', await page.$eval('.day-band', (e) => !e.closest('.events')));

  // (6) 종료일이 시작일보다 빠르면 막는다
  await page.click('#addScheduleBtn');
  await page.fill('#sDate', await page.evaluate(() => window.WorkCore.addDays(window.WorkCore.todayISO(), 5)));
  await page.fill('#sEnd', await page.evaluate(() => window.WorkCore.addDays(window.WorkCore.todayISO(), 1)));
  await page.fill('#sName', '거꾸로 기간');
  await page.click('#saveScheduleBtn');
  await page.waitForTimeout(300);
  check('종료일이 시작일보다 빠르면 저장하지 않는다', await page.$eval('#scheduleModal', (e) => e.classList.contains('show')));
  check('막은 이유를 알린다', (await page.innerText('#toast')).includes('종료일'), await page.innerText('#toast'));

  // 정상 저장
  await page.fill('#sEnd', await page.evaluate(() => window.WorkCore.addDays(window.WorkCore.todayISO(), 8)));
  await page.click('#saveScheduleBtn');
  await page.waitForTimeout(400);
  const saved = await page.evaluate(async () => (await window.WorkCore.readState()).manualEvents.find((m) => m.name === '거꾸로 기간'));
  check('종료일이 상태에 저장된다', !!saved?.endDate, JSON.stringify(saved));
  const railText = await page.innerText('#dueList');
  check('좌측 레일이 기간을 시작~종료로 보여준다', /~/.test(railText), railText.slice(0, 120));

  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[28] 업체·업무·일정 일괄 등록 — 화면 세 곳을 오갈 일이 없다');
{
  const { ctx, page, errors } = await open();
  const st = () => page.evaluate(() => window.WorkCore.readState());

  await page.click('#addWorkBtn');
  await page.waitForSelector('#workModal.show');
  check('일정 행이 한 줄 준비돼 있다', await page.$$eval('#wEvents .ev-row', (e) => e.length) === 1);
  check('업체는 검색되는 칸으로 고른다', await page.$$eval('#wVendorInput', (e) => e.length) === 1);

  // 템플릿 '없음' 이면 업무 칸이 사라진다
  await page.selectOption('#wTemplate', '');
  check('템플릿 없음이면 업무명 칸이 숨는다', await page.$eval('#wProjectBox', (e) => e.classList.contains('hidden')));
  check('템플릿 없음이면 행사 기간 칸도 숨는다', await page.$eval('#wPeriodBox', (e) => e.classList.contains('hidden')));

  // 업체 + 일정 1건만 등록 (업무 없이). 업체는 목록에 없으니 그 자리에서 만든다.
  await combo(page, 'wVendor', '한빛푸드');
  await page.fill('#wEvents [data-ev-name="0"]', '납품 확인');
  await page.fill('#wEvents [data-ev-start="0"]', await page.evaluate(() => window.WorkCore.addDays(window.WorkCore.todayISO(), 4)));
  await page.click('#saveWorkBtn');
  await page.waitForTimeout(500);
  const a = await st();
  const hanbit = a.vendorTemplates.find((v) => v.name === '한빛푸드');
  check('목록에 없는 업체가 그 자리에서 만들어진다', !!hanbit, JSON.stringify(a.vendorTemplates.map((v) => v.name)));
  const ev1 = a.manualEvents.find((m) => m.name === '납품 확인');
  check('일정이 그 업체로 등록된다', ev1?.vendorId === hanbit?.id);
  check('업무를 안 만들었으면 일정도 업무에 걸리지 않는다', ev1?.projectId === null, JSON.stringify(ev1?.projectId));

  // 새 업체 + 업무 + 기간 + 일정 2건을 한 번에
  await page.click('#addWorkBtn');
  await page.waitForSelector('#workModal.show');
  await combo(page, 'wVendor', '들녘유통');
  await page.selectOption('#wTemplate', 'wt-simple');
  await page.fill('#wProject', '가을 직거래장터');
  const d = (n) => page.evaluate((k) => window.WorkCore.addDays(window.WorkCore.todayISO(), k), n);
  await page.fill('#wFirstDate', await d(1));
  await page.fill('#wStart', await d(10));
  await page.fill('#wEnd', await d(13));
  await page.fill('#wEvents [data-ev-name="0"]', '부스 배치');
  await page.fill('#wEvents [data-ev-start="0"]', await d(9));
  await page.click('#wAddEvent');
  await page.fill('#wEvents [data-ev-name="1"]', '행사참여기간');
  await page.fill('#wEvents [data-ev-start="1"]', await d(10));
  await page.fill('#wEvents [data-ev-end="1"]', await d(13));
  await page.click('#wAddEvent');   // 빈 줄 — 무시돼야 한다
  await page.click('#saveWorkBtn');
  await page.waitForTimeout(600);

  const b = await st();
  const dl = b.vendorTemplates.find((v) => v.name === '들녘유통');
  const pj = b.projects.find((p) => p.name === '가을 직거래장터');
  const mine = b.manualEvents.filter((m) => m.vendorId === dl?.id);
  check('업체가 만들어진다', !!dl);
  check('업무가 그 업체로 만들어진다', pj?.vendorId === dl?.id);
  check('업무 절차가 템플릿대로 생긴다', pj?.steps.length === 5, `${pj?.steps.length}`);
  check('행사 기간이 업무에 저장된다', !!pj?.startDate && !!pj?.endDate, JSON.stringify([pj?.startDate, pj?.endDate]));
  check('일정 2건이 함께 등록된다 (빈 줄은 무시)', mine.length === 2, `${mine.length}`);
  check('일정이 만든 업무에 걸린다', mine.every((m) => m.projectId === pj?.id));
  check('기간 일정의 종료일이 살아 있다', !!mine.find((m) => m.name === '행사참여기간')?.endDate);
  check('한 번의 저장으로 끝난다 (모달이 닫힌다)', await page.$eval('#workModal', (e) => !e.classList.contains('show')));

  const toastText = await page.innerText('#toast');
  check('무엇이 등록됐는지 알려준다', toastText.includes('들녘유통') && toastText.includes('2건'), toastText);
  check('새 업체가 캘린더·레일에 바로 나타난다', (await page.innerText('#dueList')).includes('들녘유통'));

  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[29] 예산 — 예산항목 → 행사 → 업체로 점점 좁혀 본다');
{
  const { ctx, page, errors } = await open();

  // 합본예산서를 손으로 넣는다
  await page.click('[data-board="budget"]');
  await page.waitForSelector('#budgetBoard:not(.hidden)');
  check('예산이 세 번째 축으로 붙는다', await page.$eval('#calendarScroll', (e) => e.classList.contains('hidden')));
  check('예산에서도 왼쪽 급한 일정 레일은 남는다', await page.$$eval('#dueList .due-card', (e) => e.length) > 0);
  check('예산 항목이 없으면 그렇게 말한다', (await page.innerText('#budgetBoard')).includes('없습니다'));

  await page.click('#editBudgetBtn');
  await page.waitForSelector('#budgetModal.show');
  await page.fill('#bTitle', '2026년 농특산물 유통 본예산');
  await page.fill('#bYear', '2026');
  await page.fill('#budgetItems [data-bi-code="0"]', '301-01');
  await page.fill('#budgetItems [data-bi-name="0"]', '행사운영비');
  await page.fill('#budgetItems [data-bi-amount="0"]', '50000000');
  await page.click('#bAddItem');
  await page.fill('#budgetItems [data-bi-code="1"]', '301-02');
  await page.fill('#budgetItems [data-bi-name="1"]', '홍보비');
  await page.fill('#budgetItems [data-bi-amount="1"]', '20000000');
  await page.click('#bAddItem');   // 빈 줄 — 무시돼야 한다
  await page.click('#saveBudgetBtn');
  await page.waitForTimeout(400);

  const b1 = await page.evaluate(() => window.WorkCore.readState());
  check('예산 항목이 저장된다 (빈 줄은 무시)', b1.budget.items.length === 2, JSON.stringify(b1.budget.items.map((i) => i.name)));
  check('예산액이 숫자로 저장된다', b1.budget.items[0].amount === 50000000, `${b1.budget.items[0].amount}`);
  check('예산서 이름과 연도가 남는다', b1.budget.title.includes('2026년') && b1.budget.year === 2026);
  const rows = await page.$$eval('#budgetBoard .bg-row', (e) => e.length);
  check('항목 줄이 두 개 선다', rows === 2, `${rows}`);
  check('총예산이 합산된다', (await page.innerText('.bt-v')).includes('70,000,000'), await page.innerText('.bt-v'));

  // 지출을 등록한다 — 예산 화면에서
  const itemIds = b1.budget.items.map((i) => i.id);
  await page.click('#addSpendBtn');
  await page.waitForSelector('#spendModal.show');
  await combo(page, 'spItem', '행사운영비');
  await combo(page, 'spProject', '배수로 정비공사');
  await combo(page, 'spVendor', '대한건설');
  await page.fill('#spName', '무대 설치 대금');
  await page.fill('#spAmount', '12000000');
  await page.selectOption('#spStatus', 'spent');
  await page.click('#saveSpendBtn');
  await page.waitForTimeout(400);

  await page.click('#addSpendBtn');
  await page.waitForSelector('#spendModal.show');
  await combo(page, 'spItem', '행사운영비');
  await combo(page, 'spProject', '배수로 정비공사');
  await combo(page, 'spVendor', '미래토건');
  await page.fill('#spName', '음향 임차');
  await page.fill('#spAmount', '3000000');
  await page.selectOption('#spStatus', 'planned');
  await page.click('#saveSpendBtn');
  await page.waitForTimeout(400);

  // 금액 없이는 막는다
  await page.click('#addSpendBtn');
  await page.fill('#spName', '금액없음');
  await page.click('#saveSpendBtn');
  await page.waitForTimeout(250);
  check('금액 없이 저장하면 막는다', await page.$eval('#spendModal', (e) => e.classList.contains('show')));
  await page.click('#spendModal .close');

  // 예산항목 미지정 지출도 총계에 들어간다
  await page.click('#addSpendBtn');
  await page.waitForSelector('#spendModal.show');
  await combo(page, 'spItem', '예산항목 미지정');
  await page.fill('#spName', '분류 전 집행');
  await page.fill('#spAmount', '500000');
  await page.click('#saveSpendBtn');
  await page.waitForTimeout(400);

  // 세 단계 합계가 서로 맞는가 — 이 앱에서 가장 중요한 숫자다
  const agree = await page.evaluate(async () => {
    const C = window.WorkCore, s = await C.readState(), sum = C.budgetSummary(s);
    const itemSum = sum.items.reduce((n, r) => n + r.spent + r.planned, 0) + (sum.unassigned?.total || 0);
    const projSum = [...sum.items.map((r) => r.projects), sum.unassigned?.projects || []].flat()
      .reduce((n, g) => n + g.total, 0);
    const vendSum = [...sum.items.map((r) => r.projects), sum.unassigned?.projects || []].flat()
      .flatMap((g) => g.vendors).reduce((n, v) => n + v.total, 0);
    const ledger = s.spends.reduce((n, sp) => n + Number(sp.amount), 0);
    return { total: sum.total.spent + sum.total.planned, itemSum, projSum, vendSum, ledger,
      remain: sum.total.remain, amount: sum.total.amount,
      firstItem: { spent: sum.items[0].spent, planned: sum.items[0].planned, remain: sum.items[0].remain } };
  });
  check('항목 합계 = 행사 합계 = 업체 합계 = 지출 원장 합계',
    agree.itemSum === agree.ledger && agree.projSum === agree.ledger && agree.vendSum === agree.ledger,
    JSON.stringify(agree));
  check('총계가 예산항목 미지정 지출까지 센다', agree.total === agree.ledger && agree.ledger === 15500000, JSON.stringify(agree));
  check('잔액 = 예산 − 기지출 − 지출예정', agree.remain === agree.amount - agree.total, JSON.stringify(agree));
  check('항목별 기지출·지출예정이 갈린다',
    agree.firstItem.spent === 12000000 && agree.firstItem.planned === 3000000 && agree.firstItem.remain === 35000000,
    JSON.stringify(agree.firstItem));

  // 드릴다운 — 항목 → 행사 → 업체
  check('처음에는 접혀 있다', await page.$$eval('#budgetBoard .bg-row.open', (e) => e.length) === 0);
  await page.click('#budgetBoard .bg-row .bg-head');
  await page.waitForSelector('#budgetBoard .bg-row.open .bg-project');
  check('펼치면 행사별 소계가 나온다', (await page.innerText('#budgetBoard .bg-row.open')).includes('배수로 정비공사'));
  await page.click('#budgetBoard .bg-row.open .bp-head');
  await page.waitForSelector('#budgetBoard .bg-project.open .bg-vendor');
  const drill = await page.innerText('#budgetBoard .bg-project.open');
  check('다시 펼치면 업체별 지출이 나온다', drill.includes('대한건설') && drill.includes('미래토건'), drill.slice(0, 160));
  check('기지출과 지출예정이 구분돼 보인다', drill.includes('기지출') && drill.includes('지출예정'));

  // 지출 줄을 누르면 편집이 열리고, 삭제도 된다
  await page.click('#budgetBoard .bg-project.open .bg-spend');
  await page.waitForSelector('#spendModal.show');
  check('지출 줄을 누르면 편집이 열린다', await page.$eval('#spName', (e) => e.value.length) > 0);
  check('편집일 때만 삭제 버튼이 보인다', await page.$eval('#deleteSpendBtn', (e) => !e.classList.contains('hidden')));
  await page.fill('#spAmount', '13000000');
  await page.click('#saveSpendBtn');
  await page.waitForTimeout(400);
  const edited = await page.evaluate(async () => (await window.WorkCore.readState()).spends.find((x) => x.name === '무대 설치 대금').amount);
  check('금액 수정이 반영된다', edited === 13000000, `${edited}`);

  // 업체별 보드의 총지출이 예산 화면과 같은 숫자다
  await page.click('[data-board="vendor"]');
  await page.waitForSelector('#vendorBoard:not(.hidden) .board-row');
  const vendorMoney = await page.evaluate(async () => {
    const C = window.WorkCore, s = await C.readState();
    const row = C.vendorSummaries(s).find((r) => r.vendor?.name === '대한건설');
    const mine = s.spends.filter((sp) => sp.vendorId === row.vendorId).reduce((n, sp) => n + Number(sp.amount), 0);
    return { board: row.spent + row.planned, ledger: mine, shown: !!document.querySelector('.bh-money') };
  });
  check('업체별 보드의 총지출이 원장과 같다', vendorMoney.board === vendorMoney.ledger && vendorMoney.board === 13000000, JSON.stringify(vendorMoney));
  check('업체 줄에 지출이 표시된다', vendorMoney.shown);

  // 상세에서 바로 지출을 적는다
  await page.click('[data-board="calendar"]');
  await page.click('.due-card');
  await page.waitForSelector('#detailModal.show');
  await page.click('#detailAddSpend');
  await page.waitForSelector('#spendModal.show');
  check('상세에서 열면 업체가 미리 채워진다', (await page.$eval('#spVendor', (e) => e.value)).length > 0);
  await page.fill('#spName', '준공 대금');
  await page.fill('#spAmount', '2000000');
  await combo(page, 'spItem', '홍보비');
  await page.click('#saveSpendBtn');
  await page.waitForTimeout(500);
  const linked = await page.evaluate(async () => {
    const s = await window.WorkCore.readState();
    const sp = s.spends.find((x) => x.name === '준공 대금');
    return { kind: sp?.recordKind, id: !!sp?.recordId, item: sp?.itemId };
  });
  check('상세에서 등록한 지출이 그 건에 걸린다', !!linked.kind && linked.id, JSON.stringify(linked));
  check('고른 예산항목에 들어간다', linked.item === itemIds[1], JSON.stringify(linked));
  // 상세를 열어 둔 채 적었으면 그 자리에서 바로 보여야 한다
  const detailNow = await page.innerText('#detailBody');
  check('상세의 지출 목록이 곧바로 갱신된다', detailNow.includes('준공 대금') && detailNow.includes('2,000,000'), detailNow.slice(-200));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // 예산 모드가 저장된다
  await page.click('[data-board="budget"]');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector('#budgetBoard:not(.hidden)');
  check('예산 모드가 새로고침 후에도 유지된다', await page.$eval('#budgetBoard', (e) => !e.classList.contains('hidden')));

  // 용어를 바꿔도 예산 문구가 따라온다
  const terms = await page.evaluate(() => {
    const L = window.WorkCore.labels({ vendor: '거래처', project: '계약건', budgetItem: '세목', spend: '집행' });
    return { tab: L.fBudgetItem, caption: L.budgetCaption, empty: L.budgetEmptyItem, add: L.addSpend };
  });
  check('예산항목 용어가 바뀐다', terms.tab === '세목', terms.tab);
  check('예산 문구에 하드코딩이 남지 않는다', !/업체|업무|예산항목|지출/.test(terms.caption + terms.add), terms.caption + ' | ' + terms.add);
  check('조사가 맞는다 (집행이 없습니다)', terms.empty === '아직 집행이 없습니다.', terms.empty);

  const tiny = await page.evaluate(measure);
  check('예산 화면에 13px 미만 텍스트가 없다', tiny.length === 0, tiny.join(' | '));
  for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(120);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`예산 화면 ${vp.width}px 에서 가로 스크롤이 없다`, over <= 1, `${over}px`);
  }

  check('콘솔/페이지 에러 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\n[30] 검색되는 선택 칸 — 치면 걸러지고, 없으면 그 자리에서 만든다');
{
  const { ctx, page, errors } = await open();
  await page.click('#addScheduleBtn');
  await page.waitForSelector('#scheduleModal.show');

  // 역할·속성 (W3C APG 콤보박스)
  const aria = await page.evaluate(() => {
    const i = document.getElementById('sVendorInput');
    return { role: i.getAttribute('role'), expanded: i.getAttribute('aria-expanded'),
      controls: i.getAttribute('aria-controls'), list: !!document.getElementById(i.getAttribute('aria-controls')),
      nativeHidden: document.getElementById('sVendor').getAttribute('aria-hidden') };
  });
  check('role=combobox 로 노출된다', aria.role === 'combobox' && aria.list, JSON.stringify(aria));
  check('원래 select 는 값의 주인으로만 남는다', aria.nativeHidden === 'true');
  check('처음에는 닫혀 있다', aria.expanded === 'false');
  check('고른 값이 글자로 보인다', (await page.inputValue('#sVendorInput')).length > 0);

  // 치면 걸러진다
  await page.click('#sVendorInput');
  check('누르면 열린다', await page.$eval('#sVendorInput', (e) => e.getAttribute('aria-expanded') === 'true'));
  const all = await page.$$eval('#scheduleModal .cb-opt', (e) => e.length);
  await page.fill('#sVendorInput', '미래');
  await page.waitForTimeout(80);
  const hits = await page.$$eval('#scheduleModal .cb-opt', (e) => e.map((x) => x.textContent));
  check('치면 걸러진다', hits.length < all && hits.some((t) => t.includes('미래토건')), `${all} -> ${JSON.stringify(hits)}`);

  // 이미 있는 이름이면 만들기 줄이 나오지 않는다
  await page.fill('#sVendorInput', '미래토건');
  await page.waitForTimeout(80);
  check('같은 이름이 있으면 새로 만들기가 안 나온다', await page.$$eval('#scheduleModal .cb-opt.create', (e) => e.length) === 0);

  // 없는 이름이면 만들기 줄
  await page.fill('#sVendorInput', '솔뫼농산');
  await page.waitForTimeout(80);
  const createRow = await page.$$eval('#scheduleModal .cb-opt.create', (e) => e.map((x) => x.textContent));
  check('목록에 없으면 새로 만들기가 나온다', createRow.length === 1 && createRow[0].includes('솔뫼농산'), JSON.stringify(createRow));

  // 키보드만으로 이동·선택
  const act = await page.$eval('#sVendorInput', (e) => e.getAttribute('aria-activedescendant'));
  check('활성 항목을 aria 로 알린다', !!act, `${act}`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const made = await page.evaluate(async () => {
    const s = await window.WorkCore.readState();
    return { names: s.vendorTemplates.map((v) => v.name), picked: document.getElementById('sVendor').value };
  });
  check('Enter 로 새 업체가 만들어진다', made.names.includes('솔뫼농산'), made.names.join(','));
  check('만들자마자 골라져 있다', made.names.includes('솔뫼농산') && !!made.picked);
  check('만든 이름이 칸에 남는다', (await page.inputValue('#sVendorInput')) === '솔뫼농산');
  check('만들면 닫힌다', await page.$eval('#sVendorInput', (e) => e.getAttribute('aria-expanded') === 'false'));

  // Esc 는 되돌린다
  await page.click('#sVendorInput');
  await page.fill('#sVendorInput', '아무거나입력');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  check('Esc 는 원래 글자로 되돌린다', (await page.inputValue('#sVendorInput')) === '솔뫼농산');
  check('Esc 로 목록만 닫히고 모달은 남는다', await page.$eval('#scheduleModal', (e) => e.classList.contains('show')));

  // ↑↓ 로 고른다
  await page.click('#sVendorInput');
  await page.fill('#sVendorInput', '');
  await page.waitForTimeout(80);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const activeText = await page.$eval('#scheduleModal .cb-opt.active', (e) => e.textContent);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  check('↑↓ 와 Enter 만으로 고를 수 있다', (await page.inputValue('#sVendorInput')) === activeText, `${activeText}`);

  // 만든 업체가 다른 모달에도 그대로 있다
  await page.click('#scheduleModal .close');
  await page.click('#addWorkBtn');
  await page.waitForSelector('#workModal.show');
  await page.click('#wVendorInput');
  await page.fill('#wVendorInput', '솔뫼');
  await page.waitForTimeout(80);
  check('다른 모달에서도 같은 업체가 검색된다',
    (await page.$$eval('#workModal .cb-opt', (e) => e.map((x) => x.textContent))).some((t) => t.includes('솔뫼농산')));

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
