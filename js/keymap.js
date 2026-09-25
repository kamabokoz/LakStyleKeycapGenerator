// keymap.js — keymap loading, per-key legend editor, legend export
// LAK風キーキャップジェネレータ / MIT License

// ---------- keymap & legends ----------
const KM={device:"",layers:[],behaviors:{},keys:[],source:""};
const LDEF={host:"jis",font:"IBM Plex Sans JP",weight:700,mainSize:4.0,subSize:2.3,style:"engrave",depth:0.6,height:0.4,embed:0.3};
let LCFG={...LDEF};
let KEYCFG={}; // pos -> [{layer, at, text?}]
const EDEF={format:"stl",bodyExt:1,legendExt:2,plate:256};
let EXP={...EDEF};
const sel=new Set();let multiSel=false,curKey=null,client=null;
const AT=[["c","中央"],["tl","左上"],["tr","右上"],["bl","左下"],["br","右下"],["t","上"],["b","下"]];
function slotsOf(pos){return KEYCFG[pos]||[{layer:0,at:"c"}];}
function bindingAt(li,pos){const L=KM.layers[li];return L&&L.bindings[pos];}
function autoLabel(li,pos){const b=bindingAt(li,pos);return b?LBL.label(b,KM.behaviors,KM.layers,LCFG.host):"";}
function slotText(s,pos){return (s.text!==undefined&&s.text!==null&&s.text!=="")?s.text:autoLabel(s.layer,pos);}
function kmStatus(t,err){const e=document.getElementById("km-status");e.textContent=t||"";e.className="km-status"+(err?" err":"");}

