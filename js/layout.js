// layout.js — the page frame: tabs, the preset/history popover, the output pane (one save button),
// the filament table (every use of a filament in one place) and the filament bar under the preview
// LAK風キーキャップジェネレータ / MIT License

const TAB_KEY="lak-tab",TABS=["shape","keymap","legend","art","out"];
let curTab="shape";
function showTab(name,focus){
  if(!TABS.includes(name))name="shape";curTab=name;
  for(const t of TABS){const b=document.getElementById("tab-"+t),p=document.getElementById("pane-"+t);
    b.setAttribute("aria-selected",String(t===name));b.tabIndex=t===name?0:-1;p.hidden=t!==name;}
  try{localStorage.setItem(TAB_KEY,name);}catch(_){}
  // canvases measure themselves: draw them once they are visible
  if(name==="keymap"&&typeof drawMap==="function")drawMap();
  if(name==="art"&&typeof drawArtMap==="function")drawArtMap();
  if(name==="out")renderOut();
  if(focus)document.getElementById("tab-"+name).focus();
}
function initTabs(){
  const nav=document.getElementById("tabs");
  nav.addEventListener("click",e=>{const b=e.target.closest("[data-pane]");if(b){showTab(b.dataset.pane);
    if(window.innerWidth<900){const s=document.querySelector(".side");const top=s.getBoundingClientRect().top+scrollY-8;if(scrollY>top)scrollTo({top,behavior:"smooth"});}}});
  nav.addEventListener("keydown",e=>{const i=TABS.indexOf(curTab);
    if(e.key==="ArrowRight"||e.key==="ArrowDown"){e.preventDefault();showTab(TABS[(i+1)%TABS.length],true);}
    else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){e.preventDefault();showTab(TABS[(i+TABS.length-1)%TABS.length],true);}
    else if(e.key==="Home"){e.preventDefault();showTab(TABS[0],true);}else if(e.key==="End"){e.preventDefault();showTab(TABS[TABS.length-1],true);}});
  document.addEventListener("click",e=>{const g=e.target.closest&&e.target.closest("[data-goto]");if(g)showTab(g.dataset.goto);});
  let t="shape";try{t=localStorage.getItem(TAB_KEY)||"shape";}catch(_){}
  showTab(t);
}
// ---- presets & history popover ----
function initLibPop(){
  const pop=document.getElementById("lib-pop"),btn=document.getElementById("lib-btn");
  const open=v=>{pop.hidden=!v;btn.setAttribute("aria-expanded",String(v));if(v){const f=pop.querySelector("input,button");if(f)f.focus();}};
  btn.onclick=()=>open(pop.hidden);
  document.getElementById("lib-close").onclick=()=>{open(false);btn.focus();};
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!pop.hidden){open(false);btn.focus();}});
  document.addEventListener("pointerdown",e=>{if(!pop.hidden&&!pop.contains(e.target)&&!btn.contains(e.target))open(false);});
  // loading a preset or a history entry closes it
  pop.addEventListener("click",e=>{const b=e.target.closest(".acts button");if(b&&/読み込む|Xに投稿/.test(b.textContent))open(false);});
}
// ---- output: what to make ----
let outBusy=false;
function kmLoaded(){return typeof KM!=="undefined"&&KM.layers.length>0;}
function outTarget(){
  let t=EXP.target;const loaded=kmLoaded();
  if(!["shape","all","sel","samples","tray"].includes(t))t=loaded?"all":"shape";
  if(!loaded&&(t==="all"||t==="sel"))t="shape"; // the tray works without a keymap (grid arrangement)
  return t;
}
function setOutTarget(t){const prev=outTarget();EXP.target=t;saveWs();renderOut();
  // the 3D view follows what is made: the tray / the size samples, back to the key when leaving them
  if(t==="tray"&&typeof showTray==="function")showTray();
  else if(t==="samples"&&typeof showSamples==="function")showSamples();
  else if(prev!==t&&(view==="tray"||view==="sizes")){const b=document.querySelector('.views button[data-view="'+(t==="all"&&kmLoaded()?"all":"iso")+'"]');if(b)b.click();}}
