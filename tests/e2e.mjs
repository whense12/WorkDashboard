#!/usr/bin/env node
/**
 * Windows 실동작 E2E.
 *
 * 브라우저 스모크로는 확인할 수 없는 것들 — 앱 폴더에 실제로 파일이 생기는가,
 * 앱을 껐다 켜도 첨부가 남는가, 자동 실행이 레지스트리에 들어가는가,
 * 도우미 창이 항상 위에 오는가, 창 위치가 복원되는가, 실제 WebView2 에서 CSP 가
 * 화면을 깨뜨리지 않는가 — 를 빌드된 실물 앱을 띄워 확인한다.
 *
 * tauri-driver 를 띄우고 W3C WebDriver 프로토콜을 직접 호출한다.
 * WebdriverIO 스택을 끌어오지 않는 이유는 이 프로젝트가 의존성을 최소로 유지하기
 * 때문이다(발주서 §18). 필요한 명령은 세션 생성/스크립트 실행/세션 종료뿐이다.
 *
 *   node tests/e2e.mjs [경로\to\app.exe]
 *
 * Windows 전용. 다른 OS 에서는 아무것도 하지 않고 통과한다.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'win32') {
  console.log('Windows 전용 E2E 입니다. 현재 플랫폼:', process.platform, '— 건너뜁니다.');
  process.exit(0);
}

// tauri CLI 는 mainBinaryName 으로 리네임하지만 순수 cargo build 는 Cargo 패키지명을 쓴다.
// 어느 쪽으로 빌드했든 찾도록 후보를 훑는다.
const RELEASE = join(root, 'src-tauri', 'target', 'release');
const APP = process.argv[2]
  || ['work-calendar-helper.exe', 'work_calendar_helper.exe'].map((n) => join(RELEASE, n)).find(existsSync);
if (!APP || !existsSync(APP)) {
  console.error(`빌드된 실행파일을 찾지 못했습니다. 확인한 곳: ${RELEASE}`);
  process.exit(1);
}
const PROC = basename(APP).replace(/\.exe$/i, '');

const IDENTIFIER = 'kr.go.goseong.work-calendar-helper';
const APPDATA = join(process.env.LOCALAPPDATA, IDENTIFIER);
const DRIVER = 'http://127.0.0.1:4444';

let passed = 0;
const failures = [];
const skips = [];
const check = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
};
// 확인하지 못한 것은 통과로 세지 않는다. 무엇을 왜 못 했는지 남긴다.
const skip = (name, why) => { skips.push(`${name} — ${why}`); console.log(`  SKIP ${name} — ${why}`); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PWSH = (() => {
  // PowerShell 7 은 .ps1 을 UTF-8 로 읽는다. 5.1 은 ANSI 로 읽어 한글 주석에서 깨진다.
  try { execFileSync('pwsh', ['-NoProfile', '-Command', 'exit 0']); return 'pwsh'; }
  catch { return 'powershell'; }
})();
const ps = (action, extra = []) => {
  try {
    return execFileSync(PWSH, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'tests', 'win32.ps1'), '-Action', action, '-ProcessName', PROC, ...extra], { encoding: 'utf8' }).trim();
  } catch (e) { return `PSERROR:${e.message}`; }
};
const psRaw = (script) => {
  try { return execFileSync(PWSH, ['-NoProfile', '-Command', script], { encoding: 'utf8' }).trim(); }
  catch (e) { return `PSERROR:${e.message}`; }
};

// ── WebDriver 최소 클라이언트 ────────────────────────────────────────────────
async function wd(method, path, body) {
  const res = await fetch(DRIVER + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json.value;
}

let sessionId = null;
async function newSession(attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const v = await wd('POST', '/session', { capabilities: { alwaysMatch: { 'tauri:options': { application: APP } } } });
      sessionId = v.sessionId || v.session_id;
      await wd('POST', `/session/${sessionId}/timeouts`, { script: 30000 });
      return sessionId;
    } catch (e) {
      last = e;
      console.log(`  세션 생성 ${i}/${attempts} 실패: ${String(e.message).slice(0, 180)}`);
      // 앱이 반쯤 떠 있으면 다음 시도를 방해한다. 정리하고 다시 시도한다.
      psRaw(`Get-Process -Name '${PROC}' -ErrorAction SilentlyContinue | Stop-Process -Force`);
      await sleep(4000);
    }
  }
  throw last;
}
async function endSession() {
  if (!sessionId) return;
  try { await wd('DELETE', `/session/${sessionId}`); } catch { /* 앱이 이미 죽었을 수 있다 */ }
  sessionId = null;
}
/** 비동기 스크립트 실행. 마지막 인자로 넘어오는 콜백에 결과를 넘긴다. */
async function evalAsync(fnBody, args = []) {
  const script = `const done = arguments[arguments.length - 1];
    (async () => { ${fnBody} })().then(r => done({ ok: true, r })).catch(e => done({ ok: false, e: String(e && e.message || e) }));`;
  const out = await wd('POST', `/session/${sessionId}/execute/async`, { script, args });
  if (!out || out.ok !== true) throw new Error(`앱 안 스크립트 실패: ${out && out.e}`);
  return out.r;
}
async function waitReady(timeoutMs = 30000) {
  const t0 = Date.now();
  for (;;) {
    try { const ok = await evalAsync('return !!window.WorkCore'); if (ok) return true; } catch { /* 아직 로딩 중 */ }
    if (Date.now() - t0 > timeoutMs) return false;
    await sleep(500);
  }
}