// --- geometry of legend slots on the top ---
function plateauHalf(){const b=P.boundary!=2?derive(P).d1:0.8;return Math.max(2,P.top_size/2-b-0.45);}
function slotBoxFor(s,multi){const b=slotBox(s.at,multi);return{...b,cx:b.cx+(+s.dx||0),cy:b.cy+(+s.dy||0)};}
function slotBox(at,multi){
  const s=plateauHalf(),sub=LCFG.subSize;
  switch(at){
    case "c":return{cx:0,cy:0,size:multi?LCFG.mainSize*0.9:LCFG.mainSize,maxW:2*s*0.94};
    case "t":return{cx:0,cy:s-sub*0.62,size:sub,maxW:2*s*0.9};
    case "b":return{cx:0,cy:-(s-sub*0.62),size:sub,maxW:2*s*0.9};
    case "tl":return{cx:-s*0.5,cy:s-sub*0.62,size:sub,maxW:s*0.95};
    case "tr":return{cx:s*0.5,cy:s-sub*0.62,size:sub,maxW:s*0.95};
    case "bl":return{cx:-s*0.5,cy:-(s-sub*0.62),size:sub,maxW:s*0.95};
    case "br":return{cx:s*0.5,cy:-(s-sub*0.62),size:sub,maxW:s*0.95};
  }
  return{cx:0,cy:0,size:LCFG.mainSize,maxW:2*s*0.9};
}
function zTop(x,y){return zPlateau(x,y,P,derive(P));}
const shapeCache=new Map();
function loopsOf(shapes){const o=[];for(const s of shapes){o.push(s.outer);for(const h of s.holes)o.push(h);}return o;}
function segX(p,q,r,s){const c=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const d1=c(p,q,r),d2=c(p,q,s),d3=c(r,s,p),d4=c(r,s,q);return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));}
function pipL(pt,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
function shapesOverlap(A,B){const la=loopsOf(A),lb=loopsOf(B);
  for(const x of la)for(const y of lb){for(let i=0;i<x.length;i++)for(let j=0;j<y.length;j++)if(segX(x[i],x[(i+1)%x.length],y[j],y[(j+1)%y.length]))return true;}
  for(const s of A)for(const t of B){if(pipL(s.outer[0],t.outer)||pipL(t.outer[0],s.outer))return true;}
  return false;}
// ---- fonts for legends ----
const FONTS=[
  {name:"IBM Plex Sans JP",g:"jp",w:"400;500;600;700"},
  {name:"Noto Sans JP",g:"jp",w:"400;500;700;900"},
  {name:"M PLUS Rounded 1c",g:"jp",w:"500;700;800"},
  {name:"Zen Maru Gothic",g:"jp",w:"500;700;900"},
  {name:"BIZ UDPGothic",g:"jp",w:"400;700"},
  {name:"M PLUS 1 Code",g:"jp",w:"400;500;700"},
  {name:"Kosugi Maru",g:"jp",w:"400"},
  {name:"Dela Gothic One",g:"jp",w:"400"},
  {name:"Inter",g:"en",w:"400;500;700;800"},
  {name:"Barlow",g:"en",w:"400;500;700;800"},
  {name:"Roboto Mono",g:"en",w:"400;500;700"},
  {name:"JetBrains Mono",g:"en",w:"400;500;700;800"},
  {name:"Orbitron",g:"en",w:"500;700;900"}];
const fontLinks=new Set(["IBM Plex Sans JP","M PLUS Rounded 1c"]),customFonts=new Set();
function ensureFont(name){
  const f=FONTS.find(x=>x.name===name);if(!f||fontLinks.has(name))return Promise.resolve();fontLinks.add(name);
  return new Promise(res=>{const l=document.createElement("link");l.rel="stylesheet";
    l.href="https://fonts.googleapis.com/css2?family="+name.replace(/ /g,"+")+":wght@"+f.w+"&display=swap";
    l.onload=l.onerror=()=>res();document.head.appendChild(l);setTimeout(res,8000);});
}
function localFontInstalled(name){ // compare widths against generic fallbacks
  const c=document.createElement("canvas").getContext("2d"),s="mmmmmmmmmmlli1WQ@あ漢";
  return ["monospace","serif","sans-serif"].some(g=>{c.font="40px "+g;const a=c.measureText(s).width;c.font=`40px "${name}", ${g}`;return Math.abs(c.measureText(s).width-a)>0.5;});
}
function fontKind(name){if(FONTS.some(f=>f.name===name))return "web";if(customFonts.has(name))return "file";return "local";}
async function loadFontFile(file){
  const name="File: "+file.name.replace(/\.(ttf|otf|woff2?|ttc)$/i,"").slice(0,40);
  const face=new FontFace(name,await file.arrayBuffer());await face.load();document.fonts.add(face);customFonts.add(name);return name;
}
async function legendShapes(pos){
  await ensureFont(LCFG.font);
  const slots=slotsOf(pos),multi=slots.length>1;
  const D=derive(P);
  const key=JSON.stringify([pos,slots.map(s=>[slotText(s,pos),s.at,+s.dx||0,+s.dy||0]),LCFG.font,LCFG.weight,LCFG.mainSize,LCFG.subSize,P.top_size,P.edge_band,P.boundary,P.r_top,P.step_run,P.step_rs,P.step_rf,P.r_plateau,P.edge_drop,multi]);
  let r=shapeCache.get(key);
  if(!r){
    const shapes=[],dropped=[];
    for(const s of slots){const t=slotText(s,pos);if(!t)continue;const bx=slotBoxFor(s,multi);
      const sh=await LEG.textShapes(t,{font:LCFG.font,weight:LCFG.weight,size:bx.size,maxW:bx.maxW,cx:bx.cx,cy:bx.cy});
      const pr=plateauRect(P,D);const outside=loopsOf(sh).some(l=>l.some(p=>sdRR(p[0],p[1],pr.size,pr.r)>-0.1));
      if(outside||shapesOverlap(sh,shapes)){dropped.push(t);continue;}
      shapes.push(...sh);}
    r={shapes,dropped};if(shapeCache.size>300)shapeCache.clear();shapeCache.set(key,r);
  }
  return r;
}
function shiftT(T,offx){return offx?T.map(t=>[[t[0][0]+offx,t[0][1],t[0][2]],[t[1][0]+offx,t[1][1],t[1][2]],[t[2][0]+offx,t[2][1],t[2][2]],t[3]]):T;}
// body (with pockets when engraved) and the legend part (inlay filling the pocket, or raised letters)
async function legendParts(pos,offx,N,M){
  const {shapes,dropped}=await legendShapes(pos);
  if(!shapes.length)return{body:buildMesh(P,N,M,offx),legend:[],dropped};
  if(LCFG.style==="engrave"){
    const body=buildMesh(P,N,M,offx,{shapes,depth:LCFG.depth});
    const legend=shiftT(LEG.extrude(shapes,(x,y)=>zTop(x,y)-LCFG.depth,(x,y)=>zTop(x,y),3),offx);
    return{body,legend,dropped};
  }
  const legend=shiftT(LEG.extrude(shapes,(x,y)=>zTop(x,y)-LCFG.embed,(x,y)=>zTop(x,y)+LCFG.height,3),offx);
  return{body:buildMesh(P,N,M,offx),legend,dropped};
}
function minPocketFloor(shapes){let m=Infinity;for(const l of loopsOf(shapes))for(const p of l)m=Math.min(m,zTop(p[0],p[1])-LCFG.depth-P.cavity_h);return m;}

// --- loading keymaps ---
function setKeymap(d,src){
  KM.device=d.device||"";KM.layers=d.layers||[];KM.behaviors=d.behaviors||{};KM.keys=d.keys||[];KM.source=src;
  sel.clear();curKey=KM.keys.length?0:null;if(curKey!==null)sel.add(0);
  for(const k in KEYCFG){if(+k>=KM.keys.length)delete KEYCFG[k];}
  shapeCache.clear();renderKm();saveWs();update();
}
async function connect(kind){
  if(client){try{await client.close();}catch(_){}client=null;}
  kmStatus(kind==="usb"?"USBポートを選んでください…":kind==="ble"?"キーボードを選んでください…":"周辺のBluetooth機器がすべて表示されます。キーボードの名前を選んでください。");
  try{
    kmLogClear();
    const tr=kind==="usb"?await ZS.openSerial():await ZS.openBle(kind==="ble-all",kmLog);
    client=new ZS.Client(tr);
    client.onClose=()=>{client=null;clearInterval(unlockTimer);waitingUnlock=false;kmStatus("キーボードとの接続が切れました。");renderKmButtons();};
    client.onNotify=()=>{kmLog("キーボードから通知を受信"+(waitingUnlock?"（読み込みを再開）":""));if(waitingUnlock)readFromDevice();};
    renderKmButtons();
    await readFromDevice();
  }catch(e){
    client=null;renderKmButtons();
    kmLog("エラー: "+(e&&e.name)+" "+(e&&e.message));
    if(e&&e.name==="NotFoundError"){kmStatus(kind==="ble"?"選択がキャンセルされました。キーボードが一覧に出なかった場合は「すべてのデバイスから選ぶ」を試してください。":"選択がキャンセルされました。");return;}
    if(e&&(e.name==="SecurityError"||/permissions policy|disallowed/i.test(String(e.message)))){
      kmStatus(BUILD==="claude"?"この表示ではUSB/Bluetooth接続が許可されていません。単体版で接続し、書き出したキーマップファイルを「ファイルから読込」で読み込んでください。":"このページではUSB/Bluetooth接続が許可されていません。httpsかローカルファイルとしてChrome/Edgeで開いてください。",true);return;}
    kmStatus((e&&e.message)||"接続できませんでした。",true);
  }
}
let waitingUnlock=false;
const kmLogLines=[];
function kmLog(m){const t=new Date();kmLogLines.push(String(t.getMinutes()).padStart(2,"0")+":"+String(t.getSeconds()).padStart(2,"0")+"."+String(t.getMilliseconds()).padStart(3,"0")+" "+m);
  const el=document.getElementById("km-log");if(el){el.textContent=kmLogLines.slice(-60).join("\n");document.getElementById("km-logbox").hidden=false;}}
function kmLogClear(){kmLogLines.length=0;const el=document.getElementById("km-log");if(el)el.textContent="";}
let reading=false,unlockTimer=0;
async function readFromDevice(){
  if(!client||reading)return;
  reading=true;
  const c=client;
  c.onProgress=n=>{if(!waitingUnlock)kmStatus("キーボードから受信中… "+(n/1024).toFixed(1)+" KB");};
  kmStatus("キーマップを読み込んでいます…");
  try{
    kmLog("デバイス情報を要求");const device=await c.deviceName();kmLog("デバイス名: "+(device||"(取得できず)"));
    kmLog("キーマップを要求");
    const layers=await withRetry(()=>c.keymap(),"キーマップ");
    waitingUnlock=false;clearInterval(unlockTimer);
    kmLog("キーマップ受信: "+layers.length+"レイヤー");
    kmLog("物理配列を要求");
    const lay=await withRetry(()=>c.layouts(),"物理配列");
    const L=lay.layouts[lay.active]||lay.layouts[0]||{keys:[]};
    kmLog("物理配列受信: "+L.keys.length+"キー");
    kmStatus("ビヘイビア情報を読み込んでいます…");kmLog("ビヘイビア情報を要求");
    const behaviors=await c.behaviors();
    kmLog("ビヘイビア受信: "+Object.keys(behaviors).length+"種類（受信合計 "+(c.rxBytes/1024).toFixed(1)+" KB）");
    setKeymap({device,layers,behaviors,keys:L.keys},c.tr.kind);
    kmStatus("読み込みました（"+layers.length+"レイヤー / "+L.keys.length+"キー）。");
  }catch(e){
    kmLog("読み込みエラー: "+(e&&e.code)+" "+(e&&e.message));
    if(e&&e.code==="meta"){
      if(!waitingUnlock){waitingUnlock=true;
        // do not rely only on the unlock notification: ask again every few seconds
        clearInterval(unlockTimer);unlockTimer=setInterval(()=>{if(!client){clearInterval(unlockTimer);return;}if(waitingUnlock)readFromDevice();},3000);}
      kmStatus("キーボードがロックされています。キーボードの &studio_unlock キー（DYA Studioのアンロック操作）を押すと自動で読み込みます。",true);renderKmButtons();
    }else kmStatus((e&&e.message)||"読み込みに失敗しました。",true);
  }finally{reading=false;c.onProgress=null;}
}
async function withRetry(fn,label){
  try{return await fn();}
  catch(e){if(e&&e.code==="timeout"){kmLog(label+"の応答がないため再要求");return await fn();}throw e;}
}
function exportKeymapJson(){
  const data={format:"lak-keymap/1",device:KM.device,layers:KM.layers,behaviors:KM.behaviors,keys:KM.keys,legendConfig:LCFG,keyConfig:KEYCFG};
  const name="keymap_"+(KM.device||"keyboard").replace(/[^A-Za-z0-9_-]+/g,"_")+".json";
  saveFile(new Blob([JSON.stringify(data)],{type:"application/json"}),name,"km-status");
}
function importKeymapFile(file){
  const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);
      if(d.format!=="lak-keymap/1"||!Array.isArray(d.layers)||!Array.isArray(d.keys))throw new Error("形式が違います");
      if(d.legendConfig)LCFG={...LDEF,...d.legendConfig};
      KEYCFG=d.keyConfig&&typeof d.keyConfig==="object"?d.keyConfig:{};
      setKeymap(d,"file");buildLegendForm();kmStatus("ファイルから読み込みました（"+d.layers.length+"レイヤー / "+d.keys.length+"キー）。");}
    catch(e){kmStatus("このファイルは読み込めません（"+e.message+"）。このアプリで書き出したキーマップファイルを選んでください。",true);}};
  r.readAsText(file);
}
function loadSample(){
  const keys=[],st=[30,30,10,0,10,20];
  for(let r=0;r<3;r++){for(let c=0;c<6;c++)keys.push({w:100,h:100,x:c*100,y:r*100+st[c],r:0,rx:0,ry:0});
    for(let c=0;c<6;c++)keys.push({w:100,h:100,x:800+c*100,y:r*100+st[5-c],r:0,rx:0,ry:0});}
  keys.push({w:100,h:100,x:310,y:340,r:0,rx:0,ry:0},{w:100,h:100,x:415,y:345,r:800,rx:0,ry:0},{w:100,h:100,x:520,y:365,r:1600,rx:0,ry:0});
  keys.push({w:100,h:100,x:680,y:365,r:-1600,rx:0,ry:0},{w:100,h:100,x:785,y:345,r:-800,rx:0,ry:0},{w:100,h:100,x:890,y:340,r:0,rx:0,ry:0});
  const kp=u=>({b:1,p1:0x070000+u,p2:0}),mo=l=>({b:2,p1:l,p2:0}),tr={b:3,p1:0,p2:0};
  const ch=c=>c===";"?0x33:c===","?0x36:c==="."?0x37:c==="/"?0x38:c==="'"?0x34:0x04+c.charCodeAt(0)-65;
  const rows=[[0x2B,"QWERT","YUIOP",0x2A],[0xE0,"ASDFG","HJKL;",0x34],[0xE1,"ZXCVB","NM,./",0x28]];
  const L0=[];rows.forEach(([l,a,b2,r])=>{L0.push(kp(l),...a.split("").map(c=>kp(ch(c))),...b2.split("").map(c=>kp(ch(c))),kp(r));});
  L0.push(kp(0xE3),mo(1),kp(0x2C),kp(0x28),mo(2),kp(0x8B));
  const L1=Array(42).fill(tr);for(let i=0;i<10;i++)L1[1+i]=kp(0x1E+i);
  L1[13]=kp(0x2D|0x02000000);L1[14]=kp(0x2E);L1[15]=kp(0x2F);L1[16]=kp(0x30);L1[22]=kp(0x89);
  const L2=Array(42).fill(tr);[0x50,0x51,0x52,0x4F].forEach((u,i)=>L2[18+i]=kp(u));L2[6]=kp(0x4A);L2[7]=kp(0x4E);L2[8]=kp(0x4B);L2[9]=kp(0x4D);
  L2[1]={b:4,p1:0,p2:0};L2[2]={b:4,p1:1,p2:1};L2[13]={b:5,p1:0x0C00E9,p2:0};L2[14]={b:5,p1:0x0C00EA,p2:0};
  setKeymap({device:"サンプル（42キー分割）",keys,
    behaviors:{1:{name:"Key Press",consts:{p1:{},p2:{}}},2:{name:"Momentary Layer",consts:{p1:{},p2:{}}},3:{name:"Transparent",consts:{p1:{},p2:{}}},
      4:{name:"Bluetooth",consts:{p1:{0:"Clear",1:"Select Profile"},p2:{}}},5:{name:"Key Press",consts:{p1:{},p2:{}}}},
    layers:[{id:0,name:"Base",bindings:L0},{id:1,name:"Num",bindings:L1},{id:2,name:"Nav",bindings:L2}]},"sample");
  kmStatus("サンプルのキーマップを読み込みました。");
}