function renderOut(){
  const box=document.getElementById("out-target");if(!box)return;box.innerHTML="";
  const t=outTarget(),loaded=kmLoaded();
  const seg=document.createElement("div");seg.className="seg";seg.style.borderTop="0";seg.setAttribute("role","group");seg.setAttribute("aria-label","作るもの");
  const sh=document.createElement("div");sh.className="seghead";sh.textContent="作るもの";seg.appendChild(sh);
  const nSel=typeof sel!=="undefined"?sel.size:0;
  [["shape","キーの形だけ（1個）"],["all",loaded?"全キー（"+KM.keys.length+"）":"全キー"],["sel","選択中のキー（"+nSel+"）"],["samples","Legendのサイズ見本"],["tray","保管トレー"]].forEach(([v,label])=>{
    const b=document.createElement("button");b.type="button";b.textContent=label;b.setAttribute("aria-pressed",String(t===v));
    if((v==="all"||v==="sel")&&!loaded){b.disabled=true;b.title="キーマップを読み込むと選べます";}
    b.onclick=()=>setOutTarget(v);seg.appendChild(b);});
  const hint=document.createElement("p");hint.className="hint";hint.style.cssText="width:100%;padding:4px 0 0";
  hint.textContent=t==="shape"?"Legendのないキーキャップ1個分のSTLと、同じ形のOpenSCADファイルをZIPにまとめます。":
    t==="all"?"キーマップの全キーを、Legend・マーク・ホーミング突起・天面アート付きで出力します。":
    t==="sel"?"キーマップで選んだキーだけを出力します（キーマップのタブで選べます）。":
    t==="tray"?"作ったキーキャップを、キーボードの並びのまま、または格子状に並べて保管する、ロック付きで中が見える蓋つきのトレーです。":
    "Legendが潰れないか確かめる試し刷りです。大きさごとのマスを並べた薄い板を3MFで出力します。";
  if(!loaded&&(t==="shape"||t==="samples")){const a=document.createElement("button");a.type="button";a.className="linkbtn";a.dataset.goto="keymap";a.textContent="キーマップを読み込むと、Legend付きで全キーを出力できます";hint.appendChild(document.createElement("br"));hint.appendChild(a);}
  seg.appendChild(hint);box.appendChild(seg);
  document.getElementById("km-exfmt").hidden=!(t==="all"||t==="sel");
  const sz=document.getElementById("km-sizes");sz.hidden=t!=="samples";
  const tf=document.getElementById("tray-form");tf.hidden=t!=="tray";if(t==="tray"&&typeof buildTrayForm==="function")buildTrayForm();
  const fil=document.getElementById("out-fil");fil.hidden=t==="shape";if(t!=="shape")renderFilTable(fil,t);
  renderFilBar();refreshOut();
}
function refreshOut(){
  const b=document.getElementById("out-save"),sum=document.getElementById("out-sum");if(!b)return;
  const t=outTarget(),fmtName=EXP.format==="3mf"?"3MF":"STL（ZIP）",nf=filamentUses().length;
  let label="保存",text="",dis=outBusy;
  if(t==="shape"){label="STLを保存";text="キー1個の形・STL＋OpenSCAD（ZIP）";dis=dis||document.getElementById("save").disabled;}
  else if(t==="all"||t==="sel"){const n=t==="all"?KM.keys.length:sel.size;
    label=EXP.format==="3mf"?"3MFを保存":"STL（ZIP）を保存";
    text=(t==="all"?"全":"選択中の")+n+"キー・"+fmtName+(EXP.format==="3mf"?"・"+(arrangeMode()==="layout"?"キー配列どおり":"格子状"):"")+"・フィラメント"+nf+"本";
    dis=dis||!n;}
  else if(t==="tray"){label=EXP.format==="3mf"?"トレーの3MFを保存":"トレーのSTL（ZIP）を保存";const c=trayCfg();
    text="保管トレー・"+(c.style==="window"?"窓あき":c.style==="clearwin"?"透明窓":"窓なし")+"の蓋・"+({snap:"ツメ",onetouch:"ワンタッチ",slide:"スライド",none:"ロックなし"}[c.mech]||"ツメ")+"・"+(trayArr()==="grid"?(g=>g.cols+"×"+g.rows+"マス（格子状）")(trayGridCfg()):KM.keys.length+"キー"+(c.split?"・左右で分ける":""));}
  else{const n=typeof sampleList==="function"?sampleList().length:0;label="サイズ見本の3MFを保存";text=n+"マス・3MF・"+(LCFG.style==="engrave"?"彫り込み":"浮き彫り");dis=dis||!n;}
  b.textContent=outBusy?"作成中…":label;b.disabled=!!dis;sum.textContent=text;
  document.getElementById("status").hidden=t!=="shape";
  document.getElementById("km-exst").hidden=!(t==="all"||t==="sel");
  document.getElementById("sz-st").hidden=t!=="samples";
  document.getElementById("tray-st").hidden=t!=="tray";
}
async function outSave(){
  const t=outTarget();if(outBusy)return;
  if(t==="shape"){document.getElementById("save").click();return;}
  outBusy=true;refreshOut();
  try{if(t==="samples")await exportSamples();else if(t==="tray")await exportTray();else await exportLegendKeys(t==="sel");}
  finally{outBusy=false;refreshOut();}
}
// ---- filaments: one table for every use ----
// rows: [{label, get, set, kind}] for the current output
function filRows(t){
  if(t==="tray"){const r=[{label:"トレー",get:()=>EXP.trayExt||1,set:v=>{EXP.trayExt=v;},kind:"tray"},{label:"蓋",get:()=>EXP.lidExt||1,set:v=>{EXP.lidExt=v;},kind:"tray"}];
    if(trayCfg().style==="clearwin")r.push({label:"蓋の透明窓",get:()=>EXP.winExt||3,set:v=>{EXP.winExt=v;},kind:"tray"});
    if(trayLabelsActive().some(o=>o.l.style==="inlay"))r.push({label:"名前（2色）",get:()=>trayLabelExt(),set:v=>{EXP.labelExt=v;},kind:"tray"});
    {const sc=traySpecCfg();if(sc.on&&sc.style==="inlay")r.push({label:"仕様の刻印（2色）",get:()=>traySpecExt(),set:v=>{EXP.specExt=v;},kind:"tray"});}
    if(trayArtActive())for(const g of trayArtRef().groups){if(g.hidden)continue;for(const l of g.layers)if(!l.hidden)r.push({label:"アート（"+g.name+"・"+l.name+"）",get:()=>l.ext,set:v=>{l.ext=v;},kind:"tray"});}
    return r;}
  const rows=[{label:"本体",get:()=>EXP.bodyExt,set:v=>{EXP.bodyExt=v;},kind:"body"}];
  const loaded=kmLoaded();
  if(loaded||t==="samples"){
    if(loaded&&t!=="samples"&&EXP.format==="3mf"&&EXP.legendMode==="layer"){
      const used=usedLayers();
      used.forEach(li=>rows.push({label:"Legend（"+(li<0?"画像":layerName(li))+"）",get:()=>layerExt(li),set:v=>{EXP.layerExt={...EXP.layerExt,[li]:v};},kind:"legend"}));
      if(!used.length)rows.push({label:"Legend（表示しているレイヤーなし）",get:()=>EXP.legendExt,set:v=>{EXP.legendExt=v;},kind:"legend"});
    }else rows.push({label:"Legend",get:()=>EXP.legendExt,set:v=>{EXP.legendExt=v;},kind:"legend"});
  }
  if(loaded&&t!=="samples"&&typeof artActive==="function"&&artActive())
    artShownLayers().forEach(l=>rows.push({label:"天面アート（"+artLayerLabel(l)+"）",get:()=>l.ext,set:v=>{l.ext=v;},kind:"art"}));
  return rows;
}
function filChanged(kind){
  setCols();saveWs();
  if(kind==="art"&&typeof artChanged==="function"){artChanged();if(typeof buildArtForm==="function")buildArtForm();}
  else if(typeof shapeCache!=="undefined")shapeCache.clear();
  if(typeof wholeReset==="function")wholeReset();
  if(kind==="tray"&&typeof trayDirty==="function")trayDirty();
  rebuildPreview();renderOut();if(typeof drawMap==="function")drawMap();
}
function renderFilTable(box,t){
  box.innerHTML="";
  const h=document.createElement("div");h.className="km-edhead";h.id="fil-head";h.textContent="フィラメントの割り当て";box.appendChild(h);
  const rows=filRows(t),users=new Map();rows.forEach(r=>{const n=r.get();users.set(n,(users.get(n)||0)+1);});
  const list=document.createElement("div");list.className="fil-table";
  rows.forEach((r,i)=>{
    const n=r.get(),row=document.createElement("div");row.className="fil-row";
    const c=document.createElement("input");c.type="color";c.value=filColor(n).toLowerCase();c.setAttribute("aria-label","フィラメント"+n+"の色");
    c.oninput=()=>{setFilColor(n,c.value);box.querySelectorAll('input[type=color][data-n="'+n+'"]').forEach(x=>{if(x!==c)x.value=c.value;});renderFilBar();};
    c.onchange=()=>{renderOut();if(typeof buildArtForm==="function"&&kmLoaded())buildArtForm();};c.dataset.n=n;
    const nm=document.createElement("label");nm.className="fil-name";nm.htmlFor="fil-sel-"+i;nm.textContent=r.label;
    if(users.get(n)>1){const s=document.createElement("small");s.textContent="ほかの用途と同じフィラメント";nm.appendChild(s);}
    const s=document.createElement("select");s.id="fil-sel-"+i;
    for(let k=1;k<=16;k++){const o=document.createElement("option");o.value=k;o.textContent="フィラメント"+k;s.appendChild(o);}
    s.value=String(n);s.onchange=()=>{r.set(parseInt(s.value,10));filChanged(r.kind);};
    row.appendChild(c);row.appendChild(nm);row.appendChild(s);list.appendChild(row);});
  box.appendChild(list);
  if(t!=="samples"&&EXP.format==="3mf"){
    const l=document.createElement("label");l.className="km-lname";l.style.padding="8px 0 2px";
    const cb=document.createElement("input");cb.type="checkbox";cb.checked=EXP.colors3mf===true;cb.onchange=()=>{EXP.colors3mf=cb.checked;saveWs();};
    l.appendChild(cb);l.appendChild(document.createTextNode(" 3MFにフィラメントの色を書き込む（試験的）"));box.appendChild(l);}
  const hint=document.createElement("p");hint.className="hint";hint.style.padding="4px 0 6px";
  hint.textContent="同じ番号にした用途は、同じフィラメントで印刷されます。色はプレビューの表示に使います"+(t!=="samples"&&EXP.format==="3mf"?"（上のチェックをオンにすると3MFにも書き込み、Bambu Studio / OrcaSlicerで開いたときに色が付きます）。":"。")+(t!=="samples"&&t!=="tray"&&EXP.format!=="3mf"?"STLではフィラメント番号は使いませんが、天面アートのファイル名に入ります。":"");
  box.appendChild(hint);
}
// the filament bar under the preview: what each filament prints
function renderFilBar(){
  const bar=document.getElementById("fil-bar");if(!bar)return;bar.innerHTML="";
  const uses=filamentUses();
  const h=document.createElement("span");h.className="filbar-head";h.textContent="フィラメント";bar.appendChild(h);
  for(const {n,uses:u} of uses){const b=document.createElement("button");b.type="button";b.className="filchip";b.title="フィラメント"+n+"："+u.join("、");
    const sw=document.createElement("span");sw.className="filsw";sw.style.background=filColor(n);b.appendChild(sw);
    const tx=document.createElement("span");tx.textContent=n+" "+u[0]+(u.length>1?" ほか"+(u.length-1):"");b.appendChild(tx);
    b.onclick=()=>openFilaments();bar.appendChild(b);}
  const e=document.createElement("button");e.type="button";e.className="filedit linkbtn";e.textContent="割り当てを編集";e.onclick=()=>openFilaments();bar.appendChild(e);
}
function openFilaments(){
  if(outTarget()==="shape")EXP.target=kmLoaded()?"all":"samples";
  showTab("out");const h=document.getElementById("fil-head");if(h)h.scrollIntoView({behavior:"smooth",block:"center"});
}
function initLayout(){
  initTabs();initLibPop();
  document.getElementById("out-save").onclick=outSave;
  renderOut();
}

