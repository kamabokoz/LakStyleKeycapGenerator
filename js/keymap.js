// keymap.js — keymap loading, per-key legend editor, legend export
// LAK風キーキャップジェネレータ / MIT License

// ---------- keymap & legends ----------
const KM={device:"",layers:[],behaviors:{},keys:[],source:""};
const LDEF={host:"jis",font:"IBM Plex Sans JP",weight:700,mainSize:4.0,subSize:2.3,style:"engrave",depth:0.6,height:0.4,embed:0.3,
  mark:false,markShape:"dot",markSize:1.6,markAt:"tl",markOnly:false};
let LCFG={...LDEF};
let KEYCFG={}; // pos -> [{layer, at, text?}]
let SVGS={}; // SVG image library: id -> {name, svg, mode:"dark"|"all", scale}
const svgImgs=new Map(); // id -> {img} thumbnails for the key map
function svgImg(id){if(!SVGS[id])return null;let e=svgImgs.get(id);if(e)return e.img;e={img:null};svgImgs.set(id,e);
  LEG.svgThumb(SVGS[id].svg,96).then(im=>{e.img=im;drawMap();}).catch(()=>{});return null;}
function svgKey(id){const v=SVGS[id];return v?id+":"+v.mode+":"+(+v.scale||1):"";}
// layer -1 = image-only slot (a logo that does not belong to any keymap layer)
function layerName(li){return li<0?"画像":((KM.layers[li]&&KM.layers[li].name)||("Layer "+li));}
var KEYHOME={}; // pos -> true : keys that get the homing bump in keymap output
// shape parameters for one key: with a keymap loaded, the homing bump is chosen per key
function paramsFor(pos){return KM.layers.length&&pos!==null&&pos!==undefined?{...P,homing:P.homing&&!!KEYHOME[pos]}:P;}
// the master switch in the parameters panel is ON: make sure some keys carry the bump and the preview shows one of them
function homingEdited(k){
  if(!KM.layers.length)return;
  const sw=k==="homing";   // the master switch itself: markers and the key editor change
  if(!P.homing){if(sw){drawMap();renderEditor();}return;}
  let msg="";
  if(!Object.keys(KEYHOME).length){
    const fj=fjKeys(),pick=fj.length?fj:(curKey!==null?[curKey]:[]);
    pick.forEach(i=>KEYHOME[i]=true);
    if(pick.length)msg=(fj.length?"F・Jキーに":"表示中のキーに")+"ホーミング突起を付けました（付けるキーはキーの設定欄で変えられます）。";
  }
  if(curKey===null||!KEYHOME[curKey]){
    const t=Object.keys(KEYHOME).map(Number).sort((x,y)=>x-y)[0];
    if(t!==undefined){sel.clear();sel.add(t);curKey=t;
      const lab=autoLabel(0,t);msg+="ホーミング突起の付いたキー"+(lab?"（"+lab+"）":"（"+(t+1)+"番）")+"を表示しています。";}
  }
  if(msg)kmStatus(msg);
  if(msg||sw){drawMap();renderEditor();saveWs();}   // only when something changed (sliders call this on every tick)
}
function setHomingMaster(on){P.homing=on;const i=inputs.homing;if(i&&i.check)i.check.checked=on;}
const EDEF={format:"stl",bodyExt:1,legendExt:2,plate:256,legendMode:"one",layerExt:{}};
// filament for a layer's legend when legends are split by layer (default: legend filament + layer index)
function layerExt(li){const v=EXP.layerExt&&EXP.layerExt[li];return Number.isInteger(v)&&v>=1&&v<=16?v:li<0?EXP.legendExt:Math.min(16,EXP.legendExt+li);}
// preview material for a filament number: same as body -> body colour, otherwise a distinct colour per filament
function extMat(ext){return ext===EXP.bodyExt?0:4+((ext-1)%8);}
// when 3MF with per-layer legends is selected, the preview colours legends by their filament
function legendMatFn(){return EXP.format==="3mf"&&EXP.legendMode==="layer"?li=>extMat(layerExt(li)):null;}
function recolor(T,m){return T.map(t=>[t[0],t[1],t[2],m]);}
// layers that show a legend on at least one key
function usedLayers(){const u=new Set();KM.keys.forEach((_,p)=>{slotsOf(p).forEach(s=>{if(slotShown(s,p)||(s.svg&&SVGS[s.svg]))u.add(s.layer);});keyMarks(p).forEach(t=>u.add(t));});return [...u].sort((a,b)=>((a<0)-(b<0))||a-b);} // image-only (-1) last
let EXP={...EDEF};
const sel=new Set();let multiSel=false,curKey=null,client=null;
const AT=[["c","中央"],["tl","左上"],["tr","右上"],["bl","左下"],["br","右下"],["t","上"],["b","下"]];
function slotsOf(pos){return KEYCFG[pos]||[{layer:0,at:"c"}];}
function bindingAt(li,pos){const L=KM.layers[li];return L&&L.bindings[pos];}
function autoLabel(li,pos){const b=bindingAt(li,pos);if(!b)return "";
  return VIAL.isVialBinding(b)?VIAL.label(b,KM.behaviors._qmk,KM.layers,LCFG.host):LBL.label(b,KM.behaviors,KM.layers,LCFG.host);}