// --- layout map ---
const kmCv=()=>document.getElementById("km-map");
let mapGeom=null;
function keyPoly(k){
  const u=1/100,x=k.x*u,y=k.y*u,w=k.w*u,h=k.h*u,r=(k.r||0)/100*Math.PI/180;
  let rx=k.rx*u,ry=k.ry*u;if(!k.rx&&!k.ry){rx=x+w/2;ry=y+h/2;}
  const pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const c=Math.cos(r),s=Math.sin(r);
  return pts.map(([px,py])=>{const dx=px-rx,dy=py-ry;return[rx+dx*c-dy*s,ry+dx*s+dy*c];});
}
function drawMap(){
  const cv=kmCv();if(!cv)return;const ctx2=cv.getContext("2d");
  const W=cv.clientWidth||340,Hh=Math.max(140,Math.min(260,W*0.5));cv.style.height=Hh+"px";
  const d=window.devicePixelRatio||1;cv.width=W*d;cv.height=Hh*d;ctx2.setTransform(d,0,0,d,0,0);ctx2.clearRect(0,0,W,Hh);
  if(!KM.keys.length)return;
  const polys=KM.keys.map(keyPoly);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  polys.forEach(p=>p.forEach(([x,y])=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}));
  const pad=8,sc=Math.min((W-2*pad)/(x1-x0),(Hh-2*pad)/(y1-y0));
  const ox=(W-(x1-x0)*sc)/2-x0*sc,oy=(Hh-(y1-y0)*sc)/2-y0*sc;
  mapGeom={sc,ox,oy,polys};
  const ink=css("--ink"),muted=css("--muted"),acc=css("--accent"),panel=css("--bg"),line=css("--line");
  polys.forEach((p,i)=>{
    const g=.06;const cx=p.reduce((a,q)=>a+q[0],0)/4,cy=p.reduce((a,q)=>a+q[1],0)/4;
    const q=p.map(([x,y])=>[ox+(cx+(x-cx)*(1-g))*sc,oy+(cy+(y-cy)*(1-g))*sc]);
    ctx2.beginPath();q.forEach(([x,y],j)=>j?ctx2.lineTo(x,y):ctx2.moveTo(x,y));ctx2.closePath();
    const on=sel.has(i);ctx2.fillStyle=on?acc:panel;ctx2.fill();ctx2.strokeStyle=i===curKey?ink:line;ctx2.lineWidth=i===curKey?2:1;ctx2.stroke();
    const k=KM.keys[i],ang=(k.r||0)/100*Math.PI/180;
    ctx2.save();ctx2.translate(ox+cx*sc,oy+cy*sc);ctx2.rotate(ang);
    const slots=slotsOf(i);ctx2.textAlign="center";ctx2.textBaseline="middle";
    for(const s of slots){const t=slotText(s,i);if(!t)continue;const fs=(s.at==="c"?0.3:0.19)*sc;
      ctx2.font=`600 ${Math.max(7,fs)}px "IBM Plex Sans JP",system-ui,sans-serif`;ctx2.fillStyle=on?css("--accent-ink"):(s.at==="c"?ink:muted);
      const off={c:[0,0],t:[0,-.3],b:[0,.3],tl:[-.22,-.3],tr:[.22,-.3],bl:[-.22,.3],br:[.22,.3]}[s.at]||[0,0];
      let tx=t;while(ctx2.measureText(tx).width>0.86*sc&&tx.length>1)tx=tx.slice(0,-1);
      const mm=sc/Math.max(P.pitch,1);ctx2.fillText(tx,off[0]*sc+(+s.dx||0)*mm,off[1]*sc-(+s.dy||0)*mm);}
    ctx2.restore();
  });
}
function mapHit(ev){
  if(!mapGeom)return -1;const r=kmCv().getBoundingClientRect();const px=(ev.clientX-r.left-mapGeom.ox)/mapGeom.sc,py=(ev.clientY-r.top-mapGeom.oy)/mapGeom.sc;
  for(let i=mapGeom.polys.length-1;i>=0;i--){const p=mapGeom.polys[i];let c=false;for(let a=0,b=3;a<4;b=a++){const A=p[a],B=p[b];if(((A[1]>py)!==(B[1]>py))&&(px<(B[0]-A[0])*(py-A[1])/(B[1]-A[1])+A[0]))c=!c;}if(c)return i;}
  return -1;
}