// ── tauri-driver 기동 ────────────────────────────────────────────────────────
console.log(`대상 실행파일: ${APP} (프로세스 ${PROC})`);
console.log(`앱 데이터 폴더: ${APPDATA}`);
psRaw(`Get-Process -Name '${PROC}' -ErrorAction SilentlyContinue | Stop-Process -Force`); // 남은 프로세스 정리
psRaw(`if (Test-Path '${APPDATA}') { Remove-Item -Recurse -Force '${APPDATA}' }`); // 깨끗한 상태에서 시작
console.log('msedgedriver:', psRaw('(Get-Command msedgedriver -ErrorAction SilentlyContinue).Source'));
const driver = spawn('tauri-driver', [], { stdio: ['ignore', 'inherit', 'inherit'] });
driver.on('error', (e) => { console.error('tauri-driver 실행 실패:', e.message); process.exit(1); });
await sleep(4000);

let exitCode = 0;
try {
  // ── 1. 첫 기동 ────────────────────────────────────────────────────────────
  console.log('\n[E1] 빌드된 앱이 실제로 뜨고, CSP 아래에서 화면이 성립한다');
  await newSession();
  check('앱이 뜨고 스크립트가 실행된다', await waitReady(), '30초 안에 WorkCore 가 나타나지 않음');

  const boot = await evalAsync(`
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', ev => window.__cspViolations.push(ev.violatedDirective + ' ' + ev.blockedURI));
    await document.fonts.ready;
    const s = await window.WorkCore.readState();
    return {
      title: document.title,
      version: s.version,
      fontLoaded: [...document.fonts].some(f => f.family.includes('Pretendard') && f.status === 'loaded'),
      nativeFiles: window.WorkCore.nativeFiles(),
      hasFsPlugin: !!(window.__TAURI__ && window.__TAURI__.fs && window.__TAURI__.fs.writeFile),
      hasOpener: !!(window.__TAURI__ && window.__TAURI__.opener),
      cards: document.querySelectorAll('.due-card, .empty').length,
    };`);
  // 스크립트가 돌았다는 것 자체가 script-src 'self' 가 번들 스크립트를 막지 않았다는 증거다.
  check('CSP 가 번들 스크립트를 막지 않는다', boot.version === 9, JSON.stringify(boot));
  check('CSP 아래에서 번들 폰트가 로드된다', boot.fontLoaded === true, `fontLoaded=${boot.fontLoaded}`);
  check('fs 플러그인이 웹뷰에 노출된다', boot.hasFsPlugin === true);
  check('첨부 백엔드가 네이티브로 잡힌다', boot.nativeFiles === true);
  check('화면이 렌더된다', boot.cards > 0, `요소 ${boot.cards}개`);

  // ── 2. 첨부가 앱 폴더에 실제 파일로 ───────────────────────────────────────
  console.log('\n[E2] 첨부가 앱 폴더에 실제 파일로 저장된다 (§16.2)');
  const att = await evalAsync(`
    const C = window.WorkCore;
    const s = await C.readState(), d = C.demoData();
    s.projects.push(...d.projects); s.manualEvents.push(...d.manualEvents);
    await C.saveState(s);
    const s2 = await C.readState();
    const step = s2.projects.find(p => p.id === 'demo-p1').steps[2];
    const file = new File([new TextEncoder().encode('E2E 첨부 내용 확인')], 'e2e-첨부.txt', { type: 'text/plain' });
    const meta = await C.putAttachment(file, step.id);
    step.attachments.push(meta);
    await C.saveState(s2);
    return { meta, stepId: step.id };`);
  check('메타데이터 backend 가 tauri-fs 다', att.meta.backend === 'tauri-fs', JSON.stringify(att.meta));
  const attFull = join(APPDATA, att.meta.relativePath.replace(/\//g, '\\'));
  check('디스크에 실제 파일이 생긴다', psRaw(`Test-Path '${attFull}'`) === 'True', attFull);
  check('파일 내용이 맞는다', psRaw(`Get-Content -Raw -Encoding UTF8 '${attFull}'`).includes('E2E 첨부 내용 확인'));
  check('물리 파일명에 사용자 파일명이 들어가지 않는다', !attFull.includes('첨부.txt') && /att-[0-9a-z-]+\.txt$/i.test(attFull), attFull);

  // ── 3. 자동 백업 ──────────────────────────────────────────────────────────
  console.log('\n[E3] 자동 백업이 조용히 만들어진다 (§16.3)');
  const bk = await evalAsync(`
    const C = window.WorkCore, s = await C.readState();
    s.settings.lastAutoBackup = null;
    const r = await C.maybeAutoBackup(s);
    return { r, list: await C.listBackups() };`);
  check('자동 백업이 성공한다', bk.r && bk.r.ok === true, JSON.stringify(bk.r));
  check('백업 파일이 목록에 잡힌다', Array.isArray(bk.list) && bk.list.length === 1, JSON.stringify(bk.list));
  check('백업이 첨부를 포함한다', bk.r?.manifest?.attachmentsIncluded === 1, JSON.stringify(bk.r?.manifest));
  const bkPath = join(APPDATA, 'backups', bk.list?.[0] || 'none.zip');
  check('디스크에 ZIP 이 있다', psRaw(`Test-Path '${bkPath}'`) === 'True', bkPath);
  const unzip = psRaw(`Add-Type -A System.IO.Compression.FileSystem; (([IO.Compression.ZipFile]::OpenRead('${bkPath}')).Entries | ForEach-Object { $_.FullName }) -join ';'`);
  check('Windows 가 이 ZIP 을 읽을 수 있다', unzip.includes('state.json') && unzip.includes('manifest.json') && unzip.includes('attachments/'), unzip);

  // ── 4. 자동 실행 ──────────────────────────────────────────────────────────
  console.log('\n[E4] 자동 실행 설정이 레지스트리에 반영된다 (인수조건 H)');
  const runKeyBefore = ps('autostart');
  check('설정 전에는 앱이 등록되어 있지 않다', !/work-calendar|업체별/.test(runKeyBefore), runKeyBefore);
  const onErr = await evalAsync(`try { await window.__TAURI__.core.invoke('set_autostart', { enabled: true }); return null } catch (e) { return String(e) }`);
  check('set_autostart(true) 가 오류 없이 끝난다', onErr === null, String(onErr));
  await sleep(500);
  const reg = ps('autostart');
  check('HKCU Run 키에 앱이 등록된다', /work-calendar|업체별/.test(reg), reg);
  const enabled = await evalAsync(`return await window.__TAURI__.core.invoke('is_autostart_enabled')`);
  check('앱도 켜져 있다고 보고한다', enabled === true, String(enabled));
  await evalAsync(`await window.__TAURI__.core.invoke('set_autostart', { enabled: false }); return 1`);
  await sleep(500);
  const runKeyAfter = ps('autostart');
  check('끄면 레지스트리에서 사라진다', !/work-calendar|업체별/.test(runKeyAfter), runKeyAfter);

  // ── 5. 조각 창 세 개 — 창이 없는 앱의 실체 ────────────────────────────────
  console.log('\n[E5] 조각 창 — 달력 시트·미니 대시보드·현황이 각각 떠 있다');
  await sleep(1200);
  const titles = ps('listwindows');
  check('달력 시트 창이 있다', titles.includes('(cal)'), titles);
  check('미니 대시보드 창이 있다', titles.includes('(mini)'), titles);
  check('현황 창이 있다', titles.includes('(status)'), titles);
  // 항상 아래(악세사리)이므로 TOPMOST 가 아니어야 한다.
  const calTop = ps('topmost', ['-Kind', 'cal']);
  if (calTop === 'NOWINDOW' || calTop.startsWith('PSERROR')) skip('조각이 TOPMOST 가 아니다', calTop);
  else check('조각이 TOPMOST 가 아니다 (항상 아래 악세사리)', calTop === 'False', calTop);

  // ── 6. pop 창 — 폼은 창으로 열렸다 닫힌다 ────────────────────────────────
  console.log('\n[E6] pop 창 — 입력 폼이 작은 창으로 열리고, 딥링크가 상세 pop 을 연다');
  const formErr = await evalAsync(`try { await window.__TAURI__.core.invoke('open_form', { form: 'schedule', payload: '{}' }); return null } catch (e) { return String(e) }`);
  check('open_form 이 오류 없이 끝난다', formErr === null, String(formErr));
  await sleep(2000);
  const withPop = ps('listwindows');
  check('pop 창이 뜬다', withPop.includes('(pop)'), withPop);
  const badForm = await evalAsync(`try { await window.__TAURI__.core.invoke('open_form', { form: 'evil<script>', payload: '{}' }); return null } catch (e) { return String(e) }`);
  check('화이트리스트 밖 폼 이름은 거부된다', badForm !== null, String(badForm));

  // 딥링크 — 다른 창이 공유 상태에 적으면 달력 시트 창이 소비해 상세 pop 을 연다.
  const relay = await evalAsync(`
    const C = window.WorkCore, s = await C.readState();
    const ev = s.manualEvents[0];
    s.pendingSelection = { kind: 'manual', id: ev.id };
    await C.saveState(s);
    await new Promise(r => setTimeout(r, 1800));
    return { left: (await C.readState()).pendingSelection };`);
  check('소비 후 딥링크 상태가 비워진다', relay.left === null, JSON.stringify(relay.left));
  const afterRelay = ps('listwindows');
  check('딥링크가 상세 pop 창을 연다', afterRelay.includes('(pop)'), afterRelay);

  // ── 7. 창 위치 복원 + 첨부 유지 ───────────────────────────────────────────
  console.log('\n[E7] 앱을 껐다 켠다 — 창 위치 복원과 첨부 유지');
  const moved = ps('move', ['-Kind', 'cal', '-X', '140', '-Y', '90']);
  const movedOk = /^\d+,\d+$/.test(moved);
  if (!movedOk) skip('창 위치 복원', `창을 옮기지 못함 (${moved})`);
  await sleep(800);
  await endSession();
  await sleep(2500);

  await newSession();
  check('두 번째 기동에서도 앱이 뜬다', await waitReady(), '재기동 후 WorkCore 없음');
  const after = await evalAsync(`
    const C = window.WorkCore, s = await C.readState();
    const step = s.projects.find(p => p.id === 'demo-p1').steps[2];
    const meta = step.attachments[0];
    let text = null, err = null;
    try { const r = await C.readAttachment(meta); text = new TextDecoder().decode(r.bytes); } catch (e) { err = String(e.message); }
    return { attachments: step.attachments.length, text, err, projects: s.projects.length };`);
  check('재시작 후에도 첨부 메타데이터가 남는다', after.attachments === 1, JSON.stringify(after));
  check('재시작 후에도 첨부 실물을 읽을 수 있다', after.text === 'E2E 첨부 내용 확인', after.err || after.text);
  check('재시작 후에도 업무가 남는다', after.projects === 4, `projects=${after.projects}`);

  if (movedOk) {
    await sleep(500);
    const rect = ps('rect', ['-Kind', 'cal']);
    if (!/^\d+,\d+$/.test(rect)) skip('창 위치 복원', `재기동 후 창을 찾지 못함 (${rect})`);
    else {
      const [mx, my] = moved.split(',').map(Number), [rx, ry] = rect.split(',').map(Number);
      check('창 위치가 복원된다', Math.abs(rx - mx) <= 12 && Math.abs(ry - my) <= 12, `옮긴 위치 ${moved} · 재기동 후 ${rect}`);
    }
  }

  // ── 8. 첨부 삭제와 백업 복원 ──────────────────────────────────────────────
  console.log('\n[E8] 첨부 삭제가 실물까지 지우고, 백업 복원이 되살린다');
  const del = await evalAsync(`
    const C = window.WorkCore, s = await C.readState();
    const step = s.projects.find(p => p.id === 'demo-p1').steps[2];
    const meta = step.attachments[0], rel = meta.relativePath;
    await C.deleteAttachment(meta);
    step.attachments = [];
    await C.saveState(s);
    return { rel };`);
  check('삭제 후 디스크에서 사라진다', psRaw(`Test-Path '${join(APPDATA, del.rel.replace(/\//g, '\\'))}'`) === 'False', del.rel);

  const restored = await evalAsync(`
    const C = window.WorkCore;
    const list = await C.listBackups();
    const bytes = await C.readBackupFile(list[0]);
    const { state, manifest } = await C.restoreBackup(bytes);
    await C.saveState(state);
    const s = await C.readState();
    const step = s.projects.find(p => p.id === 'demo-p1').steps[2];
    let text = null, err = null;
    try { const r = await C.readAttachment(step.attachments[0]); text = new TextDecoder().decode(r.bytes); } catch (e) { err = String(e.message); }
    return { included: manifest.attachmentsIncluded, attachments: step.attachments.length, text, err };`);
  check('백업에서 첨부가 되살아난다', restored.attachments === 1 && restored.text === 'E2E 첨부 내용 확인', restored.err || JSON.stringify(restored));

  // ── 9. CSP 위반 ───────────────────────────────────────────────────────────
  console.log('\n[E9] 실제 WebView2 에서 CSP 위반이 없다 (§26)');
  const viol = await evalAsync(`
    window.__v = window.__v || [];
    document.addEventListener('securitypolicyviolation', ev => window.__v.push(ev.violatedDirective + ' <- ' + ev.blockedURI));
    document.getElementById('settingsBtn').click();
    await new Promise(r => setTimeout(r, 400));
    document.getElementById('templateBtn').click();
    await new Promise(r => setTimeout(r, 400));
    document.querySelector('[data-template-tab="terms"]').click();
    await new Promise(r => setTimeout(r, 400));
    document.querySelector('.due-card') && document.querySelector('.due-card').click();
    await new Promise(r => setTimeout(r, 400));
    return { violations: window.__v, boot: window.__cspViolations || [] };`);
  check('화면을 조작해도 CSP 위반이 없다', viol.violations.length === 0, viol.violations.join(' | '));

  // ── 10. Store 자기 발화 ───────────────────────────────────────────────────
  console.log('\n[E10] Tauri Store 자기 발화 — 저장 중 입력이 유실되지 않는다');
  const rev = await evalAsync(`
    const C = window.WorkCore;
    let fired = 0;
    await C.watchState(() => { fired++; });
    const s = await C.readState();
    for (let i = 0; i < 5; i++) { s.settings.customHorizon = 30 + i; await C.saveState(s); }
    await new Promise(r => setTimeout(r, 1200));
    return { fired, finalValue: (await C.readState()).settings.customHorizon };`);
  check('자기가 쓴 저장에는 watch 가 반응하지 않는다', rev.fired === 0, `콜백 ${rev.fired}회 발화`);
  check('저장 자체는 정상 동작한다', rev.finalValue === 34, `customHorizon=${rev.finalValue}`);

} catch (e) {
  console.error('\nE2E 중단:', e.message);
  failures.push(`예외: ${e.message}`);
} finally {
  await endSession();
  driver.kill();
}

console.log('\n' + '─'.repeat(64));
if (skips.length) { console.log(`확인 못 한 항목 ${skips.length}건:`); skips.forEach((s) => console.log(`  · ${s}`)); console.log(''); }
if (failures.length) {
  console.log(`실패 ${failures.length}건 / 통과 ${passed}건\n`);
  failures.forEach((f) => console.log(`  · ${f}`));
  exitCode = 1;
} else {
  console.log(`통과 ${passed}건, 실패 없음${skips.length ? ` (확인 못 함 ${skips.length}건)` : ''}`);
}
process.exit(exitCode);
