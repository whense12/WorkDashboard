(async function(){
  const C=window.WorkCore;let state=await C.initStorage();let currentMonth=new Date(2026,7,1);let selectedRecord=null;
  // ── 창 모드 ──────────────────────────────────────────────────────────────
  // 이 앱에는 메인 창이 없다. 달력 시트·미니 대시보드·현황이 각각 무장식 창이고(도우미 방식),
  // 입력 폼은 필요할 때만 작은 pop 창으로 열렸다 닫힌다. 브라우저·검사에서는 파라미터 없이
  // 세 조각과 모달이 모두 한 페이지에 있다 — 동작은 완전히 같다.
  const PARAMS=new URLSearchParams(location.search);
  const MODE=PARAMS.get('w')||'';
  const IS_POP=MODE==='pop';
  if(MODE==='cal'||MODE==='mini'||MODE==='status')document.body.classList.add('win-mode','mode-'+MODE);
  if(IS_POP)document.body.classList.add('mode-pop');
  const hasPiece=p=>!MODE||MODE===p;   // 이 창에 그 조각이 있는가
  /** 조각 창에서 폼을 열면 pop 창으로 내보낸다. pop 창 자신과 브라우저는 제자리에서 연다. */
  async function popOut(form,payload){
    if(!C.isTauri()||IS_POP)return false;
    try{await window.__TAURI__.core.invoke('open_form',{form,payload:JSON.stringify(payload||{})});return true}
    catch(e){console.warn('pop 창을 열지 못했습니다',e);return false}
  }
  // pop 창은 마지막 모달이 닫히면 스스로 사라진다. 되돌리기 토스트가 떠 있는 동안은
  // 기다린다 — 창이 먼저 닫히면 되돌릴 기회도 함께 사라진다.
  function closePopSoon(){
    if(!IS_POP)return;
    setTimeout(function check(){
      if(modalStack.length)return;                       // 다른 모달이 이어서 열렸다
      if(document.querySelector('.toast-undo')){setTimeout(check,500);return}
      try{window.__TAURI__.core.invoke('close_pop')}catch(e){console.warn(e)}
    },80);
  }let selectedProjectId=null;let templateTab='vendor';let selectedVendorTemplateId=null;let selectedWorkTemplateId=null;let projectStepsDraft=[];
  let L=C.labels(state.terms);const $=id=>document.getElementById(id);const q=(s,r=document)=>r.querySelector(s);const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  function toast(text,action){
    const el=$('toast');
    el.innerHTML='';
    const span=document.createElement('span');span.textContent=text;el.appendChild(span);
    if(action){
      const b=document.createElement('button');b.className='toast-undo';b.id='undoBtn';b.textContent=action.label;
      b.addEventListener('click',()=>{clearTimeout(toast.t);el.classList.remove('show');action.run()});
      el.appendChild(b);
    }
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>{el.classList.remove('show');el.querySelector('.toast-undo')?.remove();action?.onExpire?.()},action?(action.delay||6500):1700);
  }
  // ── 되돌리기 ─────────────────────────────────────────────────────────────
  // 확인창이 11곳이었고 되돌리기는 하나도 없었다. NN/g: "확인창을 남발하면 사람이
  // 읽지 않고 누르게 된다." 되돌리기를 기본으로 두고, 되돌려도 복구가 안 되는 것에만
  // 확인창을 남긴다(절차 단계 삭제·백업 복원·용어 기본값).
  //
  // 첨부 실물 삭제는 되돌리기 창이 닫힌 뒤에 한다. 먼저 지우면 되돌려도 파일이 없다.
  let pendingPurge=null;
  function flushPurge(){const p=pendingPurge;pendingPurge=null;if(p)Promise.resolve(p()).catch(e=>console.warn('첨부 정리 실패',e))}
  async function withUndo(message,mutate,{purge=null}={}){
    flushPurge();                       // 앞서 대기 중이던 정리를 먼저 확정한다
    const before=C.clone(state);
    await mutate();
    await C.saveState(state);render();
    pendingPurge=purge;
    toast(message,{label:L.undo,onExpire:flushPurge,run:async()=>{
      pendingPurge=null;                // 되돌리면 실물도 지우지 않는다
      state=before;await C.saveState(state);render();
      toast(L.undone);
    }});
  }
  // ── 모달 포커스 관리 (발주서 §17.2-4) ────────────────────────────────────
  // 열린 순서를 스택으로 들고 있어야 한다. 이전에는 Escape 가 DOM 순서상 마지막 모달을
  // 닫아서, 상세 위에 다른 모달이 떠 있으면 엉뚱한 창이 닫혔다.
  const modalStack=[];
  const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const focusables=root=>[...root.querySelectorAll(FOCUSABLE)].filter(el=>el.offsetWidth||el.offsetHeight||el.getClientRects().length);
  let popShown=false;
  function show(id){
    const bg=$(id);if(bg.classList.contains('show'))return;
    modalStack.push({id,returnTo:document.activeElement});
    bg.classList.add('show');
    // pop 창은 visible:false 로 태어난다. 첫 모달이 화면에 잡힌 지금 띄운다.
    if(IS_POP&&!popShown){popShown=true;try{window.__TAURI__?.core?.invoke('pop_ready')}catch(e){}}
    window.WorkCombo?.syncAll(bg);
    (focusables(bg)[0]||bg.querySelector('.modal'))?.focus?.();
  }
  function hide(id){
    const bg=$(id);if(!bg.classList.contains('show'))return;
    bg.classList.remove('show');
    const i=modalStack.findIndex(m=>m.id===id);
    const entry=i>=0?modalStack.splice(i,1)[0]:null;
    if(entry?.returnTo?.isConnected)entry.returnTo.focus?.();
    if(!modalStack.length)closePopSoon();
  }
  // Tab 이 모달 밖으로 새어 나가지 않게 가둔다.
  document.addEventListener('keydown',e=>{
    if(e.key!=='Tab'||!modalStack.length)return;
    const f=focusables($(modalStack[modalStack.length-1].id));
    if(!f.length){e.preventDefault();return}
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  });
  async function persist(msg){await C.saveState(state);render();if(msg)toast(msg)}
  function render(){L=C.labels(state.terms);applyStaticLabels();renderHorizon();renderDue();renderCalendar();renderBoard();renderGroupBoard();renderBudget();renderStatus();applyMiniMode();applyStatus();fillSelects();renderTemplatePanes();}
  // 정적 HTML 의 data-t 를 사전 값으로 채운다. 마크업이 들어가는 문구만 innerHTML 로 넣는다.
  function applyStaticLabels(){document.title=L.app;qa('[data-t]').forEach(el=>{const v=L[el.dataset.t];if(typeof v==='string')el.textContent=v});const o=$('omni');if(o)o.placeholder=L.omniPlaceholder;$('calHint').textContent=L.calHint;$('statusHint').textContent='줄을 누르면 펼쳐집니다'}
  function renderHorizon(){const s=state.settings;$('horizonSelect').value=s.horizon;$('horizonCustom').value=s.customHorizon;$('horizonCustom').classList.toggle('hidden',s.horizon!=='custom')}
  function renderDue(){const cards=C.dueCards(state),host=$('dueList');if(!cards.length){const blank=!state.projects.length&&!state.manualEvents.length;host.innerHTML=`<div class="empty">${blank?L.emptyBlank:L.emptyHorizon}</div>`;return}host.innerHTML=cards.map(r=>{const v=C.vendor(state,r.vendorId),p=C.project(state,r.projectId);return `<button class="due-card ${C.ddayClass(r)}" data-due-kind="${r.kind}" data-due-id="${r.id}"><span><span class="due-vendor">${C.esc(v?.name||L.noVendor)}</span><span class="due-task">${C.esc(r.name)}</span><span class="due-sub">${spanText(r)}${p?` · ${C.esc(p.name)}`:''}</span>${r.extra?`<span class="due-extra">${C.esc(L.laterCount(r.extra))}</span>`:''}</span><span class="due-dday">${C.ddayLabel(r)}</span></button>`}).join('');qa('[data-due-id]',host).forEach(b=>b.addEventListener('click',()=>openRecord(b.dataset.dueKind,b.dataset.dueId)))}
  // ── 미니 대시보드 토글 ───────────────────────────────────────────────────
  // 지남/오늘/예정을 머리글로 가르지 않는다 — 색(빨강/주황/파랑)이 이미 그 일을 한다.
  // 대신 한 토글로 '일정순'과 '업체별'을 오간다. 초안의 세그먼트 조작 언어 그대로다.
  const MINI_MODES=['due','vendor'];
  const miniMode=()=>MINI_MODES.includes(state.settings.miniView)?state.settings.miniView:'due';
  let expandedVendors=new Set();   // 펼침은 화면 상태다. 저장하지 않는다.
  let expandedItems=new Set(),expandedProjects=new Set();
  let openStatus=new Set(Array.isArray(state.settings.statusOpen)?state.settings.statusOpen:[]); // 현황 조각에서 펼쳐 둔 부(행사/예산). 다시 켰을 때 보던 화면이 그대로 있어야 한다.
  function applyMiniMode(){
    const mode=miniMode();
    $('dueList').classList.toggle('hidden',mode!=='due');
    $('vendorBoard').classList.toggle('hidden',mode!=='vendor');
    qa('.tabs [data-board]').forEach(b=>{const on=b.dataset.board===mode;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});
  }
  async function setMiniMode(mode){
    if(miniMode()===mode)return;
    state.settings.miniView=mode;
    await C.saveState(state);          // 다시 켰을 때 보던 화면이 그대로 있어야 한다
    renderDue();renderBoard();applyMiniMode();
  }
  // ── 현황 조각 — 행사·예산 요약 겉면과 제자리 펼침 ────────────────────────
  function applyStatus(){
    [['group','groupBoard','stGroupFace'],['budget','budgetBoard','stBudgetFace']].forEach(([k,board,face])=>{
      const open=openStatus.has(k);
      $(board).classList.toggle('hidden',!open);
      $(face).classList.toggle('hidden',open);
      q(`.st-head[data-board="${k}"]`)?.setAttribute('aria-expanded',String(open));
    });
  }
  function toggleStatus(k){
    if(openStatus.has(k))openStatus.delete(k);else openStatus.add(k);
    state.settings.statusOpen=[...openStatus];
    C.saveState(state);
    applyStatus();
  }
  function renderStatus(){
    const gs=C.groupSummaries(state);
    $('stGroupSum').textContent=gs.length?`${gs.length}건 · 진행 ${gs.reduce((n,g)=>n+g.stepsDone,0)}/${gs.reduce((n,g)=>n+g.stepsTotal,0)}`:'없음';
    $('stGroupFace').innerHTML=gs.length?gs.slice(0,2).map(g=>{
      const pct=g.stepsTotal?Math.round(g.stepsDone/g.stepsTotal*100):0;
      const period=g.group.startDate?spanText({date:g.group.startDate,endDate:g.group.endDate}):'기간 미정';
      return `<div class="st-row"><div class="l1"><b>${C.esc(g.group.name)}</b><span>${C.esc(period)} · ${C.esc(L.groupVendors(g.vendorCount))}</span></div>
        <div class="st-meter"><span class="track"><i style="width:${pct}%;background:#7a4dbe"></i></span><span class="n">${g.stepsDone} / ${g.stepsTotal}${g.overdueCount?` · <b style="color:var(--danger)">${L.boardOverdue} ${g.overdueCount}</b>`:''}</span></div></div>`;
    }).join(''):`<div class="empty" style="padding:8px">${L.groupEmpty}</div>`;
    const t=C.budgetSummary(state).total;
    $('stBudgetSum').textContent=t.amount?`${L.budgetRemain} ${C.formatMoney(t.remain)}원`:'미등록';
    $('stBudgetFace').innerHTML=t.amount||t.spent||t.planned
      ?`<div class="st-row"><div class="l1"><b>${C.esc(L.budgetTotal)} ${won(t.amount)}</b><span class="${t.remain<0?'neg':''}">${C.esc(t.remain<0?L.budgetOver:L.budgetRemain)} ${won(Math.abs(t.remain))}</span></div>
         <div class="st-meter"><span class="track">${budgetBarInner(t)}</span><span class="n">${C.esc(L.budgetSpent)} ${won(t.spent)} · ${C.esc(L.budgetPlanned)} ${won(t.planned)}</span></div></div>`
      :`<div class="empty" style="padding:8px">${L.budgetEmpty}</div>`;
  }
  const budgetBarInner=r=>`<i style="width:${r.spentRate}%;background:var(--done)"></i><i style="width:${r.plannedRate}%;background:${r.over?'var(--danger)':'var(--accent)'}"></i>`;
  function boardItemRow(it){
    const dday=it.completed?'완료':(it.date?C.ddayLabel(it):L.boardNoDate);
    const cls=it.completed?'done':(it.date?C.ddayClass(it):'undated');
    const sub=[it.stepName,it.projectName,it.date?spanText(it):null].filter(Boolean).join(' · ');
    const body=`<span class="bi-main"><span class="bi-name">${C.esc(it.name)}</span>${sub?`<span class="bi-sub">${C.esc(sub)}</span>`:''}</span>`
      +`${it.stepsTotal?`<span class="bi-steps">${it.stepsDone}/${it.stepsTotal}</span>`:''}`
      +`<span class="bi-dday ${cls}">${C.esc(dday)}</span>`;
    // 날짜가 없으면 열 상세가 없다. 버튼처럼 보이게 해 놓고 아무 일도 안 일어나면 그게 더 나쁘다.
    return it.record
      ? `<button class="board-item ${cls}" data-due-kind="${it.record.kind}" data-due-id="${it.record.id}">${body}</button>`
      : `<div class="board-item flat ${cls}">${body}</div>`;
  }
  function renderBoard(){
    const rows=C.vendorSummaries(state),host=$('vendorBoard');
    if(!rows.length){const blank=!state.projects.length&&!state.manualEvents.length;host.innerHTML=`<div class="empty">${blank?L.emptyBlank:L.boardEmpty}</div>`;return}
    host.innerHTML=rows.map(b=>{
      const open=expandedVendors.has(b.vendorId||'');
      const pct=b.stepsTotal?Math.round(b.stepsDone/b.stepsTotal*100):0;
      const info=(state.vendorFields||[]).map(f=>(b.vendor?.values||{})[f.id]||'').filter(Boolean).join(' · ');
      const next=b.next;
      return `<section class="board-row${open?' open':''}" data-vendor="${C.esc(b.vendorId||'')}">
        <button class="board-head" aria-expanded="${open}">
          <span class="bh-id"><span class="bh-name">${C.esc(b.vendor?.name||L.noVendor)}</span>${info?`<span class="bh-info">${C.esc(info)}</span>`:''}</span>
          <span class="bh-stat"><span class="bh-counts">${C.esc(L.boardOpen)} <b>${b.openCount}</b> · ${C.esc(L.boardDone)} <b>${b.doneCount}</b>${b.overdueCount?` <span class="bh-late">${C.esc(L.boardOverdue)} ${b.overdueCount}</span>`:''}${(b.spent||b.planned)?` <span class="bh-money">${C.esc(L.vendorSpendLine(C.formatMoney(b.spent+b.planned)))}</span>`:''}</span><span class="bh-bar" role="img" aria-label="${C.esc(L.boardProgress)} ${pct}%"><i style="width:${pct}%"></i></span></span>
          <span class="bh-next">${next?`<span class="bn-name">${C.esc(next.name)}</span><span class="bn-date">${spanText(next)}</span>`:`<span class="bn-name muted">${C.esc(L.boardEmpty)}</span>`}</span>
          <span class="bh-dday ${next?C.ddayClass(next):'undated'}">${next?C.ddayLabel(next):'—'}</span>
        </button>
        <div class="board-items">${b.items.map(boardItemRow).join('')}</div>
      </section>`;
    }).join('');
    qa('.board-head',host).forEach(h=>h.addEventListener('click',()=>{
      const key=h.closest('.board-row').dataset.vendor;
      if(expandedVendors.has(key))expandedVendors.delete(key);else expandedVendors.add(key);
      renderBoard();
    }));
    // 클릭하면 지금 쓰던 상세 모달이 그대로 열린다. 새 조작 방식을 만들지 않는다.
    qa('.board-item[data-due-id]',host).forEach(b=>b.addEventListener('click',()=>openRecord(b.dataset.dueKind,b.dataset.dueId)));
  }
  // 기간 일정은 시작~종료 모든 날짜 칸에 선다. 월 그리드가 날짜 칸 단위라 진짜 하나로
  // 이어진 막대는 아니다. 모서리 처리와 톤으로 이어짐을 표현하고, 클릭 대상은 매일 살려 둔다.
  function edgeClass(r,ds){
    if(!C.isPeriod(r))return '';
    return ['period',r.date===ds?'start':'',C.endOf(r)===ds?'end':'',r.date!==ds?'cont':''].filter(Boolean).join(' ');
  }
  // 날짜 문구는 한 곳에서 만든다. 기간이면 시작~종료, 아니면 지금까지와 같다.
  const spanText=r=>C.isPeriod(r)?`${C.pretty(r.date)} ~ ${C.pretty(r.endDate)}`:C.pretty(r.date);
  // ── 예산 ─────────────────────────────────────────────────────────────────
  // 합본예산서와 집행 현황이 앱 밖에 있어, "이 행사에 얼마 썼나"를 답하려면 다른 파일을
  // 열어야 했다. 업체별 보드에서 만든 아코디언 조작 언어를 그대로 쓴다 — 줄을 누르면
  // 펼쳐지고, 맨 아래 줄을 누르면 편집이 열린다. 새로 배울 게 없다.
  const won=n=>`${C.formatMoney(n)}원`;
  function budgetBar(r){
    // 기지출 초록(집행 완료) · 지출예정 파랑(예정) · 잔액 회색 · 초과 빨강. 새 색을 만들지 않는다.
    return `<span class="bg-bar${r.over?' over':''}" role="img" aria-label="${C.esc(L.budgetSpent)} ${won(r.spent)}, ${C.esc(L.budgetPlanned)} ${won(r.planned)}"><i class="s" style="width:${r.spentRate}%"></i><i class="p" style="width:${r.plannedRate}%"></i></span>`;
  }
  function budgetFigures(r){
    return `<span class="bg-figs"><span class="fig s"><em>${C.esc(L.budgetSpent)}</em><b>${won(r.spent)}</b></span>`
      +`<span class="fig p"><em>${C.esc(L.budgetPlanned)}</em><b>${won(r.planned)}</b></span>`
      +`<span class="fig r${r.remain<0?' neg':''}"><em>${C.esc(r.remain<0?L.budgetOver:L.budgetRemain)}</em><b>${won(Math.abs(r.remain))}</b></span></span>`;
  }
  function spendRows(g){
    return g.vendors.map(v=>`<div class="bg-vendor"><div class="bv-head"><span class="bv-name">${C.esc(v.vendor?.name||L.noVendor)}</span><span class="bv-total">${won(v.total)}</span></div>`
      +v.spends.map(sp=>`<button class="bg-spend" data-spend="${C.esc(sp.id)}"><span class="bs-name">${C.esc(sp.name)}</span><span class="bs-date">${sp.date?C.pretty(sp.date):''}</span><span class="bs-status ${sp.status==='spent'?'spent':'planned'}">${C.esc(sp.status==='spent'?L.statusSpent:L.statusPlanned)}</span><span class="bs-amount">${won(sp.amount)}</span></button>`).join('')
      +`</div>`).join('');
  }
  function budgetGroups(key,projects){
    return projects.map(g=>{
      const pk=`${key}:${g.projectId||''}`,open=expandedProjects.has(pk);
      return `<div class="bg-project${open?' open':''}" data-bgproject="${C.esc(pk)}">
        <button class="bp-head"><span class="bp-name">${C.esc(g.project?.name||L.noProjectGroup)}</span><span class="bp-figs"><span>${C.esc(L.budgetSpent)} ${won(g.spent)}</span><span>${C.esc(L.budgetPlanned)} ${won(g.planned)}</span></span><span class="bp-total">${won(g.total)}</span></button>
        <div class="bp-body">${spendRows(g)}</div></div>`;
    }).join('');
  }
  // ── 행사별 ───────────────────────────────────────────────────────────────
  // project.vendorId 가 업체 한 곳이라 '한 행사에 업체 10곳'을 담을 수 없었다.
  // 업무는 그대로 '업체 × 행사' 참여 건으로 두고 그 위에 행사를 얹었다.
  let expandedGroups=new Set();
  function renderGroupBoard(){
    const rows=C.groupSummaries(state),host=$('groupBoard');
    if(!rows.length){host.innerHTML=`<div class="empty">${L.groupEmpty}</div>`;return}
    host.innerHTML=rows.map(g=>{
      const open=expandedGroups.has(g.group.id);
      const pct=g.stepsTotal?Math.round(g.stepsDone/g.stepsTotal*100):0;
      const period=g.group.startDate?spanText({date:g.group.startDate,endDate:g.group.endDate}):'기간 미정';
      const money=(g.spent||g.planned)?`<span class="bh-money">${C.esc(L.vendorSpendLine(C.formatMoney(g.spent+g.planned)))}</span>`:'';
      return `<section class="board-row${open?' open':''}" data-group="${C.esc(g.group.id)}">
        <button class="board-head" aria-expanded="${open}">
          <span class="bh-id"><span class="bh-name">${C.esc(g.group.name)}</span><span class="bh-info">${C.esc(period)}</span></span>
          <span class="bh-stat"><span class="bh-counts">${C.esc(L.groupVendors(g.vendorCount))} · ${C.esc(L.boardDone)} <b>${g.doneCount}</b>${g.overdueCount?` <span class="bh-late">${C.esc(L.boardOverdue)} ${g.overdueCount}</span>`:''}${money}</span><span class="bh-bar" role="img" aria-label="${C.esc(L.boardProgress)} ${pct}%"><i style="width:${pct}%"></i></span></span>
          <span class="bh-next">${g.next?`<span class="bn-name">${C.esc(g.next.name)}</span><span class="bn-date">${spanText(g.next)}</span>`:`<span class="bn-name muted">${C.esc(L.noUpcoming)}</span>`}</span>
          <span class="bh-dday ${g.next?C.ddayClass(g.next):'undated'}">${g.next?C.ddayLabel(g.next):'—'}</span>
        </button>
        <div class="board-items">
          ${g.members.map(m=>{
            const cls=m.completed?'done':(m.date?C.ddayClass({date:m.date}):'undated');
            const sub=[m.stepName,m.startDate?spanText({date:m.startDate,endDate:m.endDate}):null].filter(Boolean).join(' · ');
            const body=`<span class="bi-main"><span class="bi-name">${C.esc(m.vendor?.name||L.noVendor)}</span>${sub?`<span class="bi-sub">${C.esc(sub)}</span>`:''}</span>`
              +`${m.stepsTotal?`<span class="bi-steps">${m.stepsDone}/${m.stepsTotal}</span>`:''}`
              +`<span class="bi-dday ${cls}">${C.esc(m.completed?'완료':(m.date?C.ddayLabel({date:m.date}):L.boardNoDate))}</span>`;
            return m.record
              ? `<button class="board-item ${cls}" data-due-kind="${m.record.kind}" data-due-id="${m.record.id}">${body}</button>`
              : `<div class="board-item flat ${cls}">${body}</div>`;
          }).join('')}
          <button class="board-item add" data-group-add="${C.esc(g.group.id)}">${C.esc(L.addGroupMember)}</button>
        </div>
      </section>`;
    }).join('');
    qa('.board-head',host).forEach(h=>h.addEventListener('click',()=>{
      const k=h.closest('.board-row').dataset.group;
      if(expandedGroups.has(k))expandedGroups.delete(k);else expandedGroups.add(k);
      renderGroupBoard();
    }));
    qa('.board-item[data-due-id]',host).forEach(b=>b.addEventListener('click',()=>openRecord(b.dataset.dueKind,b.dataset.dueId)));
    // 행사가 이미 있는데 업체 한 곳이 더 들어오는 경우. 여기서 바로 붙인다.
    qa('[data-group-add]',host).forEach(b=>b.addEventListener('click',()=>openWork({groupId:b.dataset.groupAdd})));
  }
  // 상세에서 바로 지출을 적을 수 있어야 한다. 계약·준공 단계에서 예산 화면을 따로
  // 찾아가야 한다면 그것도 또 하나의 일이다.
  // 공통 일정에서 갈라져 나온 건임을 알려 준다. 묶여 있지는 않다 — 여기서 고쳐도 나머지는 그대로다.
  function batchNote(rec){
    const b=rec.kind==='manual'&&state.manualEvents.find(x=>x.id===rec.id)?.batchId;
    if(!b)return '';
    const n=state.manualEvents.filter(x=>x.batchId===b).length;
    return n>1?` <span class="batch-note">${C.esc(`함께 만든 ${state.terms.vendor} ${n}곳 중 이 건`)}</span>`:'';
  }
  function spendSection(rec){
    const list=C.spendsOfRecord(state,rec.kind,rec.id);
    const total=list.reduce((n,sp)=>n+Number(sp.amount||0),0);
    return `<section class="worklog-section"><div class="section-headline"><div><b>${C.esc(L.detailSpendTitle)}</b><span>${C.esc(L.detailSpendSub)}</span></div><button class="btn" id="detailAddSpend">${C.esc(L.addSpendHere)}</button></div>`
      +(list.length
        ?`<div class="bg-vendor" style="margin-top:8px">${list.map(sp=>`<button class="bg-spend" data-spend="${C.esc(sp.id)}"><span class="bs-name">${C.esc(sp.name)}</span><span class="bs-date">${sp.date?C.pretty(sp.date):''}</span><span class="bs-status ${sp.status==='spent'?'spent':'planned'}">${C.esc(sp.status==='spent'?L.statusSpent:L.statusPlanned)}</span><span class="bs-amount">${won(sp.amount)}</span></button>`).join('')}<div class="bv-head" style="padding-top:6px"><span>합계</span><span class="bv-total">${won(total)}</span></div></div>`
        :`<div class="empty">${C.esc(L.budgetEmptyItem)}</div>`)
      +`</section>`;
  }
  // 상세를 열어 둔 채 지출을 적었으면 그 자리에서 바로 보여야 한다.
  // persist -> render 는 상세 본문까지 다시 그리지는 않는다.
  function refreshOpenDetail(){
    if(!selectedRecord||!$('detailModal').classList.contains('show'))return;
    openRecord(selectedRecord.kind,selectedRecord.id);
  }
  function renderBudget(){
    const sum=C.budgetSummary(state),host=$('budgetBoard'),t=sum.total;
    const strip=`<div class="bg-summary">
      <div class="bg-total"><span class="bt-k">${C.esc(L.budgetTotal)}</span><span class="bt-v">${won(t.amount)}</span></div>
      ${budgetFigures(t)}${budgetBar(t)}
      <div class="bg-actions"><button class="btn" id="editBudgetBtn">${C.esc(L.editBudget)}</button><button class="btn primary" id="addSpendBtn">${C.esc(L.addSpend)}</button></div>
      ${state.budget.title||state.budget.year?`<div class="bg-title">${C.esc([state.budget.title,String(state.budget.year||'')].filter(x=>x&&!String(state.budget.title).includes(x)||x===state.budget.title).join(' · '))}</div>`:''}
    </div>`;
    const row=(key,name,r,projects,extra='')=>{
      const open=expandedItems.has(key);
      return `<section class="bg-row${open?' open':''}" data-bgitem="${C.esc(key)}">
        <button class="bg-head" aria-expanded="${open}">
          <span class="bg-id"><span class="bg-name">${C.esc(name)}</span>${extra?`<span class="bg-code">${C.esc(extra)}</span>`:''}</span>
          <span class="bg-amount">${won(r.amount??r.total)}</span>
          <span class="bg-mid">${budgetBar(r)}</span>
          ${budgetFigures(r)}
        </button>
        <div class="bg-body">${projects.length?budgetGroups(key,projects):`<div class="empty">${C.esc(L.budgetEmptyItem)}</div>`}</div>
      </section>`;
    };
    const items=sum.items.map(r=>row(r.item.id,r.item.name,r,r.projects,r.item.code||'')).join('');
    // 예산항목에 붙지 않은 지출을 숨기면 총계가 거짓말이 된다. 맨 아래 묶음으로 세운다.
    const un=sum.unassigned?row('__un__',L.unassignedItem,{...sum.unassigned,amount:sum.unassigned.total,remain:0,spentRate:sum.unassigned.total?sum.unassigned.spent/sum.unassigned.total*100:0,plannedRate:sum.unassigned.total?sum.unassigned.planned/sum.unassigned.total*100:0,over:false},sum.unassigned.projects):'';
    host.innerHTML=strip+(sum.items.length||un?`<div class="bg-list">${items}${un}</div>`:`<div class="empty">${L.budgetEmpty}</div>`);
    q('#editBudgetBtn',host)?.addEventListener('click',openBudget);
    q('#addSpendBtn',host)?.addEventListener('click',()=>openSpend(null));
    qa('.bg-head',host).forEach(h=>h.addEventListener('click',()=>{
      const k=h.closest('.bg-row').dataset.bgitem;
      if(expandedItems.has(k))expandedItems.delete(k);else expandedItems.add(k);
      renderBudget();
    }));
    qa('.bp-head',host).forEach(h=>h.addEventListener('click',()=>{
      const k=h.closest('.bg-project').dataset.bgproject;
      if(expandedProjects.has(k))expandedProjects.delete(k);else expandedProjects.add(k);
      renderBudget();
    }));
    qa('[data-spend]',host).forEach(b=>b.addEventListener('click',()=>openSpend(b.dataset.spend)));
  }

  // ── 합본예산서 ────────────────────────────────────────────────────────────
  let budgetDraft=[];
  const blankBudgetRow=()=>({id:C.uid('bi'),code:'',name:'',amount:''});
  function renderBudgetItems(){
    const host=$('budgetItems');
    host.innerHTML=budgetDraft.map((it,i)=>`<div class="ev-row bi-row"><input data-bi-code="${i}" value="${C.esc(it.code||'')}" placeholder="${C.esc(L.budgetCode)}" autocomplete="off"><input data-bi-name="${i}" value="${C.esc(it.name||'')}" placeholder="${C.esc(L.budgetItemName)}" autocomplete="off"><input data-bi-amount="${i}" type="number" min="0" step="1000" value="${C.esc(String(it.amount??''))}" placeholder="${C.esc(L.budgetAmount)}"><button type="button" class="remove" data-bi-remove="${i}">삭제</button></div>`).join('');
    qa('[data-bi-code]',host).forEach(el=>el.addEventListener('input',()=>budgetDraft[+el.dataset.biCode].code=el.value));
    qa('[data-bi-name]',host).forEach(el=>el.addEventListener('input',()=>budgetDraft[+el.dataset.biName].name=el.value));
    qa('[data-bi-amount]',host).forEach(el=>el.addEventListener('input',()=>budgetDraft[+el.dataset.biAmount].amount=el.value));
    qa('[data-bi-remove]',host).forEach(b=>b.addEventListener('click',()=>{
      const i=+b.dataset.biRemove,it=budgetDraft[i];
      const used=(state.spends||[]).filter(sp=>sp.itemId===it.id).length;
      if(used&&!confirm(`'${it.name||L.budgetItemName}' 에 걸린 ${L.detailSpendTitle} ${used}건이 ${L.unassignedItem} 으로 남습니다.\n삭제할까요?`))return;
      budgetDraft.splice(i,1);if(!budgetDraft.length)budgetDraft.push(blankBudgetRow());renderBudgetItems();
    }));
  }
  async function openBudget(){
    if(await popOut('budget',{}))return;
    budgetDraft=(state.budget.items||[]).map(it=>({...it}));
    if(!budgetDraft.length)budgetDraft.push(blankBudgetRow());
    $('bTitle').value=state.budget.title||'';
    $('bYear').value=state.budget.year||'';
    $('bAddItem').textContent=L.addBudgetItem;
    $('budgetItemsHead').innerHTML=`<span>${C.esc(L.budgetCode)}</span><span>${C.esc(L.budgetItemName)}</span><span>${C.esc(L.budgetAmount)}</span><span></span>`;
    $('budgetItemsHint').textContent=`${L.budgetItemName}과 예산액만 있으면 됩니다. 코드는 비워도 됩니다.`;
    renderBudgetItems();show('budgetModal');
  }
  async function saveBudget(){
    const rows=budgetDraft.filter(it=>String(it.name||'').trim());
    // 감액은 실제로 일어난다. 막지 않고 알린 뒤 사용자가 정하게 한다.
    const sum=C.budgetSummary(state);
    const shrink=rows.filter(it=>{
      const cur=sum.items.find(r=>r.item.id===it.id);
      return cur&&Number(it.amount||0)<cur.spent+cur.planned;
    }).length;
    if(shrink&&!confirm(L.budgetShrinkWarn(shrink)))return;
    state.budget.title=$('bTitle').value.trim();
    state.budget.year=$('bYear').value?Number($('bYear').value):null;
    state.budget.items=rows.map(it=>({id:it.id,code:String(it.code||'').trim(),name:it.name.trim(),amount:Number(it.amount||0)}));
    hide('budgetModal');await persist(L.savedBudget);
  }

  // ── 지출 ─────────────────────────────────────────────────────────────────
  let editingSpendId=null;
  async function openSpend(id,preset={}){
    if(await popOut('spend',{id:id||null,preset}))return;
    editingSpendId=id;
    const sp=id?(state.spends||[]).find(x=>x.id===id):null;
    const src={...(sp||{itemId:'',projectId:null,vendorId:null,name:'',amount:'',status:'spent',date:C.todayISO(),memo:''}),...(sp?{}:preset)};
    $('spItem').innerHTML=`<option value="">${C.esc(L.unassignedItem)}</option>`+(state.budget.items||[]).map(it=>`<option value="${C.esc(it.id)}">${C.esc(it.code?`${it.code} · ${it.name}`:it.name)}</option>`).join('');
    $('spProject').innerHTML=`<option value="">${C.esc(L.noProjectGroup)}</option>`+state.projects.map(p=>`<option value="${C.esc(p.id)}">${C.esc(p.name)}</option>`).join('');
    $('spVendor').innerHTML=`<option value="">${C.esc(L.noVendor)}</option>`+state.vendorTemplates.map(v=>`<option value="${C.esc(v.id)}">${C.esc(v.name)}</option>`).join('');
    $('spStatus').innerHTML=`<option value="spent">${C.esc(L.statusSpent)}</option><option value="planned">${C.esc(L.statusPlanned)}</option>`;
    $('spItem').value=src.itemId||'';$('spProject').value=src.projectId||'';$('spVendor').value=src.vendorId||'';
    $('spName').value=src.name||'';$('spAmount').value=src.amount===''?'':String(src.amount);
    $('spStatus').value=src.status||'spent';$('spDate').value=src.date||C.todayISO();$('spMemo').value=src.memo||'';
    $('deleteSpendBtn').classList.toggle('hidden',!id);
    $('spendModal').dataset.preset=JSON.stringify(sp?{}:preset);
    show('spendModal');setTimeout(()=>$('spName').focus(),0);
  }
  async function saveSpend(){
    const name=$('spName').value.trim(),amount=Number($('spAmount').value||0);
    if(!name||!amount){toast(L.needSpendFields);return}
    const preset=JSON.parse($('spendModal').dataset.preset||'{}');
    const row={
      itemId:$('spItem').value||null,projectId:$('spProject').value||null,vendorId:$('spVendor').value||null,
      name,amount,status:$('spStatus').value==='planned'?'planned':'spent',
      date:$('spDate').value||C.todayISO(),memo:$('spMemo').value.trim(),
      recordKind:preset.recordKind||null,recordId:preset.recordId||null,
    };
    if(editingSpendId){
      const i=(state.spends||[]).findIndex(x=>x.id===editingSpendId);
      if(i>=0)state.spends[i]={...state.spends[i],...row};
    }else{
      state.spends.push({id:C.uid('sp'),...row});
    }
    hide('spendModal');await persist(L.savedSpend);
    refreshOpenDetail();
  }
  async function deleteSpend(){
    if(!editingSpendId)return;
    const id=editingSpendId;
    hide('spendModal');
    await withUndo(L.deletedSpend,()=>{state.spends=(state.spends||[]).filter(x=>x.id!==id)});
    refreshOpenDetail();
  }
  function allEventRecords(){return C.eventRecords(state)}
  function renderCalendar(){const y=currentMonth.getFullYear(),m=currentMonth.getMonth();$('monthTitle').textContent=`${y}년 ${m+1}월`;$('monthGrid').innerHTML='';const first=new Date(y,m,1),before=first.getDay(),days=new Date(y,m+1,0).getDate(),cells=Math.ceil((before+days)/7)*7,events=allEventRecords(),bands=C.projectBands(state);for(let i=0;i<cells;i++){const d=new Date(y,m,1-before+i),ds=C.iso(d),inMonth=d.getMonth()===m,isToday=ds===C.todayISO(),rows=events.filter(e=>C.spansDay(e,ds)).sort((a,b)=>Number(a.completed)-Number(b.completed)),dayBands=bands.filter(b=>C.spansDay(b,ds));const cell=document.createElement('div');cell.className=`day ${inMonth?'':'out'} ${d.getDay()===0?'weekend':''} ${isToday?'today':''}`;cell.dataset.date=ds;cell.innerHTML=`<div class="day-head"><span class="day-num">${d.getDate()}</span>${isToday?'<span class="today-label">TODAY</span>':''}</div>${dayBands.length?`<div class="day-bands">${dayBands.map(b=>`<span class="day-band ${edgeClass(b,ds)}" title="${C.esc(b.name)} · ${spanText(b)}${b.count?` · ${C.esc(L.groupVendors(b.count))}`:''}">${b.date===ds||d.getDay()===0?C.esc(b.name)+(b.count?` (${b.count})`:''):''}</span>`).join('')}</div>`:''}<div class="events">${rows.map(r=>{const v=C.vendor(state,r.vendorId);return `<button class="event ${r.completed?'done':''} ${r.kind==='manual'?'manual':''} ${!r.completed?C.ddayClass(r):''} ${edgeClass(r,ds)}"${r.completed?'':' draggable="true"'} data-event-kind="${r.kind}" data-event-id="${r.id}" title="${C.esc(v?.name||'')} · ${C.esc(r.name)} · ${spanText(r)}">${r.completed?'✓ ':''}${C.esc(v?.name||L.noVendor)} · ${C.esc(r.name)}${C.isPeriod(r)&&r.date===ds?` (${C.periodDays(r)}일)`:''}</button>`}).join('')}</div>${inMonth?`<span class="add-hint">+ ${C.esc(state.terms.event)}</span>`:''}`;
    if(inMonth){
      // 시트는 바탕화면이다. 한 번 클릭으로 모달이 튀면 바탕화면을 잘못 건드릴 때마다 창이 뜬다.
      // DesktopCal 관례대로 빈 날짜는 두 번 클릭으로 연다.
      cell.addEventListener('dblclick',e=>{if(e.target.closest('[data-event-id]'))return;openSchedule(ds)});
      cell.addEventListener('dragover',e=>{e.preventDefault();cell.classList.add('drop-ok')});
      cell.addEventListener('dragleave',()=>cell.classList.remove('drop-ok'));
      cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('drop-ok');
        const [kind,id]=String(e.dataTransfer.getData('text/plain')||'').split('|');
        if(kind&&id)moveRecordTo(kind,id,ds);});
    }
    $('monthGrid').appendChild(cell)}
    qa('[data-event-id]',$('monthGrid')).forEach(b=>{
      b.addEventListener('click',e=>{e.stopPropagation();openRecord(b.dataset.eventKind,b.dataset.eventId)});
      if(b.getAttribute('draggable')==='true'){
        b.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',`${b.dataset.eventKind}|${b.dataset.eventId}`);e.dataTransfer.effectAllowed='move';b.classList.add('dragging')});
        b.addEventListener('dragend',()=>b.classList.remove('dragging'));
      }
    })}
  // 끌어서 날짜 이동. 기간 건은 길이를 지킨 채 통으로 움직이고, 완료 건은 애초에 끌리지 않는다.
  async function moveRecordTo(kind,id,ds){
    const r=findRecord(kind,id);
    if(!r||r.completed||!ds||r.date===ds)return;
    await withUndo(L.changedDate,()=>{
      if(kind==='manual'){
        const m=state.manualEvents.find(x=>x.id===id);if(!m)return;
        const len=C.isPeriod(m)?C.diffDays(m.endDate,m.date):0;
        m.date=ds;m.endDate=len?C.addDays(ds,len):null;
      }else{
        const p=C.project(state,r.projectId),s=p?.steps.find(x=>x.id===id);if(s)s.dueDate=ds;
      }
    });
  }
  // option 을 다시 그릴 때 고르고 있던 값을 지킨다. 지키지 않으면 방금 만든 업체가 사라진다.
  function setOptions(el,html){const keep=el.value;el.innerHTML=html;if(keep&&[...el.options].some(o=>o.value===keep))el.value=keep}
  function fillSelects(){
    const vendorOpts=state.vendorTemplates.map(v=>`<option value="${v.id}">${C.esc(v.name)}</option>`).join('');
    setOptions($('sVendor'),vendorOpts);
    setOptions($('wVendor'),vendorOpts);
    setOptions($('wTemplate'),`<option value="">${C.esc(L.optNoTemplate)}</option>`+state.workTemplates.map(t=>`<option value="${t.id}">${C.esc(t.name)}</option>`).join(''));
    setOptions($('wGroup'),`<option value="">${C.esc(L.noGroup)}</option>`+(state.groups||[]).map(g=>`<option value="${g.id}">${C.esc(g.name)}</option>`).join(''));
    updateProjectSelect();
  }
  // 업체를 목록에서 못 찾으면 그 자리에서 만든다. 모달 안에서 또 모달을 띄우지 않는다.
  // 이름만 받고 담당자·연락처 같은 항목은 나중에 상세나 템플릿에서 채운다.
  // 행사도 목록에 없으면 그 자리에서 만든다. 기간은 업무 모달의 참여기간 칸에서 받는다.
  async function createGroup(name){
    const nm=String(name||'').trim();if(!nm)return null;
    const id=C.uid('g');
    state.groups.push({id,name:nm,startDate:null,endDate:null,memo:''});
    await C.saveState(state);
    fillSelects();
    toast(L.createdGroup(nm));
    return id;
  }
  async function createVendor(name){
    const nm=String(name||'').trim();if(!nm)return null;
    const id=C.uid('v');
    state.vendorTemplates.push({id,name:nm,values:{}});
    await C.saveState(state);
    fillSelects();
    toast(L.createdVendor(nm));
    return id;
  }
  function updateProjectSelect(){
    const ids=new Set(pickedVendors.length?pickedVendors.map(v=>v.id):[$('sVendor').value]);
    const rows=state.projects.filter(p=>ids.has(p.vendorId));
    // 같은 행사의 참여 건이 여럿이면 이름이 겹친다. 업체명을 붙여 구분한다.
    const seen=new Map();rows.forEach(p=>seen.set(p.name,(seen.get(p.name)||0)+1));
    setOptions($('sProject'),`<option value="">${C.esc(L.genericEvent)}</option>`
      +rows.map(p=>`<option value="${p.id}">${C.esc(seen.get(p.name)>1?`${p.name} · ${C.vendor(state,p.vendorId)?.name||''}`:p.name)}</option>`).join(''));
  }
  // ── 여러 업체에 같은 일정을, 업체별로 개별 조정 ──────────────────────────
  // '전 참여업체 서류제출 9/10' 을 업체 수만큼 되풀이 입력하고 있었다.
  // 한 번에 걸되 묶어서 잠그지는 않는다 — 한 달짜리 행사에 A·B 는 한 달 쭉,
  // C 는 2주만 참여할 수 있어야 한다. 저장하면 업체마다 별개의 일정이 생기고
  // 완료·기록·첨부·삭제가 전부 따로 된다.
  let pickedVendors=[];          // [{id, date, endDate}] — date/endDate 가 null 이면 공통값
  const commonRange=()=>({date:$('sDate').value,endDate:$('sEnd').value||null});
  function renderVendorPicks(){
    const chips=$('sVendorChips');
    chips.innerHTML=pickedVendors.map(v=>`<span class="chip">${C.esc(C.vendor(state,v.id)?.name||L.noVendor)}<button type="button" data-chip="${C.esc(v.id)}" aria-label="${C.esc(L.removeChip)}">×</button></span>`).join('');
    qa('[data-chip]',chips).forEach(b=>b.addEventListener('click',()=>{
      pickedVendors=pickedVendors.filter(v=>v.id!==b.dataset.chip);renderVendorPicks();
    }));
    // 업체가 둘 이상일 때만 개별 조정 줄을 낸다. 한 곳이면 예전과 똑같은 화면이다.
    const many=pickedVendors.length>1;
    $('sPerVendorBox').classList.toggle('hidden',!many);
    $('sPerVendorLabel').textContent=L.perVendorTitle(state.terms.vendor);
    $('sPerVendorNote').textContent=L.perVendorNote(state.terms.vendor,state.terms.event);
    $('sAddVendor').textContent=L.addAnotherVendor(state.terms.vendor);
    if(!many){$('sPerVendor').innerHTML='';return}
    const c=commonRange();
    $('sPerVendor').innerHTML=pickedVendors.map((v,i)=>{
      const custom=v.date!==null||v.endDate!==null;
      return `<div class="pv-row${custom?' custom':''}"><span class="pv-name">${C.esc(C.vendor(state,v.id)?.name||L.noVendor)}</span>`
        +`<input data-pv-start="${i}" type="date" value="${C.esc(v.date??c.date??'')}" aria-label="${C.esc(L.fStartDate)}">`
        +`<input data-pv-end="${i}" type="date" value="${C.esc(v.endDate??c.endDate??'')}" aria-label="${C.esc(L.fEndDate)}">`
        +`<button type="button" class="pv-reset" data-pv-reset="${i}"${custom?'':' disabled'}>${C.esc(custom?L.resetToCommon:L.sameAsCommon)}</button></div>`;
    }).join('');
    qa('[data-pv-start]',$('sPerVendor')).forEach(el=>el.addEventListener('input',()=>{pickedVendors[+el.dataset.pvStart].date=el.value||null;renderVendorPicks()}));
    qa('[data-pv-end]',$('sPerVendor')).forEach(el=>el.addEventListener('input',()=>{pickedVendors[+el.dataset.pvEnd].endDate=el.value||null;renderVendorPicks()}));
    qa('[data-pv-reset]',$('sPerVendor')).forEach(b=>b.addEventListener('click',()=>{
      const v=pickedVendors[+b.dataset.pvReset];v.date=null;v.endDate=null;renderVendorPicks();
    }));
  }
  function addPickedVendor(id){
    if(!id||pickedVendors.some(v=>v.id===id))return;
    pickedVendors.push({id,date:null,endDate:null});renderVendorPicks();
  }
  async function openSchedule(date=C.todayISO(),preset={}){
    if(await popOut('schedule',{date,...preset}))return;
    selectedRecord=null;$('scheduleTitle').textContent=L.eventModalTitle;
    $('sDate').value=date;$('sEnd').value='';fillSelects();$('sName').value=preset.name||'';$('sMemo').value='';
    pickedVendors=[];
    const first=state.vendorTemplates[0]?.id;
    if(first){$('sVendor').value=first;addPickedVendor(first)}else renderVendorPicks();
    show('scheduleModal');setTimeout(()=>$('sName').focus(),0);
  }
  async function saveSchedule(){
    const c=commonRange(),name=$('sName').value.trim(),memo=$('sMemo').value.trim();
    if(!pickedVendors.length&&$('sVendor').value)addPickedVendor($('sVendor').value);
    if(!c.date||!pickedVendors.length||!name){toast(L.needEventFields);return}
    const rows=pickedVendors.map(v=>({vendorId:v.id,date:v.date??c.date,endDate:v.endDate??c.endDate}));
    for(const r of rows)if(r.endDate&&r.endDate<r.date){toast(L.badEndDate);return}
    // 여럿이면 같은 batchId 를 달아 '공통 일정에서 온 건'임만 알린다. 묶어서 잠그지 않는다.
    const batchId=rows.length>1?C.uid('b'):null;
    const linked=$('sProject').value||null;
    rows.forEach(r=>{
      // 업체마다 그 행사의 자기 참여 건에 붙인다. 고른 업무가 그 업체 것이 아니면 찾아서 맞춘다.
      let projectId=linked;
      const lp=C.project(state,linked);
      if(lp&&lp.vendorId!==r.vendorId){
        const mine=lp.groupId?state.projects.find(p=>p.groupId===lp.groupId&&p.vendorId===r.vendorId):null;
        projectId=mine?mine.id:null;
      }
      state.manualEvents.push({id:C.uid('m'),vendorId:r.vendorId,projectId,date:r.date,endDate:r.endDate,
        name,memo,batchId,completed:false,completedAt:null,logs:[],attachments:[]});
    });
    hide('scheduleModal');
    await persist(rows.length>1?L.savedEventsFor(rows.length,state.terms.event):L.savedEvent);
  }
  // ── 업체·업무·일정 일괄 등록 ─────────────────────────────────────────────
  // 업체는 템플릿 화면, 업무는 여기, 일정은 또 다른 모달 — 새 업체 한 곳을 들이려면
  // 화면 세 곳을 오가야 했다. 실제 업무는 "업체가 새로 들어왔고 그 업체 일정이 여러 건"이
  // 한 덩어리다. 헤더에 버튼을 만들지 않고(§4.3) 이 모달 하나로 끝낸다.
  let bundleDraft=[];
  function renderBundleEvents(){
    const host=$('wEvents');
    host.innerHTML=bundleDraft.map((e,i)=>`<div class="ev-row"><input data-ev-name="${i}" value="${C.esc(e.name)}" placeholder="${C.esc(L.fEventName)}" autocomplete="off"><input data-ev-start="${i}" type="date" value="${C.esc(e.date||'')}" aria-label="${C.esc(L.fStartDate)}"><input data-ev-end="${i}" type="date" value="${C.esc(e.endDate||'')}" aria-label="${C.esc(L.fEndDate)}"><button type="button" class="remove" data-ev-remove="${i}">삭제</button></div>`).join('');
    qa('[data-ev-name]',host).forEach(el=>el.addEventListener('input',()=>bundleDraft[+el.dataset.evName].name=el.value));
    qa('[data-ev-start]',host).forEach(el=>el.addEventListener('input',()=>bundleDraft[+el.dataset.evStart].date=el.value));
    qa('[data-ev-end]',host).forEach(el=>el.addEventListener('input',()=>bundleDraft[+el.dataset.evEnd].endDate=el.value));
    qa('[data-ev-remove]',host).forEach(b=>b.addEventListener('click',()=>{bundleDraft.splice(+b.dataset.evRemove,1);if(!bundleDraft.length)bundleDraft.push(blankBundleRow());renderBundleEvents()}));
  }
  const blankBundleRow=()=>({name:'',date:C.todayISO(),endDate:''});
  function applyWorkMode(){
    // 템플릿을 고르지 않으면 업무를 만들지 않는다. 업체와 일정만 등록하는 길이다.
    const hasTpl=!!$('wTemplate').value;
    const inGroup=!!$('wGroup').value;
    $('wProjectBox').classList.toggle('hidden',!hasTpl&&!inGroup);
    $('wFirstDateBox').classList.toggle('hidden',!hasTpl);
    // 참여기간은 행사에 붙는 순간 필요하다. 템플릿 유무와 무관하다.
    $('wPeriodBox').classList.toggle('hidden',!hasTpl&&!inGroup);
  }
  async function openWork(preset={}){
    if(await popOut('work',preset))return;
    bundleDraft=[blankBundleRow()];
    $('wProject').value='';$('wFirstDate').value=C.todayISO();
    $('wStart').value='';$('wEnd').value='';$('wMemo').value='';
    fillSelects();
    $('wVendor').value=state.vendorTemplates[0]?.id||'';
    $('wTemplate').value=state.workTemplates[0]?.id||'';
    $('wGroup').value=preset.groupId||'';
    // 행사에서 들어왔으면 그 행사의 이름·기간이 기본값이 된다. 업체마다 줄일 수 있다.
    if(preset.groupId){
      const g=C.group(state,preset.groupId);
      if(g){$('wProject').value=g.name;$('wStart').value=g.startDate||'';$('wEnd').value=g.endDate||''}
    }
    $('wEventsLabel').textContent=L.bundleEvents;
    $('wEventsHint').textContent=L.bundleHint;
    $('wAddEvent').textContent=L.addBundleEvent;
    renderBundleEvents();applyWorkMode();show('workModal');
  }
  async function saveWork(){
    // 1) 업체 — 목록에서 고르거나 콤보박스에서 그 자리에 만든 것이 이미 들어와 있다
    const vendorId=$('wVendor').value;
    if(!vendorId){toast(L.needVendor);return}
    const vendorName=C.vendor(state,vendorId)?.name||'';
    // 2) 업무 — 템플릿을 골랐을 때만
    const template=state.workTemplates.find(t=>t.id===$('wTemplate').value);
    const rows=bundleDraft.filter(e=>e.name.trim()&&e.date);
    let project=null;
    if(template){
      const name=$('wProject').value.trim(),date=$('wFirstDate').value;
      if(!name||!date){toast(L.needProjectFields);return}
      const start=$('wStart').value||null,end=$('wEnd').value||null;
      if(start&&end&&end<start){toast(L.badEndDate);return}
      project=C.projectFromTemplate(template,vendorId,name,date,$('wMemo').value.trim());
      project.startDate=start;project.endDate=end;
      project.groupId=$('wGroup').value||null;
      // 행사 기간이 아직 비어 있으면 첫 참여 건의 기간으로 채운다. 캘린더 띠가 그려져야 한다.
      const g=C.group(state,project.groupId);
      if(g&&!g.startDate&&start){g.startDate=start;g.endDate=end||start}
    }else if($('wGroup').value){
      // 템플릿 없이 행사에만 붙이는 길. 절차가 없는 참여 건을 만든다.
      const g=C.group(state,$('wGroup').value);
      const start=$('wStart').value||g?.startDate||null,end=$('wEnd').value||g?.endDate||null;
      if(start&&end&&end<start){toast(L.badEndDate);return}
      project={id:C.uid('p'),vendorId,name:$('wProject').value.trim()||g?.name||'',memo:$('wMemo').value.trim(),
        templateId:null,groupId:g?.id||null,startDate:start,endDate:end,steps:[]};
      if(g&&!g.startDate&&start){g.startDate=start;g.endDate=end||start}
    }else if(!rows.length){
      // 업체는 콤보박스에서 이미 만들어졌다. 여기서 아무것도 안 넣으면 할 일이 없다.
      toast(L.needAnything);return;
    }
    for(const e of rows)if(e.endDate&&e.endDate<e.date){toast(L.badEndDate);return}
    if(project)state.projects.push(project);
    // 3) 일정 — 만든 업무에 자동으로 걸린다
    rows.forEach(e=>state.manualEvents.push({id:C.uid('m'),vendorId,projectId:project?project.id:null,
      date:e.date,endDate:e.endDate||null,name:e.name.trim(),memo:'',completed:false,completedAt:null,logs:[],attachments:[]}));
    hide('workModal');
    await persist(L.savedBundle(vendorName,!!project,rows.length));
  }
  function findRecord(kind,id){return allEventRecords().find(r=>r.kind===kind&&r.id===id)}
  function recordEntity(record){if(!record)return null;if(record.kind==='manual')return state.manualEvents.find(x=>x.id===record.id)||null;const p=C.project(state,record.projectId);return p?.steps?.find(x=>x.id===record.id)||null}
  function stepStatus(p,s){const current=C.currentStep(p);if(s.completed)return{key:'done',label:`완료${s.completedAt?` · ${C.pretty(s.completedAt)}`:''}`};if(current?.id===s.id)return{key:'current',label:`현재${s.dueDate?` · ${C.pretty(s.dueDate)}`:''}`};return{key:'future',label:s.dueDate?`예정 · ${C.pretty(s.dueDate)}`:'예정 · 날짜 미정'}}
  async function openRecord(kind,id){
    if(await popOut('detail',{kind,id}))return;
    selectedRecord=findRecord(kind,id);if(!selectedRecord)return;const v=C.vendor(state,selectedRecord.vendorId),p=C.project(state,selectedRecord.projectId),entity=recordEntity(selectedRecord);if(entity){entity.logs=Array.isArray(entity.logs)?entity.logs:[];entity.attachments=Array.isArray(entity.attachments)?entity.attachments:[]}
    $('detailTitle').textContent=L.detailTitle;$('deleteEventBtn').classList.toggle('hidden',kind!=='manual');$('completeBtn').classList.toggle('hidden',selectedRecord.completed);$('changeDateBtn').classList.toggle('hidden',selectedRecord.completed);$('reopenBtn').classList.toggle('hidden',!selectedRecord.completed);const steps=p?.steps||[];
    const logs=(entity?.logs||[]).slice().sort((a,b)=>String(b.time).localeCompare(String(a.time))),files=entity?.attachments||[];
    $('detailBody').innerHTML=`<div class="detail-hero"><div><div class="detail-vendor">${C.esc(v?.name||'업체')}</div><div class="detail-project">${C.esc(p?.name||L.genericEvent)}</div></div><div class="detail-dday ${selectedRecord.completed?'done':C.ddayClass(selectedRecord)}">${selectedRecord.completed?'완료':C.ddayLabel(selectedRecord)}</div></div>
    <div class="current-box"><div class="current-label">${C.esc(selectedRecord.kind==='manual'?state.terms.event:L.selectedStep)}${batchNote(selectedRecord)}</div><div class="current-title">${C.esc(selectedRecord.name)}</div><div class="current-date">${C.isPeriod(selectedRecord)?C.esc(L.periodSpan(C.pretty(selectedRecord.date),C.pretty(selectedRecord.endDate),C.periodDays(selectedRecord))):C.pretty(selectedRecord.date)}${selectedRecord.memo?` · ${C.esc(selectedRecord.memo)}`:''}</div></div>
    ${vendorInfoRow(v)}
    <section class="worklog-section"><div class="section-headline"><div><b>${C.esc(L.worklog)}</b><span>진행 경과, 통화·협의 내용, 전달사항을 계속 남길 수 있습니다.</span></div></div><div class="log-compose"><textarea id="workLogText" placeholder="예: 업체 담당자와 통화. 평가서 보완본을 8/14 오전까지 제출하기로 함."></textarea><button class="btn primary" id="addWorkLogBtn">기록 추가</button></div><div class="worklog-list">${logs.length?logs.map(l=>`<div class="worklog-item"><div class="worklog-time">${new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(l.time))}</div><div class="worklog-text">${C.esc(l.text)}</div><button class="tiny-link danger" data-delete-log="${l.id}">삭제</button></div>`).join(''):'<div class="section-empty">아직 기록이 없습니다.</div>'}</div></section>
    ${spendSection(selectedRecord)}
    <section class="attachment-section"><div class="section-headline"><div><b>첨부파일</b><span>이 일정과 관련된 문서·사진을 로컬에 보관합니다.</span></div><label class="btn file-btn" for="detailFiles">+ 파일 첨부</label><input id="detailFiles" type="file" multiple hidden></div><div class="attachment-list">${files.length?files.map(f=>`<div class="attachment-item"><span class="file-icon">↳</span><span class="attachment-main"><b>${C.esc(f.name)}</b><small>${C.formatBytes(f.size)}</small></span><button class="tiny-link" data-download-file="${f.id}">열기/저장</button><button class="tiny-link danger" data-delete-file="${f.id}">삭제</button></div>`).join(''):'<div class="section-empty">첨부된 파일이 없습니다.</div>'}</div><div class="attachment-note">첨부파일은 이 PC/브라우저의 로컬 저장소에 보관됩니다. 다른 PC로 옮길 때는 파일 백업 기능을 별도로 추가하는 것이 안전합니다.</div></section>
    ${p?`<div class="steps"><div class="steps-head"><div><div class="steps-title">${C.esc(L.allSteps)}</div><div class="steps-sub">완료된 단계와 아직 오지 않은 단계까지 모두 표시합니다.</div></div><button class="link" id="editProjectSteps">${C.esc(L.editSteps)}</button></div>${steps.map((s,i)=>{const st=stepStatus(p,s);return `<div class="step ${st.key}"><span class="step-mark">${s.completed?'✓':C.currentStep(p)?.id===s.id?'●':i+1}</span><span class="step-name">${C.esc(s.name)}</span><span class="step-status ${st.key}">${C.esc(st.label)}</span></div>`}).join('')}</div>`:''}`;
    show('detailModal');q('#editProjectSteps')?.addEventListener('click',()=>{hide('detailModal');openProjectSteps(p.id)});q('#addWorkLogBtn')?.addEventListener('click',addWorkLog);q('#workLogText')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();addWorkLog()}});q('#detailFiles')?.addEventListener('change',addAttachments);
    q('#detailAddSpend')?.addEventListener('click',()=>openSpend(null,{recordKind:selectedRecord.kind,recordId:selectedRecord.id,vendorId:selectedRecord.vendorId,projectId:selectedRecord.projectId,name:selectedRecord.name}));
    qa('[data-spend]',$('detailBody')).forEach(b=>b.addEventListener('click',()=>openSpend(b.dataset.spend)));qa('[data-delete-log]',$('detailBody')).forEach(b=>b.addEventListener('click',()=>deleteWorkLog(b.dataset.deleteLog)));qa('[data-download-file]',$('detailBody')).forEach(b=>b.addEventListener('click',()=>downloadAttachment(b.dataset.downloadFile)));qa('[data-delete-file]',$('detailBody')).forEach(b=>b.addEventListener('click',()=>deleteAttachment(b.dataset.deleteFile)))
  }
  async function refreshDetail(msg){const k=selectedRecord?.kind,id=selectedRecord?.id;await C.saveState(state);render();if(k&&id)openRecord(k,id);if(msg)toast(msg)}
  async function addWorkLog(){const entity=recordEntity(selectedRecord),text=q('#workLogText')?.value.trim();if(!entity||!text)return;entity.logs=Array.isArray(entity.logs)?entity.logs:[];entity.logs.push({id:C.uid('log'),time:new Date().toISOString(),text});await refreshDetail('업무 내용을 기록했습니다.')}
  async function deleteWorkLog(id){const entity=recordEntity(selectedRecord);if(!entity)return;entity.logs=(entity.logs||[]).filter(x=>x.id!==id);await refreshDetail('기록을 삭제했습니다.')}
  async function addAttachments(e){const entity=recordEntity(selectedRecord),files=[...(e.target.files||[])];if(!entity||!files.length)return;entity.attachments=Array.isArray(entity.attachments)?entity.attachments:[];let saved=0;for(const file of files){if(file.size>50*1024*1024){toast(`${file.name}: 50MB 이하 파일만 첨부할 수 있습니다.`);continue}try{const meta=await C.putAttachment(file,entity.id);entity.attachments.push(meta);saved++}catch(err){console.warn(err);toast('파일 저장을 지원하지 않는 환경입니다.')}}if(saved)await refreshDetail(`${saved}개 파일을 첨부했습니다.`)}
  function attachmentMeta(id){return (recordEntity(selectedRecord)?.attachments||[]).find(x=>x.id===id)||null}
  async function downloadAttachment(id){
    const meta=attachmentMeta(id);if(!meta)return;
    try{
      if(await C.revealAttachment(meta))return;            // 데스크톱: OS 기본 프로그램으로 연다
      const {bytes,name,type}=await C.readAttachment(meta); // 웹: 내려받는다
      const url=URL.createObjectURL(new Blob([bytes],{type:type||'application/octet-stream'})),a=document.createElement('a');
      a.href=url;a.download=name||'attachment';document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    }catch(e){
      // 실물이 없다고 메타데이터를 지우지 않는다 — 파괴적이지 않게 알리기만 한다(인수조건 D).
      console.warn(e);
      toast(String(e?.message)==='ATTACHMENT_MISSING'?`${meta.name}: 저장된 파일을 찾을 수 없습니다. 목록에서 지우려면 삭제를 누르세요.`:'파일을 열지 못했습니다.');
    }
  }
  async function deleteAttachment(id){
    const entity=recordEntity(selectedRecord),meta=attachmentMeta(id);if(!entity||!meta)return;
    await withUndo('첨부파일을 삭제했습니다.',
      ()=>{entity.attachments=(entity.attachments||[]).filter(x=>x.id!==id)},
      {purge:()=>C.deleteAttachment(meta)});
    refreshOpenDetail();
  }
  async function completeSelected(){if(!selectedRecord)return;const next=C.completeEvent(state,selectedRecord,C.todayISO());hide('detailModal');await persist(next?`완료 · 다음 일정 ${next.name} ${C.pretty(next.dueDate)}`:'완료 처리했습니다.')}
  // 날짜 변경은 네이티브 prompt() 대신 앱 안의 date 입력으로 받는다.
  function openDateModal(){if(!selectedRecord||selectedRecord.completed)return;
    $('dNewDate').value=selectedRecord.date;
    $('dNewEnd').value=selectedRecord.endDate||'';
    // 절차 단계는 마감일이다. 기간 칸을 열어 두면 의미가 흐려지므로 일정에서만 보인다.
    $('dNewEnd').closest('.field').classList.toggle('hidden',selectedRecord.kind!=='manual');
    $('dateModalNote').textContent=`${selectedRecord.name} · 현재 ${spanText(selectedRecord)}`;
    show('dateModal');setTimeout(()=>$('dNewDate').focus(),0)}
  async function saveSelectedDate(){const next=$('dNewDate').value,nextEnd=$('dNewEnd').value||null;if(!selectedRecord||!next){toast('날짜를 선택하세요.');return}
    if(selectedRecord.kind==='manual'&&nextEnd&&nextEnd<next){toast(L.badEndDate);return}
    if(selectedRecord.kind==='manual'){const m=state.manualEvents.find(x=>x.id===selectedRecord.id);if(m){m.date=next;m.endDate=nextEnd}}
    else{const p=C.project(state,selectedRecord.projectId),s=p?.steps.find(x=>x.id===selectedRecord.id);if(s)s.dueDate=next}
    hide('dateModal');hide('detailModal');await persist(L.changedDate)}
  // 완료 취소 — 잘못 누른 `OK 완료` 를 되돌리는 경로. 기록·첨부·완료일 외 데이터는 그대로 둔다.
  async function reopenSelected(){if(!selectedRecord||!selectedRecord.completed)return;
    // 이것 자체가 되돌리기다. 되돌리기에 확인창을 붙이면 되돌릴 마음이 사라진다.
    let kept=null;
    hide('detailModal');
    await withUndo('완료를 취소했습니다.',()=>{const r=C.reopenEvent(state,selectedRecord);kept=r?.kept||null});
    if(kept)toast(`다음 단계 ${kept.name}의 날짜(${C.pretty(kept.dueDate)})는 그대로 두었습니다.`);}
  async function deleteSelected(){if(!selectedRecord||selectedRecord.kind!=='manual')return;
    const id=selectedRecord.id,files=C.attachmentsOf([state.manualEvents.find(x=>x.id===id)]);
    hide('detailModal');
    // 메타데이터만 지우면 blob 이 영구히 남는다. 다만 되돌리기 창이 닫힌 뒤에 지운다.
    await withUndo(files.length?`${L.deletedEvent} (첨부 ${files.length}개 포함)`:L.deletedEvent,
      ()=>{state.manualEvents=state.manualEvents.filter(x=>x.id!==id)},
      {purge:()=>C.purgeAttachments(files)});}
  // 업체 정보는 사용자 정의 항목에서 그린다. 값이 있는 항목만 보여 상세를 어지럽히지 않는다.
  function vendorInfoRow(v){
    const rows=(state.vendorFields||[]).map(f=>({f,val:(v?.values||{})[f.id]||''})).filter(x=>x.val);
    if(!rows.length)return '';
    return `<div class="info-row">${rows.map(({f,val})=>`<div class="info"><span>${C.esc(f.label)}</span><b>${C.esc(val)}</b></div>`).join('')}</div>`;
  }
  const inputType=t=>t==='tel'?'tel':t==='email'?'email':'text';
  function vendorFieldInputs(v){
    return (state.vendorFields||[]).map(f=>{
      const val=C.esc((v?.values||{})[f.id]||'');
      const ctrl=f.type==='multiline'
        ?`<textarea data-vf="${C.esc(f.id)}">${val}</textarea>`
        :`<input data-vf="${C.esc(f.id)}" type="${inputType(f.type)}" value="${val}">`;
      return `<div class="field ${f.type==='multiline'?'full':''}"><label>${C.esc(f.label)}</label>${ctrl}</div>`;
    }).join('');
  }
  function renderTemplatePanes(){renderVendorTemplates();renderWorkTemplates();renderTermsPane()}

  // ── 용어·항목 ───────────────────────────────────────────────────────────
  // 발주서 §1 "도메인 규칙을 하드코딩하지 말 것". 화면에 쓰는 이름만 바꾸고 데이터는 건드리지 않는다.
  let vfDraft=[];
  const FIELD_TYPES=[['text','한 줄'],['tel','전화번호'],['email','이메일'],['multiline','여러 줄']];
  function currentTermsDraft(){
    const o={...state.terms};
    qa('[data-term]',$('termsPane')).forEach(el=>{const v=el.value.trim();if(v)o[el.dataset.term]=v});
    return o;
  }
  function updateTermsPreview(){
    const d=C.labels(currentTermsDraft());
    $('termsPreview').innerHTML=`<b>이렇게 보입니다</b>${[d.sideCaption,d.fLinkedNote,d.savedProject,d.emptyHorizon].map(x=>`<span>${C.esc(x)}</span>`).join('')}`;
  }
  function renderVendorFieldEditor(){
    const host=$('vfList');
    host.innerHTML=vfDraft.map((f,i)=>`<div class="proc-row"><div class="move"><button data-vfup="${i}" aria-label="위로">↑</button><button data-vfdown="${i}" aria-label="아래로">↓</button></div><input data-vflabel="${i}" value="${C.esc(f.label)}" aria-label="항목 이름"><select data-vftype="${i}" aria-label="항목 형식">${FIELD_TYPES.map(([v,t])=>`<option value="${v}"${f.type===v?' selected':''}>${t}</option>`).join('')}</select><button class="remove" data-vfremove="${i}">삭제</button></div>`).join('')||'<div class="section-empty">항목이 없습니다.</div>';
    qa('[data-vflabel]',host).forEach(el=>el.addEventListener('input',()=>{vfDraft[+el.dataset.vflabel].label=el.value}));
    qa('[data-vftype]',host).forEach(el=>el.addEventListener('change',()=>{vfDraft[+el.dataset.vftype].type=el.value}));
    qa('[data-vfremove]',host).forEach(b=>b.addEventListener('click',()=>{
      const i=+b.dataset.vfremove,f=vfDraft[i];
      const used=state.vendorTemplates.filter(v=>(v.values||{})[f.id]).length;
      vfDraft.splice(i,1);renderVendorFieldEditor();
      // 편집 중인 초안이라 저장 전에는 아무것도 사라지지 않는다. 무엇이 걸려 있는지만 알린다.
      if(used)toast(`'${f.label}' 을(를) 뺐습니다. 저장하면 ${used}개 ${state.terms.vendor}의 값도 사라집니다.`);
    }));
    const move=(i,d)=>{const j=i+d;if(j<0||j>=vfDraft.length)return;[vfDraft[i],vfDraft[j]]=[vfDraft[j],vfDraft[i]];renderVendorFieldEditor()};
    qa('[data-vfup]',host).forEach(b=>b.addEventListener('click',()=>move(+b.dataset.vfup,-1)));
    qa('[data-vfdown]',host).forEach(b=>b.addEventListener('click',()=>move(+b.dataset.vfdown,1)));
  }
  function renderTermsPane(){
    const t=state.terms;
    vfDraft=C.clone(state.vendorFields);
    $('termsPane').innerHTML=`
      <div class="terms-note">화면에 쓰이는 이름만 바꿉니다. 이미 등록한 데이터는 그대로 유지됩니다.</div>
      <div class="form-grid">
        <div class="field full"><label>앱 이름</label><input data-term="app" value="${C.esc(t.app)}"></div>
        <div class="field"><label>거래 상대 · 기본 “업체”</label><input data-term="vendor" value="${C.esc(t.vendor)}"></div>
        <div class="field"><label>진행 단위 · 기본 “업무”</label><input data-term="project" value="${C.esc(t.project)}"></div>
        <div class="field"><label>절차 · 기본 “절차”</label><input data-term="step" value="${C.esc(t.step)}"></div>
        <div class="field"><label>일정 · 기본 “일정”</label><input data-term="event" value="${C.esc(t.event)}"></div>
        <div class="field"><label>예산 항목 · 기본 “예산항목”</label><input data-term="budgetItem" value="${C.esc(t.budgetItem)}"></div>
        <div class="field"><label>지출 · 기본 “지출”</label><input data-term="spend" value="${C.esc(t.spend)}"></div>
      </div>
      <div class="terms-preview" id="termsPreview"></div>
      <div class="editor-head" style="margin-top:16px"><div class="editor-title">${C.esc(t.vendor)} 항목</div></div>
      <div class="terms-note">상세 화면에 보일 항목입니다. 값이 비어 있으면 표시되지 않습니다.</div>
      <div class="proc-list" id="vfList" style="margin-top:8px"></div>
      <div class="setting-actions" style="margin-top:10px;justify-content:flex-start">
        <button class="btn" id="vfAdd">+ 항목 추가</button>
        <button class="btn" id="termsReset">기본값으로</button>
        <button class="btn primary" id="termsSave">저장</button>
      </div>`;
    renderVendorFieldEditor();updateTermsPreview();
    qa('[data-term]',$('termsPane')).forEach(el=>el.addEventListener('input',updateTermsPreview));
    q('#vfAdd').addEventListener('click',()=>{vfDraft.push({id:C.uid('vf'),label:'새 항목',type:'text'});renderVendorFieldEditor()});
    q('#termsReset').addEventListener('click',async()=>{
      if(!confirm('용어와 항목을 기본값으로 되돌릴까요?\n입력해 둔 값은 지워지지 않습니다.'))return;
      state.terms=C.defaultTerms();state.vendorFields=C.defaultVendorFields();
      await persist('기본값으로 되돌렸습니다.');
    });
    q('#termsSave').addEventListener('click',async()=>{
      state.terms=currentTermsDraft();
      state.vendorFields=vfDraft.filter(f=>String(f.label||'').trim()).map(f=>({...f,label:f.label.trim()}));
      if(!state.vendorFields.length)state.vendorFields=C.defaultVendorFields();
      await persist('용어와 항목을 저장했습니다.');
    });
  }
  function renderVendorTemplates(){if(!selectedVendorTemplateId&&state.vendorTemplates[0])selectedVendorTemplateId=state.vendorTemplates[0].id;const v=state.vendorTemplates.find(x=>x.id===selectedVendorTemplateId)||state.vendorTemplates[0];$('vendorTemplatePane').innerHTML=`<div class="template-layout"><div><div class="template-list">${state.vendorTemplates.map(x=>`<button class="template-item ${v?.id===x.id?'active':''}" data-vt="${x.id}">${C.esc(x.name)}</button>`).join('')}</div><button class="btn" id="newVendorTemplate" style="margin-top:7px;width:100%">${C.esc(L.newVendorTpl)}</button></div><div class="template-editor"><div class="editor-head"><div class="editor-title">${C.esc(L.vendorInfo)}</div>${v?'<button class="btn danger" id="deleteVendorTemplate">삭제</button>':''}</div>${v?`<div class="form-grid"><div class="field full"><label>${C.esc(L.vendorName)}</label><input id="vtName" value="${C.esc(v.name)}"></div>${vendorFieldInputs(v)}</div><button class="btn primary" id="saveVendorTemplate" style="margin-top:8px">${C.esc(L.saveVendor)}</button>`:`${C.esc(state.terms.vendor)} 템플릿을 추가하세요.`}</div></div>`;qa('[data-vt]').forEach(b=>b.addEventListener('click',()=>{selectedVendorTemplateId=b.dataset.vt;renderVendorTemplates()}));q('#newVendorTemplate')?.addEventListener('click',()=>{const id=C.uid('v');state.vendorTemplates.push({id,name:L.newVendorName,values:{}});selectedVendorTemplateId=id;renderVendorTemplates()});q('#saveVendorTemplate')?.addEventListener('click',async()=>{v.name=$('vtName').value.trim()||v.name;v.values=v.values||{};qa('[data-vf]').forEach(el=>{v.values[el.dataset.vf]=el.value.trim()});await persist(L.savedVendorTpl)});q('#deleteVendorTemplate')?.addEventListener('click',async()=>{if(state.projects.some(p=>p.vendorId===v.id)||state.manualEvents.some(m=>m.vendorId===v.id)){toast(L.vendorInUse);return}state.vendorTemplates=state.vendorTemplates.filter(x=>x.id!==v.id);selectedVendorTemplateId=state.vendorTemplates[0]?.id||null;await persist(L.deletedVendorTpl)})}
  function renderWorkTemplates(){if(!selectedWorkTemplateId&&state.workTemplates[0])selectedWorkTemplateId=state.workTemplates[0].id;const t=state.workTemplates.find(x=>x.id===selectedWorkTemplateId)||state.workTemplates[0];$('workTemplatePane').innerHTML=`<div class="template-layout"><div><div class="template-list">${state.workTemplates.map(x=>`<button class="template-item ${t?.id===x.id?'active':''}" data-wt="${x.id}">${C.esc(x.name)}</button>`).join('')}</div><button class="btn" id="newWorkTemplate" style="margin-top:7px;width:100%">${C.esc(L.newWorkTpl)}</button></div><div class="template-editor"><div class="editor-head"><div class="editor-title">${C.esc(L.workSteps)}</div>${t?'<button class="btn danger" id="deleteWorkTemplate">삭제</button>':''}</div>${t?`<div class="field full"><label>템플릿명</label><input id="wtName" value="${C.esc(t.name)}"></div><div class="proc-list" id="wtSteps" style="margin-top:8px"></div><button class="btn" id="wtAddStep" style="margin-top:7px">+ 단계 추가</button><button class="btn primary" id="saveWorkTemplate" style="margin-top:7px">템플릿 저장</button>`:`${C.esc(state.terms.project)} 템플릿을 추가하세요.`}</div></div>`;if(t)renderStepEditor('wtSteps',t.steps,()=>renderWorkTemplates());qa('[data-wt]').forEach(b=>b.addEventListener('click',()=>{selectedWorkTemplateId=b.dataset.wt;renderWorkTemplates()}));q('#newWorkTemplate')?.addEventListener('click',()=>{const id=C.uid('wt');state.workTemplates.push({id,name:L.newWorkTplName,steps:[{name:'첫 단계',offset:0}]});selectedWorkTemplateId=id;renderWorkTemplates()});q('#wtAddStep')?.addEventListener('click',()=>{t.steps.push({name:'새 단계',offset:1});renderWorkTemplates()});q('#saveWorkTemplate')?.addEventListener('click',async()=>{t.name=$('wtName').value.trim()||t.name;await persist(L.savedWorkTpl)});q('#deleteWorkTemplate')?.addEventListener('click',async()=>{state.workTemplates=state.workTemplates.filter(x=>x.id!==t.id);selectedWorkTemplateId=state.workTemplates[0]?.id||null;await persist(L.deletedWorkTpl)})}
  function renderStepEditor(hostId,steps,rerender){const host=$(hostId);host.innerHTML=steps.map((s,i)=>`<div class="proc-row"><div class="move"><button data-up="${i}">↑</button><button data-down="${i}">↓</button></div><input data-step-name="${i}" value="${C.esc(s.name)}"><input data-step-offset="${i}" type="number" min="0" value="${Number(s.offset||0)}" title="이전 단계 완료 후 일수"><button class="remove" data-remove="${i}">삭제</button></div>`).join('');qa('[data-step-name]',host).forEach(el=>el.addEventListener('input',()=>steps[+el.dataset.stepName].name=el.value));qa('[data-step-offset]',host).forEach(el=>el.addEventListener('input',()=>steps[+el.dataset.stepOffset].offset=Number(el.value||0)));qa('[data-up]',host).forEach(b=>b.addEventListener('click',()=>move(+b.dataset.up,-1)));qa('[data-down]',host).forEach(b=>b.addEventListener('click',()=>move(+b.dataset.down,1)));qa('[data-remove]',host).forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.remove,s=steps[i]||{};const lost=[];if(s.completed)lost.push(`완료 이력${s.completedAt?` (${C.pretty(s.completedAt)})`:''}`);if(s.logs?.length)lost.push(`업무 기록 ${s.logs.length}건`);if(s.attachments?.length)lost.push(`첨부파일 ${s.attachments.length}개`);if(lost.length&&!confirm(`'${s.name}' 단계를 삭제하면 다음이 함께 사라집니다.\n\n- ${lost.join('\n- ')}\n\n삭제할까요?`))return;steps.splice(i,1);rerender()}));function move(i,d){const j=i+d;if(j<0||j>=steps.length)return;[steps[i],steps[j]]=[steps[j],steps[i]];rerender()}}
  function openProjectSteps(projectId){selectedProjectId=projectId;const p=C.project(state,projectId);projectStepsDraft=C.clone(p.steps);$('projectStepsTitle').textContent=`${p.name} · ${L.editSteps}`;renderProjectSteps();show('projectStepsModal')}
  function renderProjectSteps(){renderStepEditor('projectStepsList',projectStepsDraft,renderProjectSteps)}
  async function saveProjectSteps(){const p=C.project(state,selectedProjectId);if(!p)return;
    const kept=new Set(projectStepsDraft.map(s=>s.id).filter(Boolean)),dropped=p.steps.filter(s=>!kept.has(s.id));
    p.steps=projectStepsDraft.map(s=>({...s,id:s.id||C.uid(`${p.id}s`),offset:Number(s.offset||0)}));
    hide('projectStepsModal');
    if(dropped.length)await C.purgeAttachments(C.attachmentsOf(dropped));
    await persist(L.savedSteps)}
  async function openTemplates(){if(await popOut('template',{}))return;templateTab='vendor';qa('[data-template-tab]').forEach(b=>b.classList.toggle('active',b.dataset.templateTab==='vendor'));$('vendorTemplatePane').classList.remove('hidden');$('workTemplatePane').classList.add('hidden');$('termsPane').classList.add('hidden');renderTemplatePanes();show('templateModal')}
  async function openSettings(){
    if(await popOut('settings',{}))return;
    const tauri=C.isTauri();$('autostart').checked=!!state.settings.autostart;
    if(tauri){try{$('autostart').checked=await window.__TAURI__.core.invoke('is_autostart_enabled');state.settings.autostart=$('autostart').checked}catch(e){}}
    renderDemoRow();renderBackupRow();show('settingsModal')}
  function renderDemoRow(){const on=C.hasDemoData(state);$('demoToggleBtn').textContent=on?'예시 데이터 지우기':'예시 데이터 불러오기';$('demoToggleBtn').classList.toggle('danger',on)}

  // ── 백업 ───────────────────────────────────────────────────────────────
  // 데스크톱은 앱 폴더 안에서 목록으로 다루고, 웹은 내려받기/파일 선택으로 다룬다.
  async function renderBackupRow(){
    const native=C.nativeFiles();
    $('backupFolderBtn').classList.toggle('hidden',!native);
    $('backupPick').classList.toggle('hidden',!native);
    $('restoreBtn').classList.toggle('hidden',!native);
    $('restoreFileLabel').classList.toggle('hidden',native);
    $('backupNowBtn').textContent=native?'지금 백업':'백업 내려받기';
    if(native){
      const list=await C.listBackups();
      $('backupPick').innerHTML=list.length?list.map(n=>`<option value="${C.esc(n)}">${C.esc(n)}</option>`).join(''):'<option value="">백업 없음</option>';
      $('restoreBtn').disabled=!list.length;
      $('backupCopy').textContent=list.length
        ?`하루 한 번 자동으로 남깁니다. 최근 ${list.length}개 보관 중 · 마지막 ${list[0].replace(/\.zip$/,'')}`
        :'하루 한 번 자동으로 남깁니다. 아직 백업이 없습니다.';
    }else{
      $('backupCopy').textContent='첨부파일까지 함께 담은 ZIP 을 내려받습니다. 웹 미리보기에서는 자동 백업이 동작하지 않습니다.';
    }
  }
  async function backupNow(){
    try{
      const {bytes,manifest}=await C.buildBackup(state);
      const note=manifest.attachmentsMissing.length?` (실물 없는 첨부 ${manifest.attachmentsMissing.length}개 제외)`:'';
      if(C.nativeFiles()){
        await C.writeBackupFile(`backup-${C.todayISO()}.zip`,bytes);
        await C.rotateBackups();await renderBackupRow();
        toast(`백업했습니다. 첨부 ${manifest.attachmentsIncluded}개${note}`);
      }else{
        const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),a=document.createElement('a');
        a.href=url;a.download=`work-calendar-backup-${C.todayISO()}.zip`;document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
        toast(`백업을 내려받았습니다. 첨부 ${manifest.attachmentsIncluded}개${note}`);
      }
    }catch(e){console.warn(e);toast(`백업 실패: ${e?.message||e}`)}
  }
  async function applyRestore(bytes){
    if(!confirm('백업 시점으로 되돌립니다.\n지금 데이터는 복원 직전에 한 벌 자동으로 저장됩니다.\n계속할까요?'))return;
    try{
      if(C.nativeFiles()){
        try{const cur=await C.buildBackup(state);await C.writeBackupFile(`before-restore-${C.todayISO()}.zip`,cur.bytes)}
        catch(e){console.warn('복원 전 백업 실패',e)}
      }
      const {state:next,manifest}=await C.restoreBackup(bytes);
      state=next;await C.saveState(state);render();await renderBackupRow();
      toast(`복원했습니다. 첨부 ${manifest?.attachmentsIncluded??0}개`);
    }catch(e){console.warn(e);toast(`복원 실패: ${e?.message||e}`)}
  }
  async function restoreFromList(){const name=$('backupPick').value;if(!name)return;try{await applyRestore(await C.readBackupFile(name))}catch(e){toast(`백업을 읽지 못했습니다: ${e?.message||e}`)}}
  async function restoreFromFile(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;await applyRestore(new Uint8Array(await f.arrayBuffer()))}
  // 예시 데이터는 demo- 접두 id 로만 식별한다. 사용자가 직접 만든 업무는 절대 건드리지 않는다.
  async function toggleDemo(){
    const isDemo=x=>String(x.id).startsWith('demo-');
    if(C.hasDemoData(state)){
      const dropped=[...state.projects.filter(isDemo).flatMap(p=>p.steps),...state.manualEvents.filter(isDemo)];
      await withUndo('예시 데이터를 지웠습니다.',()=>{
        state.projects=state.projects.filter(p=>!isDemo(p));state.manualEvents=state.manualEvents.filter(m=>!isDemo(m));
      },{purge:()=>C.purgeAttachments(C.attachmentsOf(dropped))});
      renderDemoRow();
    }else{
      const d=C.demoData();state.projects.push(...d.projects);state.manualEvents.push(...d.manualEvents);
      renderDemoRow();await persist('예시 데이터를 불러왔습니다.');
    }
  }
  // 다른 창이 공유 상태에 대상을 적으면 이 창이 소비해 상세를 연다.
  // 조각 세 창이 모두 소비하면 pop 창이 세 번 열린다 — 달력 시트 창(브라우저 포함)만 소비한다.
  async function consumePendingSelection(){if(MODE&&MODE!=='cal')return;const sel=state.pendingSelection;if(!sel||!sel.id)return;
    state.pendingSelection=null;await C.saveState(state);
    if(findRecord(sel.kind,sel.id))openRecord(sel.kind,sel.id);}
  async function setAutostart(){const enabled=$('autostart').checked;state.settings.autostart=enabled;await C.saveState(state);if(C.isTauri())try{await window.__TAURI__.core.invoke('set_autostart',{enabled})}catch(e){toast('자동실행 설정을 적용하지 못했습니다.')}}
  $('horizonSelect').addEventListener('change',async e=>{state.settings.horizon=e.target.value;$('horizonCustom').classList.toggle('hidden',e.target.value!=='custom');await persist()});$('horizonCustom').addEventListener('change',async e=>{state.settings.customHorizon=Math.max(1,Number(e.target.value||1));await persist()});
  $('prevMonth').addEventListener('click',()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);renderCalendar()});$('nextMonth').addEventListener('click',()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);renderCalendar()});$('todayBtn').addEventListener('click',()=>{const d=C.parse(C.todayISO());currentMonth=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar();setTimeout(()=>q('.day.today')?.scrollIntoView({block:'center',behavior:'smooth'}),10)});
  $('addScheduleBtn').addEventListener('click',()=>openSchedule());$('saveScheduleBtn').addEventListener('click',saveSchedule);$('sVendor').addEventListener('change',()=>{updateProjectSelect();addPickedVendor($('sVendor').value)});
  $('sAddVendor').addEventListener('click',()=>{document.getElementById('sVendorInput')?.focus()});$('addWorkBtn').addEventListener('click',()=>openWork());$('saveWorkBtn').addEventListener('click',saveWork);$('wVendor').addEventListener('change',applyWorkMode);$('wTemplate').addEventListener('change',applyWorkMode);
  $('wGroup').addEventListener('change',()=>{
    const g=C.group(state,$('wGroup').value);if(!g)return;
    if(!$('wProject').value.trim())$('wProject').value=g.name;
    if(!$('wStart').value)$('wStart').value=g.startDate||'';
    if(!$('wEnd').value)$('wEnd').value=g.endDate||'';
    applyWorkMode();
  });$('wAddEvent').addEventListener('click',()=>{bundleDraft.push(blankBundleRow());renderBundleEvents()});$('templateBtn').addEventListener('click',openTemplates);$('settingsBtn').addEventListener('click',openSettings);$('autostart').addEventListener('change',setAutostart);$('completeBtn').addEventListener('click',completeSelected);$('changeDateBtn').addEventListener('click',openDateModal);$('saveDateBtn').addEventListener('click',saveSelectedDate);$('reopenBtn').addEventListener('click',reopenSelected);$('deleteEventBtn').addEventListener('click',deleteSelected);$('demoToggleBtn').addEventListener('click',toggleDemo);$('backupNowBtn').addEventListener('click',backupNow);$('backupFolderBtn').addEventListener('click',async()=>{if(!await C.revealBackups())toast('이 환경에서는 폴더를 열 수 없습니다.')});$('restoreBtn').addEventListener('click',restoreFromList);$('restoreFile').addEventListener('change',restoreFromFile);$('projectAddStep').addEventListener('click',()=>{projectStepsDraft.push({id:null,name:'새 단계',offset:1,dueDate:null,completed:false,completedAt:null});renderProjectSteps()});$('saveProjectSteps').addEventListener('click',saveProjectSteps);
  // 업체가 나오는 곳은 모두 같은 방식으로 고른다 — 치면 걸러지고, 없으면 그 자리에서 만든다.
  const CB=window.WorkCombo;
  if(CB){
    [$('sVendor'),$('wVendor'),$('spVendor')].forEach(el=>CB.enhance(el,{
      allowCreate:true,onCreate:createVendor,
      createLabel:n=>L.createVendorRow(n),placeholder:L.searchPlaceholder(state.terms.vendor)}));
    CB.enhance($('wGroup'),{allowCreate:true,onCreate:createGroup,
      createLabel:n=>L.createGroupRow(n),placeholder:'행사 검색'});
    CB.enhance($('sProject'),{placeholder:L.searchPlaceholder(state.terms.project)});
    CB.enhance($('spProject'),{placeholder:L.searchPlaceholder(state.terms.project)});
    CB.enhance($('spItem'),{placeholder:L.searchPlaceholder(state.terms.budgetItem)});
  }
  qa('.tabs [data-board]').forEach(b=>b.addEventListener('click',()=>setMiniMode(b.dataset.board)));
  qa('.st-head[data-board]').forEach(b=>b.addEventListener('click',()=>toggleStatus(b.dataset.board)));
  // ── 추가·검색 한 칸 (미니 대시보드) ──────────────────────────────────────
  let omniItems=[],omniIdx=-1;
  function closeOmni(clear){const host=$('omniList');host.classList.add('hidden');$('omni').setAttribute('aria-expanded','false');omniIdx=-1;if(clear)$('omni').value=''}
  function renderOmni(){
    const qv=$('omni').value.trim(),host=$('omniList');
    if(!qv){closeOmni(false);return}
    const groups=C.searchAll(state,qv);omniItems=[];
    let html='';
    groups.forEach(g=>{
      html+=`<div class="omni-kind">${C.esc(L.omniKind[g.kind]||g.kind)}</div>`;
      g.rows.forEach(r=>{const i=omniItems.length;omniItems.push({kind:g.kind,row:r});
        html+=`<button class="omni-opt" data-omni="${i}" id="omni-${i}" role="option"><b>${C.esc(r.name)}</b>${r.sub?`<small>${C.esc(r.sub)}</small>`:''}</button>`;});
    });
    const ci=omniItems.length;omniItems.push({kind:'create',row:{name:qv}});
    html+=(groups.length?'':`<div class="omni-empty">${C.esc(L.omniEmpty(qv))}</div>`)
      +`<button class="omni-opt create" data-omni="${ci}" id="omni-${ci}" role="option">${C.esc(L.omniCreate(qv))}</button>`;
    host.innerHTML=html;host.classList.remove('hidden');$('omni').setAttribute('aria-expanded','true');omniIdx=-1;
    // blur 가 클릭보다 먼저 오면 목록이 닫혀 선택이 무산된다. mousedown 에서 처리한다.
    qa('[data-omni]',host).forEach(b=>b.addEventListener('mousedown',e=>{e.preventDefault();pickOmni(+b.dataset.omni)}));
  }
  async function pickOmni(i){
    const it=omniItems[i];if(!it)return;
    closeOmni(true);
    switch(it.kind){
      case 'event':openRecord(it.row.recordKind,it.row.id);break;
      case 'spend':openSpend(it.row.id);break;
      case 'vendor':await setMiniMode('vendor');expandedVendors.add(it.row.id);renderBoard();applyMiniMode();break;
      case 'project':await setMiniMode('vendor');expandedVendors.add(it.row.vendorId||'');renderBoard();applyMiniMode();break;
      case 'group':openStatus.add('group');expandedGroups.add(it.row.id);renderGroupBoard();applyStatus();break;
      case 'create':openSchedule(C.todayISO(),{name:it.row.name});break;
    }
  }
  function moveOmni(d){
    if($('omniList').classList.contains('hidden'))return;
    const n=omniItems.length;if(!n)return;
    omniIdx=(omniIdx+d+n)%n;
    qa('[data-omni]').forEach((b,i)=>b.classList.toggle('active',i===omniIdx));
    document.getElementById(`omni-${omniIdx}`)?.scrollIntoView({block:'nearest'});
  }
  if($('omni')){
    $('omni').addEventListener('input',renderOmni);
    $('omni').addEventListener('focus',renderOmni);
    $('omni').addEventListener('blur',()=>setTimeout(()=>closeOmni(false),120));
    $('omni').addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'){e.preventDefault();moveOmni(1)}
      else if(e.key==='ArrowUp'){e.preventDefault();moveOmni(-1)}
      else if(e.key==='Enter'){e.preventDefault();const qv=$('omni').value.trim();if(!qv)return;
        pickOmni(omniIdx>=0?omniIdx:omniItems.length-1)}   // 고르지 않았으면 '새로 만들기'
      else if(e.key==='Escape'&&!$('omniList').classList.contains('hidden')){e.preventDefault();e.stopPropagation();closeOmni(false)}
    });
    $('omniAdd').addEventListener('click',()=>{const qv=$('omni').value.trim();closeOmni(true);openSchedule(C.todayISO(),qv?{name:qv}:{})});
  }
  // ── 키보드 — 입력 중이거나 모달이 떠 있으면 아무것도 가로채지 않는다 ────
  const typing=()=>{const el=document.activeElement;return !!el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT'||el.isContentEditable)};
  document.addEventListener('keydown',e=>{
    if(modalStack.length||typing()||e.ctrlKey||e.metaKey||e.altKey)return;
    const k=e.key;
    if(hasPiece('cal')){
      if(k==='t'||k==='T'){e.preventDefault();$('todayBtn').click();return}
      if(k==='ArrowLeft'){e.preventDefault();$('prevMonth').click();return}
      if(k==='ArrowRight'){e.preventDefault();$('nextMonth').click();return}
    }
    if(k==='n'||k==='N'){e.preventDefault();openSchedule();return}
    if(k==='/'&&hasPiece('mini')){e.preventDefault();$('omni').focus()}
  });
  $('bAddItem').addEventListener('click',()=>{budgetDraft.push(blankBudgetRow());renderBudgetItems()});
  $('saveBudgetBtn').addEventListener('click',saveBudget);
  $('saveSpendBtn').addEventListener('click',saveSpend);
  $('deleteSpendBtn').addEventListener('click',deleteSpend);
  qa('[data-template-tab]').forEach(b=>b.addEventListener('click',()=>{templateTab=b.dataset.templateTab;qa('[data-template-tab]').forEach(x=>x.classList.toggle('active',x===b));$('vendorTemplatePane').classList.toggle('hidden',templateTab!=='vendor');$('workTemplatePane').classList.toggle('hidden',templateTab!=='work');$('termsPane').classList.toggle('hidden',templateTab!=='terms')}));qa('[data-close]').forEach(b=>b.addEventListener('click',()=>hide(b.dataset.close)));qa('.modal-bg').forEach(bg=>bg.addEventListener('mousedown',e=>{if(e.target===bg)hide(bg.id)}));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalStack.length)hide(modalStack[modalStack.length-1].id)});
  await C.watchState(v=>{state=v;render();consumePendingSelection()});
  const d=C.parse(C.todayISO());currentMonth=new Date(d.getFullYear(),d.getMonth(),1);render();consumePendingSelection();  // 사용자가 버튼을 눌러야 보호된다면 그건 또 하나의 업무다. 시작할 때 조용히 처리한다.
  (async()=>{try{const moved=await C.migrateAttachmentsToDisk(state);if(moved)console.info('첨부 '+moved+'개를 앱 폴더로 옮겼습니다.');const ab=await C.maybeAutoBackup(state);if(ab&&ab.ok===false)toast('자동 백업에 실패했습니다: '+ab.error);}catch(e){console.warn(e)}})();setTimeout(()=>q('.day.today')?.scrollIntoView({block:'center'}),50);
  // pop 창이면 요청된 폼을 바로 연다. 폼이 못 열리면(대상이 그 사이 지워졌으면) 스스로 닫는다.
  if(IS_POP){
    const form=PARAMS.get('form');let payload={};
    try{payload=JSON.parse(PARAMS.get('payload')||'{}')}catch(e){}
    if(form==='schedule')openSchedule(payload.date||C.todayISO(),payload);
    else if(form==='work')openWork(payload);
    else if(form==='detail')openRecord(payload.kind,payload.id);
    else if(form==='spend')openSpend(payload.id||null,payload.preset||{});
    else if(form==='budget')openBudget();
    else if(form==='template')openTemplates();
    else if(form==='settings')openSettings();
    setTimeout(()=>{if(!modalStack.length)closePopSoon()},200);
  }
  // 조각 창은 visible:false 로 만들어 두고 첫 렌더가 끝난 여기서 띄운다. 먼저 띄우면 아직
  // 아무것도 그리지 않은 WebView2 가 검은 사각형으로 잠깐(느린 PC 에서는 오래) 남는다.
  if(C.isTauri()&&!IS_POP)requestAnimationFrame(()=>{try{window.__TAURI__.core.invoke('piece_ready')}catch(e){console.warn(e)}});
})();