// --- per-key editor ---
function renderEditor(){
  const box=document.getElementById("km-editor");box.innerHTML="";
  if(!KM.layers.length)return;
  const ids=[...sel];
  const head=document.createElement("div");head.className="km-edhead";
  head.textContent=ids.length===0?"キーを選ぶと、表示するレイヤーを設定できます。":ids.length===1?"キー "+(ids[0]+1)+" に表示するレイヤー":ids.length+"キーをまとめて設定中";
  box.appendChild(head);
  if(!ids.length)return;
  KM.layers.forEach((L,li)=>{
    const states=ids.map(p=>slotsOf(p).find(s=>s.layer===li));
    const onCount=states.filter(Boolean).length;
    const row=document.createElement("div");row.className="km-lrow";
    const lab=document.createElement("label");lab.className="km-lname";
    const cb=document.createElement("input");cb.type="checkbox";cb.checked=onCount===ids.length;cb.indeterminate=onCount>0&&onCount<ids.length;
    lab.appendChild(cb);lab.appendChild(document.createTextNode(" "+(L.name||("Layer "+li))));
    const at=document.createElement("select");at.setAttribute("aria-label",(L.name||"Layer")+"の位置");
    AT.forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;at.appendChild(o);});
    const first=states.find(Boolean);at.value=first?first.at:"c";at.disabled=onCount===0;
    cb.onchange=()=>{ids.forEach(p=>{let s=slotsOf(p).map(x=>({...x}));
        if(cb.checked){if(!s.find(x=>x.layer===li)){const used=new Set(s.map(x=>x.at));const free=["c","tr","br","tl","bl","t","b"].find(a=>!used.has(a))||"tr";s.push({layer:li,at:free});}}
        else s=s.filter(x=>x.layer!==li);
        KEYCFG[p]=s;});
      kmChanged();};
    at.onchange=()=>{ids.forEach(p=>{KEYCFG[p]=slotsOf(p).map(x=>x.layer===li?{...x,at:at.value}:{...x});});kmChanged();};
    row.appendChild(lab);row.appendChild(at);
    if(ids.length===1){
      const s=states[0];const auto=autoLabel(li,ids[0]);
      const tx=document.createElement("input");tx.className="km-text";tx.placeholder=auto||"（空）";tx.value=s&&s.text?s.text:"";tx.disabled=!s;tx.maxLength=12;
      tx.setAttribute("aria-label",(L.name||"Layer")+"の文字（空欄で自動）");
      tx.onchange=()=>{KEYCFG[ids[0]]=slotsOf(ids[0]).map(x=>x.layer===li?{...x,text:tx.value||undefined}:{...x});kmChanged(false);};
      row.appendChild(tx);
    }
    box.appendChild(row);
  });
  const hint=document.createElement("p");hint.className="hint";hint.style.padding="6px 0 0";
  hint.textContent=ids.length===1?"文字欄を空にすると、キーマップから自動で決まる文字になります。":"複数キーの文字の上書きは、1キーずつ選んで行ってください。";
  box.appendChild(hint);
  renderFine(box,ids);
}
let fineLayer=null;
function renderFine(box,ids){
  const layersOn=[...new Set(ids.flatMap(p=>slotsOf(p).map(s=>s.layer)))].sort((a,b)=>a-b);
  if(!layersOn.length)return;
  if(fineLayer===null||!layersOn.includes(fineLayer))fineLayer=layersOn[0];
  const wrap=document.createElement("div");wrap.className="km-fine";
  const head=document.createElement("div");head.className="km-edhead";head.textContent="位置の微調整";wrap.appendChild(head);
  const row1=document.createElement("div");row1.className="km-finerow";
  const sel2=document.createElement("select");sel2.setAttribute("aria-label","微調整するレイヤー");
  layersOn.forEach(li=>{const o=document.createElement("option");o.value=li;o.textContent=(KM.layers[li]&&KM.layers[li].name)||("Layer "+li);sel2.appendChild(o);});
  sel2.value=fineLayer;sel2.onchange=()=>{fineLayer=+sel2.value;renderEditor();};
  row1.appendChild(sel2);
  const targets=()=>ids.filter(p=>slotsOf(p).some(s=>s.layer===fineLayer));
  const cur=axis=>{const v=targets().map(p=>+(slotsOf(p).find(s=>s.layer===fineLayer)[axis])||0);return{v:v[0]||0,mixed:v.some(x=>Math.abs(x-v[0])>1e-9)};};
  const setAbs=(axis,val)=>{targets().forEach(p=>{KEYCFG[p]=slotsOf(p).map(s=>s.layer===fineLayer?{...s,[axis]:Math.round(val*100)/100}:{...s});});};
  const nudge=(axis,d)=>{targets().forEach(p=>{KEYCFG[p]=slotsOf(p).map(s=>s.layer===fineLayer?{...s,[axis]:Math.round(((+s[axis]||0)+d)*100)/100}:{...s});});};
  const inputs={};
  for(const [axis,lab] of [["dx","左右 X"],["dy","上下 Y"]]){
    const l=document.createElement("label");l.className="km-fineval";l.textContent=lab;
    const i=document.createElement("input");i.type="number";i.step="0.1";i.min="-5";i.max="5";i.inputMode="decimal";
    const c=cur(axis);i.value=fmt(c.v);if(c.mixed){i.value="";i.placeholder="混在";}
    i.onchange=()=>{let v=parseFloat(i.value);if(isNaN(v))return;v=Math.max(-5,Math.min(5,v));setAbs(axis,v);i.value=fmt(v);i.placeholder="";kmChanged(false);};
    l.appendChild(i);row1.appendChild(l);inputs[axis]=i;
  }
  wrap.appendChild(row1);
  const pad=document.createElement("div");pad.className="km-nudge";
  const refresh=()=>{for(const a of ["dx","dy"]){const c=cur(a);inputs[a].value=c.mixed?"":fmt(c.v);inputs[a].placeholder=c.mixed?"混在":"";}};
  [["↑","dy",0.1,"上へ0.1mm"],["←","dx",-0.1,"左へ0.1mm"],["→","dx",0.1,"右へ0.1mm"],["↓","dy",-0.1,"下へ0.1mm"]].forEach(([t,a,d,al])=>{
    const b=document.createElement("button");b.type="button";b.textContent=t;b.setAttribute("aria-label",al);b.onclick=()=>{nudge(a,d);refresh();kmChanged(false);};pad.appendChild(b);});
  const rs=document.createElement("button");rs.type="button";rs.className="ghost";rs.textContent="位置を戻す";
  rs.onclick=()=>{setAbs("dx",0);setAbs("dy",0);refresh();kmChanged(false);};pad.appendChild(rs);
  wrap.appendChild(pad);
  const n=document.createElement("p");n.className="hint";n.style.padding="4px 0 0";
  n.textContent=ids.length>1?"矢印は選択中の各キーを今の位置から動かします。数値を入れると全キーが同じ位置になります。":"0.1mm単位で動かせます。天面からはみ出す位置にすると、そのLegendは省かれます。";
  wrap.appendChild(n);box.appendChild(wrap);
}
function kmChanged(rerenderEditor=true){drawMap();if(rerenderEditor)renderEditor();saveWs();rebuildPreview();}
function renderKmButtons(){
  const loaded=KM.layers.length>0;
  document.getElementById("km-loaded").hidden=!loaded;
  document.getElementById("km-dev").textContent=loaded?(KM.device||"キーボード")+"・"+KM.layers.length+"レイヤー・"+KM.keys.length+"キー":"";
  document.getElementById("km-disconnect").hidden=!client;
  document.getElementById("km-reload").hidden=!client;
}
function renderKm(){renderKmButtons();drawMap();renderEditor();}

