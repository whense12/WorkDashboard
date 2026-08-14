(function(){
  const KEY='work-calendar-state-v5';
  const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+Number(n||0));return iso(d)};
  const diffDays=(s,base=todayISO())=>Math.round((parse(s)-parse(base))/86400000);
  const pretty=s=>{if(!s)return'';const d=parse(s);return `${d.getMonth()+1}.${d.getDate()}.`};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const uid=p=>`${p}-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const seed={
    version:5,
    settings:{horizon:'14',customHorizon:45,helperAlwaysOnTop:true,autostart:false},
    vendorTemplates:[
      {id:'v-daehan',name:'대한건설',person:'김OO',contact:'010-1111-1111',memo:''},
      {id:'v-mirae',name:'미래토건',person:'박OO',contact:'010-2222-2222',memo:''},
      {id:'v-dongsung',name:'동성건설',person:'이OO',contact:'010-3333-3333',memo:''},
      {id:'v-goseong',name:'고성건설',person:'최OO',contact:'010-4444-4444',memo:''}
    ],
    workTemplates:[
      {id:'wt-general',name:'일반 공사(예시)',steps:[
        {name:'시행계획',offset:0},{name:'청렴이행서약',offset:2},{name:'안전보건수준평가',offset:2},{name:'계약의뢰',offset:2},{name:'계약',offset:3},{name:'착공계 확인',offset:2},{name:'준공계',offset:20},{name:'준공검사',offset:2}
      ]},
      {id:'wt-simple',name:'간소 절차(예시)',steps:[{name:'시행계획',offset:0},{name:'계약의뢰',offset:2},{name:'계약',offset:3},{name:'착공',offset:2},{name:'준공',offset:20}]}
    ],
    projects:[
      {id:'p1',vendorId:'v-daehan',name:'배수로 정비공사',memo:'',templateId:'wt-general',steps:[
        {id:'p1s1',name:'시행계획',offset:0,dueDate:'2026-08-07',completed:true,completedAt:'2026-08-07'},
        {id:'p1s2',name:'청렴이행서약',offset:2,dueDate:'2026-08-09',completed:true,completedAt:'2026-08-09'},
        {id:'p1s3',name:'안전보건수준평가',offset:2,dueDate:'2026-08-14',completed:false,completedAt:null},
        {id:'p1s4',name:'계약의뢰',offset:2,dueDate:null,completed:false,completedAt:null},
        {id:'p1s5',name:'계약',offset:3,dueDate:null,completed:false,completedAt:null}
      ]},
      {id:'p2',vendorId:'v-mirae',name:'농로 보수공사',memo:'',templateId:'wt-simple',steps:[
        {id:'p2s1',name:'시행계획',offset:0,dueDate:'2026-08-08',completed:true,completedAt:'2026-08-08'},
        {id:'p2s2',name:'계약의뢰',offset:2,dueDate:'2026-08-12',completed:false,completedAt:null},
        {id:'p2s3',name:'계약',offset:3,dueDate:null,completed:false,completedAt:null},
        {id:'p2s4',name:'착공',offset:2,dueDate:null,completed:false,completedAt:null}
      ]},
      {id:'p3',vendorId:'v-dongsung',name:'도로 정비공사',memo:'',templateId:'wt-general',steps:[
        {id:'p3s1',name:'시행계획',offset:0,dueDate:'2026-08-06',completed:true,completedAt:'2026-08-06'},
        {id:'p3s2',name:'청렴이행서약',offset:2,dueDate:'2026-08-10',completed:false,completedAt:null},
        {id:'p3s3',name:'안전보건수준평가',offset:2,dueDate:null,completed:false,completedAt:null}
      ]},
      {id:'p4',vendorId:'v-goseong',name:'시설 보수공사',memo:'',templateId:'wt-general',steps:[
        {id:'p4s1',name:'시행계획',offset:0,dueDate:'2026-08-18',completed:false,completedAt:null},
        {id:'p4s2',name:'계약의뢰',offset:2,dueDate:null,completed:false,completedAt:null}
      ]}
    ],
    manualEvents:[
      {id:'m1',vendorId:'v-daehan',projectId:'p1',date:'2026-08-20',name:'현장 확인',memo:'현장 일정 확인',completed:false,completedAt:null}
    ]
  };

  function normalizeState(x){
    const s=x&&typeof x==='object'?x:clone(seed);
    s.version=5;
    s.settings=s.settings||clone(seed.settings);
    s.vendorTemplates=Array.isArray(s.vendorTemplates)?s.vendorTemplates:[];
    s.workTemplates=Array.isArray(s.workTemplates)?s.workTemplates:[];
    s.projects=Array.isArray(s.projects)?s.projects:[];
    s.manualEvents=Array.isArray(s.manualEvents)?s.manualEvents:[];
    s.projects.forEach(p=>{
      p.steps=Array.isArray(p.steps)?p.steps:[];
      p.steps.forEach(st=>{st.logs=Array.isArray(st.logs)?st.logs:[];st.attachments=Array.isArray(st.attachments)?st.attachments:[];st.memo=st.memo||''});
    });
    s.manualEvents.forEach(m=>{m.logs=Array.isArray(m.logs)?m.logs:[];m.attachments=Array.isArray(m.attachments)?m.attachments:[]});
    return s;
  }
  const ATTACH_DB='work-calendar-attachments-v1',ATTACH_STORE='files';
  function openAttachmentDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return}const req=indexedDB.open(ATTACH_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(ATTACH_STORE))db.createObjectStore(ATTACH_STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
  async function putAttachment(file){const db=await openAttachmentDB();const id=uid('att');const row={id,name:file.name,type:file.type||'application/octet-stream',size:file.size,lastModified:file.lastModified||Date.now(),blob:file};await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACH_STORE,'readwrite');tx.objectStore(ATTACH_STORE).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();return{id,name:row.name,type:row.type,size:row.size,lastModified:row.lastModified}}
  async function getAttachment(id){const db=await openAttachmentDB();const row=await new Promise((resolve,reject)=>{const req=db.transaction(ATTACH_STORE,'readonly').objectStore(ATTACH_STORE).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});db.close();return row}
  async function removeAttachment(id){try{const db=await openAttachmentDB();await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACH_STORE,'readwrite');tx.objectStore(ATTACH_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){console.warn('attachment delete failed',e)}}
  function formatBytes(n){n=Number(n||0);if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(n<10240?1:0)} KB`;return`${(n/1048576).toFixed(n<10485760?1:0)} MB`}
  let store=null;let memoryState=normalizeState(clone(seed));
  const isTauri=()=>!!(window.__TAURI__?.core);
  async function initStorage(){
    if(isTauri() && window.__TAURI__?.store?.load){
      try{
        store=await window.__TAURI__.store.load('work-calendar.json',{autoSave:150});
        const value=await store.get('state');
        if(value) return normalizeState(value);
        await store.set('state',clone(seed));await store.save();return normalizeState(clone(seed));
      }catch(e){console.warn('Tauri store fallback',e)}
    }
    try{const raw=localStorage.getItem(KEY);if(raw)return normalizeState(JSON.parse(raw))}catch(e){}
    try{localStorage.setItem(KEY,JSON.stringify(seed));}catch(e){} memoryState=normalizeState(clone(seed));return clone(memoryState);
  }
  async function saveState(state){state=normalizeState(state);
    if(store){await store.set('state',state);await store.save();}
    else {try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){memoryState=clone(state)}}
    try{new BroadcastChannel(KEY).postMessage({type:'state'});}catch(e){}
  }
  async function watchState(cb){
    if(store?.onKeyChange){try{return await store.onKeyChange('state',v=>v&&cb(v));}catch(e){}}
    window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{cb(JSON.parse(e.newValue))}catch(_){}}});
    try{const bc=new BroadcastChannel(KEY);bc.onmessage=async()=>{cb(await readState())};}catch(e){}
  }
  async function readState(){if(store){return normalizeState((await store.get('state'))||clone(seed))}try{return normalizeState(JSON.parse(localStorage.getItem(KEY)||'null')||clone(memoryState))}catch(e){return clone(memoryState)}}
  function vendor(state,id){return state.vendorTemplates.find(v=>v.id===id)}
  function project(state,id){return state.projects.find(p=>p.id===id)}
  function currentStep(p){return p?.steps?.find(s=>!s.completed)||null}
  function eventRecords(state){
    const rows=[];
    state.projects.forEach(p=>p.steps.forEach(s=>{if(s.dueDate)rows.push({kind:'step',id:s.id,date:s.dueDate,name:s.name,completed:!!s.completed,vendorId:p.vendorId,projectId:p.id,memo:s.memo||p.memo||'',step:s})}));
    state.manualEvents.forEach(m=>rows.push({kind:'manual',id:m.id,date:m.date,name:m.name,completed:!!m.completed,vendorId:m.vendorId,projectId:m.projectId||null,memo:m.memo||'',manual:m}));
    return rows;
  }
  function horizonDays(settings){if(settings.horizon==='all')return Infinity;if(settings.horizon==='custom')return Math.max(1,Number(settings.customHorizon||1));return Number(settings.horizon||14)}
  function dueCards(state){
    const max=horizonDays(state.settings),future=eventRecords(state).filter(e=>!e.completed&&e.date);
    const groups=new Map();
    future.forEach(e=>{const arr=groups.get(e.vendorId)||[];arr.push(e);groups.set(e.vendorId,arr)});
    const cards=[];
    groups.forEach((arr,vendorId)=>{arr.sort((a,b)=>a.date.localeCompare(b.date));const first=arr[0],d=diffDays(first.date);if(d<=max||d<0||max===Infinity)cards.push({...first,extra:arr.length-1,dday:d})});
    return cards.sort((a,b)=>a.date.localeCompare(b.date));
  }
  function ddayLabel(date){const n=diffDays(date);if(n===0)return'D-DAY';return n>0?`D-${n}`:`D+${Math.abs(n)}`}
  function ddayClass(date){const n=diffDays(date);return n<0?'overdue':n===0?'today':''}
  function projectFromTemplate(template,vendorId,name,firstDate,memo=''){
    const id=uid('p');return {id,vendorId,name,memo,templateId:template.id,steps:template.steps.map((s,i)=>({id:uid(`${id}s`),name:s.name,offset:Number(s.offset||0),dueDate:i===0?firstDate:null,completed:false,completedAt:null,memo:'',logs:[],attachments:[]}))};
  }
  function completeEvent(state,record,date=todayISO()){
    if(record.kind==='manual'){
      const m=state.manualEvents.find(x=>x.id===record.id);if(m){m.completed=true;m.completedAt=date}return null;
    }
    const p=project(state,record.projectId);if(!p)return null;const s=p.steps.find(x=>x.id===record.id);if(!s)return null;s.completed=true;s.completedAt=date;const next=currentStep(p);if(next&&!next.dueDate)next.dueDate=addDays(date,next.offset||0);return next;
  }
  function horizonLabel(settings){if(settings.horizon==='all')return'무제한';if(settings.horizon==='custom')return`D-${settings.customHorizon}`;return`D-${settings.horizon}`}
  window.WorkCore={KEY,seed,clone,uid,todayISO,parse,iso,addDays,diffDays,pretty,esc,isTauri,normalizeState,initStorage,saveState,watchState,readState,vendor,project,currentStep,eventRecords,dueCards,ddayLabel,ddayClass,horizonDays,horizonLabel,projectFromTemplate,completeEvent,putAttachment,getAttachment,removeAttachment,formatBytes};
})();
