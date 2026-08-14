(async function(){
 const C=window.WorkCore;let state=await C.initStorage();const $=id=>document.getElementById(id);
 let L=C.labels(state.terms);
 function render(){const cards=C.dueCards(state);L=C.labels(state.terms);document.title=L.upcoming;$('helperTitle').textContent=L.upcoming;$('helperHorizon').textContent=C.horizonLabel(state.settings);$('helperList').innerHTML=cards.length?cards.map(r=>{const v=C.vendor(state,r.vendorId),p=C.project(state,r.projectId);return `<button class="helper-card ${C.ddayClass(r.date)}" data-kind="${r.kind}" data-id="${r.id}"><span><span class="helper-vendor">${C.esc(v?.name||L.noVendor)}</span><span class="helper-task">${C.esc(r.name)}</span><span class="helper-sub">${C.pretty(r.date)}${p?` · ${C.esc(p.name)}`:''}</span></span><span class="helper-dday">${C.ddayLabel(r.date)}</span></button>`}).join(''):`<div class="empty" data-tauri-drag-region>${C.esc(L.upcoming)}이 없습니다.<br>위 <b>+</b> 로 바로 추가할 수 있습니다.</div>`;$('helperUpdated').textContent=`${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 갱신`;document.querySelectorAll('.helper-card').forEach(b=>b.addEventListener('click',()=>openInMain(b.dataset.kind,b.dataset.id)))}
 async function invoke(cmd,args){if(C.isTauri())try{return await window.__TAURI__.core.invoke(cmd,args||{})}catch(e){console.warn(e)}}
 async function openMain(){if(C.isTauri())await invoke('show_main');else if(window.opener)window.opener.focus()}
 // 카드 클릭은 본체를 띄우는 데서 끝나면 안 된다. 어떤 일정인지 공유 상태에 적어두면
 // 본체가 그것을 소비해 해당 상세를 연다. 창 간 IPC 채널을 새로 만들 필요가 없다.
 async function openInMain(kind,id){if(!kind||!id){await openMain();return}state.pendingSelection={kind,id};await C.saveState(state);await openMain()}

 // ── 빠른 일정 추가 ────────────────────────────────────────────────────────
 // 도우미에서 본체를 열고 모달을 찾아 채우는 것은 "일정 하나 적어두기"에 비해 너무 먼 길이다.
 // 악세사리 자리에서 이름·날짜만으로 끝낼 수 있어야 한다. 나머지는 본체에서 채우면 된다.
 const quick=$('helperQuickForm');
 function fillQuick(){
   $('qName').placeholder=L.fEventName;
   $('qName').setAttribute('aria-label',L.fEventName);
   $('qDate').setAttribute('aria-label',`${state.terms.event} 날짜`);
   $('qVendor').setAttribute('aria-label',L.fVendor);
   $('qVendor').innerHTML=`<option value="">${C.esc(L.noVendor)}</option>`+
     state.vendorTemplates.map(v=>`<option value="${C.esc(v.id)}">${C.esc(v.name)}</option>`).join('');
 }
 function openQuick(){fillQuick();$('qMsg').textContent='';$('qName').value='';$('qDate').value=C.todayISO();quick.hidden=false;$('helperQuick').setAttribute('aria-expanded','true');$('qName').focus()}
 function closeQuick(){quick.hidden=true;$('helperQuick').setAttribute('aria-expanded','false')}
 $('helperQuick').addEventListener('click',()=>{quick.hidden?openQuick():closeQuick()});
 $('qCancel').addEventListener('click',closeQuick);
 quick.addEventListener('submit',async e=>{
   e.preventDefault();
   const name=$('qName').value.trim(),date=$('qDate').value;
   if(!name||!date){$('qMsg').textContent=`${L.fEventName}과 날짜를 확인하세요.`;return}
   state.manualEvents.push({id:C.uid('m'),vendorId:$('qVendor').value||null,projectId:null,date,name,memo:'',completed:false,completedAt:null,logs:[],attachments:[]});
   await C.saveState(state);
   closeQuick();render();
 });
 // 폼이 열려 있을 때 Escape 는 도우미를 치우는 게 아니라 폼만 닫는다.
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!quick.hidden){e.preventDefault();closeQuick()}});

 $('helperHide').addEventListener('click',async()=>{if(C.isTauri())await invoke('hide_helper');else window.close()});$('helperOpenMain').addEventListener('click',openMain);await C.watchState(v=>{state=v;render();if(!quick.hidden)fillQuick()});render();
})();