// --- legend settings form ---
const LFIELDS=[
  {k:"mainSize",label:"メイン文字の大きさ",min:2,max:6,step:0.1},
  {k:"subSize",label:"サブ文字の大きさ",min:1.4,max:3.5,step:0.1},
  {k:"depth",label:"彫り込みの深さ",hint:"2色印刷なら積層ピッチの倍数に",min:0.2,max:1.2,step:0.05,dep:()=>LCFG.style==="engrave"},
  {k:"height",label:"浮き彫りの高さ",hint:"天面からの出っ張り",min:0.2,max:1.2,step:0.05,dep:()=>LCFG.style==="raised"}];
function buildFontRow(box){
  const w=document.createElement("div");w.className="seg km-font";
  const h=document.createElement("div");h.className="seghead";h.textContent="フォント";w.appendChild(h);
  const sel2=document.createElement("select");sel2.setAttribute("aria-label","Legendのフォント");
  const og=(label,list)=>{const g=document.createElement("optgroup");g.label=label;list.forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;g.appendChild(o);});sel2.appendChild(g);};
  og("日本語対応",FONTS.filter(f=>f.g==="jp").map(f=>[f.name,f.name]));
  og("英数字向け（かな・漢字はIBM Plex Sans JPで表示）",FONTS.filter(f=>f.g==="en").map(f=>[f.name,f.name]));
  const kind=fontKind(LCFG.font),extra=[];
  if(kind!=="web")extra.push([LCFG.font,(kind==="file"?"":"PCのフォント: ")+LCFG.font.replace(/^File: /,"ファイル: ")]);
  extra.push(["__local","PCにインストールしたフォントを使う…"],["__file","フォントファイルを読み込む…"]);
  og("その他",extra);
  sel2.value=LCFG.font;
  const panel=document.createElement("div");panel.className="km-fontpanel";
  const note=document.createElement("p");note.className="hint";note.style.margin="4px 0 0";
  const fi=document.createElement("input");fi.type="file";fi.accept=".ttf,.otf,.woff,.woff2";fi.hidden=true;
  const setFont=name=>{LCFG.font=name;shapeCache.clear();buildLegendForm();kmChanged(false);};
  sel2.onchange=()=>{
    if(sel2.value==="__file"){sel2.value=LCFG.font;fi.click();return;}
    if(sel2.value==="__local"){sel2.value=LCFG.font;panel.hidden=false;panel.querySelector("input").focus();return;}
    setFont(sel2.value);};
  fi.onchange=async()=>{const f=fi.files&&fi.files[0];fi.value="";if(!f)return;
    try{const name=await loadFontFile(f);setFont(name);}catch(e){note.textContent="このフォントファイルは読み込めませんでした。TTF / OTF / WOFF / WOFF2を選んでください。";}};
  panel.hidden=true;
  const inp=document.createElement("input");inp.placeholder="例：Yu Gothic UI、Hiragino Sans";inp.setAttribute("aria-label","フォント名");
  const ok=document.createElement("button");ok.type="button";ok.textContent="使う";
  ok.onclick=()=>{const v=inp.value.trim();if(!v)return;if(!localFontInstalled(v)){note.textContent="「"+v+"」はこのPCで見つかりませんでした。フォント名を確認してください。";return;}setFont(v);};
  inp.onkeydown=e=>{if(e.key==="Enter")ok.click();};
  panel.appendChild(inp);panel.appendChild(ok);
  w.appendChild(sel2);w.appendChild(panel);w.appendChild(fi);w.appendChild(note);
  if(kind==="file"&&!document.fonts.check('16px "'+LCFG.font+'"'))note.textContent="読み込んだフォントファイルはページを開き直すと使えなくなります。もう一度読み込んでください。";
  else if(kind==="file")note.textContent="フォントファイルはこのページを開いている間だけ使えます（保存されません）。";
  else if(kind==="local")note.textContent="PCにインストールしたフォントは、そのフォントがあるPCでだけ同じ形になります。";
  else if(FONTS.find(f=>f.name===LCFG.font).g==="en")note.textContent="かな・漢字のLegendは IBM Plex Sans JP で作られます。";
  box.appendChild(w);
}
function buildLegendForm(){
  const box=document.getElementById("km-legend");box.innerHTML="";
  const segRow=(label,key,opts)=>{const w=document.createElement("div");w.className="seg";const h=document.createElement("div");h.className="seghead";h.textContent=label;w.appendChild(h);
    opts.forEach(([t,v])=>{const b=document.createElement("button");b.type="button";b.textContent=t;b.setAttribute("aria-pressed",String(LCFG[key]===v));
      b.onclick=()=>{LCFG[key]=v;w.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));shapeCache.clear();if(key==="style")buildLegendForm();kmChanged(false);};w.appendChild(b);});
    box.appendChild(w);};
  segRow("Legendの形","style",[["彫り込み（面一）","engrave"],["浮き彫り","raised"]]);
  segRow("ホストPCのキー配列（記号の表示）","host",[["JIS（日本語）","jis"],["US","us"]]);
  buildFontRow(box);
  segRow("太さ","weight",[["標準",500],["太字",700]]);
  LFIELDS.forEach(it=>{
    const r=document.createElement("div");r.className="row";r.style.gridTemplateColumns="minmax(0,1fr) 76px";
    const id="l-"+it.k;const lab=document.createElement("label");lab.htmlFor=id;lab.textContent=it.label+"（mm）";
    if(it.hint){const sm=document.createElement("small");sm.textContent=it.hint;lab.appendChild(sm);}
    const num=document.createElement("input");num.type="number";num.id=id;num.min=it.min;num.max=it.max;num.step=it.step;num.value=LCFG[it.k];num.inputMode="decimal";
    const rng=document.createElement("input");rng.type="range";rng.min=it.min;rng.max=it.max;rng.step=it.step;rng.value=LCFG[it.k];rng.setAttribute("aria-label",it.label);
    let tm=0;const apply=()=>{clearTimeout(tm);tm=setTimeout(()=>{shapeCache.clear();kmChanged(false);},250);};
    rng.oninput=()=>{LCFG[it.k]=parseFloat(rng.value);num.value=fmt(LCFG[it.k]);drawMap();apply();};
    num.onchange=()=>{let v=parseFloat(num.value);if(isNaN(v))v=LCFG[it.k];v=Math.min(it.max,Math.max(it.min,v));LCFG[it.k]=v;num.value=fmt(v);rng.value=v;apply();};
    r.appendChild(lab);r.appendChild(num);r.appendChild(rng);if(it.dep&&!it.dep())r.style.display="none";box.appendChild(r);
  });
}

