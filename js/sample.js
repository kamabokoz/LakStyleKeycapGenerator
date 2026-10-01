// sample.js — Legend size samples: one thin flat plate divided into a grid, one cell per size with the size engraved
// LAK風キーキャップジェネレータ / MIT License

const SDEF={text:"B8@e",sizes:"2, 2.5, 3, 3.5, 4",both:false,label:true};
function sampleCfg(){return{...SDEF,...(LCFG.sample&&typeof LCFG.sample==="object"?LCFG.sample:{})};}
function sampleSizes(){const v=String(sampleCfg().sizes).split(/[,、\s]+/).map(Number).filter(x=>isFinite(x)&&x>=0.8&&x<=10);
  return [...new Set(v.map(x=>Math.round(x*100)/100))].sort((a,b)=>a-b).slice(0,20);}
// every sample to print: [{size, weight, label}]
function sampleList(){const c=sampleCfg(),ws=c.both?[500,700]:[LCFG.weight];const out=[];
  for(const sz of sampleSizes())for(const w of ws)out.push({size:sz,weight:w,label:fmt(sz)+(c.both?(w>=700?"B":"N"):"")});return out;}

// plate dimensions (mm)
const SP_M=1.2,SP_GROOVE=0.6,SP_LAB=1.8,SP_GAP=0.8,SP_END=0.9;
// plate thickness: engraved -> the pocket depth plus a 0.6mm floor (at least 1mm); raised -> 1mm
function sampleThick(){return LCFG.style==="engrave"?Math.max(1.0,LCFG.depth+0.6):1.0;}
function shapesBox(S){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const l of loopsOf(S))for(const p of l){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}
  return{x0,y0,x1,y1,w:x1-x0,h:y1-y0,cx:(x0+x1)/2};}
function shiftShapes(S,dx,dy){const f=l=>l.map(p=>[p[0]+dx,p[1]+dy]);return S.map(s=>({...s,outer:f(s.outer),holes:s.holes.map(f)}));}
const rectShape=(x0,y0,x1,y1)=>({outer:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],holes:[]});
// outline without repeated or collinear points
function cleanLoop(L){const o=[];for(const p of L){const q=o[o.length-1];if(!q||Math.abs(q[0]-p[0])>1e-9||Math.abs(q[1]-p[1])>1e-9)o.push(p);}
  if(o.length>1&&Math.abs(o[0][0]-o[o.length-1][0])<1e-9&&Math.abs(o[0][1]-o[o.length-1][1])<1e-9)o.pop();
  for(let i=0;i<o.length&&o.length>3;){const a=o[(i+o.length-1)%o.length],b=o[i],c=o[(i+1)%o.length];
    if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-9)o.splice(i,1);else i++;}
  return o;}