// layer key: the layer this binding switches to ({layer, tap}) or null. ZMK behaviours and Vial/QMK keycodes
function layerTarget(b){
  if(!b)return null;
  if(VIAL.isVialBinding(b))return VIAL.layerTarget(b);
  const B=KM.behaviors[b.b];if(!B)return null;
  const n=(B.name||"").toLowerCase(),c=B.consts||{};
  const idx=id=>{const i=KM.layers.findIndex(l=>l.id===id);return i>=0?i:id;};
  if(/layer[- ]?tap/.test(n))return{layer:idx(b.p1),tap:true};
  if(/momentary layer|sticky layer|toggle layer|to layer/.test(n)||c.p1Kind==="layer")return{layer:idx(b.p1),tap:false};
  return null;
}
// layers a key's marks point to: from the base layer (layer-taps included) and every layer shown on the key
function keyMarks(pos){
  if(!LCFG.mark)return [];
  const out=[];
  for(const li of [...new Set([0,...slotsOf(pos).map(s=>s.layer)])].sort((a,b)=>a-b)){
    const t=layerTarget(bindingAt(li,pos));if(t&&t.layer>=0&&!out.includes(t.layer))out.push(t.layer);}
  return out;
}
// text printed for a slot: with "mark only", plain layer keys (not layer-taps) print just the mark
function slotShown(s,pos){
  if(LCFG.mark&&LCFG.markOnly&&!s.text){const t=layerTarget(bindingAt(s.layer,pos));if(t&&!t.tap)return "";}
  return slotText(s,pos);
}
// 2D outline (CCW) of one mark centred at cx,cy
function markOutline(shape,size,cx,cy){
  const o=[],r=size/2;
  if(shape==="square"){const h=r*0.9,rc=Math.min(0.25,h*0.3);for(const [qx,qy,a0] of [[1,1,0],[-1,1,90],[-1,-1,180],[1,-1,270]])for(let i=0;i<=4;i++){const a=(a0+i*22.5)*Math.PI/180;o.push([cx+qx*(h-rc)+rc*Math.cos(a),cy+qy*(h-rc)+rc*Math.sin(a)]);}}
  else if(shape==="tri"){const h=size*0.9;for(const a of [90,210,330]){const t=a*Math.PI/180;o.push([cx+h*0.62*Math.cos(t),cy-h*0.12+h*0.62*Math.sin(t)]);}}
  else if(shape==="bar"){const w=size*1.9,t=Math.max(0.25,size*0.28),e=w/2-t;for(let i=0;i<=12;i++){const a=(-90+i*15)*Math.PI/180;o.push([cx+e+t*Math.cos(a),cy+t*Math.sin(a)]);}for(let i=0;i<=12;i++){const a=(90+i*15)*Math.PI/180;o.push([cx-e+t*Math.cos(a),cy+t*Math.sin(a)]);}}
  else{for(let i=0;i<32;i++){const a=i/32*2*Math.PI;o.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}}
  return{outer:o,holes:[]};
}
function markWidth(){return LCFG.markShape==="bar"?LCFG.markSize*1.9:LCFG.markSize;}
// centres of n marks at the chosen corner, lined up towards the middle
function markCentres(n){
  const s=plateauHalf(),w=markWidth(),h=LCFG.markShape==="bar"?Math.max(0.5,LCFG.markSize*0.56):LCFG.markSize,gap=Math.max(0.5,LCFG.markSize*0.4),at=LCFG.markAt;
  const cy=at[0]==="t"?s-h/2-0.15:-(s-h/2-0.15),tot=n*w+(n-1)*gap;
  const x0=at.includes("l")?-s+w/2+0.15:at.includes("r")?s-w/2-0.15-(n-1)*(w+gap):-tot/2+w/2;
  return Array.from({length:n},(_,i)=>[x0+i*(w+gap),cy]);
}
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
  const marks=keyMarks(pos);
  const key=JSON.stringify([pos,slots.map(s=>[slotShown(s,pos),svgKey(s.svg),s.at,+s.dx||0,+s.dy||0]),marks,LCFG.markShape,LCFG.markSize,LCFG.markAt,LCFG.font,LCFG.weight,LCFG.mainSize,LCFG.subSize,P.top_size,P.edge_band,P.boundary,P.r_top,P.step_run,P.step_rs,P.step_rf,P.r_plateau,P.edge_drop,multi]);
  let r=shapeCache.get(key);
  if(!r){
    const shapes=[],dropped=[],groups=[];
    const addGroup=(layer,sh)=>{const g=groups.find(x=>x.layer===layer);if(g)g.shapes.push(...sh);else groups.push({layer,shapes:sh.slice()});};
    for(const s of slots){const im=s.svg&&SVGS[s.svg],t=im?"":slotShown(s,pos);if(!im&&!t)continue;const bx=slotBoxFor(s,multi);
      let sh;
      if(im){try{sh=await LEG.svgShapes(im.svg,{h:bx.size*1.3*(+im.scale||1),maxW:bx.maxW,cx:bx.cx,cy:bx.cy,mode:im.mode});}catch(e){dropped.push(im.name);continue;}
        if(!sh.length){dropped.push(im.name+"（印字する部分がありません）");continue;}}
      else sh=await LEG.textShapes(t,{font:LCFG.font,weight:LCFG.weight,size:bx.size,maxW:bx.maxW,cx:bx.cx,cy:bx.cy});
      const pr=plateauRect(P,D);const outside=loopsOf(sh).some(l=>l.some(p=>sdRR(p[0],p[1],pr.size,pr.r)>-0.1));
      if(outside||shapesOverlap(sh,shapes)){dropped.push(im?im.name:t);continue;}
      shapes.push(...sh);addGroup(s.layer,sh);}
    // layer-key marks, coloured (grouped) by the layer they switch to
    const pr=plateauRect(P,D);
    markCentres(marks.length).forEach(([cx,cy],i)=>{const sh=[markOutline(LCFG.markShape,LCFG.markSize,cx,cy)];
      if(loopsOf(sh).some(l=>l.some(p=>sdRR(p[0],p[1],pr.size,pr.r)>-0.1))||shapesOverlap(sh,shapes)){dropped.push("マーク（"+((KM.layers[marks[i]]&&KM.layers[marks[i]].name)||("L"+marks[i]))+"）");return;}
      shapes.push(...sh);addGroup(marks[i],sh);});
    r={shapes,dropped,groups};if(shapeCache.size>300)shapeCache.clear();shapeCache.set(key,r);
  }
  return r;
}
function shiftT(T,offx){return offx?T.map(t=>[[t[0][0]+offx,t[0][1],t[0][2]],[t[1][0]+offx,t[1][1],t[1][2]],[t[2][0]+offx,t[2][1],t[2][2]],t[3]]):T;}
// body (with pockets when engraved) and the legend part (inlay filling the pocket, or raised letters)
// legendBy: the legend split by keymap layer ([{layer, tris}]), for per-layer filaments
async function legendParts(pos,offx,N,M){
  const {shapes,dropped,groups}=await legendShapes(pos),Q=paramsFor(pos);
  if(!shapes.length)return{body:buildMesh(Q,N,M,offx),legend:[],legendBy:[],dropped};
  const eng=LCFG.style==="engrave";
  const zb=eng?(x,y)=>zTop(x,y)-LCFG.depth:(x,y)=>zTop(x,y)-LCFG.embed,zt=eng?(x,y)=>zTop(x,y):(x,y)=>zTop(x,y)+LCFG.height;
  const legendBy=groups.map(g=>({layer:g.layer,tris:shiftT(LEG.extrude(g.shapes,zb,zt,3),offx)}));
  const legend=[].concat(...legendBy.map(g=>g.tris));
  const body=eng?buildMesh(Q,N,M,offx,{shapes,depth:LCFG.depth}):buildMesh(Q,N,M,offx);
  return{body,legend,legendBy,dropped};
}
// does the homing bump touch any legend of this key?
function homingHitsLegend(shapes){
  if(!shapes.length)return false;
  const S=homingSpec(P),L=Math.max(0,S.len-S.w),m=S.r+0.3;
  const dSeg=(x,y)=>{const t=Math.max(-L/2,Math.min(L/2,x-S.x));return Math.hypot(x-S.x-t,y-S.y);};
  for(const l of loopsOf(shapes))for(let i=0;i<l.length;i++){const a=l[i],b=l[(i+1)%l.length];
    for(let s=0;s<=4;s++){const x=a[0]+(b[0]-a[0])*s/4,y=a[1]+(b[1]-a[1])*s/4;if(dSeg(x,y)<m)return true;}}
  // bump entirely inside a glyph
  return shapes.some(s=>pipL([S.x,S.y],s.outer)&&!s.holes.some(h=>pipL([S.x,S.y],h)));
}
function minPocketFloor(shapes){let m=Infinity;for(const l of loopsOf(shapes))for(const p of l)m=Math.min(m,zTop(p[0],p[1])-LCFG.depth-P.cavity_h);return m;}