// --- export all keys ---
function safeName(t){const s=String(t||"").replace(/[^A-Za-z0-9+\-]+/g,"");return s||"key";}
async function exportLegendKeys(onlySel){
  const st=document.getElementById("km-exst"),btns=[document.getElementById("km-exall"),document.getElementById("km-exsel")];
  const list=onlySel?[...sel].sort((a,b)=>a-b):KM.keys.map((_,i)=>i);
  if(!list.length){st.textContent="キーが選ばれていません。";return;}
  btns.forEach(b=>b.disabled=true);
  if(EXP.format==="3mf"){try{await export3MF(list,st);}catch(e){st.textContent="生成できませんでした（"+(e&&e.message||e)+"）。";}finally{btns.forEach(b=>b.disabled=false);}return;}
  try{
    const q=P.quality==2?[24,160]:[14,96];
    const files=[{name:"body_plain.stl",data:toSTL(buildMesh(P,q[0],q[1],0))}];const scadRows=[],warns=[];
    for(let n=0;n<list.length;n++){
      const pos=list[n];st.textContent="Legendを生成しています… "+(n+1)+" / "+list.length;
      await new Promise(r=>setTimeout(r,0));
      const parts=await legendParts(pos,0,q[0],q[1]);
      if(parts.dropped.length)warns.push((pos+1)+"番: "+parts.dropped.join(", "));
      const main=slotsOf(pos).map(s=>slotText(s,pos)).find(Boolean)||"";
      const nm=String(pos+1).padStart(2,"0")+"_"+safeName(main);
      const keyT=LCFG.style==="engrave"?parts.body:parts.body.concat(parts.legend);
      files.push({name:"keys/"+nm+".stl",data:toSTL(keyT)});
      if(parts.legend.length)files.push({name:(LCFG.style==="engrave"?"inlay/":"legends/")+nm+"_legend.stl",data:toSTL(parts.legend)});
      const multi=slotsOf(pos).length>1;
      scadRows.push("    [ // "+(pos+1)+"\n"+slotsOf(pos).map(s=>{const t=slotText(s,pos);if(!t)return null;const b=slotBoxFor(s,multi);
        return "      ["+JSON.stringify(t)+", "+fmt(b.cx)+", "+fmt(b.cy)+", "+fmt(b.size)+"]";}).filter(Boolean).join(",\n")+"\n    ]");
    }
    files.push({name:"engraved.scad",data:new TextEncoder().encode(engraveScad(scadRows,list))});
    files.push({name:"keymap.json",data:new TextEncoder().encode(JSON.stringify({format:"lak-keymap/1",device:KM.device,layers:KM.layers,behaviors:KM.behaviors,keys:KM.keys,legendConfig:LCFG,keyConfig:KEYCFG}))});
    st.textContent="ZIPにまとめています…";await new Promise(r=>setTimeout(r,0));
    const zip=await makeZipAsync(files);
    const tag=(KM.device||"keyboard").replace(/[^A-Za-z0-9_-]+/g,"_").slice(0,30)||"keyboard";
    await saveFile(zip,"lak_legends_"+tag+".zip","km-exst");
    if(warns.length)st.textContent+=" 入りきらない・重なるLegendを省きました（"+warns.slice(0,6).join(" / ")+(warns.length>6?" ほか":"")+"）。";
    if(Store.mode==="db"||Store.mode==="local")addItem("history",{filename:"lak_legends_"+tag+".zip",quality:P.quality,params:{...P},createdAt:Date.now()}).catch(()=>{});
  }catch(e){st.textContent="生成できませんでした（"+(e&&e.message||e)+"）。";}
  finally{btns.forEach(b=>b.disabled=false);}
}
async function export3MF(list,st){
  const q=P.quality==2?[24,160]:[14,96];
  const pos=plateLayout(list.length,P.pitch,EXP.plate),items=[],warns=[];
  for(let n=0;n<list.length;n++){
    const k=list[n];st.textContent="3MFを生成しています… "+(n+1)+" / "+list.length;await new Promise(r=>setTimeout(r,0));
    const parts=await legendParts(k,0,q[0],q[1]);
    if(parts.dropped.length)warns.push((k+1)+"番: "+parts.dropped.join(", "));
    const main=slotsOf(k).map(s=>slotText(s,k)).find(Boolean)||"";
    items.push({name:String(k+1).padStart(2,"0")+"_"+(main||"key"),x:pos[n][0],y:pos[n][1],
      parts:[{name:"body",tris:parts.body,extruder:EXP.bodyExt},{name:"legend",tris:parts.legend,extruder:EXP.legendExt}]});
  }
  st.textContent="3MFにまとめています…";await new Promise(r=>setTimeout(r,0));
  const blob=await build3MF(items);
  const tag=(KM.device||"keyboard").replace(/[^A-Za-z0-9_-]+/g,"_").slice(0,30)||"keyboard",fname="lak_keycaps_"+tag+".3mf";
  if(window.claude){ // .3mf is not an allowed download type here -> wrap in a zip
    const z=await makeZipAsync([{name:fname,data:new Uint8Array(await blob.arrayBuffer())}]);
    await saveFile(z,fname.replace(/\.3mf$/,"_3mf.zip"),"km-exst");
  }else await saveFile(blob,fname,"km-exst");
  if(warns.length)st.textContent+=" 入りきらない・重なるLegendを省きました（"+warns.slice(0,6).join(" / ")+(warns.length>6?" ほか":"")+"）。";
  if(Store.mode==="db"||Store.mode==="local")addItem("history",{filename:fname,quality:P.quality,params:{...P},createdAt:Date.now()}).catch(()=>{});
}
function buildExportForm(){
  const box=document.getElementById("km-exfmt");box.innerHTML="";
  const w=document.createElement("div");w.className="seg";w.style.borderTop="0";
  const h=document.createElement("div");h.className="seghead";h.textContent="出力形式";w.appendChild(h);
  [["STL（ZIP）","stl"],["3MF（Bambu Studio / OrcaSlicer）","3mf"]].forEach(([t,v])=>{const b=document.createElement("button");b.type="button";b.textContent=t;
    b.setAttribute("aria-pressed",String(EXP.format===v));b.onclick=()=>{EXP.format=v;buildExportForm();saveWs();};w.appendChild(b);});
  box.appendChild(w);
  const note=document.createElement("p");note.className="hint";note.style.padding="0 0 6px";
  if(EXP.format==="3mf"){
    note.textContent="選んだキーをプレートに並べた1ファイルにします。各キーは「本体＋Legend」の2パーツのオブジェクトで、フィラメント番号も設定済みです。"+(BUILD==="claude"?"この表示では3MFをZIPに入れて保存します。":"");
    box.appendChild(note);
    const g=document.createElement("div");g.className="km-exgrid";
    const num=(label,key,min,max)=>{const l=document.createElement("label");l.textContent=label;const i=document.createElement("input");i.type="number";i.min=min;i.max=max;i.value=EXP[key];i.inputMode="numeric";
      i.onchange=()=>{let v=parseInt(i.value,10);if(isNaN(v))v=EXP[key];v=Math.min(max,Math.max(min,v));EXP[key]=v;i.value=v;saveWs();};l.appendChild(i);g.appendChild(l);};
    num("本体のフィラメント","bodyExt",1,16);num("Legendのフィラメント","legendExt",1,16);
    const l=document.createElement("label");l.textContent="プレート";const s=document.createElement("select");
    [["256mm（X1/P1/A1）",256],["180mm（A1 mini）",180]].forEach(([t,v])=>{const o=document.createElement("option");o.value=v;o.textContent=t;s.appendChild(o);});
    s.value=EXP.plate;s.onchange=()=>{EXP.plate=+s.value;saveWs();};l.appendChild(s);g.appendChild(l);
    box.appendChild(g);
  }else{
    note.textContent="キーごとのSTL（Legendを彫り込んだ本体）、2色印刷用のはめ込みLegend、刻印用のOpenSCADをZIPにまとめます。";box.appendChild(note);
  }
}
function engraveScad(rows,list){
  const body=scadText().replace(/\nkeycap\(\);\s*$/,"\n");
  return body+`
// ===== Legend 刻印版 =====
// key を変えて1キーずつ出力します（keys/ フォルダの番号と対応）
key = 0;              // 0 = ${list[0]+1}番のキー
engrave_depth = ${fmt(LCFG.depth)};
legend_font = "${LCFG.font}:style=${LCFG.weight>=700?"Bold":"Medium"}";

legends = [
${rows.join(",\n")}
];

difference() {
    keycap();
    for (l = legends[key])
        translate([l[1], l[2], edge_h + E + dome - engrave_depth])
            linear_extrude(5) text(l[0], size = l[3] * 0.8, font = legend_font, halign = "center", valign = "center");
}
`;
}