// ---- the shape parameters being edited: kept as a draft, offered again when the page is opened next time ----
let draftReady=false,draftTimer=0;
const DRAFT_KEY="draft";
async function draftGet(){
  try{if(Store.mode==="db"){const s=await Store.db.doc("data/users/"+Store.uid+"/lib").collection("ws").doc(DRAFT_KEY).get();return s.exists?s.data():null;}
    if(Store.mode==="local")return JSON.parse(localStorage.getItem(LS+DRAFT_KEY)||"null");}catch(_){}
  return null;}
async function draftPut(doc){
  try{if(Store.mode==="db"){const r=Store.db.doc("data/users/"+Store.uid+"/lib").collection("ws").doc(DRAFT_KEY);if(doc)await r.set(doc);else await r.delete();}
    else if(Store.mode==="local"){if(doc)localStorage.setItem(LS+DRAFT_KEY,JSON.stringify(doc));else localStorage.removeItem(LS+DRAFT_KEY);}}catch(_){}}
function sameParams(a,b){for(const k in DEF)if(a[k]!==b[k])return false;return true;}
// every change of the parameters: saved a moment later (the initial values need no draft)
function saveDraft(){if(!draftReady)return;clearTimeout(draftTimer);
  draftTimer=setTimeout(()=>{draftPut(sameParams(P,DEF)?null:{p:{...P},at:Date.now()});},400);}