// Lay out every sample: one row per size (standard and bold side by side), each row as wide as it needs,
// rows stacked and left aligned -> a staircase-shaped plate with as little area as possible.
async function sampleLayout(progress){
  const c=sampleCfg(),list=sampleList();await ensureFont(LCFG.font);
  const cells=[];
  for(let i=0;i<list.length;i++){const sm=list[i];if(progress)await progress(i,list.length);
    const text=await LEG.textShapes(c.text||SDEF.text,{font:LCFG.font,weight:sm.weight,size:sm.size,maxW:1000,cx:0,cy:0});
    const lab=c.label?await LEG.textShapes(sm.label,{font:"IBM Plex Sans JP",weight:700,size:SP_LAB,maxW:1000,cx:0,cy:0}):[];
    if(!text.length)continue;
    const bt=shapesBox(text),bl=lab.length?shapesBox(lab):null;
    cells.push({sm,text,lab,bt,bl,w:Math.max(bt.w,bl?bl.w:0)+2*SP_M,h:bt.h+(bl?SP_GAP+bl.h:0)+2*SP_M});}
  const rows=[];for(const cl of cells){const r=rows[rows.length-1];if(r&&r.size===cl.sm.size)r.cells.push(cl);else rows.push({size:cl.sm.size,cells:[cl]});}
  let y=0;const texts=[],labels=[],grooves=[];
  for(const r of rows){r.cw=Math.max(...r.cells.map(q=>q.w));r.h=Math.max(...r.cells.map(q=>q.h));r.w=r.cw*r.cells.length;r.top=y;r.bot=y-r.h;
    r.cells.forEach((cl,j)=>{const cx=r.cw*(j+0.5),block=cl.bt.h+(cl.bl?SP_GAP+cl.bl.h:0),tTop=r.top-(r.h-block)/2;
      cl.textAt=shiftShapes(cl.text,cx-cl.bt.cx,tTop-cl.bt.y1);texts.push(...cl.textAt);
      if(cl.bl)labels.push(...shiftShapes(cl.lab,cx-cl.bl.cx,tTop-cl.bt.h-SP_GAP-cl.bl.y1));
      if(j>0){const x=r.cw*j;grooves.push(rectShape(x-SP_GROOVE/2,r.bot+SP_END,x+SP_GROOVE/2,r.top-SP_END));}}); // between cells
    y=r.bot;}
  for(let i=0;i+1<rows.length;i++){const w=Math.min(rows[i].w,rows[i+1].w),yb=rows[i].bot;                     // between rows
    if(w>2*SP_END+1)grooves.push(rectShape(SP_END,yb-SP_GROOVE/2,w-SP_END,yb+SP_GROOVE/2));}
  if(!rows.length)return null;
  // staircase outline (CCW): bottom edge, right side row by row upwards, top edge
  const n=rows.length,L=[[0,rows[n-1].bot],[rows[n-1].w,rows[n-1].bot]];
  for(let i=n-1;i>=0;i--){L.push([rows[i].w,rows[i].bot]);L.push([rows[i].w,rows[i].top]);}
  L.push([0,0]);
  const W=Math.max(...rows.map(r=>r.w)),H=-rows[n-1].bot,dx=-W/2,dy=H/2; // centre the plate on the origin
  const mv=S=>shiftShapes(S,dx,dy);
  return{outline:cleanLoop(L.map(p=>[p[0]+dx,p[1]+dy])),texts:mv(texts),labels:mv(labels),grooves:mv(grooves),W,H,rows,cells};
}
// meshes of the plate: body (with the pockets) and legend (inlay when engraved, raised letters otherwise)
function samplePlateMesh(lay){
  const eng=LCFG.style==="engrave",Tp=sampleThick(),pd=eng?LCFG.depth:Math.min(0.4,Tp-0.6);
  const pockets=(eng?lay.texts:[]).concat(lay.labels,lay.grooves),o=lay.outline;
  const T=pocketTop(o.map(p=>[p[0],p[1],Tp]),pockets,pd,null,null,0,{zs:()=>Tp,flat:true});
  for(let i=0;i<o.length;i++){const p=o[i],q=o[(i+1)%o.length];                                              // sides
    T.push([[p[0],p[1],0],[q[0],q[1],0],[q[0],q[1],Tp],0],[[p[0],p[1],0],[q[0],q[1],Tp],[p[0],p[1],Tp],0]);}
  const {poly,tris}=LEG.triangulate({outer:o,holes:[]});                                                     // bottom
  for(const [a,b,c] of tris)T.push([[poly[a][0],poly[a][1],0],[poly[c][0],poly[c][1],0],[poly[b][0],poly[b][1],0],0]);
  orient(T);
  const legend=eng?LEG.extrude(lay.texts,()=>Tp-LCFG.depth,()=>Tp,3):LEG.extrude(lay.texts,()=>Tp-LCFG.embed,()=>Tp+LCFG.height,3);
  return{body:T,legend,thick:Tp};
}
const PLA_G_PER_MM3=0.00124;
function sampleGrams(m){return (Math.abs(signedVol(m.body))+(LCFG.style==="engrave"?0:Math.abs(signedVol(m.legend))))*PLA_G_PER_MM3;}
function sampleSummary(lay,m){return fmt(lay.W)+"×"+fmt(lay.H)+"mm・厚さ"+fmt(m.thick)+"mm・約"+sampleGrams(m).toFixed(1)+"g（PLA）";}

