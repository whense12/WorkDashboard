/* 운영표 — 화면의 모든 참가일ㆍ건수는 expand.js 계산값. 손으로 적은 숫자 없음.
   문구는 부서 문체 규칙: 개조식(-함/-임/-음), 날짜 `2026. 9. 12.(토)`, 줄표 없음, 가운뎃점 ㆍ */
(function(){
"use strict";
var W=window.WD, A=document.getElementById("app"), WL=document.getElementById("widget-layer");
var cur=W.events[0].id, editing=null, undo=[], note=null, showW=true;

function el(t,c,x){var n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n}
function esc(s){return String(s).replace(/[&<>"]/g,function(m){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]})}
var KO=W.WD_KO;
function dFull(d){var p=d.split("-");return p[0]+". "+(+p[1])+". "+(+p[2])+".("+KO[W.weekdayISO(d)-1]+")"}
function dMD(d){var p=d.split("-");return (+p[1])+". "+(+p[2])+"."}

function ev(){return W.eventById(cur)}
function plansOf(e){return W.plans.filter(function(p){return p.event_id===e.id})}
/* 운영일 = 그 행사에서 실제로 한 곳이라도 나오는 날 */
function daysOf(e){
  var set={};
  plansOf(e).forEach(function(p){
    W.expandPlan(p,W.exceptions,{start:e.start_date,end:e.end_date}).dates.forEach(function(d){set[d]=1});
  });
  return Object.keys(set).sort();
}
function exOf(p,d){for(var i=0;i<W.exceptions.length;i++){var x=W.exceptions[i];if(x.plan_id===p.id&&x.date===d)return x}return null}
function planned(p,d){return p.weekdays.indexOf(W.weekdayISO(d))>=0}
function comes(p,d){var x=exOf(p,d);if(x)return x.type==="include";return planned(p,d)}

function apply(fn,undoFn,msg){undo.push(undoFn);note=msg;fn();draw()}

function toggleCell(p,d){
  var x=exOf(p,d), was=comes(p,d);
  if(x){
    var i=W.exceptions.indexOf(x);
    apply(function(){W.exceptions.splice(i,1)},function(){W.exceptions.splice(i,0,x)},
      dFull(d)+" "+W.vendorById(p.vendor_id).name+" 예외를 지움. 나오는 요일대로 돌아감.");
  }else{
    var nx={id:"X"+(W.exceptions.length+90),plan_id:p.id,date:d,type:was?"exclude":"include",reason:""};
    apply(function(){W.exceptions.push(nx)},function(){W.exceptions.pop()},
      dFull(d)+" "+W.vendorById(p.vendor_id).name+(was?" 그날만 빠짐으로 표시함.":" 그날만 나옴으로 표시함.")+" 나오는 요일은 바뀌지 않음.");
  }
}
function toggleReply(p){
  var old=p.status;
  apply(function(){p.status=old==="confirmed"?"needs_confirmation":"confirmed"},
        function(){p.status=old},
        W.vendorById(p.vendor_id).name+(old==="confirmed"?" 회신 없음으로 되돌림.":" 회신 받음으로 표시함."));
}

/* ── 그리기 ─────────────────────────────────────────────────────── */
function draw(){
  A.textContent="";
  A.appendChild(sideEvents());
  A.appendChild(sheet());
  WL.textContent="";
  if(showW){
    WL.appendChild(widget());
    var x=el("button","wclose","×");x.type="button";x.title="위젯 감춤";
    x.addEventListener("click",function(){showW=false;draw()});
    WL.appendChild(x);
  }else{
    var o=el("button","btn wopen","바탕화면 위젯 보기");o.type="button";
    o.addEventListener("click",function(){showW=true;draw()});
    WL.appendChild(o);
  }
}

function sideEvents(){
  var s=el("nav","events");
  s.appendChild(el("h2",null,"행사"));
  W.events.forEach(function(e){
    var b=el("button","ev");b.type="button";
    b.setAttribute("aria-current",e.id===cur?"true":"false");
    b.appendChild(el("span","nm",e.name));
    b.appendChild(el("span","pd",dMD(e.start_date)+"~"+dMD(e.end_date)));
    b.addEventListener("click",function(){cur=e.id;editing=null;note=null;draw()});
    s.appendChild(b);
  });
  return s;
}

function sheet(){
  var e=ev(), ps=plansOf(e), days=daysOf(e), box=el("main","sheet");

  var t=el("h1","doc-title",e.name+" 참가업체 운영표");
  box.appendChild(t);

  var noReply=ps.filter(function(p){return p.status==="needs_confirmation"}).length;
  var lead=el("p","lead");
  lead.textContent="❖ 참가업체 "+ps.length+"곳ㆍ운영 "+days.length+"일."+
    (noReply?" 회신 없는 곳 "+noReply+"곳임.":" 전부 회신 받았음.");
  box.appendChild(lead);

  var dl=el("dl","meta");
  [["기  간",days.length?dFull(days[0])+" ~ "+dFull(days[days.length-1]).replace(/^\d{4}\. /,"")+", "+days.length+"일간"
      :dFull(e.start_date)+" ~ "+dFull(e.end_date).replace(/^\d{4}\. /,"")],
   ["장  소",e.location],
   ["운영일",days.length?(function(){var s={};days.forEach(function(d){s[W.weekdayISO(d)]=1});
     return Object.keys(s).map(Number).sort(function(x,y){return x-y}).map(function(i){return KO[i-1]}).join("ㆍ")+"요일"})():"없음"]
  ].forEach(function(r){dl.appendChild(el("dt",null,r[0]));dl.appendChild(el("dd",null,r[1]))});
  box.appendChild(dl);

  if(!ps.length){
    box.appendChild(el("p","empty","이 행사에 등록된 업체가 없음. 업체를 등록하면 여기에 운영표가 생김."));
    return box;
  }

  box.appendChild(gridTable(e,ps,days));
  box.appendChild(cmdRow(e,ps,days));
  if(note){
    var tt=el("p","toast");
    tt.appendChild(el("span",null,note));
    var u=el("button","btn","되돌리기");u.type="button";
    u.addEventListener("click",popUndo);
    tt.appendChild(u); tt.appendChild(el("span","kbd","Ctrl+Z"));
    box.appendChild(tt);
  }
  if(editing) box.appendChild(editPane(ps,days));
  return box;
}

function gridTable(e,ps,days){
  var wrap=el("div","tablewrap"), tb=el("table","grid");
  var cg=el("colgroup");
  var c0=document.createElement("col");c0.style.width="212px";cg.appendChild(c0);
  days.forEach(function(){var c=document.createElement("col");c.style.width="26px";cg.appendChild(c)});
  var cn=document.createElement("col");cn.style.width="44px";cg.appendChild(cn);
  var cm=document.createElement("col");cm.style.width="108px";cg.appendChild(cm);
  tb.appendChild(cg);
  var thead=el("thead"), r1=el("tr"), r2=el("tr");
  var c1=el("th","vcol","업  체");c1.rowSpan=2;r1.appendChild(c1);
  var m=null,span=null;
  days.forEach(function(d){
    var mo=+d.split("-")[1];
    if(mo!==m){m=mo;span=el("th",null,mo+"월");span.colSpan=1;r1.appendChild(span)}
    else span.colSpan++;
    var h=el("th",(W.weekdayISO(d)===1?"wk":""));
    h.innerHTML=(+d.split("-")[2])+"<br>"+KO[W.weekdayISO(d)-1];
    h.title=dFull(d);
    r2.appendChild(h);
  });
  var n1=el("th","num","일수");n1.rowSpan=2;r1.appendChild(n1);
  var n2=el("th","memo","비  고");n2.rowSpan=2;r1.appendChild(n2);
  thead.appendChild(r1);thead.appendChild(r2);tb.appendChild(thead);

  var body=el("tbody");
  ps.slice().sort(function(a,b){return W.vendorById(a.vendor_id).name.localeCompare(W.vendorById(b.vendor_id).name,"ko")})
  .forEach(function(p){
    var v=W.vendorById(p.vendor_id), tr=el("tr");
    var th=el("th");th.title=v.name;
    var ck=el("button","chk",p.status==="confirmed"?"■":"□");
    ck.type="button";ck.title=p.status==="confirmed"?"회신 받음. 누르면 되돌림":"회신 없음. 누르면 받음으로 표시";
    ck.addEventListener("click",function(ev2){ev2.stopPropagation();toggleReply(p)});
    th.appendChild(ck);th.appendChild(document.createTextNode(" "+v.name));
    tr.appendChild(th);

    var n=0;
    days.forEach(function(d){
      var x=exOf(p,d), on=comes(p,d);
      var td=el("td","day"+(W.weekdayISO(d)>=6?" sat":"")+(W.weekdayISO(d)===1?" wk":"")+(x?" hasex":""));
      if(on)n++;
      var mark=on?(p.status==="confirmed"?"■":"□"):(planned(p,d)?"─":"");
      var sp=el("span","mk"+(on&&p.status!=="confirmed"?" no":"")+(x?" ex":""),mark);
      td.appendChild(sp);
      td.title=dFull(d)+" "+v.name+(on?(x?" 그날만 나옴":" 참가"):(x?" 그날만 빠짐":" 해당 없음"));
      td.tabIndex=-1;
      td.addEventListener("click",function(){toggleCell(p,d)});
      tr.appendChild(td);
    });
    tr.appendChild(el("td","num",String(n)));
    var ex=W.exceptions.filter(function(x2){return x2.plan_id===p.id}).sort(function(a,b){return a.date<b.date?-1:1});
    var memo=ex.map(function(x2){return dMD(x2.date)+(x2.type==="include"?" 나옴":" 빠짐")}).join("ㆍ");
    var mtd=el("td","memo",memo);mtd.title=memo;
    tr.appendChild(mtd);
    body.appendChild(tr);
  });
  tb.appendChild(body);wrap.appendChild(tb);
  return wrap;
}

function cmdRow(e,ps,days){
  var c=el("div","cmd");
  c.appendChild(el("span","legend","■ 참가ㆍ□ 회신 없음ㆍ─ 그날만 빠짐. 칸을 누르면 그날만 바뀌고 나오는 요일은 그대로 둠."));
  var b1=el("button","btn","나오는 요일 고치기");b1.type="button";
  b1.addEventListener("click",function(){editing=editing?null:{plan:ps[0].id,w:ps[0].weekdays.slice()};note=null;draw()});
  var b2=el("button","btn pri","표 내려받기");b2.type="button";
  b2.addEventListener("click",function(){csv(e,ps,days)});
  var b3=el("button","btn","되돌리기");b3.type="button";b3.disabled=!undo.length;
  b3.addEventListener("click",popUndo);
  c.appendChild(b1);c.appendChild(b2);c.appendChild(b3);c.appendChild(el("span","kbd","Ctrl+Z"));
  return c;
}

function editPane(ps,days){
  var st=editing, p=W.planById(st.plan), v=W.vendorById(p.vendor_id);
  var box=el("section","edit");
  box.appendChild(el("h3",null,v.name+" — 나오는 요일"));

  var sel=document.createElement("select");
  sel.style.cssText="font:inherit;border:1px solid var(--line);padding:3px 6px;margin-bottom:10px;border-radius:0";
  ps.forEach(function(q){var o=document.createElement("option");o.value=q.id;
    o.textContent=W.vendorById(q.vendor_id).name;o.selected=q.id===st.plan;sel.appendChild(o)});
  sel.addEventListener("change",function(){var q=W.planById(sel.value);editing={plan:q.id,w:q.weekdays.slice()};draw()});
  box.appendChild(sel);

  var row=el("div","wdays");
  KO.forEach(function(k,i){
    var b=el("button","wd",k);b.type="button";
    b.setAttribute("aria-pressed",st.w.indexOf(i+1)>=0?"true":"false");
    b.addEventListener("click",function(){
      var j=st.w.indexOf(i+1); if(j>=0)st.w.splice(j,1); else st.w.push(i+1); draw();
    });
    row.appendChild(b);
  });
  box.appendChild(row);

  var before=W.expandPlan(p,W.exceptions,null).dates;
  var trial={id:p.id,event_id:p.event_id,vendor_id:p.vendor_id,start_date:p.start_date,end_date:p.end_date,weekdays:st.w};
  var after=st.w.length?W.expandPlan(trial,W.exceptions,null).dates:[];
  var bs={};before.forEach(function(d){bs[d]=1});
  var as={};after.forEach(function(d){as[d]=1});
  var add=after.filter(function(d){return !bs[d]}), rem=before.filter(function(d){return !as[d]});

  var diff=el("div","diff");
  [["늘어나는 날 "+add.length+"일",add],["빠지는 날 "+rem.length+"일",rem]].forEach(function(col){
    var c=el("div");c.appendChild(el("div","h",col[0]));
    var ul=el("ul");col[1].forEach(function(d){ul.appendChild(el("li",null,dMD(d)+"("+KO[W.weekdayISO(d)-1]+")"))});
    c.appendChild(ul);diff.appendChild(c);
  });
  box.appendChild(diff);

  var f=el("div","cmd");
  var save=el("button","btn pri","저장 · +"+add.length+"일 −"+rem.length+"일");save.type="button";
  save.disabled=!st.w.length||(!add.length&&!rem.length);
  if(!st.w.length){var r=el("span","legend","요일을 한 개 이상 고를 것");f.appendChild(r)}
  save.addEventListener("click",function(){
    var old=p.weekdays.slice(), nw=st.w.slice();
    editing=null;
    apply(function(){p.weekdays=nw},function(){p.weekdays=old},
      v.name+" 나오는 요일을 "+nw.slice().sort().map(function(i){return KO[i-1]}).join("ㆍ")+"로 바꿈. +"+add.length+"일 −"+rem.length+"일.");
  });
  var cancel=el("button","btn","그만두기");cancel.type="button";
  cancel.addEventListener("click",function(){editing=null;draw()});
  f.appendChild(cancel);f.appendChild(save);
  box.appendChild(f);
  return box;
}

function popUndo(){
  if(!undo.length)return;
  undo.pop()(); note="되돌렸음."; draw();
}

function csv(e,ps,days){
  var rows=[["업체"].concat(days.map(dMD)).concat(["일수","비고"])];
  ps.forEach(function(p){
    var v=W.vendorById(p.vendor_id),n=0,row=[v.name];
    days.forEach(function(d){var on=comes(p,d);if(on)n++;row.push(on?(p.status==="confirmed"?"O":"?"):"")});
    var ex=W.exceptions.filter(function(x){return x.plan_id===p.id})
      .map(function(x){return dMD(x.date)+(x.type==="include"?" 나옴":" 빠짐")}).join(" · ");
    row.push(n);row.push(ex);rows.push(row);
  });
  var body=rows.map(function(r){return r.map(function(c){return /[",]/.test(c)?'"'+String(c).replace(/"/g,'""')+'"':c}).join(",")}).join("\r\n");
  var b=new Blob(["﻿"+body],{type:"text/csv;charset=utf-8"});
  var a=document.createElement("a");a.href=URL.createObjectURL(b);
  a.download=e.name+"_운영표.csv";a.click();
  note="표를 CSV로 내려받았음. 결재 문서에 붙일 수 있음."; draw();
}

/* ── 위젯: 다음 운영일 하나만 말함 ───────────────────────────────── */
function widget(){
  var today=W.TODAY, best=null;
  W.events.forEach(function(e){
    daysOf(e).forEach(function(d){
      if(d>=today&&(!best||d<best.d))best={d:d,e:e};
    });
  });
  var b=el("button","widget");b.type="button";
  var L=el("div");
  if(best){
    var p=best.d.split("-");
    L.appendChild(el("div","d",(+p[1])+"월 "+(+p[2])+"일"));
    L.appendChild(el("div","dw","("+KO[W.weekdayISO(best.d)-1]+")"));
  }else{L.appendChild(el("div","d","—"))}
  var R=el("div","r");
  if(best){
    var ps=plansOf(best.e).filter(function(q){return comes(q,best.d)});
    var no=ps.filter(function(q){return q.status==="needs_confirmation"}).length;
    R.appendChild(el("div","n",best.e.name));
    R.appendChild(el("div","big",ps.length+"곳 나옴"));
    var line=el("div","n");
    if(no){var s=el("span","no","회신 없는 곳 "+no);line.appendChild(s)}
    else line.textContent="전부 회신 받았음";
    R.appendChild(line);
    b.title=dFull(best.d)+" "+best.e.name+" 참가 "+ps.length+"곳";
  }else{R.appendChild(el("div","big","예정된 운영일 없음"))}
  b.appendChild(L);b.appendChild(R);
  b.addEventListener("click",function(){if(best){cur=best.e.id;editing=null;note=null;draw();window.scrollTo(0,0)}});
  return b;
}

document.addEventListener("keydown",function(e){
  if(e.isComposing||e.keyCode===229)return;
  if((e.ctrlKey||e.metaKey)&&e.code==="KeyZ"){e.preventDefault();popUndo()}
  if(e.code==="Escape"&&editing){editing=null;draw()}
});
draw();
})();
