(function(){
  // 저장 키는 v5 그대로 둔다. 키를 올리면 기존 사용자의 v5 데이터가 통째로 고아가 된다.
  // 스키마 버전은 상태 안의 version 필드와 migrate() 가 관리한다.
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
  const STATE_VERSION=6;
  // 최초 실행 상태는 재사용 기준정보(업체/업무 템플릿)만 담는다.
  // 예시 공사·일정은 seed 에 넣지 않는다 — 넣으면 실사용자가 가짜 데이터를 손으로 지워야 한다.
  const seed={
    version:STATE_VERSION,
    settings:{horizon:'14',customHorizon:45,helperAlwaysOnTop:true,autostart:false},
    pendingSelection:null,
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
    projects:[],
    manualEvents:[]
  };

  // 예시 데이터는 설정에서 명시적으로 불러올 때만 들어간다.
  // 날짜를 고정하지 않고 오늘 기준 상대일로 만든다 — 고정하면 시간이 지나 전부 지연 건이 된다.
  function demoData(base=todayISO()){
    const d=n=>addDays(base,n);
    return {
      projects:[
        {id:'demo-p1',vendorId:'v-daehan',name:'배수로 정비공사',memo:'',templateId:'wt-general',steps:[
          {id:'demo-p1s1',name:'시행계획',offset:0,dueDate:d(-6),completed:true,completedAt:d(-6)},
          {id:'demo-p1s2',name:'청렴이행서약',offset:2,dueDate:d(-4),completed:true,completedAt:d(-4)},
          {id:'demo-p1s3',name:'안전보건수준평가',offset:2,dueDate:d(1),completed:false,completedAt:null},
          {id:'demo-p1s4',name:'계약의뢰',offset:2,dueDate:null,completed:false,completedAt:null},
          {id:'demo-p1s5',name:'계약',offset:3,dueDate:null,completed:false,completedAt:null}
        ]},
        {id:'demo-p2',vendorId:'v-mirae',name:'농로 보수공사',memo:'',templateId:'wt-simple',steps:[
          {id:'demo-p2s1',name:'시행계획',offset:0,dueDate:d(-5),completed:true,completedAt:d(-5)},
          {id:'demo-p2s2',name:'계약의뢰',offset:2,dueDate:d(-1),completed:false,completedAt:null},
          {id:'demo-p2s3',name:'계약',offset:3,dueDate:null,completed:false,completedAt:null},
          {id:'demo-p2s4',name:'착공',offset:2,dueDate:null,completed:false,completedAt:null}
        ]},
        {id:'demo-p3',vendorId:'v-dongsung',name:'도로 정비공사',memo:'',templateId:'wt-general',steps:[
          {id:'demo-p3s1',name:'시행계획',offset:0,dueDate:d(-7),completed:true,completedAt:d(-7)},
          {id:'demo-p3s2',name:'청렴이행서약',offset:2,dueDate:d(-3),completed:false,completedAt:null},
          {id:'demo-p3s3',name:'안전보건수준평가',offset:2,dueDate:null,completed:false,completedAt:null}
        ]},
        {id:'demo-p4',vendorId:'v-goseong',name:'시설 보수공사',memo:'',templateId:'wt-general',steps:[
          {id:'demo-p4s1',name:'시행계획',offset:0,dueDate:d(5),completed:false,completedAt:null},
          {id:'demo-p4s2',name:'계약의뢰',offset:2,dueDate:null,completed:false,completedAt:null}
        ]}
      ],
      manualEvents:[
        {id:'demo-m1',vendorId:'v-daehan',projectId:'demo-p1',date:d(7),name:'현장 확인',memo:'현장 일정 확인',completed:false,completedAt:null}
      ]
    };
  }
  function hasDemoData(s){return s.projects.some(p=>String(p.id).startsWith('demo-'))||s.manualEvents.some(m=>String(m.id).startsWith('demo-'))}

  // 저장된 상태를 현재 스키마로 올린다. 버전을 무조건 덮어쓰지 않고 단계별로 통과시켜야
  // 다음 스키마 변경 때 기존 데이터를 안전하게 이관할 수 있다.
  function migrate(s){
    let v=Number(s.version||0);
    if(v<6){
      // v5 -> v6: 필드 구조 변경 없음. pendingSelection(창 간 딥링크)만 새로 쓰인다.
      if(!('pendingSelection' in s))s.pendingSelection=null;
      v=6;
    }
    s.version=v;
    return s;
  }

  function normalizeState(x){
    const s=migrate(x&&typeof x==='object'?x:clone(seed));
    s.settings=s.settings||clone(seed.settings);
    s.pendingSelection=s.pendingSelection||null;
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
  // ── 첨부 저장 ────────────────────────────────────────────────────────────
  // 데스크톱은 앱 전용 폴더에 실제 파일로, 웹은 IndexedDB Blob 으로 저장한다(§16.2).
  //
  // 권한 표면을 좁히려고 "사용자가 고른 임의 경로에 쓰기"를 아예 만들지 않았다.
  // 백업 내보내기도 앱 폴더에 쓴 뒤 그 폴더를 탐색기로 열어 주는 방식이라,
  // 앱은 자기 데이터 디렉터리 밖을 건드릴 수 없다(§26).
  const ATTACH_DIR='attachments',BACKUP_DIR='backups',BACKUP_KEEP=7;
  const SAFE_ID=/^[A-Za-z0-9_-]+$/;
  const fsApi=()=>window.__TAURI__?.fs;
  const pathApi=()=>window.__TAURI__?.path;
  const openerApi=()=>window.__TAURI__?.opener;
  const nativeFiles=()=>!!(window.__TAURI__?.core&&fsApi()?.writeFile);
  const appDir=()=>fsApi().BaseDirectory.AppLocalData;
  const extOf=n=>{const m=/\.([A-Za-z0-9]{1,12})$/.exec(String(n||''));return m?m[1].toLowerCase():'bin'};
  function attachPath(entityId,attId,ext){
    // 물리 파일명에 사용자 입력이 절대 들어가지 않게 한다. id 는 uid() 산출물이지만 한 번 더 막는다.
    if(!SAFE_ID.test(String(entityId))||!SAFE_ID.test(String(attId)))throw new Error('첨부 경로에 쓸 수 없는 식별자입니다.');
    return `${ATTACH_DIR}/${entityId}/${attId}.${SAFE_ID.test(ext)?ext:'bin'}`;
  }
  const ATTACH_DB='work-calendar-attachments-v1',ATTACH_STORE='files';
  function openAttachmentDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return}const req=indexedDB.open(ATTACH_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(ATTACH_STORE))db.createObjectStore(ATTACH_STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
  async function idbPut(row){const db=await openAttachmentDB();await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACH_STORE,'readwrite');tx.objectStore(ATTACH_STORE).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
  async function idbGet(id){const db=await openAttachmentDB();const row=await new Promise((resolve,reject)=>{const req=db.transaction(ATTACH_STORE,'readonly').objectStore(ATTACH_STORE).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});db.close();return row}
  async function idbDelete(id){try{const db=await openAttachmentDB();await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACH_STORE,'readwrite');tx.objectStore(ATTACH_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){console.warn('attachment delete failed',e)}}

  // 발주서 §15 의 AttachmentMeta 형태로 돌려준다. backend 로 어디에 실물이 있는지 구분한다.
  async function storeAttachmentBytes(entityId,meta,bytes){
    if(nativeFiles()){
      const rel=attachPath(entityId,meta.id,extOf(meta.name)),fs=fsApi();
      await fs.mkdir(`${ATTACH_DIR}/${entityId}`,{baseDir:appDir(),recursive:true});
      await fs.writeFile(rel,bytes,{baseDir:appDir()});
      return {...meta,backend:'tauri-fs',relativePath:rel};
    }
    await idbPut({...meta,blob:new Blob([bytes],{type:meta.type||'application/octet-stream'})});
    return {...meta,backend:'indexeddb',relativePath:undefined};
  }
  async function putAttachment(file,entityId){
    const meta={id:uid('att'),name:file.name,type:file.type||'application/octet-stream',size:file.size,addedAt:new Date().toISOString()};
    return storeAttachmentBytes(entityId,meta,new Uint8Array(await file.arrayBuffer()));
  }
  // 실물이 없으면 ATTACHMENT_MISSING 을 던진다. 호출부는 파괴적이지 않게 안내만 한다(인수조건 D).
  async function readAttachment(meta){
    if(meta?.backend==='tauri-fs'&&meta.relativePath){
      if(!nativeFiles())throw new Error('ATTACHMENT_MISSING');
      const fs=fsApi();
      if(!await fs.exists(meta.relativePath,{baseDir:appDir()}))throw new Error('ATTACHMENT_MISSING');
      return {bytes:await fs.readFile(meta.relativePath,{baseDir:appDir()}),name:meta.name,type:meta.type};
    }
    const row=await idbGet(meta.id);
    if(!row?.blob)throw new Error('ATTACHMENT_MISSING');
    return {bytes:new Uint8Array(await row.blob.arrayBuffer()),name:row.name||meta.name,type:row.type||meta.type};
  }
  async function deleteAttachment(meta){
    if(!meta)return;
    if(meta.backend==='tauri-fs'&&meta.relativePath&&nativeFiles()){
      try{await fsApi().remove(meta.relativePath,{baseDir:appDir()})}catch(e){console.warn('첨부 파일 삭제 실패',e)}
      return;
    }
    await idbDelete(meta.id);
  }
  function attachmentsOf(entities){return entities.flatMap(e=>Array.isArray(e?.attachments)?e.attachments:[])}
  async function purgeAttachments(metas){for(const m of metas)await deleteAttachment(m)}
  // 데스크톱에서 첨부를 OS 기본 프로그램으로 연다. 웹은 호출부가 Blob 다운로드로 처리한다.
  async function revealAttachment(meta){
    if(!(meta?.backend==='tauri-fs'&&meta.relativePath&&openerApi()&&pathApi()))return false;
    const base=await pathApi().appLocalDataDir();
    await openerApi().openPath(await pathApi().join(base,meta.relativePath));
    return true;
  }
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
  // Tauri Store 의 onKeyChange 는 "내가 방금 쓴 값"에도 발화한다. 그대로 두면 저장할 때마다
  // 상태 객체가 통째로 교체되어, 템플릿 편집기처럼 배열을 직접 참조하는 화면에서 입력이 유실된다.
  // _rev 로 자기가 쓴 변경인지 구분해 걸러낸다.
  let lastRev=0;
  async function saveState(state){state=normalizeState(state);
    state._rev=lastRev=(Number(state._rev)||0)+1;
    if(store){await store.set('state',state);await store.save();}
    else {try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){memoryState=clone(state)}}
    try{new BroadcastChannel(KEY).postMessage({type:'state'});}catch(e){}
  }
  async function watchState(cb){
    // 콜백에는 항상 정규화된 상태를 넘긴다. 이전에는 store 경로에서 원본을 그대로 넘겨
    // 정규화되지 않은 객체가 화면으로 들어갔다.
    const relay=v=>{if(!v)return;const s=normalizeState(v);if(s._rev&&s._rev===lastRev)return;cb(s)};
    if(store?.onKeyChange){try{return await store.onKeyChange('state',relay);}catch(e){}}
    window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{relay(JSON.parse(e.newValue))}catch(_){}}});
    try{const bc=new BroadcastChannel(KEY);bc.onmessage=async()=>{relay(await readState())};}catch(e){}
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
  // 완료 취소. 잘못 누른 `OK 완료` 를 되돌리는 유일한 경로다.
  // 뒤 단계에 이미 날짜가 잡혀 있어도 지우지 않는다 — 사용자가 직접 넣은 날짜인지
  // 자동 계산된 날짜인지 구분할 방법이 없으므로 임의 삭제는 데이터 손실이다.
  // 대신 어떤 날짜가 남았는지 호출부에 돌려주어 사용자에게 알린다.
  function reopenEvent(state,record){
    if(record.kind==='manual'){
      const m=state.manualEvents.find(x=>x.id===record.id);if(!m)return null;
      m.completed=false;m.completedAt=null;return {kept:null};
    }
    const p=project(state,record.projectId);if(!p)return null;
    const i=p.steps.findIndex(x=>x.id===record.id);if(i<0)return null;
    p.steps[i].completed=false;p.steps[i].completedAt=null;
    const later=p.steps.slice(i+1).find(x=>!x.completed&&x.dueDate);
    return {kept:later?{name:later.name,dueDate:later.dueDate}:null};
  }
  function horizonLabel(settings){if(settings.horizon==='all')return'무제한';if(settings.horizon==='custom')return`D-${settings.customHorizon}`;return`D-${settings.horizon}`}

  // ── 백업 / 복원 ──────────────────────────────────────────────────────────
  // 발주서 §16.3. 상태 JSON 만 있는 백업은 첨부가 생기고 나면 백업이 아니다.
  // 첨부 실물까지 한 ZIP 에 담고, manifest 로 무엇이 들어갔는지 남긴다.
  const SAFE_BACKUP=/^[A-Za-z0-9_.-]+\.zip$/;
  const encJson=o=>new TextEncoder().encode(JSON.stringify(o,null,1));
  function allAttachmentMetas(state){
    const out=[];
    state.projects.forEach(p=>p.steps.forEach(s=>out.push(...(s.attachments||[]))));
    state.manualEvents.forEach(m=>out.push(...(m.attachments||[])));
    return out;
  }
  async function buildBackup(state){
    if(!window.WorkZip?.supported())throw new Error('이 환경에서는 압축을 만들 수 없습니다.');
    const metas=allAttachmentMetas(state),entries=[],missing=[];
    for(const m of metas){
      try{const {bytes}=await readAttachment(m);entries.push({name:`${ATTACH_DIR}/${m.id}.${extOf(m.name)}`,data:bytes})}
      catch(e){missing.push(m.name)}
    }
    const manifest={format:'work-calendar-backup',formatVersion:1,stateVersion:state.version,
      createdAt:new Date().toISOString(),attachmentsTotal:metas.length,
      attachmentsIncluded:entries.length,attachmentsMissing:missing};
    return {bytes:await window.WorkZip.create([{name:'manifest.json',data:encJson(manifest)},{name:'state.json',data:encJson(state)},...entries]),manifest};
  }
  async function readBackup(bytes){
    const files=await window.WorkZip.read(bytes),st=files.get('state.json');
    if(!st)throw new Error('백업 파일이 아닙니다. state.json 이 없습니다.');
    const mf=files.get('manifest.json');
    return {state:normalizeState(JSON.parse(new TextDecoder().decode(st))),
            manifest:mf?JSON.parse(new TextDecoder().decode(mf)):null,files};
  }
  // 복원은 첨부 실물을 먼저 되살린 뒤 메타데이터의 경로를 새 위치로 맞춘다. id 는 그대로 둔다.
  async function restoreBackup(bytes){
    const {state,manifest,files}=await readBackup(bytes),byId=new Map();
    for(const [name,data] of files){const m=/^attachments\/([A-Za-z0-9_-]+)\./.exec(name);if(m)byId.set(m[1],data)}
    const revive=async entity=>{
      const list=entity.attachments||[];
      for(let i=0;i<list.length;i++){
        const data=byId.get(list[i].id);if(!data)continue;
        list[i]=await storeAttachmentBytes(entity.id,{...list[i],backend:undefined,relativePath:undefined},data);
      }
    };
    for(const p of state.projects)for(const s of p.steps)await revive(s);
    for(const ev of state.manualEvents)await revive(ev);
    return {state,manifest};
  }

  // 백업 파일은 앱 폴더 안에서만 다룬다. 임의 경로 쓰기 권한을 만들지 않기 위해서다(§26).
  async function writeBackupFile(name,bytes){
    if(!SAFE_BACKUP.test(name))throw new Error('잘못된 백업 파일명입니다.');
    const fs=fsApi();await fs.mkdir(BACKUP_DIR,{baseDir:appDir(),recursive:true});
    await fs.writeFile(`${BACKUP_DIR}/${name}`,bytes,{baseDir:appDir()});
  }
  async function listBackups(){
    if(!nativeFiles())return [];
    try{
      const fs=fsApi();
      if(!await fs.exists(BACKUP_DIR,{baseDir:appDir()}))return [];
      return (await fs.readDir(BACKUP_DIR,{baseDir:appDir()}))
        .filter(r=>r.isFile&&SAFE_BACKUP.test(r.name)).map(r=>r.name).sort().reverse();
    }catch(e){console.warn('백업 목록을 읽지 못했습니다.',e);return []}
  }
  async function readBackupFile(name){
    if(!SAFE_BACKUP.test(name))throw new Error('잘못된 백업 파일명입니다.');
    return fsApi().readFile(`${BACKUP_DIR}/${name}`,{baseDir:appDir()});
  }
  async function rotateBackups(keep=BACKUP_KEEP){
    const all=await listBackups();
    for(const n of all.slice(keep)){try{await fsApi().remove(`${BACKUP_DIR}/${n}`,{baseDir:appDir()})}catch(e){console.warn(e)}}
  }
  async function revealBackups(){
    if(!(nativeFiles()&&openerApi()&&pathApi()))return false;
    const fs=fsApi();await fs.mkdir(BACKUP_DIR,{baseDir:appDir(),recursive:true});
    const full=await pathApi().join(await pathApi().appLocalDataDir(),BACKUP_DIR);
    await openerApi().openPath(full);return true;
  }
  // 하루 한 번 조용히. 버튼을 눌러야만 백업된다면 사용자가 기억해야 하고, 그건 또 하나의 업무다.
  // 성공은 알리지 않는다. 실패했을 때만 호출부가 알린다.
  async function maybeAutoBackup(state){
    if(!nativeFiles()||!window.WorkZip?.supported())return null;
    const today=todayISO();
    if(state.settings.lastAutoBackup===today)return null;
    try{
      const {bytes,manifest}=await buildBackup(state);
      await writeBackupFile(`backup-${today}.zip`,bytes);
      await rotateBackups();
      state.settings.lastAutoBackup=today;await saveState(state);
      return {ok:true,manifest};
    }catch(e){console.warn('자동 백업 실패',e);return {ok:false,error:String(e?.message||e)}}
  }
  // 옛 첨부는 데스크톱에서도 IndexedDB 에 있다. 사용자가 "옮기기" 버튼을 눌러야 한다면
  // 그것도 또 하나의 일이다. 시작할 때 조용히 옮기고, 옮긴 뒤에만 원본을 지운다(§21).
  async function migrateAttachmentsToDisk(state){
    if(!nativeFiles())return 0;
    let moved=0;
    const walk=async entity=>{
      const list=entity.attachments||[];
      for(let i=0;i<list.length;i++){
        const meta=list[i];
        if(meta.backend==='tauri-fs')continue;
        try{
          const row=await idbGet(meta.id);if(!row?.blob)continue;
          list[i]=await storeAttachmentBytes(entity.id,{...meta,backend:undefined,relativePath:undefined},new Uint8Array(await row.blob.arrayBuffer()));
          await idbDelete(meta.id);moved++;
        }catch(e){console.warn('첨부 이관 실패',meta.name,e)}
      }
    };
    for(const p of state.projects)for(const s of p.steps)await walk(s);
    for(const ev of state.manualEvents)await walk(ev);
    if(moved)await saveState(state);
    return moved;
  }
  window.WorkCore={KEY,STATE_VERSION,seed,demoData,hasDemoData,clone,uid,todayISO,parse,iso,addDays,diffDays,pretty,esc,isTauri,nativeFiles,migrate,normalizeState,initStorage,saveState,watchState,readState,vendor,project,currentStep,eventRecords,dueCards,ddayLabel,ddayClass,horizonDays,horizonLabel,projectFromTemplate,completeEvent,reopenEvent,
    putAttachment,readAttachment,deleteAttachment,attachmentsOf,purgeAttachments,revealAttachment,migrateAttachmentsToDisk,formatBytes,
    buildBackup,readBackup,restoreBackup,writeBackupFile,listBackups,readBackupFile,rotateBackups,revealBackups,maybeAutoBackup};
})();