async function exportSamples(){
  const st=document.getElementById("sz-st"),btn=document.getElementById("sz-save")||{};
  if(!sampleList().length){st.textContent="大きさを1つ以上入れてください（例：2, 2.5, 3）。";return;}
  btn.disabled=true;
  try{
    const lay=await sampleLayout(async(i,n)=>{st.textContent="見本の文字を作っています… "+(i+1)+" / "+n;await new Promise(r=>setTimeout(r,0));});
    if(!lay){st.textContent="見本の文字を作れませんでした。";return;}
    st.textContent="プレートを作っています…";await new Promise(r=>setTimeout(r,0));
    const m=samplePlateMesh(lay),parts=[{name:"body",tris:m.body,extruder:EXP.bodyExt},{name:"legend",tris:m.legend,extruder:EXP.legendExt}];
    const c=EXP.plate/2,items=[{name:"Legendサイズ見本",x:c,y:c,parts}];
    let extra=null;if(EXP.colors3mf===true){const hi=Math.max(EXP.bodyExt,EXP.legendExt);extra={"filament_colour":Array.from({length:hi},(_,i)=>filColor(i+1))};}
    st.textContent="3MFにまとめています…";await new Promise(r=>setTimeout(r,0));
    const blob=await build3MF(items,extra),fname="lak_legend_sizes.3mf";
    if(window.claude){const z=await makeZipAsync([{name:fname,data:new Uint8Array(await blob.arrayBuffer())}]);await saveFile(z,"lak_legend_sizes_3mf.zip","sz-st");}
    else await saveFile(blob,fname,"sz-st");
    st.textContent+=" "+sampleSummary(lay,m)+"。";
    if(Math.max(lay.W,lay.H)>EXP.plate-10)st.textContent+=" プレートの大きさ（"+EXP.plate+"mm）を超えています。大きさの数を減らしてください。";
  }catch(e){console.error(e);st.textContent="作れませんでした（"+(e&&e.message||e)+"）。";}
  finally{btn.disabled=false;}
}

// ---------- 3D preview of the plate (view "sizes") ----------
let sampleTok=0,sampleTimer=0,sampleLast=null,sampleDims="";
function sizesSpan(){const W=sampleLast?sampleLast.W:40,H=sampleLast?sampleLast.H:40;return Math.max(W,H*1.3)*1.1+8;}
function scheduleSamples(){clearTimeout(sampleTimer);sampleTimer=setTimeout(buildSamplePreview,150);}
function sampleSig(){return JSON.stringify([sampleCfg(),sampleList(),LCFG.font,LCFG.weight,LCFG.style,LCFG.depth,LCFG.height,LCFG.embed]);}
async function buildSamplePreview(){
  const tok=++sampleTok;
  if(!sampleList().length){tris=[];dirty=true;wholeNote("大きさを1つ以上入れてください");return;}
  const sig=sampleSig();let lay,m;
  if(sampleLast&&sampleLast.sig===sig){lay=sampleLast.lay;m=sampleLast.m;}
  else{
    lay=await sampleLayout(async(i,n)=>{if(tok===sampleTok)wholeNote("サイズ見本を作成中… "+(i+1)+" / "+n);await new Promise(r=>setTimeout(r,0));});
    if(tok!==sampleTok)return;if(!lay){tris=[];dirty=true;wholeNote("見本の文字を作れませんでした");return;}
    m=samplePlateMesh(lay);sampleLast={sig,lay,m,W:lay.W,H:lay.H};}
  if(tok!==sampleTok)return;
  // the pockets without an inlay (size labels, grid grooves) are recesses in the body colour: show them as a shade of it
  tris=m.body.map(t=>t[3]===3?[t[0],t[1],t[2],1]:t).concat(recolor(m.legend,extMat(EXP.legendExt)));dirty=true;
  const dims=fmt(lay.W)+"x"+fmt(lay.H);if(dims!==sampleDims){sampleDims=dims;ts=sizesSpan();}
  wholeNote(sampleSummary(lay,m));
  if(typeof scheduleCard==="function")scheduleCard(200);
}
function sampleReset(){sampleTok++;clearTimeout(sampleTimer);}
// show the samples in the 3D view
function showSamples(){const b=document.querySelector('.views button[data-view="sizes"]');if(!b)return;b.hidden=false;
  if(view!=="sizes")b.click();else rebuildPreview();
  const st=document.querySelector(".stage");if(st){const r=st.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)st.scrollIntoView({behavior:"smooth",block:"start"});}}

