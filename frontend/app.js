(async function(){
  const C=window.WorkCore;let state=await C.initStorage();let currentMonth=new Date(2026,7,1);let selectedRecord=null;let selectedProjectId=null;let templateTab='vendor';let selectedVendorTemplateId=null;let selectedWorkTemplateId=null;let projectStepsDraft=[];
  let L=C.labels(state.terms);const $=id=>document.getElementById(id);const q=(s,r=document)=>r.querySelector(s);const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1700)}
  // ── 모달 포커스 관리 (발주서 §17.2-4) ────────────────────────────────────
  // 열린 순서를 스택으로 들고 있어야 한다. 이전에는 Escape 가 DOM 순서상 마지막 모달을
  // 닫아서, 상세 위에 다른 모달이 떠 있으면 엉뚱한 창이 닫혔다.
  const modalStack=[];
  const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const focusables=root=>[...root.querySelectorAll(FOCUSABLE)].filter(el=>el.offsetWidth||el.offsetHeight||el.getClientRects().length);
  function show(id){
    const bg=$(id);if(bg.classList.contains('show'))return;
    modalStack.push({id,returnTo:document.activeElement});
    bg.classList.add('show');
    (focusables(bg)[0]||bg.querySelector('.modal'))?.focus?.();
  }
  function hide(id){
    const bg=$(id);if(!bg.classList.contains('show'))return;
    bg.classList.remove('show');
    const i=modalStack.findIndex(m=>m.id===id);
    const entry=i>=0?modalStack.splice(i,1)[0]:null;
    if(entry?.returnTo?.isConnected)entry.returnTo.focus?.();
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
  function render(){L=C.labels(state.terms);applyStaticLabels();renderHorizon();renderDue();renderCalendar();renderBoard();applyBoardMode();fillSelects();renderTemplatePanes();}
  // 정적 HTML 의 data-t 를 사전 값으로 채운다. 마크업이 들어가는 문구만 innerHTML 로 넣는다.
  function applyStaticLabels(){document.title=L.app;qa('[data-t]').forEach(el=>{const v=L[el.dataset.t];if(typeof v==='string')el.textContent=v})}
  function renderHorizon(){const s=state.settings;$('horizonSelect').value=s.horizon;$('horizonCustom').value=s.customHorizon;$('horizonCustom').classList.toggle('hidden',s.horizon!=='custom')}
  function renderDue(){const cards=C.dueCards(state),host=$('dueList');if(!cards.length){const blank=!state.projects.length&&!state.manualEvents.length;host.innerHTML=`<div class="empty">${blank?L.emptyBlank:L.emptyHorizon}</div>`;return}host.innerHTML=cards.map(r=>{const v=C.vendor(state,r.vendorId),p=C.project(state,r.projectId);return `<button class="due-card ${C.ddayClass(r)}" data-due-kind="${r.kind}" data-due-id="${r.id}"><span><span class="due-vendor">${C.esc(v?.name||L.noVendor)}</span><span class="due-task">${C.esc(r.name)}</span><span class="due-sub">${spanText(r)}${p?` · ${C.esc(p.name)}`:''}</span>${r.extra?`<span class="due-extra">${C.esc(L.laterCount(r.extra))}</span>`:''}</span><span class="due-dday">${C.ddayLabel(r)}</span></button>`}).join('');qa('[data-due-id]',host).forEach(b=>b.addEventListener('click',()=>openRecord(b.dataset.dueKind,b.dataset.dueId)))}
  // ── 업체별 요약 ──────────────────────────────────────────────────────────
  // 캘린더와 같은 자리를 쓰는 두 번째 축이다. 좌측 D-day 레일은 두 모드에서 모두 남는다 —
  // "뭐가 급한가"는 어느 화면을 보고 있든 사라지면 안 된다(발주서 §5.3).
  const boardMode=()=>state.settings.boardView==='vendor'?'vendor':'calendar';
  let expandedVendors=new Set();   // 펼침은 화면 상태다. 저장하지 않는다.
  function applyBoardMode(){
    const vendorView=boardMode()==='vendor';
    $('calendarScroll').classList.toggle('hidden',vendorView);
    $('vendorBoard').classList.toggle('hidden',!vendorView);
    $('calNav').classList.toggle('hidden',vendorView);   // 월 이동은 업체별에서 의미가 없다
    $('calHint').textContent=vendorView?L.boardCaption:L.calHint;
    qa('[data-board]').forEach(b=>{const on=b.dataset.board===(vendorView?'vendor':'calendar');b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});
  }
  async function setBoardMode(mode){
    if(boardMode()===mode)return;
    state.settings.boardView=mode;
    await C.saveState(state);          // 다시 켰을 때 보던 화면이 그대로 있어야 한다
    renderBoard();applyBoardMode();
  }
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
          <span class="bh-stat"><span class="bh-counts">${C.esc(L.boardOpen)} <b>${b.openCount}</b> · ${C.esc(L.boardDone)} <b>${b.doneCount}</b>${b.overdueCount?` <span class="bh-late">${C.esc(L.boardOverdue)} ${b.overdueCount}</span>`:''}</span><span class="bh-bar" role="img" aria-label="${C.esc(L.boardProgress)} ${pct}%"><i style="width:${pct}%"></i></span></span>
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
  function allEventRecords(){return C.eventRecords(state)}
  function renderCalendar(){const y=currentMonth.getFullYear(),m=currentMonth.getMonth();$('monthTitle').textContent=`${y}년 ${m+1}월`;$('monthGrid').innerHTML='';const first=new Date(y,m,1),before=first.getDay(),days=new Date(y,m+1,0).getDate(),cells=Math.ceil((before+days)/7)*7,events=allEventRecords(),bands=C.projectBands(state);for(let i=0;i<cells;i++){const d=new Date(y,m,1-before+i),ds=C.iso(d),inMonth=d.getMonth()===m,isToday=ds===C.todayISO(),rows=events.filter(e=>C.spansDay(e,ds)).sort((a,b)=>Number(a.completed)-Number(b.completed)),dayBands=bands.filter(b=>C.spansDay(b,ds));const cell=document.createElement('div');cell.className=`day ${inMonth?'':'out'} ${[0,6].includes(d.getDay())?'weekend':''} ${isToday?'today':''}`;cell.dataset.date=ds;cell.innerHTML=`<div class="day-head"><span class="day-num">${d.getDate()}</span>${isToday?'<span class="today-label">TODAY</span>':''}</div>${dayBands.length?`<div class="day-bands">${dayBands.map(b=>`<span class="day-band ${edgeClass(b,ds)}" title="${C.esc(b.name)} · ${spanText(b)}">${b.date===ds||d.getDay()===0?C.esc(b.name):''}</span>`).join('')}</div>`:''}<div class="events">${rows.map(r=>{const v=C.vendor(state,r.vendorId);return `<button class="event ${r.completed?'done':''} ${r.kind==='manual'?'manual':''} ${!r.completed?C.ddayClass(r):''} ${edgeClass(r,ds)}" data-event-kind="${r.kind}" data-event-id="${r.id}" title="${C.esc(v?.name||'')} · ${C.esc(r.name)} · ${spanText(r)}">${r.completed?'✓ ':''}${C.esc(v?.name||L.noVendor)} · ${C.esc(r.name)}${C.isPeriod(r)&&r.date===ds?` (${C.periodDays(r)}일)`:''}</button>`}).join('')}</div>${inMonth?`<span class="add-hint">+ ${C.esc(state.terms.event)}</span>`:''}`;if(inMonth)cell.addEventListener('click',e=>{if(e.target.closest('[data-event-id]'))return;openSchedule(ds)});$('monthGrid').appendChild(cell)}qa('[data-event-id]',$('monthGrid')).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openRecord(b.dataset.eventKind,b.dataset.eventId)}))}
  function fillSelects(){const vendorOpts=state.vendorTemplates.map(v=>`<option value="${v.id}">${C.esc(v.name)}</option>`).join('');$('sVendor').innerHTML=vendorOpts;$('wVendor').innerHTML=vendorOpts;$('wTemplate').innerHTML=state.workTemplates.map(t=>`<option value="${t.id}">${C.esc(t.name)}</option>`).join('');updateProjectSelect()}
  function updateProjectSelect(){const vid=$('sVendor').value;const rows=state.projects.filter(p=>p.vendorId===vid);$('sProject').innerHTML=`<option value="">${C.esc(L.genericEvent)}</option>`+rows.map(p=>`<option value="${p.id}">${C.esc(p.name)}</option>`).join('')}
  function openSchedule(date=C.todayISO()){selectedRecord=null;$('scheduleTitle').textContent=L.eventModalTitle;$('sDate').value=date;$('sEnd').value='';fillSelects();$('sName').value='';$('sMemo').value='';show('scheduleModal');setTimeout(()=>$('sName').focus(),0)}
  async function saveSchedule(){const date=$('sDate').value,endDate=$('sEnd').value||null,vendorId=$('sVendor').value,name=$('sName').value.trim();
    if(!date||!vendorId||!name){toast(L.needEventFields);return}
    if(endDate&&endDate<date){toast(L.badEndDate);return}
    state.manualEvents.push({id:C.uid('m'),vendorId,projectId:$('sProject').value||null,date,endDate,name,memo:$('sMemo').value.trim(),completed:false,completedAt:null,logs:[],attachments:[]});
    hide('scheduleModal');await persist(L.savedEvent)}
  function openWork(){fillSelects();$('wProject').value='';$('wFirstDate').value=C.todayISO();$('wMemo').value='';show('workModal')}
  async function saveWork(){const vendorId=$('wVendor').value,template=state.workTemplates.find(t=>t.id===$('wTemplate').value),name=$('wProject').value.trim(),date=$('wFirstDate').value;if(!vendorId||!template||!name||!date){toast(L.needProjectFields);return}state.projects.push(C.projectFromTemplate(template,vendorId,name,date,$('wMemo').value.trim()));hide('workModal');await persist(L.savedProject)}
  function findRecord(kind,id){return allEventRecords().find(r=>r.kind===kind&&r.id===id)}
  function recordEntity(record){if(!record)return null;if(record.kind==='manual')return state.manualEvents.find(x=>x.id===record.id)||null;const p=C.project(state,record.projectId);return p?.steps?.find(x=>x.id===record.id)||null}
  function stepStatus(p,s){const current=C.currentStep(p);if(s.completed)return{key:'done',label:`완료${s.completedAt?` · ${C.pretty(s.completedAt)}`:''}`};if(current?.id===s.id)return{key:'current',label:`현재${s.dueDate?` · ${C.pretty(s.dueDate)}`:''}`};return{key:'future',label:s.dueDate?`예정 · ${C.pretty(s.dueDate)}`:'예정 · 날짜 미정'}}
  function openRecord(kind,id){selectedRecord=findRecord(kind,id);if(!selectedRecord)return;const v=C.vendor(state,selectedRecord.vendorId),p=C.project(state,selectedRecord.projectId),entity=recordEntity(selectedRecord);if(entity){entity.logs=Array.isArray(entity.logs)?entity.logs:[];entity.attachments=Array.isArray(entity.attachments)?entity.attachments:[]}
    $('detailTitle').textContent=L.detailTitle;$('deleteEventBtn').classList.toggle('hidden',kind!=='manual');$('completeBtn').classList.toggle('hidden',selectedRecord.completed);$('changeDateBtn').classList.toggle('hidden',selectedRecord.completed);$('reopenBtn').classList.toggle('hidden',!selectedRecord.completed);const steps=p?.steps||[];
    const logs=(entity?.logs||[]).slice().sort((a,b)=>String(b.time).localeCompare(String(a.time))),files=entity?.attachments||[];
    $('detailBody').innerHTML=`<div class="detail-hero"><div><div class="detail-vendor">${C.esc(v?.name||'업체')}</div><div class="detail-project">${C.esc(p?.name||L.genericEvent)}</div></div><div class="detail-dday ${selectedRecord.completed?'done':C.ddayClass(selectedRecord)}">${selectedRecord.completed?'완료':C.ddayLabel(selectedRecord)}</div></div>
    <div class="current-box"><div class="current-label">${C.esc(selectedRecord.kind==='manual'?state.terms.event:L.selectedStep)}</div><div class="current-title">${C.esc(selectedRecord.name)}</div><div class="current-date">${C.isPeriod(selectedRecord)?C.esc(L.periodSpan(C.pretty(selectedRecord.date),C.pretty(selectedRecord.endDate),C.periodDays(selectedRecord))):C.pretty(selectedRecord.date)}${selectedRecord.memo?` · ${C.esc(selectedRecord.memo)}`:''}</div></div>
    ${vendorInfoRow(v)}
    <section class="worklog-section"><div class="section-headline"><div><b>${C.esc(L.worklog)}</b><span>진행 경과, 통화·협의 내용, 전달사항을 계속 남길 수 있습니다.</span></div></div><div class="log-compose"><textarea id="workLogText" placeholder="예: 업체 담당자와 통화. 평가서 보완본을 8/14 오전까지 제출하기로 함."></textarea><button class="btn primary" id="addWorkLogBtn">기록 추가</button></div><div class="worklog-list">${logs.length?logs.map(l=>`<div class="worklog-item"><div class="worklog-time">${new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(l.time))}</div><div class="worklog-text">${C.esc(l.text)}</div><button class="tiny-link danger" data-delete-log="${l.id}">삭제</button></div>`).join(''):'<div class="section-empty">아직 기록이 없습니다.</div>'}</div></section>
    <section class="attachment-section"><div class="section-headline"><div><b>첨부파일</b><span>이 일정과 관련된 문서·사진을 로컬에 보관합니다.</span></div><label class="btn file-btn" for="detailFiles">+ 파일 첨부</label><input id="detailFiles" type="file" multiple hidden></div><div class="attachment-list">${files.length?files.map(f=>`<div class="attachment-item"><span class="file-icon">↳</span><span class="attachment-main"><b>${C.esc(f.name)}</b><small>${C.formatBytes(f.size)}</small></span><button class="tiny-link" data-download-file="${f.id}">열기/저장</button><button class="tiny-link danger" data-delete-file="${f.id}">삭제</button></div>`).join(''):'<div class="section-empty">첨부된 파일이 없습니다.</div>'}</div><div class="attachment-note">첨부파일은 이 PC/브라우저의 로컬 저장소에 보관됩니다. 다른 PC로 옮길 때는 파일 백업 기능을 별도로 추가하는 것이 안전합니다.</div></section>
    ${p?`<div class="steps"><div class="steps-head"><div><div class="steps-title">${C.esc(L.allSteps)}</div><div class="steps-sub">완료된 단계와 아직 오지 않은 단계까지 모두 표시합니다.</div></div><button class="link" id="editProjectSteps">${C.esc(L.editSteps)}</button></div>${steps.map((s,i)=>{const st=stepStatus(p,s);return `<div class="step ${st.key}"><span class="step-mark">${s.completed?'✓':C.currentStep(p)?.id===s.id?'●':i+1}</span><span class="step-name">${C.esc(s.name)}</span><span class="step-status ${st.key}">${C.esc(st.label)}</span></div>`}).join('')}</div>`:''}`;
    show('detailModal');q('#editProjectSteps')?.addEventListener('click',()=>{hide('detailModal');openProjectSteps(p.id)});q('#addWorkLogBtn')?.addEventListener('click',addWorkLog);q('#workLogText')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();addWorkLog()}});q('#detailFiles')?.addEventListener('change',addAttachments);qa('[data-delete-log]',$('detailBody')).forEach(b=>b.addEventListener('click',()=>deleteWorkLog(b.dataset.deleteLog)));qa('[data-download-file]',$('detailBody')).forEach(b=>b.addEventListener('click',()=>downloadAttachment(b.dataset.downloadFile)));qa('[data-delete-file]',$('detailBody')).forEach(b=>b.addEventListener('click',()=>deleteAttachment(b.dataset.deleteFile)))
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
  async function deleteAttachment(id){const entity=recordEntity(selectedRecord),meta=attachmentMeta(id);if(!entity||!meta)return;if(!confirm('이 첨부파일을 삭제할까요?'))return;entity.attachments=(entity.attachments||[]).filter(x=>x.id!==id);await C.deleteAttachment(meta);await refreshDetail('첨부파일을 삭제했습니다.')}
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
    if(!confirm('완료를 취소하고 이 일정을 다시 진행 중으로 되돌릴까요?\n업무 기록과 첨부파일은 그대로 유지됩니다.'))return;
    const r=C.reopenEvent(state,selectedRecord);if(!r)return;hide('detailModal');
    await persist(r.kept?`완료를 취소했습니다. 다음 단계 ${r.kept.name}의 날짜(${C.pretty(r.kept.dueDate)})는 그대로 두었습니다.`:'완료를 취소했습니다.');}
  async function deleteSelected(){if(!selectedRecord||selectedRecord.kind!=='manual')return;
    const m=state.manualEvents.find(x=>x.id===selectedRecord.id);const files=C.attachmentsOf([m]);
    if(!confirm(files.length?`${L.confirmDeleteEvent}\n첨부파일 ${files.length}개도 함께 삭제됩니다.`:L.confirmDeleteEvent))return;
    state.manualEvents=state.manualEvents.filter(x=>x.id!==selectedRecord.id);
    await C.purgeAttachments(files); // 메타데이터만 지우면 IndexedDB 에 blob 이 영구히 남는다.
    hide('detailModal');await persist(L.deletedEvent)}
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
      if(used&&!confirm(`'${f.label}' 항목을 지우면 ${used}개 ${state.terms.vendor}에 입력된 값도 함께 사라집니다.\n삭제할까요?`))return;
      vfDraft.splice(i,1);renderVendorFieldEditor();
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
  function openTemplates(){templateTab='vendor';qa('[data-template-tab]').forEach(b=>b.classList.toggle('active',b.dataset.templateTab==='vendor'));$('vendorTemplatePane').classList.remove('hidden');$('workTemplatePane').classList.add('hidden');$('termsPane').classList.add('hidden');renderTemplatePanes();show('templateModal')}
  async function openHelper(){if(C.isTauri()){try{await window.__TAURI__.core.invoke('show_helper');toast('D-day 도우미를 열었습니다.');return}catch(e){console.warn(e)}}window.open('helper.html','dday-helper','width=330,height=430,resizable=yes')}
  async function openSettings(){const tauri=C.isTauri();$('alwaysOnTop').checked=!!state.settings.helperAlwaysOnTop;$('autostart').checked=!!state.settings.autostart;if(tauri){try{$('autostart').checked=await window.__TAURI__.core.invoke('is_autostart_enabled');state.settings.autostart=$('autostart').checked}catch(e){}}renderDemoRow();renderBackupRow();show('settingsModal')}
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
      if(!confirm('예시 데이터를 지울까요?\n직접 등록한 업무·일정은 그대로 유지됩니다.'))return;
      const dropped=[...state.projects.filter(isDemo).flatMap(p=>p.steps),...state.manualEvents.filter(isDemo)];
      state.projects=state.projects.filter(p=>!isDemo(p));state.manualEvents=state.manualEvents.filter(m=>!isDemo(m));
      await C.purgeAttachments(C.attachmentsOf(dropped));
      renderDemoRow();await persist('예시 데이터를 지웠습니다.');
    }else{
      const d=C.demoData();state.projects.push(...d.projects);state.manualEvents.push(...d.manualEvents);
      renderDemoRow();await persist('예시 데이터를 불러왔습니다.');
    }
  }
  // 도우미 창에서 카드를 누르면 공유 상태에 대상이 적히고 본체가 열린다. 본체는 그 대상을 소비해 상세를 띄운다.
  async function consumePendingSelection(){const sel=state.pendingSelection;if(!sel||!sel.id)return;
    state.pendingSelection=null;await C.saveState(state);
    if(findRecord(sel.kind,sel.id))openRecord(sel.kind,sel.id);}
  async function setTop(){state.settings.helperAlwaysOnTop=$('alwaysOnTop').checked;await C.saveState(state);if(C.isTauri())try{await window.__TAURI__.core.invoke('set_helper_always_on_top',{enabled:state.settings.helperAlwaysOnTop})}catch(e){} }
  async function setAutostart(){const enabled=$('autostart').checked;state.settings.autostart=enabled;await C.saveState(state);if(C.isTauri())try{await window.__TAURI__.core.invoke('set_autostart',{enabled})}catch(e){toast('자동실행 설정을 적용하지 못했습니다.')}}
  $('horizonSelect').addEventListener('change',async e=>{state.settings.horizon=e.target.value;$('horizonCustom').classList.toggle('hidden',e.target.value!=='custom');await persist()});$('horizonCustom').addEventListener('change',async e=>{state.settings.customHorizon=Math.max(1,Number(e.target.value||1));await persist()});
  $('prevMonth').addEventListener('click',()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);renderCalendar()});$('nextMonth').addEventListener('click',()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);renderCalendar()});$('todayBtn').addEventListener('click',()=>{const d=C.parse(C.todayISO());currentMonth=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar();setTimeout(()=>q('.day.today')?.scrollIntoView({block:'center',behavior:'smooth'}),10)});
  $('addScheduleBtn').addEventListener('click',()=>openSchedule());$('saveScheduleBtn').addEventListener('click',saveSchedule);$('sVendor').addEventListener('change',updateProjectSelect);$('addWorkBtn').addEventListener('click',openWork);$('saveWorkBtn').addEventListener('click',saveWork);$('templateBtn').addEventListener('click',openTemplates);$('settingsBtn').addEventListener('click',openSettings);$('helperBtn').addEventListener('click',openHelper);$('settingsOpenHelper').addEventListener('click',openHelper);$('alwaysOnTop').addEventListener('change',setTop);$('autostart').addEventListener('change',setAutostart);$('completeBtn').addEventListener('click',completeSelected);$('changeDateBtn').addEventListener('click',openDateModal);$('saveDateBtn').addEventListener('click',saveSelectedDate);$('reopenBtn').addEventListener('click',reopenSelected);$('deleteEventBtn').addEventListener('click',deleteSelected);$('demoToggleBtn').addEventListener('click',toggleDemo);$('backupNowBtn').addEventListener('click',backupNow);$('backupFolderBtn').addEventListener('click',async()=>{if(!await C.revealBackups())toast('이 환경에서는 폴더를 열 수 없습니다.')});$('restoreBtn').addEventListener('click',restoreFromList);$('restoreFile').addEventListener('change',restoreFromFile);$('projectAddStep').addEventListener('click',()=>{projectStepsDraft.push({id:null,name:'새 단계',offset:1,dueDate:null,completed:false,completedAt:null});renderProjectSteps()});$('saveProjectSteps').addEventListener('click',saveProjectSteps);
  qa('[data-board]').forEach(b=>b.addEventListener('click',()=>setBoardMode(b.dataset.board)));
  qa('[data-template-tab]').forEach(b=>b.addEventListener('click',()=>{templateTab=b.dataset.templateTab;qa('[data-template-tab]').forEach(x=>x.classList.toggle('active',x===b));$('vendorTemplatePane').classList.toggle('hidden',templateTab!=='vendor');$('workTemplatePane').classList.toggle('hidden',templateTab!=='work');$('termsPane').classList.toggle('hidden',templateTab!=='terms')}));qa('[data-close]').forEach(b=>b.addEventListener('click',()=>hide(b.dataset.close)));qa('.modal-bg').forEach(bg=>bg.addEventListener('mousedown',e=>{if(e.target===bg)hide(bg.id)}));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalStack.length)hide(modalStack[modalStack.length-1].id)});
  await C.watchState(v=>{state=v;render();consumePendingSelection()});
  const d=C.parse(C.todayISO());currentMonth=new Date(d.getFullYear(),d.getMonth(),1);render();consumePendingSelection();  // 사용자가 버튼을 눌러야 보호된다면 그건 또 하나의 업무다. 시작할 때 조용히 처리한다.
  (async()=>{try{const moved=await C.migrateAttachmentsToDisk(state);if(moved)console.info('첨부 '+moved+'개를 앱 폴더로 옮겼습니다.');const ab=await C.maybeAutoBackup(state);if(ab&&ab.ok===false)toast('자동 백업에 실패했습니다: '+ab.error);}catch(e){console.warn(e)}})();setTimeout(()=>q('.day.today')?.scrollIntoView({block:'center'}),50);
  // 본체 창은 visible:false 로 만들어 두고 여기서 띄운다. 먼저 띄우면 아직 아무것도 그리지 않은
  // WebView2 가 검은 사각형으로 잠깐(느린 PC 에서는 오래) 남는다.
  if(C.isTauri())requestAnimationFrame(()=>{try{window.__TAURI__.core.invoke('main_ready')}catch(e){console.warn(e)}});
})();