// the changed items, for the dialog: "label value"
function draftChanges(p){const out=[];
  for(const g of GROUPS)for(const it of g.items){const k=it.k||it.seg||it.check;if(!k||p[k]===DEF[k]||p[k]===undefined)continue;
    const v=it.seg?((it.options.find(o=>o[1]===p[k])||[String(p[k])])[0]):it.check?(p[k]?"オン":"オフ"):fmt(p[k])+(it.unit===""?"":" mm");
    out.push((it.label||k)+"："+v);}
  return out;}
async function checkDraft(){
  const d=await draftGet(),p=d&&d.p&&typeof d.p==="object"?cleanParams(d.p,DEF):null;
  // nothing kept, the same as now, or a shared link was opened (its parameters win; the draft goes to the history)
  if(!p||sameParams(p,P)){draftReady=true;return;}
  if(typeof openedFromLink!=="undefined"&&openedFromLink){
    let kept=false;if(typeof addItem==="function"&&(Store.mode==="db"||Store.mode==="local")){kept=true;addItem("history",{filename:"",quality:p.quality,params:p,createdAt:Date.now(),note:"前回編集中だった設定"}).catch(()=>{});}
    if(kept){const m=document.createElement("div");m.className="msg info";m.textContent="前回編集中だった形状パラメータは「プリセット・履歴」に残しました。";document.getElementById("msgs").prepend(m);}
    draftReady=true;saveDraft();return;}
  const dlg=document.getElementById("draft-dlg");if(!dlg){draftReady=true;return;}
  const when=d.at?new Date(d.at):null,ch=draftChanges(p);
  document.getElementById("draft-text").textContent="前回"+(when?"（"+(when.getMonth()+1)+"月"+when.getDate()+"日 "+String(when.getHours()).padStart(2,"0")+":"+String(when.getMinutes()).padStart(2,"0")+"）":"")+"に編集していた形状パラメータが残っています。読み込みますか？";
  const ul=document.getElementById("draft-list");ul.innerHTML="";ch.slice(0,6).forEach(t=>{const li=document.createElement("li");li.textContent=t;ul.appendChild(li);});
  if(ch.length>6){const li=document.createElement("li");li.textContent="ほか"+(ch.length-6)+"項目";ul.appendChild(li);}
  document.getElementById("draft-note").textContent="「初期値で始める」を選んでも、前回の設定は履歴（プリセット・履歴の一覧）に残します。";
  const close=load=>{dlg.hidden=true;document.body.style.overflow="";document.removeEventListener("keydown",onKey);
    if(load){P=p;for(const k in resets)delete resets[k];buildForm();update();}
    else if(typeof addItem==="function")addItem("history",{filename:"",quality:p.quality,params:p,createdAt:Date.now(),note:"前回編集中だった設定"}).catch(()=>{});
    draftReady=true;saveDraft();};
  const onKey=e=>{if(e.key==="Escape"){e.preventDefault();close(false);}};
  document.getElementById("draft-load").onclick=()=>close(true);
  document.getElementById("draft-skip").onclick=()=>close(false);
  document.addEventListener("keydown",onKey);
  dlg.hidden=false;document.body.style.overflow="hidden";document.getElementById("draft-load").focus();
}
