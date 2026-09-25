// share.js — share to X: preview card image and parameter links (#k=...)
// LAK風キーキャップジェネレータ / MIT License

// ---------- share to X ----------
const SHARE_KEY="lakgen:shareBase";
function b64uEnc(s){const b=new TextEncoder().encode(s);let bin="";b.forEach(x=>bin+=String.fromCharCode(x));return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function b64uDec(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const bin=atob(s);return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));}
function clampParams(src){
  const o=cleanParams(src);
  GROUPS.forEach(g=>g.items.forEach(it=>{
    if(it.k&&typeof o[it.k]==="number")o[it.k]=Math.min(it.max,Math.max(it.min,o[it.k]));
    if(it.seg&&!it.options.some(op=>op[1]===o[it.seg]))o[it.seg]=DEF[it.seg];
  }));
  return o;
}
function encodeParams(p,name){const d={};for(const k in DEF)if(p[k]!==DEF[k])d[k]=p[k];const o={v:2,p:d};if(name)o.n=String(name).slice(0,40);return b64uEnc(JSON.stringify(o));}
function decodeParams(s){const o=JSON.parse(b64uDec(s));if(!o||(o.v!==1&&o.v!==2)||typeof o.p!=="object")throw new Error("形式が違います");
  const base=o.v===1?LEGACY_DEF:DEF; // v1 links were made against the earlier defaults
  return{p:clampParams(cleanParams({...base,...o.p},base)),n:typeof o.n==="string"?o.n.slice(0,40):""};}
