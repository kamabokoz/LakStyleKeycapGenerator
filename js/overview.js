// overview.js — 全体プレビュー: every key of the layout with its legends, marks and 天面アート
// LAK風キーキャップジェネレータ / MIT License

const wholeCache=new Map(); // pos -> {sig, tris} (already placed on the layout)
let wholeTok=0,wholeTimer=0;
const WHOLE_Q=[6,24];      // coarser meshes than a single key: the whole board has many triangles
// everything that changes how one key looks
function keySig(pos){
  return JSON.stringify([P,LCFG,slotsOf(pos).map(s=>[slotShown(s,pos),s.svg?svgKey(s.svg):"",s.at,s.dx,s.dy]),keyMarks(pos),!!paramsFor(pos).homing,
    artActive()?ARTV:0,EXP.format,EXP.legendMode,EXP.layerExt,EXP.bodyExt,EXP.legendExt]);
}
// the same colouring as the single-key preview
function previewTris(pt){
  const lm=legendMatFn();let T=pt.body;
  if(lm)pt.legendBy.forEach(g=>{T=T.concat(recolor(g.tris,lm(g.layer)));});
  else if(LCFG.style!=="engrave")T=T.concat(pt.legend);
  (pt.art||[]).forEach(x=>{T=T.concat(recolor(x.tris,extMat(x.ext)));});
  return T;
}
// key-local mesh -> layout (world x right, y away from the typist, centred on the layout)
function placeTris(T,pos,L){
  const f=keyFrame(pos),mv=p=>{const X=f.cx+p[0]*f.c+p[1]*f.s,Y=f.cy+p[0]*f.s-p[1]*f.c;return[X-L.cx,L.cy-Y,p[2]];};
  return T.map(t=>[mv(t[0]),mv(t[1]),mv(t[2]),t[3]]);
}
function wholeNote(t){const n=document.getElementById("stage-note");if(!n)return;n.textContent=t||"";n.hidden=!t;}
function wholeSpan(){const L=layoutBox();return Math.max(L.w,L.h*1.3)*1.06+8;}
function scheduleWhole(){clearTimeout(wholeTimer);wholeTimer=setTimeout(buildWhole,200);}
async function buildWhole(){
  const tok=++wholeTok;if(!KM.keys.length)return;
  const L=layoutBox(),n=KM.keys.length,parts=new Array(n);let built=0,t0=performance.now();
  for(let i=0;i<n;i++){
    if(tok!==wholeTok)return;
    const sig=keySig(i)+L.cx+","+L.cy;let e=wholeCache.get(i);
    if(!e||e.sig!==sig){
      try{const pt=await legendParts(i,0,WHOLE_Q[0],WHOLE_Q[1]);if(tok!==wholeTok)return;e={sig,tris:placeTris(previewTris(pt),i,L)};wholeCache.set(i,e);built++;}
      catch(err){console.error(err);continue;}
    }
    parts[i]=e.tris;
    // show progress every few keys (and keep the page responsive)
    if(performance.now()-t0>700||i===n-1){t0=performance.now();tris=[].concat(...parts.filter(Boolean));dirty=true;
      wholeNote(i<n-1?"全体を作成中… "+(i+1)+" / "+n:"");await new Promise(r=>setTimeout(r,0));}
  }
  if(tok===wholeTok){wholeNote("");if(typeof scheduleCard==="function")scheduleCard(200);} // the post image follows the finished board
}
function wholeReset(){wholeCache.clear();wholeTok++;wholeNote("");}