// --- workspace persistence ---
let wsTimer=0;
function saveWs(){clearTimeout(wsTimer);wsTimer=setTimeout(async()=>{
  if(!KM.layers.length)return;
  const doc={km:{device:KM.device,layers:KM.layers,behaviors:KM.behaviors,keys:KM.keys,source:KM.source},lcfg:LCFG,keycfg:KEYCFG,exp:EXP,updatedAt:Date.now()};
  try{if(Store.mode==="db")await Store.db.doc("data/users/"+Store.uid+"/lib").collection("ws").doc("current").set(doc);
    else if(Store.mode==="local")localStorage.setItem(LS+"ws",JSON.stringify(doc));}catch(_){}
},1200);}
async function loadWs(){
  let doc=null;
  try{if(Store.mode==="db"){const s=await Store.db.doc("data/users/"+Store.uid+"/lib").collection("ws").doc("current").get();if(s.exists)doc=s.data();}
    else if(Store.mode==="local"){doc=JSON.parse(localStorage.getItem(LS+"ws")||"null");}}catch(_){}
  if(doc&&doc.km&&Array.isArray(doc.km.layers)&&doc.km.layers.length){
    LCFG={...LDEF,...(doc.lcfg||{})};KEYCFG=JSON.parse(JSON.stringify(doc.keycfg||{}));EXP={...EDEF,...(doc.exp||{})};buildExportForm();
    KM.device=doc.km.device||"";KM.layers=doc.km.layers;KM.behaviors=doc.km.behaviors||{};KM.keys=doc.km.keys||[];KM.source=doc.km.source||"";
    sel.clear();curKey=KM.keys.length?0:null;if(curKey!==null)sel.add(0);
    buildLegendForm();renderKm();kmStatus("前回のキーマップ（"+(KM.device||"キーボード")+"）を復元しました。");rebuildPreview();
  }
}

