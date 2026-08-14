(async function(){
 const C=window.WorkCore;let state=await C.initStorage();const $=id=>document.getElementById(id);
 function render(){const cards=C.dueCards(state),L=C.labels(state.terms);document.title=L.upcoming;$('helperTitle').textContent=L.upcoming;$('helperHorizon').textContent=C.horizonLabel(state.settings);$('helperList').innerHTML=cards.length?cards.map(r=>{const v=C.vendor(state,r.vendorId),p=C.project(state,r.projectId);return `<button class="helper-card ${C.ddayClass(r.date)}" data-kind="${r.kind}" data-id="${r.id}"><span><span class="helper-vendor">${C.esc(v?.name||L.noVendor)}</span><span class="helper-task">${C.esc(r.name)}</span><span class="helper-sub">${C.pretty(r.date)}${p?` · ${C.esc(p.name)}`:''}</span></span><span class="helper-dday">${C.ddayLabel(r.date)}</span></button>`}).join(''):`<div class="empty">${C.esc(L.upcoming)}이 없습니다.</div>`;$('helperUpdated').textContent=`${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 갱신`;document.querySelectorAll('.helper-card').forEach(b=>b.addEventListener('click',()=>openInMain(b.dataset.kind,b.dataset.id)))}
 async function invoke(cmd,args){if(C.isTauri())try{return await window.__TAURI__.core.invoke(cmd,args||{})}catch(e){console.warn(e)}}
 async function openMain(){if(C.isTauri())await invoke('show_main');else if(window.opener)window.opener.focus()}
 // 카드 클릭은 본체를 띄우는 데서 끝나면 안 된다. 어떤 일정인지 공유 상태에 적어두면
 // 본체가 그것을 소비해 해당 상세를 연다. 창 간 IPC 채널을 새로 만들 필요가 없다.
 async function openInMain(kind,id){if(!kind||!id){await openMain();return}state.pendingSelection={kind,id};await C.saveState(state);await openMain()}
 $('helperHide').addEventListener('click',async()=>{if(C.isTauri())await invoke('hide_helper');else window.close()});$('helperOpenMain').addEventListener('click',openMain);await C.watchState(v=>{state=v;render()});render();
})();