function buildSampleForm(){
  const box=document.getElementById("km-sizes");if(!box)return;box.innerHTML="";const c=sampleCfg();
  const set=(k,v)=>{LCFG.sample={...sampleCfg(),[k]:v};saveWs();if(view==="sizes")rebuildPreview();};
  const hint=document.createElement("p");hint.className="hint";hint.style.padding="8px 0 6px";
  hint.textContent="キーの形は作らず、薄い1枚の板を格子状に区切り、大きさごとのマスに今のLegendの設定（フォント・"+(LCFG.style==="engrave"?"彫り込み "+fmt(LCFG.depth)+"mm":"浮き彫り "+fmt(LCFG.height)+"mm")+"）で見本の文字を印字します。各マスには大きさを刻むので、印刷後もどの大きさか分かります。フィラメントが最小になるよう、マスは文字に合わせた大きさで詰めて並べます。";
  box.appendChild(hint);
  const g=document.createElement("div");g.className="km-exgrid";
  const txt=(label,key,ph)=>{const l=document.createElement("label");l.textContent=label;const i=document.createElement("input");i.value=c[key];i.placeholder=ph;
    i.onchange=()=>{set(key,i.value.trim()||SDEF[key]);i.value=sampleCfg()[key];count();};l.appendChild(i);g.appendChild(l);return i;};
  txt("見本の文字","text","B8@e");const si=txt("大きさ（mm、カンマ区切り）","sizes","2, 2.5, 3");si.inputMode="decimal";
  box.appendChild(g);
  const seg=document.createElement("div");seg.className="seg";const sh=document.createElement("div");sh.className="seghead";sh.textContent="太さ";seg.appendChild(sh);
  [["今の設定（"+(LCFG.weight>=700?"太字":"標準")+"）",false],["標準と太字の両方",true]].forEach(([t,v])=>{const b=document.createElement("button");b.type="button";b.textContent=t;
    b.setAttribute("aria-pressed",String(c.both===v));b.onclick=()=>{set("both",v);buildSampleForm();};seg.appendChild(b);});
  box.appendChild(seg);
  const lb=document.createElement("label");lb.className="km-lname";lb.style.padding="8px 0 2px";const cb=document.createElement("input");cb.type="checkbox";cb.checked=c.label;
  cb.onchange=()=>{set("label",cb.checked);count();};lb.appendChild(cb);lb.appendChild(document.createTextNode(" 大きさを刻印する（各マスの見本の下）"));box.appendChild(lb);
  const row=document.createElement("div");row.className="km-btns";
  const pv=document.createElement("button");pv.type="button";pv.id="sz-view";pv.textContent="3Dでプレビュー";pv.onclick=showSamples;row.appendChild(pv);box.appendChild(row);
  const count=()=>{const n=sampleList().length;pv.disabled=!n;if(typeof refreshOut==="function")refreshOut();};count();
}