// --- loading keymaps ---
function setKeymap(d,src){
  KM.device=d.device||"";KM.layers=d.layers||[];KM.behaviors=d.behaviors||{};KM.keys=d.keys||[];KM.source=src;
  sel.clear();curKey=KM.keys.length?0:null;if(curKey!==null)sel.add(0);
  for(const k in KEYCFG){if(+k>=KM.keys.length)delete KEYCFG[k];}
  for(const k in KEYHOME){if(+k>=KM.keys.length)delete KEYHOME[k];}
  if(P.homing&&!Object.keys(KEYHOME).length)fjKeys().forEach(i=>KEYHOME[i]=true);   // bump already switched on: start with F and J
  shapeCache.clear();renderKm();buildExportForm();saveWs();update();
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
// --- Vial (QMK) keyboards over WebHID ---
let VIALDEF=null,LASTVIL=null; // keyboard definition file / last .vil, kept for this session
async function connectVial(){
  if(client){try{await client.close();}catch(_){}client=null;}
  kmLogClear();kmStatus("キーボードを選んでください…");
  try{
    const v=await VIAL.open(kmLog,()=>{client=null;kmStatus("キーボードとの接続が切れました。");renderKmButtons();});
    client={vial:v,tr:{kind:"vial"},close:()=>v.close()};renderKmButtons();
    await readVial();
  }catch(e){
    client=null;renderKmButtons();kmLog("エラー: "+(e&&e.name)+" "+(e&&e.message));
    if(e&&e.name==="NotFoundError"){kmStatus("選択がキャンセルされました。一覧にキーボードが出ないときは、Vialアプリを閉じてからもう一度試してください。");return;}
    if(e&&(e.name==="SecurityError"||/permissions policy|disallowed/i.test(String(e.message)))){
      kmStatus(BUILD==="claude"?"この表示ではVialの接続が許可されていません。単体版で接続するか、Vialで保存した.vilファイルを「ファイルから読込」で読み込んでください。":"このページではVialの接続が許可されていません。httpsかローカルファイルとしてChrome/Edgeで開いてください。",true);return;}
    if(e&&e.name==="NotAllowedError"){kmStatus("キーボードを開けませんでした。Vialアプリなど、キーボードに接続している他のアプリを閉じてからもう一度試してください。",true);return;}
    kmStatus((e&&e.message)||"接続できませんでした。",true);
  }
}
async function readVial(){
  if(!client||!client.vial||reading)return;
  reading=true;const c=client;
  kmStatus("Vialキーボードから読み込んでいます…");
  try{
    const d=await c.vial.read(VIALDEF,(what,n,t)=>kmStatus(what+"を読み込んでいます… "+Math.min(100,Math.round(n/t*100))+"%"));
    setKeymap(d,"vial");
    kmStatus("読み込みました（"+d.layers.length+"レイヤー / "+d.keys.length+"キー）。"+(d.vial?"":"VIAのキーボードとして、読み込んだ定義ファイルの配列を使いました。"));
  }catch(e){kmLog("読み込みエラー: "+(e&&e.code)+" "+(e&&e.message));kmStatus((e&&e.message)||"読み込みに失敗しました。",true);}
  finally{reading=false;}
}
function loadVil(vil,name){
  const d=VIAL.fromVil(vil,VIALDEF,name);
  KEYCFG={};KEYHOME={};   // a different keyboard / layout: per-key settings do not carry over
  setKeymap(d,"vil");
  kmStatus("Vialのファイルを読み込みました（"+d.layers.length+"レイヤー / "+d.keys.length+"キー）。"+
    (d.grid?"キーの配列情報がないため、マトリクスの並び（行×列）で表示しています。キーボード定義（vial.json）も読み込むと実際の配列になります。":""));
}
let waitingUnlock=false;
const kmLogLines=[];
function kmLog(m){const t=new Date();kmLogLines.push(String(t.getMinutes()).padStart(2,"0")+":"+String(t.getSeconds()).padStart(2,"0")+"."+String(t.getMilliseconds()).padStart(3,"0")+" "+m);
  const el=document.getElementById("km-log");if(el){el.textContent=kmLogLines.slice(-60).join("\n");document.getElementById("km-logbox").hidden=false;}}
function kmLogClear(){kmLogLines.length=0;const el=document.getElementById("km-log");if(el)el.textContent="";}
let reading=false,unlockTimer=0;
async function readFromDevice(){
  if(client&&client.vial)return readVial();
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
  const data={format:"lak-keymap/1",device:KM.device,layers:KM.layers,behaviors:KM.behaviors,keys:KM.keys,legendConfig:LCFG,keyConfig:KEYCFG,homingKeys:Object.keys(KEYHOME).map(Number),svgs:SVGS};
  const name="keymap_"+(KM.device||"keyboard").replace(/[^A-Za-z0-9_-]+/g,"_")+".json";
  saveFile(new Blob([JSON.stringify(data)],{type:"application/json"}),name,"km-status");
}
function applyLakKeymap(d){
  if(!Array.isArray(d.layers)||!Array.isArray(d.keys))throw new Error("形式が違います");
  if(d.legendConfig)LCFG={...LDEF,...d.legendConfig};
  KEYCFG=d.keyConfig&&typeof d.keyConfig==="object"?d.keyConfig:{};
  KEYHOME={};if(Array.isArray(d.homingKeys))d.homingKeys.forEach(i=>{if(Number.isInteger(i)&&i>=0)KEYHOME[i]=true;});
  if(d.svgs&&typeof d.svgs==="object"){SVGS={...SVGS,...d.svgs};svgImgs.clear();}
  setKeymap(d,"file");buildLegendForm();kmStatus("ファイルから読み込みました（"+d.layers.length+"レイヤー / "+d.keys.length+"キー）。");
}
// keymap files: this app's keymap.json, Vial .vil, and keyboard definitions (vial.json / VIA JSON)
async function importKeymapFiles(files){
  const got=[];
  for(const f of files){try{got.push({f,d:JSON.parse(await f.text())});}catch(e){kmStatus("「"+f.name+"」はJSONとして読み込めませんでした。",true);return;}}
  try{
    const lak=got.find(x=>x.d&&x.d.format==="lak-keymap/1"),vil=got.find(x=>VIAL.isVil(x.d)),def=got.find(x=>VIAL.isDef(x.d));
    if(def)VIALDEF=def.d;
    if(lak){applyLakKeymap(lak.d);return;}
    if(vil){LASTVIL={vil:vil.d,name:vil.f.name.replace(/\.[^.]+$/,"")};loadVil(LASTVIL.vil,LASTVIL.name);return;}
    if(def){
      if(LASTVIL){loadVil(LASTVIL.vil,LASTVIL.name);kmStatus("キーボード定義を使って、Vialのファイルを実際の配列で表示し直しました（"+KM.keys.length+"キー）。");return;}
      kmStatus("キーボード定義（"+def.f.name+"）を読み込みました。続けて.vilファイルを読み込むか、VIAのキーボードなら「Vial（USB）」で接続してください。");return;}
    throw new Error("対応していない形式です");
  }catch(e){kmStatus("このファイルは読み込めません（"+e.message+"）。このアプリで書き出したキーマップ、Vialの.vil、キーボード定義（vial.json）を選んでください。",true);}
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
  let rx=k.rx*u,ry=k.ry*u;if(!k.ro&&!k.rx&&!k.ry){rx=x+w/2;ry=y+h/2;} // ro: KLE keys rotate about (rx,ry) even at 0,0
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
    for(const s of slots){
      if(s.svg&&SVGS[s.svg]){const im=svgImg(s.svg),off={c:[0,0],t:[0,-.3],b:[0,.3],tl:[-.22,-.3],tr:[.22,-.3],bl:[-.22,.3],br:[.22,.3]}[s.at]||[0,0],mm=sc/Math.max(P.pitch,1);
        const bh=(s.at==="c"?0.36:0.2)*sc,x=off[0]*sc+(+s.dx||0)*mm,y=off[1]*sc-(+s.dy||0)*mm;
        if(im){const a=im.width/im.height,w=a>=1?bh:bh*a,h=a>=1?bh/a:bh;ctx2.save();if(on)ctx2.filter="invert(1)";ctx2.drawImage(im,x-w/2,y-h/2,w,h);ctx2.restore();}
        else{ctx2.font=`600 ${Math.max(7,0.16*sc)}px system-ui,sans-serif`;ctx2.fillStyle=on?css("--accent-ink"):muted;ctx2.fillText("SVG",x,y);}
        continue;}
      const t=slotShown(s,i);if(!t)continue;const fs=(s.at==="c"?0.3:0.19)*sc;
      ctx2.font=`600 ${Math.max(7,fs)}px "IBM Plex Sans JP",system-ui,sans-serif`;ctx2.fillStyle=on?css("--accent-ink"):(s.at==="c"?ink:muted);
      const off={c:[0,0],t:[0,-.3],b:[0,.3],tl:[-.22,-.3],tr:[.22,-.3],bl:[-.22,.3],br:[.22,.3]}[s.at]||[0,0];
      let tx=t;while(ctx2.measureText(tx).width>0.86*sc&&tx.length>1)tx=tx.slice(0,-1);
      const mm=sc/Math.max(P.pitch,1);ctx2.fillText(tx,off[0]*sc+(+s.dx||0)*mm,off[1]*sc-(+s.dy||0)*mm);}
    const mk=keyMarks(i),lm=legendMatFn();
    mk.forEach((t,j)=>{ctx2.fillStyle=lm?"rgb("+COLS[lm(t)].join(",")+")":(on?css("--accent-ink"):ink);ctx2.beginPath();
      ctx2.arc((-0.33+j*0.13)*sc,-0.33*sc,Math.max(2,sc*0.05),0,2*Math.PI);ctx2.fill();});
    if(P.homing&&KEYHOME[i]){ctx2.strokeStyle=on?css("--accent-ink"):ink;ctx2.lineWidth=Math.max(1.5,sc*0.04);ctx2.lineCap="round";
      ctx2.beginPath();ctx2.moveTo(-0.14*sc,0.36*sc);ctx2.lineTo(0.14*sc,0.36*sc);ctx2.stroke();}
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
  const hasSvg=Object.keys(SVGS).length>0;
  // select of library images; withText: first option keeps the text
  const svgSelect=(withText,states,disabled,label)=>{const sv=document.createElement("select");sv.className="km-svgsel";sv.setAttribute("aria-label",label);
    if(withText){const o=document.createElement("option");o.value="";o.textContent="文字を印字";sv.appendChild(o);}
    for(const id in SVGS){const o=document.createElement("option");o.value=id;o.textContent="画像: "+SVGS[id].name;sv.appendChild(o);}
    const vals=states.filter(Boolean).map(x=>x.svg&&SVGS[x.svg]?x.svg:"");sv.value=vals.length&&vals.every(v=>v===vals[0])?vals[0]:(withText?"":Object.keys(SVGS)[0]);
    sv.disabled=disabled;return sv;};
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
      const tx=document.createElement("input");tx.className="km-text";tx.placeholder=auto||"（空）";tx.value=s&&s.text?s.text:"";tx.disabled=!s||!!(s.svg&&SVGS[s.svg]);tx.maxLength=12;
      tx.setAttribute("aria-label",(L.name||"Layer")+"の文字（空欄で自動）");
      tx.onchange=()=>{KEYCFG[ids[0]]=slotsOf(ids[0]).map(x=>x.layer===li?{...x,text:tx.value||undefined}:{...x});kmChanged(false);};
      row.appendChild(tx);
    }
    if(hasSvg){const sv=svgSelect(true,states,onCount===0,(L.name||"Layer "+li)+"の画像");
      sv.onchange=()=>{ids.forEach(p=>{KEYCFG[p]=slotsOf(p).map(x=>x.layer===li?{...x,svg:sv.value||undefined,auto:undefined}:{...x});});kmChanged();};row.appendChild(sv);}
    box.appendChild(row);
  });
  // image-only slot (layer -1): a logo next to the legends
  if(hasSvg){
    const states=ids.map(p=>slotsOf(p).find(s=>s.layer===-1)),onCount=states.filter(Boolean).length;
    const row=document.createElement("div");row.className="km-lrow";
    const lab=document.createElement("label");lab.className="km-lname";
    const cb=document.createElement("input");cb.type="checkbox";cb.checked=onCount===ids.length;cb.indeterminate=onCount>0&&onCount<ids.length;
    lab.appendChild(cb);lab.appendChild(document.createTextNode(" 画像を追加（ロゴなど）"));
    const at=document.createElement("select");at.setAttribute("aria-label","画像の位置");
    AT.forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;at.appendChild(o);});
    const first=states.find(Boolean);at.value=first?first.at:"c";at.disabled=onCount===0;
    const sv=svgSelect(false,states,onCount===0,"追加する画像");
    cb.onchange=()=>{const id=sv.value||Object.keys(SVGS)[0];ids.forEach(p=>{let s=slotsOf(p).map(x=>({...x}));
        if(cb.checked){if(!s.find(x=>x.layer===-1)){const used=new Set(s.map(x=>x.at));const free=["c","tr","br","tl","bl","t","b"].find(a=>!used.has(a))||"tr";s.push({layer:-1,at:free,svg:id});}}
        else s=s.filter(x=>x.layer!==-1);
        KEYCFG[p]=s;});kmChanged();};
    at.onchange=()=>{ids.forEach(p=>{KEYCFG[p]=slotsOf(p).map(x=>x.layer===-1?{...x,at:at.value}:{...x});});kmChanged();};
    sv.onchange=()=>{ids.forEach(p=>{KEYCFG[p]=slotsOf(p).map(x=>x.layer===-1?{...x,svg:sv.value}:{...x});});kmChanged();};
    row.appendChild(lab);row.appendChild(at);row.appendChild(sv);box.appendChild(row);
  }
  const hint=document.createElement("p");hint.className="hint";hint.style.padding="6px 0 0";
  hint.textContent=(ids.length===1?"文字欄を空にすると、キーマップから自動で決まる文字になります。":"複数キーの文字の上書きは、1キーずつ選んで行ってください。")+
    (Object.keys(SVGS).length?"":"「Legendの文字設定」でSVG画像を追加すると、文字の代わりやロゴとして印字できます。");
  box.appendChild(hint);
  renderFine(box,ids);
  renderHomingKeys(box,ids);
}
function fjKeys(){const out=[];KM.keys.forEach((_,i)=>{const t=autoLabel(0,i);if(t==="F"||t==="J")out.push(i);});return out;}
function renderHomingKeys(box,ids){
  const wrap=document.createElement("div");wrap.className="km-fine";
  const head=document.createElement("div");head.className="km-edhead";head.textContent="ホーミング突起";wrap.appendChild(head);
  const on=P.homing?ids.filter(p=>KEYHOME[p]).length:0;   // master off: nothing will get a bump
  const lab=document.createElement("label");lab.className="km-lname";lab.style.padding="4px 0";
  const cb=document.createElement("input");cb.type="checkbox";cb.checked=ids.length>0&&on===ids.length;cb.indeterminate=on>0&&on<ids.length;
  cb.onchange=()=>{ids.forEach(p=>{if(cb.checked)KEYHOME[p]=true;else delete KEYHOME[p];});if(cb.checked&&!P.homing){setHomingMaster(true);const n=Object.keys(KEYHOME).length;kmStatus("ホーミング突起をオンにしました（いま"+n+"キーに付いています）。");}kmChanged();update();};
  lab.appendChild(cb);lab.appendChild(document.createTextNode(ids.length>1?" 選択中のキーに付ける":" このキーに付ける"));wrap.appendChild(lab);
  const row=document.createElement("div");row.className="km-btns";row.style.marginTop="4px";
  const fj=document.createElement("button");fj.type="button";fj.className="ghost";fj.textContent="F・Jキーに付ける";
  fj.onclick=()=>{const k=fjKeys();if(!k.length){kmStatus("ベースレイヤーにF・Jのキーが見つかりませんでした。");return;}KEYHOME={};k.forEach(i=>KEYHOME[i]=true);if(!P.homing)setHomingMaster(true);kmStatus("F・Jキー（"+k.map(i=>i+1).join("・")+"番）にホーミング突起を付けました。");kmChanged();update();};
  const clr=document.createElement("button");clr.type="button";clr.className="ghost";clr.textContent="すべて外す";
  clr.onclick=()=>{KEYHOME={};kmChanged();update();};
  row.appendChild(fj);row.appendChild(clr);wrap.appendChild(row);
  const n=document.createElement("p");n.className="hint";n.style.padding="4px 0 0";
  const cnt=Object.keys(KEYHOME).length;
  n.textContent=!P.homing?"パラメータの「ホームポジション用の突起を付ける」がオフのため、今は突起が付きません。ここでチェックを入れるとオンになります。":(cnt?"いま"+cnt+"キーに付いています。":"")+"形と位置は、パラメータの「ホーミング突起」の設定を使います。";
  wrap.appendChild(n);box.appendChild(wrap);
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
  layersOn.forEach(li=>{const o=document.createElement("option");o.value=li;o.textContent=layerName(li);sel2.appendChild(o);});
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
function kmChanged(rerenderEditor=true){drawMap();if(rerenderEditor)renderEditor();if(EXP.format==="3mf"&&EXP.legendMode==="layer")buildExportForm();saveWs();rebuildPreview();}
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
  const numRow=it=>{
    const r=document.createElement("div");r.className="row";r.style.gridTemplateColumns="minmax(0,1fr) 76px";
    const id="l-"+it.k;const lab=document.createElement("label");lab.htmlFor=id;lab.textContent=it.label+"（mm）";
    if(it.hint){const sm=document.createElement("small");sm.textContent=it.hint;lab.appendChild(sm);}
    const num=document.createElement("input");num.type="number";num.id=id;num.min=it.min;num.max=it.max;num.step=it.step;num.value=LCFG[it.k];num.inputMode="decimal";
    const rng=document.createElement("input");rng.type="range";rng.min=it.min;rng.max=it.max;rng.step=it.step;rng.value=LCFG[it.k];rng.setAttribute("aria-label",it.label);
    let tm=0;const apply=()=>{clearTimeout(tm);tm=setTimeout(()=>{shapeCache.clear();kmChanged(false);},250);};
    rng.oninput=()=>{LCFG[it.k]=parseFloat(rng.value);num.value=fmt(LCFG[it.k]);drawMap();apply();};
    num.onchange=()=>{let v=parseFloat(num.value);if(isNaN(v))v=LCFG[it.k];v=Math.min(it.max,Math.max(it.min,v));LCFG[it.k]=v;num.value=fmt(v);rng.value=v;apply();};
    r.appendChild(lab);r.appendChild(num);r.appendChild(rng);if(it.dep&&!it.dep())r.style.display="none";box.appendChild(r);
  };
  LFIELDS.forEach(numRow);
  // --- marks on layer keys ---
  const mh=document.createElement("div");mh.className="km-edhead";mh.style.cssText="padding:14px 0 2px;border-top:1px solid var(--line);margin-top:6px";mh.textContent="レイヤーキーのマーク";box.appendChild(mh);
  const chk=(label,key,rebuild)=>{const l=document.createElement("label");l.className="km-lname";l.style.padding="6px 0";const c=document.createElement("input");c.type="checkbox";c.checked=!!LCFG[key];
    c.onchange=()=>{LCFG[key]=c.checked;shapeCache.clear();if(rebuild)buildLegendForm();if(EXP.format==="3mf"&&EXP.legendMode==="layer")buildExportForm();kmChanged(false);};
    l.appendChild(c);l.appendChild(document.createTextNode(" "+label));box.appendChild(l);};
  chk("レイヤーキーにマークを付ける","mark",true);
  const mhint=document.createElement("p");mhint.className="hint";mhint.style.padding="0 0 6px";
  mhint.textContent="MO・TG・TOなどのレイヤーキーと、ベースレイヤーのLayer-Tapに、切り替え先のレイヤーを表すマークを付けます。3MFで「レイヤーごとに色分け」にすると、マークは切り替え先レイヤーの色（フィラメント）になります。";
  box.appendChild(mhint);
  if(LCFG.mark){
    segRow("マークの形","markShape",[["丸","dot"],["四角","square"],["三角","tri"],["バー","bar"]]);
    segRow("マークの位置","markAt",[["左上","tl"],["上","t"],["右上","tr"],["左下","bl"],["下","b"],["右下","br"]]);
    numRow({k:"markSize",label:"マークの大きさ",hint:"バーは長さがこの約2倍になります",min:0.8,max:4,step:0.1});
    chk("レイヤー切り替えだけのキーは文字を省く（マークだけにする）","markOnly",false);
  }
  buildSvgLibrary(box);
}
// --- SVG image library ---
let iconGalleryOpen=false;
function addIcon(ic){if(!SVGS[ic.id])SVGS[ic.id]={name:ic.name,svg:ic.svg,mode:"dark",scale:1};}
function removeSvg(id){delete SVGS[id];svgImgs.delete(id);
  for(const p in KEYCFG)KEYCFG[p]=KEYCFG[p].filter(x=>!(x.layer===-1&&x.svg===id)).map(x=>x.svg===id?{...x,svg:undefined,auto:undefined}:x);}