function shareBase(){
  let b="";try{b=localStorage.getItem(SHARE_KEY)||"";}catch(_){}
  if(!b&&BUILD==="standalone"&&/^https?:$/.test(location.protocol))b=location.origin+location.pathname;
  return b;
}
function shareUrl(p,name){const b=shareBase();return b?b.split("#")[0]+"#k="+encodeParams(p,name):"";}
let sharedNotice="";
function applySharedHash(){
  const m=/[#&]k=([A-Za-z0-9_-]+)/.exec(location.hash||"");if(!m)return;
  try{const r=decodeParams(m[1]);P=r.p;sharedNotice="共有リンクのパラメータを読み込みました"+(r.n?"（"+r.n+"）":"")+"。";}
  catch(e){sharedNotice="共有リンクのパラメータを読み込めませんでした。";}
}
function showSharedNotice(){if(!sharedNotice)return;const box=document.getElementById("msgs");const d=document.createElement("div");d.className="msg info";d.textContent=sharedNotice;box.prepend(d);setTimeout(()=>{sharedNotice="";},0);}

// --- preview card image ---
function snapshot(v,w,h){
  const saved={W,H,yaw,el,span,ty,te,ts,view,cw:cv.width,ch:cv.height,gw:glc.width,gh:glc.height};
  W=w;H=h;cv.width=w;cv.height=h;ctx.setTransform(1,0,0,1,0,0);glc.width=w;glc.height=h;
  const pv=VIEWS[v];yaw=ty=pv[0];el=te=pv[1];span=ts=(v==="iso"?27:pv[2]);view=v;
  render();
  const off=document.createElement("canvas");off.width=w;off.height=h;const o=off.getContext("2d");
  if(v!=="section"&&GLR)o.drawImage(glc,0,0);
  o.drawImage(cv,0,0);
  W=saved.W;H=saved.H;yaw=saved.yaw;el=saved.el;span=saved.span;ty=saved.ty;te=saved.te;ts=saved.ts;view=saved.view;
  resize();dirty=true;
  return off;
}
function paramLines(p){
  const D=derive(p),center=p.edge_h+D.E+D.dome,L=[];
  L.push(["キーピッチ",fmt(p.pitch)+" mm"]);
  L.push(["中央の高さ",fmt(center)+" mm"]);
  if(p.boundary!=2)L.push(["段差",fmt(p.edge_drop)+" mm"+(p.boundary==1?"（なだらか）":p.step_run>0?"・斜面 "+fmt(p.step_run)+" mm":"")]);
  if(Math.abs(p.dome)>1e-3)L.push(["天面",["球面","円筒（左右）","円筒（前後）"][p.dome_type||0]+" "+(p.dome>0?"+":"−")+fmt(Math.abs(p.dome))+" mm"]);
  else L.push(["天面","平ら"]);
  L.push(["十字穴",fmt(p.cross_len)+" × "+fmt(p.cross_w)+" mm"]);
  return L;
}
async function makeCard(title){
  try{if(document.fonts)await document.fonts.load('600 40px "IBM Plex Sans JP"');}catch(_){}
  const Wc=1200,Hc=675,c=document.createElement("canvas");c.width=Wc;c.height=Hc;const g=c.getContext("2d");
  g.fillStyle="#E6EAED";g.fillRect(0,0,Wc,Hc);
  g.fillStyle="#D3D9DE";roundRect(g,28,28,700,619,22);g.fill();
  const iso=snapshot("iso",700,619);g.drawImage(iso,28,28);
  g.fillStyle="#F4F6F7";roundRect(g,752,28,420,619,22);g.fill();
  const F='"IBM Plex Sans JP","Hiragino Sans","Noto Sans JP",sans-serif';
  g.fillStyle="#1C252D";g.font="600 32px "+F;const nl=wrapText(g,title||"LAK風キーキャップ",780,84,370,40,2);
  let y=84+(nl-1)*40+34;
  g.font="500 16px "+F;g.fillStyle="#56626C";g.fillText("Kailh Choc V2 / 3Dプリント用",780,y);
  y+=44;for(const [k,v] of paramLines(P)){g.fillStyle="#56626C";g.font="14px "+F;g.fillText(k,780,y);g.fillStyle="#1C252D";g.font="600 21px "+F;g.fillText(v,780,y+26);y+=54;}
  const sec=snapshot("section",380,150);g.drawImage(sec,772,Math.max(y-10,Hc-236),380,150);
  g.fillStyle="#2C6A5D";g.font="600 15px "+F;g.fillText("LAK風キーキャップジェネレータ",780,Hc-48);
  return new Promise(r=>c.toBlob(b=>r(b),"image/png"));
}
function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function wrapText(g,t,x,y,maxW,lh,maxLines){const lines=[];let line="";for(const ch of t){if(g.measureText(line+ch).width>maxW&&line){lines.push(line);line=ch;}else line+=ch;}if(line)lines.push(line);
  const shown=Math.min(lines.length,maxLines);lines.slice(0,maxLines).forEach((l,i)=>{let s2=l;if(i===maxLines-1&&lines.length>maxLines){while(s2&&g.measureText(s2+"…").width>maxW)s2=s2.slice(0,-1);s2+="…";}g.fillText(s2,x,y+i*lh);});return shown;}

// --- dialog ---
let shareBlob=null,shareName="",shareObjUrl="";
function defaultShareText(name){
  const L=paramLines(P);
  return "LAK風キーキャップジェネレータで作りました。\n"+(name?"「"+name+"」\n":"")+L.slice(1,4).map(([k,v])=>k+" "+v).join("・")+"\n#自作キーボード #LAKキーキャップ #LAK風キーキャップジェネレータ";
}
function intentUrl(text,url){return "https://twitter.com/intent/tweet?text="+encodeURIComponent(text)+(url?"&url="+encodeURIComponent(url):"");}
async function openShare(name){
  shareName=name||"";
  const dlg=document.getElementById("share-dlg");dlg.hidden=false;document.body.style.overflow="hidden";
  const st=document.getElementById("share-st");st.textContent="プレビュー画像を作っています…";
  document.getElementById("share-text").value=defaultShareText(shareName);
  document.getElementById("share-base").value=(()=>{try{return localStorage.getItem(SHARE_KEY)||"";}catch(_){return"";}})();
  refreshShareLink();
  shareBlob=await makeCard(shareName);
  if(shareObjUrl)URL.revokeObjectURL(shareObjUrl);shareObjUrl=URL.createObjectURL(shareBlob);
  document.getElementById("share-img").src=shareObjUrl;
  const file=new File([shareBlob],"lak_keycap.png",{type:"image/png"});
  const canFiles=!!(navigator.canShare&&navigator.canShare({files:[file]}));
  document.getElementById("share-native").hidden=!canFiles;
  document.getElementById("share-copyimg").hidden=!(navigator.clipboard&&window.ClipboardItem);
  st.textContent=canFiles?"「Xアプリで共有」を押すと、画像と文章をまとめてXに渡せます。":"画像をコピー（または保存）してから投稿画面を開き、貼り付けてください。";
  document.getElementById("share-text").focus();
}
function closeShare(){document.getElementById("share-dlg").hidden=true;document.body.style.overflow="";}
function refreshShareLink(){
  const url=shareUrl(P,shareName),box=document.getElementById("share-link");
  box.value=url||"";box.placeholder="公開先URLを設定すると、パラメータ付きのリンクが入ります";
  const text=document.getElementById("share-text").value;
  document.getElementById("share-intent").href=intentUrl(text,url);
  document.getElementById("share-nobase").hidden=!!url;
}
function initShare(){
  window.addEventListener("hashchange",()=>{const before=JSON.stringify(P);applySharedHash();
    if(JSON.stringify(P)!==before){for(const k in resets)delete resets[k];buildForm();update();}showSharedNotice();});
  document.getElementById("share-x").onclick=()=>openShare("");
  document.getElementById("share-close").onclick=closeShare;
  document.getElementById("share-dlg").addEventListener("click",e=>{if(e.target.id==="share-dlg")closeShare();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!document.getElementById("share-dlg").hidden)closeShare();});
  document.getElementById("share-text").addEventListener("input",refreshShareLink);
  document.getElementById("share-base").addEventListener("change",e=>{
    let v=e.target.value.trim();if(v&&!/^https:\/\//.test(v)){document.getElementById("share-st").textContent="公開先URLは https:// から始まるURLにしてください。";return;}
    try{if(v)localStorage.setItem(SHARE_KEY,v.split("#")[0]);else localStorage.removeItem(SHARE_KEY);}catch(_){}
    refreshShareLink();});
  document.getElementById("share-copylink").onclick=async()=>{const v=document.getElementById("share-link").value;if(!v)return;
    try{await navigator.clipboard.writeText(v);document.getElementById("share-st").textContent="リンクをコピーしました。";}catch(_){document.getElementById("share-link").select();document.getElementById("share-st").textContent="リンクを選択しました。コピーしてください。";}};
  document.getElementById("share-native").onclick=async()=>{
    const st=document.getElementById("share-st");const url=shareUrl(P,shareName);const text=document.getElementById("share-text").value+(url?"\n"+url:"");
    try{await navigator.share({files:[new File([shareBlob],"lak_keycap.png",{type:"image/png"})],text});st.textContent="共有メニューを開きました。Xを選んでください。";}
    catch(e){st.textContent=e&&e.name==="AbortError"?"共有をキャンセルしました。":"この表示では共有メニューを使えません。画像を保存して投稿画面から添付してください。";}};
  document.getElementById("share-copyimg").onclick=async()=>{const st=document.getElementById("share-st");
    try{await navigator.clipboard.write([new ClipboardItem({"image/png":shareBlob})]);st.textContent="画像をコピーしました。投稿画面を開いて貼り付けてください。";}
    catch(_){st.textContent="この表示では画像をコピーできません。「画像を保存」を使ってください。";}};
  document.getElementById("share-save").onclick=()=>saveFile(shareBlob,"lak_keycap.png","share-st");
  document.getElementById("share-intent").addEventListener("click",()=>{refreshShareLink();});
}