function initKm(){
  document.getElementById("km-usb").onclick=()=>connect("usb");
  document.getElementById("km-ble").onclick=()=>connect("ble");
  document.getElementById("km-ble-all").onclick=()=>connect("ble-all");
  document.getElementById("km-logcopy").onclick=async()=>{try{await navigator.clipboard.writeText(kmLogLines.join("\n"));kmStatus("接続ログをコピーしました。");}catch(_){kmStatus("コピーできませんでした。ログを選択してコピーしてください。");}};
  if(!("bluetooth" in navigator))document.getElementById("km-ble-all").hidden=true;
  document.getElementById("km-sample").onclick=loadSample;
  const fi=document.getElementById("km-file");document.getElementById("km-open").onclick=()=>fi.click();
  fi.onchange=()=>{if(fi.files&&fi.files[0])importKeymapFile(fi.files[0]);fi.value="";};
  document.getElementById("km-reload").onclick=()=>readFromDevice();
  document.getElementById("km-disconnect").onclick=async()=>{if(client){try{await client.close();}catch(_){}}client=null;renderKmButtons();kmStatus("切断しました。");};
  document.getElementById("km-export").onclick=exportKeymapJson;
  document.getElementById("km-all").onclick=()=>{KM.keys.forEach((_,i)=>sel.add(i));kmChanged();};
  document.getElementById("km-none").onclick=()=>{sel.clear();kmChanged();};
  const mb=document.getElementById("km-multi");mb.onclick=()=>{multiSel=!multiSel;mb.setAttribute("aria-pressed",String(multiSel));};
  document.getElementById("km-exall").onclick=()=>exportLegendKeys(false);
  document.getElementById("km-exsel").onclick=()=>exportLegendKeys(true);
  kmCv().addEventListener("click",ev=>{const i=mapHit(ev);if(i<0)return;
    if(multiSel){if(sel.has(i))sel.delete(i);else sel.add(i);}else{sel.clear();sel.add(i);}
    curKey=i;kmChanged();});
  window.addEventListener("resize",()=>drawMap());
  if(!("serial" in navigator))document.getElementById("km-usb").title="このブラウザはUSB接続に対応していません";
  if(!("bluetooth" in navigator))document.getElementById("km-ble").title="このブラウザはBluetooth接続に対応していません";
  buildLegendForm();buildExportForm();renderKm();
}