// replace key labels (Shift, Enter, arrows, volume ...) with built-in icons; marked auto so they can be reverted
function iconizeLabels(){
  let n=0;
  KM.keys.forEach((_,p)=>{let ch=false;const slots=slotsOf(p).map(x=>({...x}));
    for(const sl of slots){if(sl.layer<0||sl.svg||sl.text)continue;const ic=ICONS.forLabel(slotShown(sl,p));if(!ic)continue;addIcon(ic);sl.svg=ic.id;sl.auto=true;ch=true;n++;}
    if(ch)KEYCFG[p]=slots;});
  return n;
}
function uniconizeLabels(){let n=0;for(const p in KEYCFG)KEYCFG[p]=KEYCFG[p].map(x=>{if(x.auto&&x.svg){n++;return{...x,svg:undefined,auto:undefined};}return x;});return n;}
function buildSvgLibrary(box){
  const h=document.createElement("div");h.className="km-edhead";h.style.cssText="padding:14px 0 2px;border-top:1px solid var(--line);margin-top:6px";h.textContent="SVG画像（ロゴ・アイコン）";box.appendChild(h);
  const hint=document.createElement("p");hint.className="hint";hint.style.padding="0 0 6px";
  hint.textContent="追加した画像は、キーの設定欄で文字の代わりに、またはロゴとして文字と並べて印字できます。大きさは文字の大きさに合わせて決まり、倍率で調整できます。";
  box.appendChild(hint);
  const list=document.createElement("div");list.className="km-svglist";
  for(const id in SVGS){const it=SVGS[id];
    const row=document.createElement("div");row.className="km-svgrow";
    const th=document.createElement("div");th.className="km-svgthumb";LEG.svgThumb(it.svg,64).then(im=>{im.alt="";th.appendChild(im);}).catch(()=>{th.textContent="?";});
    const nm=document.createElement("input");nm.value=it.name;nm.maxLength=30;nm.setAttribute("aria-label","画像の名前");
    nm.onchange=()=>{it.name=nm.value.trim()||it.name;nm.value=it.name;saveWs();renderEditor();};
    const del=document.createElement("button");del.type="button";del.className="ghost";del.textContent="削除";
    del.onclick=()=>{removeSvg(id);shapeCache.clear();buildLegendForm();kmChanged();};
    const md=document.createElement("select");md.setAttribute("aria-label","印字する部分");
    [["濃い色の部分を印字","dark"],["描かれた部分すべてを印字","all"]].forEach(([t,v])=>{const o=document.createElement("option");o.value=v;o.textContent=t;md.appendChild(o);});
    md.value=it.mode||"dark";md.onchange=()=>{it.mode=md.value;shapeCache.clear();kmChanged(false);};
    const sc=document.createElement("label");sc.className="km-svgscale";sc.textContent="倍率";
    const si=document.createElement("input");si.type="number";si.min=0.3;si.max=3;si.step=0.05;si.value=+it.scale||1;si.inputMode="decimal";
    si.onchange=()=>{let v=parseFloat(si.value);if(isNaN(v))v=+it.scale||1;v=Math.min(3,Math.max(0.3,v));it.scale=v;si.value=v;shapeCache.clear();kmChanged(false);};
    sc.appendChild(si);
    row.appendChild(th);row.appendChild(nm);row.appendChild(del);row.appendChild(md);row.appendChild(sc);list.appendChild(row);}
  box.appendChild(list);
  const setNote=t=>{const nn=box.querySelector(".km-svgnote");if(nn)nn.textContent=t;};
  // built-in icons
  const ib=document.createElement("div");ib.className="km-btns";ib.style.marginTop="8px";
  const gb=document.createElement("button");gb.type="button";gb.textContent=iconGalleryOpen?"おすすめの画像を閉じる":"おすすめの画像から選ぶ";gb.setAttribute("aria-expanded",String(iconGalleryOpen));
  gb.onclick=()=>{iconGalleryOpen=!iconGalleryOpen;buildLegendForm();};
  const ab=document.createElement("button");ab.type="button";ab.className="ghost";ab.textContent="キーの文字をアイコンに置き換える";
  ab.onclick=()=>{const n=iconizeLabels();shapeCache.clear();buildLegendForm();kmChanged();
    setNote(n?n+"か所の文字（Shift・Enter・矢印・音量など）をアイコンに置き換えました。「置き換えを元に戻す」で文字に戻せます。":"アイコンに置き換えられる文字がありませんでした（Shift・Enter・Bksp・Tab・矢印・音量などが対象です）。");};
  const ub=document.createElement("button");ub.type="button";ub.className="ghost";ub.textContent="置き換えを元に戻す";
  ub.onclick=()=>{const n=uniconizeLabels();shapeCache.clear();buildLegendForm();kmChanged();setNote(n?n+"か所を文字に戻しました。":"元に戻すものはありません。");};
  ib.appendChild(gb);ib.appendChild(ab);ib.appendChild(ub);box.appendChild(ib);
  if(iconGalleryOpen){
    const gh=document.createElement("p");gh.className="hint";gh.style.padding="6px 0 4px";gh.textContent="押すと画像の一覧に追加されます（もう一度押すと外します）。追加した画像は、キーの設定欄で選べます。";box.appendChild(gh);
    const grid=document.createElement("div");grid.className="km-icongrid";
    for(const ic of ICONS.list){const b=document.createElement("button");b.type="button";b.setAttribute("aria-pressed",String(!!SVGS[ic.id]));b.title=ic.name;
      const th=document.createElement("span");th.className="km-iconimg";LEG.svgThumb(ic.svg,48).then(im=>{im.alt="";th.appendChild(im);}).catch(()=>{});
      const nm=document.createElement("span");nm.className="km-iconname";nm.textContent=ic.name;
      b.appendChild(th);b.appendChild(nm);
      b.onclick=()=>{if(SVGS[ic.id])removeSvg(ic.id);else addIcon(ic);shapeCache.clear();buildLegendForm();kmChanged();};
      grid.appendChild(b);}
    box.appendChild(grid);
  }
  const note=document.createElement("p");note.className="hint";note.style.padding="4px 0 0";
  const fi=document.createElement("input");fi.type="file";fi.accept=".svg,image/svg+xml";fi.multiple=true;fi.hidden=true;
  const add=document.createElement("div");add.className="km-btns";add.style.margin="6px 0 10px";
  const b=document.createElement("button");b.type="button";b.textContent="SVGを追加…";b.onclick=()=>fi.click();add.appendChild(b);
  fi.onchange=async()=>{const files=[...(fi.files||[])];fi.value="";const bad=[];let n=0;
    for(const f of files){try{let t=await f.text();
        t=t.replace(/<\?xml[^>]*>/g,"").replace(/<!--[\s\S]*?-->/g,"").replace(/<metadata[\s\S]*?<\/metadata>/gi,"").replace(/>\s+</g,"><").trim();
        if(t.length>300000)throw new Error("大きすぎます（300KBまで）");
        LEG.svgPrepare(t);await LEG.svgThumb(t,32);
        const id="s"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
        SVGS[id]={name:f.name.replace(/\.svg$/i,"").slice(0,30)||"画像",svg:t,mode:"dark",scale:1};n++;}
      catch(e){bad.push(f.name+"（"+(e&&e.message||"読めません")+"）");}}
    buildLegendForm();renderEditor();saveWs();
    const nn=box.querySelector(".km-svgnote");if(nn)nn.textContent=(n?n+"個の画像を追加しました。キーを選んで、設定欄で画像を選んでください。":"")+(bad.length?" 追加できなかったファイル: "+bad.join("、"):"");};
  add.appendChild(fi);box.appendChild(add);
  note.className="hint km-svgnote";box.appendChild(note);
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
    const files=[{name:"body_plain.stl",data:toSTL(buildMesh({...P,homing:false},q[0],q[1],0))}];const scadRows=[],warns=[];
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
      scadRows.push("    [ // "+(pos+1)+"\n"+slotsOf(pos).map(s=>{if(s.svg&&SVGS[s.svg])return null;const t=slotShown(s,pos);if(!t)return null;const b=slotBoxFor(s,multi);
        return "      ["+JSON.stringify(t)+", "+fmt(b.cx)+", "+fmt(b.cy)+", "+fmt(b.size)+"]";}).filter(Boolean).join(",\n")+"\n    ]");
    }
    files.push({name:"engraved.scad",data:new TextEncoder().encode(engraveScad(scadRows,list))});
    files.push({name:"keymap.json",data:new TextEncoder().encode(JSON.stringify({format:"lak-keymap/1",device:KM.device,layers:KM.layers,behaviors:KM.behaviors,keys:KM.keys,legendConfig:LCFG,keyConfig:KEYCFG,homingKeys:Object.keys(KEYHOME).map(Number),svgs:SVGS}))});
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
    const lp=EXP.legendMode==="layer"
      ?parts.legendBy.map(g=>({name:"legend_"+(g.layer<0?"image":((KM.layers[g.layer]&&KM.layers[g.layer].name)||("L"+g.layer))),tris:g.tris,extruder:layerExt(g.layer)}))
      :[{name:"legend",tris:parts.legend,extruder:EXP.legendExt}];
    items.push({name:String(k+1).padStart(2,"0")+"_"+(main||"key"),x:pos[n][0],y:pos[n][1],
      parts:[{name:"body",tris:parts.body,extruder:EXP.bodyExt},...lp]});
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
    const perL=EXP.legendMode==="layer";
    note.textContent="選んだキーをプレートに並べた1ファイルにします。各キーは「本体＋Legend」"+(perL?"（レイヤーごと）":"")+"のパーツでできたオブジェクトで、フィラメント番号も設定済みです。"+(BUILD==="claude"?"この表示では3MFをZIPに入れて保存します。":"");
    box.appendChild(note);
    const changed=()=>{saveWs();if(perL)rebuildPreview();};
    const g=document.createElement("div");g.className="km-exgrid";
    const num=(label,key,min,max)=>{const l=document.createElement("label");l.textContent=label;const i=document.createElement("input");i.type="number";i.min=min;i.max=max;i.value=EXP[key];i.inputMode="numeric";
      i.onchange=()=>{let v=parseInt(i.value,10);if(isNaN(v))v=EXP[key];v=Math.min(max,Math.max(min,v));EXP[key]=v;i.value=v;if(perL)buildExportForm();changed();};l.appendChild(i);g.appendChild(l);};
    num("本体のフィラメント","bodyExt",1,16);if(!perL)num("Legendのフィラメント","legendExt",1,16);
    const l=document.createElement("label");l.textContent="プレート";const s=document.createElement("select");
    [["256mm（X1/P1/A1）",256],["180mm（A1 mini）",180]].forEach(([t,v])=>{const o=document.createElement("option");o.value=v;o.textContent=t;s.appendChild(o);});
    s.value=EXP.plate;s.onchange=()=>{EXP.plate=+s.value;saveWs();};l.appendChild(s);g.appendChild(l);
    box.appendChild(g);
    // legend colours: one filament, or one per keymap layer
    const m=document.createElement("div");m.className="seg";
    const mh=document.createElement("div");mh.className="seghead";mh.textContent="Legendの色分け";m.appendChild(mh);
    [["すべて同じ色","one"],["レイヤーごとに色分け","layer"]].forEach(([t,v])=>{const b=document.createElement("button");b.type="button";b.textContent=t;
      b.setAttribute("aria-pressed",String(EXP.legendMode===v));b.onclick=()=>{EXP.legendMode=v;buildExportForm();saveWs();rebuildPreview();};m.appendChild(b);});
    box.appendChild(m);
    if(perL){
      const used=usedLayers();
      const lg=document.createElement("div");lg.className="km-extable";
      if(!used.length){const e=document.createElement("p");e.className="hint";e.textContent="Legendを表示しているレイヤーがありません。";lg.appendChild(e);}
      used.forEach(li=>{
        const row=document.createElement("label");row.className="km-exrow";
        const sw=document.createElement("span");sw.className="km-swatch";const c=COLS[extMat(layerExt(li))];sw.style.background="rgb("+c.join(",")+")";
        const nm=document.createElement("span");nm.textContent=li<0?"画像（ロゴなど）":layerName(li);
        const i=document.createElement("input");i.type="number";i.min=1;i.max=16;i.value=layerExt(li);i.inputMode="numeric";i.setAttribute("aria-label",nm.textContent+"のフィラメント");
        i.onchange=()=>{let v=parseInt(i.value,10);if(isNaN(v))v=layerExt(li);v=Math.min(16,Math.max(1,v));EXP.layerExt={...EXP.layerExt,[li]:v};buildExportForm();changed();};
        row.appendChild(sw);row.appendChild(nm);row.appendChild(i);lg.appendChild(row);});
      box.appendChild(lg);
      const h2=document.createElement("p");h2.className="hint";h2.style.padding="4px 0 6px";
      h2.textContent="数字はスライサーのフィラメント番号です。プレビューのLegendは、フィラメント番号ごとに色を変えて表示しています（実際の色はスライサーで設定した色になります）。同じ番号にしたレイヤーは同じ色で印刷されます。";
      box.appendChild(h2);
    }
  }else{
    note.textContent="キーごとのSTL（Legendを彫り込んだ本体）、2色印刷用のはめ込みLegend、刻印用のOpenSCADをZIPにまとめます。";box.appendChild(note);
  }
}
function engraveScad(rows,list){
  const hk=P.homing?list.map((p,i)=>KEYHOME[p]?i:-1).filter(i=>i>=0):[];
  const body=scadText().replace(/\nhoming      = (true|false);/,"\nhoming      = len([for (h = homing_keys) if (h == key) h]) > 0;   // キーごとの設定（homing_keys）\nhoming_keys = ["+hk.join(", ")+"];")
    .replace(/\nkeycap\(\);\s*$/,"\n");
  return body+`
// ===== Legend 刻印版 =====${Object.keys(SVGS).length?"\n// SVG画像のLegendはこのファイルには入りません（STL / 3MFを使ってください）":""}${LCFG.mark?"\n// レイヤーキーのマークはこのファイルには入りません（STL / 3MFを使ってください）":""}
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
  const doc={km:{device:KM.device,layers:KM.layers,behaviors:KM.behaviors,keys:KM.keys,source:KM.source},lcfg:LCFG,keycfg:KEYCFG,home:Object.keys(KEYHOME).map(Number),exp:EXP,svgs:SVGS,updatedAt:Date.now()};
  try{if(Store.mode==="db")await Store.db.doc("data/users/"+Store.uid+"/lib").collection("ws").doc("current").set(doc);
    else if(Store.mode==="local")localStorage.setItem(LS+"ws",JSON.stringify(doc));}catch(_){}
},1200);}
async function loadWs(){
  let doc=null;
  try{if(Store.mode==="db"){const s=await Store.db.doc("data/users/"+Store.uid+"/lib").collection("ws").doc("current").get();if(s.exists)doc=s.data();}
    else if(Store.mode==="local"){doc=JSON.parse(localStorage.getItem(LS+"ws")||"null");}}catch(_){}
  if(doc&&doc.km&&Array.isArray(doc.km.layers)&&doc.km.layers.length){
    LCFG={...LDEF,...(doc.lcfg||{})};KEYCFG=JSON.parse(JSON.stringify(doc.keycfg||{}));KEYHOME={};if(Array.isArray(doc.home))doc.home.forEach(i=>{if(Number.isInteger(i)&&i>=0)KEYHOME[i]=true;});EXP={...EDEF,...(doc.exp||{})};SVGS=doc.svgs&&typeof doc.svgs==="object"?doc.svgs:{};svgImgs.clear();buildExportForm();
    KM.device=doc.km.device||"";KM.layers=doc.km.layers;KM.behaviors=doc.km.behaviors||{};KM.keys=doc.km.keys||[];KM.source=doc.km.source||"";
    sel.clear();curKey=KM.keys.length?0:null;if(curKey!==null)sel.add(0);
    buildLegendForm();renderKm();kmStatus("前回のキーマップ（"+(KM.device||"キーボード")+"）を復元しました。");rebuildPreview();
  }
}

function initKm(){
  document.getElementById("km-usb").onclick=()=>connect("usb");
  document.getElementById("km-ble").onclick=()=>connect("ble");
  document.getElementById("km-vial").onclick=()=>connectVial();
  document.getElementById("km-ble-all").onclick=()=>connect("ble-all");
  document.getElementById("km-logcopy").onclick=async()=>{try{await navigator.clipboard.writeText(kmLogLines.join("\n"));kmStatus("接続ログをコピーしました。");}catch(_){kmStatus("コピーできませんでした。ログを選択してコピーしてください。");}};
  if(!("bluetooth" in navigator))document.getElementById("km-ble-all").hidden=true;
  document.getElementById("km-sample").onclick=loadSample;
  const fi=document.getElementById("km-file");document.getElementById("km-open").onclick=()=>fi.click();
  fi.onchange=()=>{const fs=fi.files?[...fi.files]:[];fi.value="";if(fs.length)importKeymapFiles(fs);};
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
  if(!("hid" in navigator))document.getElementById("km-vial").title="このブラウザはVialの接続（WebHID）に対応していません";
  buildLegendForm();buildExportForm();renderKm();
}
