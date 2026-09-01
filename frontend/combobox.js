(function(){
  // ── 검색되는 선택 칸 ──────────────────────────────────────────────────────
  // 업체가 나오는 곳 세 군데가 전부 맨 <select> 였다. 업체가 50곳 넘어가면
  // 드롭다운을 눈으로 훑어야 하고, 목록에 없으면 다른 화면으로 나가서 만들고 돌아와야 했다.
  //
  // 기존 <select> 를 없애지 않고 그 위에 씌운다. select 가 계속 값의 주인이라
  // 저장 코드와 검사는 하나도 고치지 않아도 된다(점진적 향상).
  //
  // 역할·키보드는 W3C APG 콤보박스 패턴을 따른다:
  // role=combobox / aria-expanded / aria-controls / aria-activedescendant,
  // ↑↓ 이동 · Enter 선택 · Esc 닫기 · Tab 로 빠져나감.
  let seq=0;
  const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const registry=new Map();   // select -> controller

  function enhance(select,opts={}){
    if(!select||registry.has(select))return registry.get(select);
    const id=`cb${++seq}`;
    const wrap=document.createElement('div');
    wrap.className='cb';
    select.parentNode.insertBefore(wrap,select);
    wrap.appendChild(select);
    select.classList.add('cb-native');
    select.setAttribute('tabindex','-1');
    select.setAttribute('aria-hidden','true');

    const input=document.createElement('input');
    input.type='text';input.className='cb-input';input.autocomplete='off';
    input.setAttribute('role','combobox');
    input.setAttribute('aria-expanded','false');
    input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-controls',`${id}-list`);
    if(opts.placeholder)input.placeholder=opts.placeholder;
    const lab=select.getAttribute('aria-label')||document.querySelector(`label[for="${select.id}"]`)?.textContent;
    if(lab)input.setAttribute('aria-label',lab.trim());
    if(select.id)input.id=`${select.id}Input`;

    const list=document.createElement('ul');
    list.className='cb-list';list.id=`${id}-list`;list.setAttribute('role','listbox');list.hidden=true;
    wrap.appendChild(input);wrap.appendChild(list);

    let rows=[],active=-1,open=false;

    const options=()=>[...select.options].map(o=>({value:o.value,label:o.textContent}));
    const selected=()=>options().find(o=>o.value===select.value)||null;
    const showText=()=>{input.value=selected()?.label||''};

    function build(q){
      const all=options();
      const nq=norm(q);
      const hits=nq?all.filter(o=>norm(o.label).includes(nq)):all;
      rows=hits.map(o=>({type:'item',...o}));
      // 목록에 없을 때만 만들기 줄을 낸다. 같은 이름이 있으면 내지 않는다.
      const dup=all.some(o=>norm(o.label)===nq);
      if(opts.allowCreate&&nq&&!dup)rows.push({type:'create',value:'__create__',label:(opts.createLabel||(n=>`‘${n}’ 새로 만들기`))(q.trim())});
      list.innerHTML=rows.map((r,i)=>`<li class="cb-opt${r.type==='create'?' create':''}" role="option" id="${id}-o${i}" aria-selected="${r.type==='item'&&r.value===select.value}">${esc(r.label)}</li>`).join('')
        ||`<li class="cb-empty" role="option" aria-disabled="true">찾는 것이 없습니다</li>`;
      setActive(rows.length?0:-1);
    }
    function setActive(i){
      active=i;
      [...list.querySelectorAll('.cb-opt')].forEach((el,k)=>el.classList.toggle('active',k===i));
      if(i>=0){input.setAttribute('aria-activedescendant',`${id}-o${i}`);list.querySelectorAll('.cb-opt')[i]?.scrollIntoView({block:'nearest'})}
      else input.removeAttribute('aria-activedescendant');
    }
    function openList(q){open=true;list.hidden=false;input.setAttribute('aria-expanded','true');wrap.classList.add('open');build(q??'')}
    function closeList(){open=false;list.hidden=true;input.setAttribute('aria-expanded','false');wrap.classList.remove('open');setActive(-1)}
    function commit(value){
      select.value=value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      showText();closeList();
    }
    async function pick(i){
      const r=rows[i];if(!r)return;
      if(r.type==='create'){
        const name=input.value.trim();
        if(!name||!opts.onCreate)return;
        const newValue=await opts.onCreate(name);
        if(!newValue){closeList();showText();return}
        if(![...select.options].some(o=>o.value===newValue)){
          const o=document.createElement('option');o.value=newValue;o.textContent=name;select.appendChild(o);
        }
        commit(newValue);return;
      }
      commit(r.value);
    }

    input.addEventListener('focus',()=>openList(''));
    input.addEventListener('click',()=>{if(!open)openList('')});
    input.addEventListener('input',()=>openList(input.value));
    input.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'){e.preventDefault();if(!open)openList('');else setActive(Math.min(active+1,rows.length-1));return}
      if(e.key==='ArrowUp'){e.preventDefault();if(open)setActive(Math.max(active-1,0));return}
      if(e.key==='Enter'){if(open&&active>=0){e.preventDefault();pick(active)}return}
      if(e.key==='Escape'){if(open){e.stopPropagation();closeList();showText()}return}
      if(e.key==='Tab')closeList();
    });
    // mousedown 으로 잡아야 blur 보다 먼저 처리된다.
    list.addEventListener('mousedown',e=>{
      const li=e.target.closest('.cb-opt');if(!li)return;
      e.preventDefault();pick([...list.querySelectorAll('.cb-opt')].indexOf(li));
    });
    input.addEventListener('blur',()=>{setTimeout(()=>{if(!wrap.contains(document.activeElement)){closeList();showText()}},0)});
    // 원래 select 가 값의 주인이다. 값이 바깥에서 바뀌면(프로그램·키보드·보조기기)
    // 보이는 글자도 따라가야 한다 — 안 그러면 화면과 실제 값이 조용히 갈라진다.
    select.addEventListener('change',()=>{if(document.activeElement!==input)showText()});

    // app.js 가 fillSelects() 로 <option> 을 통째로 다시 그린다. 그때 표시 글자도 따라와야 한다.
    new MutationObserver(()=>{if(!open)showText()}).observe(select,{childList:true});

    const ctl={select,input,sync:showText,focus:()=>input.focus()};
    registry.set(select,ctl);
    showText();
    return ctl;
  }

  /** 프로그램이 select.value 를 직접 바꾼 뒤 표시 글자를 맞춘다(모달을 열 때 한 번). */
  function syncAll(root=document){
    registry.forEach((ctl,select)=>{if(root===document||root.contains(select))ctl.sync()});
  }
  window.WorkCombo={enhance,syncAll};
})();
