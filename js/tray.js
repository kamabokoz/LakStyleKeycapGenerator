// tray.js — 保管トレー: a box that keeps the printed keycaps in their keyboard layout, with a see-through,
// snap-locked lid
// LAK風キーキャップジェネレータ / MIT License
//
// Tray (printed upright): a rounded box; on its floor an MX cross post at every key of the layout (rotated keys
//   too), so each keycap presses on like on a switch and stays in place.
// Lid (printed upside down): a plate with a window over every key (or a clear insert / a plain plate for clear
//   filament) and a skirt that slides over the tray wall. Snap fingers cut free in the skirt carry a hook that
//   clicks under a bump on the tray wall; a small tab on each finger pulls it open.
// World coordinates: x right, y away from the typist (up), centred on the layout — the same as the whole-board view.
// Arrangement: the keyboard layout (keymap needed), or a plain grid of slots (rows × columns, no keymap needed).
// Every part is a set of closed shells; shells of one part may overlap (slicers merge them).

const TDEF={style:"window",fit:"grid",mech:"onetouch",lock:"std",split:false,show:"open",keys:true}; // fit "none": no posts; show/keys: preview only
const TRAY={floor:1.2,wall:2.0,skirt:1.2,gap:0.3,plate:1.6,margin:1.0,clear:0.6,skirtBottom:0.6,slit:1.0,finger:10};
const TRAY_FIT={loose:0.2,std:0.12,tight:0.06},TRAY_LOCK={weak:0.3,std:0.45,strong:0.6};
function trayCfg(){return{...TDEF,...(EXP.tray&&typeof EXP.tray==="object"?EXP.tray:{})};}
function setTray(k,v){EXP.tray={...trayCfg(),[k]:v};saveWs();trayDirty();}
function trayDirty(){trayLast=null;if(typeof view!=="undefined"&&view==="tray")rebuildPreview();if(typeof refreshOut==="function")refreshOut();}

// --- arrangement: "layout" = the keyboard's own layout / "grid" = rows and columns of slots (works without a keymap) ---
const TGRID={cols:6,rows:4};
function trayArr(){return trayCfg().arr==="grid"||!KM.keys.length?"grid":"layout";}
function trayReady(){return trayArr()==="grid"||KM.keys.length>0;}
function trayGridMin(){const b=derive(P).base;return Math.ceil(Math.max(b+1,trayDivOn()?trayDivNeed():0)*10-1e-6)/10;}
function trayGridCfg(){const c=trayCfg(),n=(v,d)=>{v=Math.round(+v);return isFinite(v)&&v>0?Math.min(20,Math.max(1,v)):d;},p=+c.gpitch,min=trayGridMin();
  return{cols:n(c.gcols,TGRID.cols),rows:n(c.grows,TGRID.rows),pitch:isFinite(p)&&p>0?Math.min(min+12,Math.max(min,p)):Math.max(min,P.pitch)};}
// slot centres (world), front row last; centred on the origin
function trayGridSlots(){const {cols,rows,pitch}=trayGridCfg(),o=[];for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)o.push([Math.round((i-(cols-1)/2)*pitch*1000)/1000,Math.round(((rows-1)/2-j)*pitch*1000)/1000,"g"+i+","+j]);return o;}
// keys whose lid window is closed: ids "k<key>" (keymap key), "s<i>,<j>" (spare cell), "g<col>,<row>" (grid slot)
function trayWinOff(){const v=trayCfg().winOff;return new Set(Array.isArray(v)?v.filter(x=>typeof x==="string"):[]);}
// the most columns whose tray (and lid) still fits the build plate
function trayGridMaxCols(pitch){const room=(EXP.plate||256)-6-2*(TRAY.wall+TRAY.margin+TRAY.gap+TRAY.skirt)-derive(P).base;return Math.max(1,Math.min(20,Math.floor(room/pitch)+1));}
// a grid for n keycaps: a little wider than tall, within the plate
function trayGridFor(n){const {pitch}=trayGridCfg(),mc=trayGridMaxCols(pitch);n=Math.max(1,n|0);let cols=Math.min(mc,Math.max(1,Math.ceil(Math.sqrt(n*1.5))));const rows=Math.min(20,Math.ceil(n/cols));cols=Math.min(cols,Math.ceil(n/rows));return{cols,rows};}
// switching the arrangement moves the trays: names go back to their default places
function setTrayArr(v){const ls=trayLabelsAll().map(l=>({...l,x:null,y:null}));EXP.tray={...trayCfg(),arr:v,labelsOn:trayLabelsOn(),labelPad:trayLabelPad(),labels:ls,label:undefined};
  if(v==="grid"&&trayCfg().gcols===undefined&&KM.keys.length){const g=trayGridFor(KM.keys.length);EXP.tray.gcols=g.cols;EXP.tray.grows=g.rows;}
  saveWs();trayDirty();}

// --- dividers' clearance: the gap between a keycap and its rib; keys move apart when the ribs need more room ---
const TRAY_RIB=0.8,TRAY_CLR=[["きつめ",0.2],["標準",0.35],["ゆるめ",0.5],["かなりゆるめ",0.7]];
function trayDivOn(){return trayCfg().fit==="grid";}
function trayGridClr(){const v=+trayCfg().gridClr;return isFinite(v)&&v>0?Math.min(1.5,Math.max(0.1,Math.round(v*100)/100)):0.35;}
// centre distance of two keys with one rib between them (clearance on both sides)
function trayDivNeed(){return derive(P).base+2*trayGridClr()+TRAY_RIB;}
// where each key sits on the tray (world offset from its place in the layout): with dividers the layout is spread evenly
// (s) so neighbours get room for the rib, then keys that still crowd each other (rotated keys) are pushed apart one by one
let trayPosCache={sig:""};
function trayPos(){
  const div=trayDivOn(),b=derive(P).base,clr=trayGridClr(),fr=KM.keys.map((_,i)=>keyFrame(i));
  const sig=[div,P.pitch,b,clr,fr.map(f=>f.cx.toFixed(3)+","+f.cy.toFixed(3)+","+f.t.toFixed(4)).join(";")].join("|");
  if(trayPosCache.sig===sig)return trayPosCache;
  const L=layoutBox(),n=fr.length,p0=fr.map(f=>[f.cx-L.cx,L.cy-f.cy]);let s=1,p=p0.map(q=>q.slice()),pushed=0;
  if(div&&n){
    s=Math.max(1,trayDivNeed()/P.pitch);p=p0.map(q=>[q[0]*s,q[1]*s]);
    // keys turned the same way share one rib (room: clearance + half a rib each); keys at different angles each need a whole rib
    const h1=b/2+clr+TRAY_RIB/2-0.005,h2=b/2+clr+TRAY_RIB,ax=fr.map(f=>[[f.c,-f.s],[f.s,f.c]]),q0=p.map(q=>q.slice());
    // separating axis test of two squares (half size h): the smallest push that separates them, or null
    const sat=(i,j)=>{const dx=p[j][0]-p[i][0],dy=p[j][1]-p[i][1],h=Math.abs(fr[i].t-fr[j].t)<1e-3?h1:h2;let best=null;
      for(const n2 of [...ax[i],...ax[j]]){const ra=h*(Math.abs(ax[i][0][0]*n2[0]+ax[i][0][1]*n2[1])+Math.abs(ax[i][1][0]*n2[0]+ax[i][1][1]*n2[1]));
        const rb=h*(Math.abs(ax[j][0][0]*n2[0]+ax[j][0][1]*n2[1])+Math.abs(ax[j][1][0]*n2[0]+ax[j][1][1]*n2[1])),dd=dx*n2[0]+dy*n2[1],o=ra+rb-Math.abs(dd);
        if(o<=1e-3)return null;if(!best||o<best.o)best={o,n:dd<0?[-n2[0],-n2[1]]:n2};}
      return best;};
    for(let it=0;it<400;it++){let any=false;
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){if(Math.abs(p[j][0]-p[i][0])>3*h2||Math.abs(p[j][1]-p[i][1])>3*h2)continue;const r=sat(i,j);if(!r)continue;
        const m=(r.o+0.002)/2;p[i][0]-=r.n[0]*m;p[i][1]-=r.n[1]*m;p[j][0]+=r.n[0]*m;p[j][1]+=r.n[1]*m;any=true;}
      if(!any)break;}
    pushed=p.filter((q,i)=>Math.hypot(q[0]-q0[i][0],q[1]-q0[i][1])>0.01).length;}
  trayPosCache={sig,s,pushed,d:p.map((q,i)=>[q[0]-p0[i][0],q[1]-p0[i][1]])};
  return trayPosCache;
}
// key-local (x, y up) -> world (on the tray)
function trayMv(i,L){const f=keyFrame(i),D=trayPos().d[i]||[0,0];return p=>{const X=f.cx+p[0]*f.c+p[1]*f.s,Y=f.cy+p[0]*f.s-p[1]*f.c;return[X-L.cx+D[0],L.cy-Y+D[1]];};}
// the highest point of a keycap above its bottom (with the homing bump and raised legends)
function trayKeyHeight(){
  const D=derive(P);let h=P.edge_h+D.E+Math.max(0,D.dome);
  if(P.homing&&Object.keys(KEYHOME).length)h+=homingSpec(P).up; // a recess adds nothing, a pin stands out like a bump
  if(LCFG.style!=="engrave")h+=LCFG.height;
  return h;
}
// keys per tray: all together, or the left and right halves split at the widest empty gap between key columns
function trayClusters(split){
  const ids=KM.keys.map((_,i)=>i);if(!split||ids.length<2)return[ids];
  const L=layoutBox(),b=derive(P).base,ext=ids.map(i=>{const mv=trayMv(i,L),xs=[[-b/2,-b/2],[b/2,-b/2],[b/2,b/2],[-b/2,b/2]].map(q=>mv(q)[0]);return{i,x0:Math.min(...xs),x1:Math.max(...xs)};}).sort((a,c)=>a.x0-c.x0);
  let best=0,at=-1,reach=-Infinity;
  for(let k=0;k<ext.length-1;k++){reach=Math.max(reach,ext[k].x1);const gap=ext[k+1].x0-reach;if(gap>best){best=gap;at=k;}}
  if(at<0||best<Math.max(4,P.gap*3))return[ids]; // a real gap between the halves, not the gap between neighbouring keys
  return[ext.slice(0,at+1).map(e=>e.i),ext.slice(at+1).map(e=>e.i)];
}
// rounded rectangle (CCW), centred on (cx, cy)
function rrectPts(w,h,r,cx,cy,n){
  r=Math.max(0,Math.min(r,w/2-1e-3,h/2-1e-3));n=n||8;const o=[],hw=w/2-r,hh=h/2-r,C=[[hw,-hh,-90],[hw,hh,0],[-hw,hh,90],[-hw,-hh,180]];
  for(const [x,y,a0] of C)for(let i=0;i<=n;i++){const a=(a0+i*90/n)*Math.PI/180;o.push([cx+x+r*Math.cos(a),cy+y+r*Math.sin(a)]);}
  return o;
}
// a point on a rounded rectangle's outline by arc length s (CCW from the left end of the bottom edge): {p, n (outward), t}
function rrectPath(w,h,r,cx,cy){
  const ex=w-2*r,ey=h-2*r,A=Math.PI*r/2,segs=[];let s=0;
  const line=(x,y,dx,dy,nx,ny,len)=>{segs.push({s,len,at:u=>({p:[x+dx*u,y+dy*u],n:[nx,ny],t:[dx,dy]})});s+=len;};
  const arc=(ox,oy,a0)=>{segs.push({s,len:A,arc:true,at:u=>{const a=a0+u/Math.max(r,1e-9);return{p:[ox+r*Math.cos(a),oy+r*Math.sin(a)],n:[Math.cos(a),Math.sin(a)],t:[-Math.sin(a),Math.cos(a)]};}});s+=A;};
  line(cx-ex/2,cy-h/2,1,0,0,-1,ex);arc(cx+ex/2,cy-ey/2,-Math.PI/2);
  line(cx+w/2,cy-ey/2,0,1,1,0,ey);arc(cx+ex/2,cy+ey/2,0);
  line(cx+ex/2,cy+h/2,-1,0,0,1,ex);arc(cx-ex/2,cy+ey/2,Math.PI/2);
  line(cx-w/2,cy+ey/2,0,-1,-1,0,ey);arc(cx-ex/2,cy-ey/2,Math.PI);
  const per=s,at=u=>{u=((u%per)+per)%per;for(const g of segs)if(u<=g.s+g.len+1e-9)return g.at(Math.max(0,u-g.s));return segs[0].at(0);};
  // sample points of [u0, u1] (u1 > u0, may pass the end): both ends and every arc point in between
  const sample=(u0,u1)=>{const us=[u0];for(let k=-1;k<=1;k++)for(const g of segs){if(!g.arc)continue;const m=Math.max(2,Math.ceil(g.len/0.8));
      for(let i=0;i<=m;i++){const u=g.s+g.len*i/m+k*per;if(u>u0+1e-6&&u<u1-1e-6)us.push(u);}}
    us.sort((a,b)=>a-b);us.push(u1);return us;};
  return{per,at,sample,edges:{bottom:[0,ex],right:[ex+A,ey],top:[ex+A+ey+A,ex],left:[2*ex+2*A+ey+A,ey]}};
}
// closed prism: a convex profile [(d, z)] (d along the outward normal n) swept along t over [-half, half]
function trayPrism(base,n,t,prof,half){
  const at=(d,z,u)=>[base[0]+n[0]*d+t[0]*u,base[1]+n[1]*d+t[1]*u,z];
  const A=prof.map(([d,z])=>at(d,z,-half)),B=prof.map(([d,z])=>at(d,z,half)),T=[],k=prof.length;
  for(let i=1;i<k-1;i++){T.push([A[0],A[i+1],A[i],0]);T.push([B[0],B[i],B[i+1],0]);}
  for(let i=0;i<k;i++){const j=(i+1)%k;T.push([A[i],A[j],B[j],0]);T.push([A[i],B[j],B[i],0]);}
  return orient(T);
}
const trayShell=T=>orient(T);
function trayExtrude(shapes,z0,z1){const T=[];for(const s of shapes)T.push(...orient(LEG.extrude([s],()=>z0,()=>z1,0)));return T;}
// A flat-bottomed solid from nested outlines: node {loop, z (top of the region inside the loop, null = cut through),
// kids:[nodes inside]}. The root's loop is the outline, z0 its bottom. Faces, walls and the bottom are built so the
// result is one closed shell (pockets, islands in them and through-holes of any nesting).
function terraceMesh(root,z0){
  const T=[],ccw=l=>LEG.area(l)>0?l:l.slice().reverse(),cw=l=>ccw(l).slice().reverse();
  const face=(outer,holes,z,up)=>{const {poly,tris}=LEG.triangulate({outer:ccw(outer),holes:holes.map(cw)});
    for(const [a,b,c] of tris){const A=[poly[a][0],poly[a][1],z],B=[poly[b][0],poly[b][1],z],C=[poly[c][0],poly[c][1],z];
      const cr=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);if(Math.abs(cr)<1e-12)continue;T.push((cr>0)===up?[A,B,C,0]:[A,C,B,0]);}};
  // wall along a loop between zlo and zhi; outward: the normal points out of the loop (solid inside)
  const wall=(loop,zlo,zhi,outward)=>{const l=ccw(loop),n=l.length;
    for(let i=0;i<n;i++){const p=l[i],q=l[(i+1)%n],pb=[p[0],p[1],zlo],qb=[q[0],q[1],zlo],qt=[q[0],q[1],zhi],pt=[p[0],p[1],zhi];
      if(outward)T.push([pb,qb,qt,0],[pb,qt,pt,0]);else T.push([pb,qt,qb,0],[pb,pt,qt,0]);}};
  const walk=node=>{
    if(node.z!==null)face(node.loop,node.kids.map(k=>k.loop),node.z,true);
    for(const k of node.kids){
      if(k.z===null)wall(k.loop,z0,node.z,false);
      else if(k.z<node.z)wall(k.loop,k.z,node.z,false);
      else if(k.z>node.z)wall(k.loop,node.z,k.z,true);
      walk(k);}};
  wall(root.loop,z0,root.z,true);walk(root);
  face(root.loop,root.kids.filter(k=>k.z===null).map(k=>k.loop),z0,false);
  return T;
}
// --- names (engraved or 2-colour inlays) on the lid top or the tray floor; several, e.g. one per tray ---
const TLDEF={text:"",where:"lid",style:"engrave",size:5,x:null,y:null,rot:0,deco:"none",decoW:"std"},TL_DEPTH=0.6;
const TL_DECOS=[["none","なし"],["rect","四角枠"],["round","角丸枠"],["capsule","カプセル枠"],["double","二重枠"],["underline","下線"],["brackets","角かっこ"],["sides","両側に飾り"],["plate","白抜き"]];
// decoration around a name (local mm, centred text): frames, lines and ornaments become part of its shapes
function trayDeco(sh,l){
  const d=l.deco||"none";if(d==="none"||!sh.length)return sh;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const q of sh)for(const p of q.outer){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}
  const s=l.size,t=Math.max(0.6,s*0.12)*({thin:0.75,std:1,bold:1.5}[l.decoW]||1),pad=Math.max(0.8,s*0.35),cx=(x0+x1)/2,cy=(y0+y1)/2,iw=x1-x0+2*pad,ih=y1-y0+2*pad;
  const ccw=p=>LEG.area(p)>0?p:p.slice().reverse(),cwp=p=>ccw(p).slice().reverse();
  const rr=(w,h,r)=>rrectPts(w,h,Math.max(0.01,r),cx,cy,8);
  const ring=(w,h,r,th)=>({outer:rr(w+2*th,h+2*th,r+th),holes:[cwp(rr(w,h,r))]});
  const box=(ax,ay,bx,by)=>({outer:ccw([[ax,ay],[bx,ay],[bx,by],[ax,by]]),holes:[]});
  const out=[];
  if(d==="rect")out.push(ring(iw,ih,0.01,t));
  else if(d==="round")out.push(ring(iw,ih,Math.min(ih/2,s*0.45),t));
  else if(d==="capsule")out.push(ring(iw+ih*0.4,ih,ih/2,t));
  else if(d==="double"){const t1=Math.max(0.6,t*0.75),gap=Math.max(0.6,t*0.9);out.push(ring(iw,ih,Math.min(ih/2,s*0.35),t1));
    out.push(ring(iw+2*(t1+gap),ih+2*(t1+gap),Math.min(ih/2,s*0.35)+t1+gap,t1));}
  else if(d==="underline"){const y=y0-pad*0.6;out.push(box(cx-iw/2,y-t,cx+iw/2,y));}
  else if(d==="brackets"){const a=Math.min(iw,ih)*0.38+t;
    for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const ox=cx+sx*(iw/2+t),oy=cy+sy*(ih/2+t),mp=([u,v])=>[ox-sx*u,oy-sy*v];
      out.push({outer:ccw([[0,0],[a,0],[a,t],[t,t],[t,a],[0,a]].map(mp)),holes:[]});}}
  else if(d==="sides"){const dz=Math.max(1.6,s*0.45),len=Math.max(3,s*1.3),gap=0.4;
    for(const sx of [-1,1]){const xd=sx<0?x0-pad*0.6-dz/2:x1+pad*0.6+dz/2;
      out.push({outer:ccw([[xd,cy-dz/2],[xd+dz/2,cy],[xd,cy+dz/2],[xd-dz/2,cy]]),holes:[]});
      const xa=xd+sx*(dz/2+gap),xb=xa+sx*len;out.push(box(Math.min(xa,xb),cy-t/2,Math.max(xa,xb),cy+t/2));}}
  else if(d==="plate"){ // a filled plate with the name knocked out (the letters' counters stay filled)
    const pl={outer:rr(iw+t,ih+t,Math.min((ih+t)/2,s*0.35)),holes:sh.map(q=>cwp(q.outer))};
    return[pl,...[].concat(...sh.map(q=>q.holes.map(h=>({outer:ccw(h),holes:[]}))))];}
  return sh.concat(out);
}
function trayLabelNorm(l){const o={...TLDEF,...(l&&typeof l==="object"?l:{})};o.text=String(o.text||"").slice(0,40);o.size=Math.min(30,Math.max(2,+o.size||5));
  o.rot=((+o.rot||0)%360+360)%360;o.where=o.where==="floor"?"floor":"lid";o.style=o.style==="inlay"?"inlay":"engrave";
  o.deco=TL_DECOS.some(([k])=>k===o.deco)?o.deco:"none";o.decoW=["thin","std","bold"].includes(o.decoW)?o.decoW:"std";
  o.x=o.x===null||o.x===undefined||!isFinite(+o.x)?null:+o.x;o.y=o.y===null||o.y===undefined||!isFinite(+o.y)?null:+o.y;return o;}
// every name in the list (older data kept one name in "label")
function trayLabelsAll(){const c=trayCfg();const ls=Array.isArray(c.labels)?c.labels:c.label&&typeof c.label==="object"?[c.label]:[];return ls.map(trayLabelNorm);}
function trayLabelsOn(){const c=trayCfg();return c.labelsOn!==undefined?!!c.labelsOn:!!(c.label&&c.label.on);}
function trayLabelPad(){const c=trayCfg();return c.labelPad!==undefined?!!c.labelPad:!(c.label&&c.label.pad===false);}
function setTrayLabels(ls){EXP.tray={...trayCfg(),labelsOn:trayLabelsOn(),labelPad:trayLabelPad(),labels:ls.map(trayLabelNorm),label:undefined};saveWs();trayDirty();}
function setTrayLabelAt(i,k,v){const ls=trayLabelsAll();if(!ls[i])return;ls[i]={...ls[i],[k]:v};setTrayLabels(ls);}
// the names that go on the trays: [{idx (in the list), l}]
function trayLabelsActive(){return trayLabelsOn()?trayLabelsAll().map((l,idx)=>({idx,l})).filter(o=>o.l.text.trim()):[];}
function trayLabelOn(){return trayLabelsActive().length>0;}
function trayStrip(){const a=trayLabelsActive();return a.length&&trayLabelPad()?Math.round(Math.max(...a.map(o=>o.l.deco==="none"?o.l.size*1.5+3:o.l.deco==="double"?o.l.size*2.6+5:o.l.size*2.1+4))*10)/10:0;}
const trayTextCache=new Map();
async function trayPrepare(){
  const act=trayLabelsActive();if(act.length)await ensureFont(LCFG.font);
  for(const {l} of act){const key=[l.text.trim(),LCFG.font,l.size].join("|");if(trayTextCache.has(key))continue;
    if(trayTextCache.size>40)trayTextCache.clear();
    trayTextCache.set(key,await LEG.textShapes(l.text.trim(),{font:LCFG.font,weight:700,size:l.size,maxW:1000,cx:0,cy:0}));}
  if(typeof trayArtPrepare==="function")await trayArtPrepare();
  await traySpecPrepare();
}
// the names in world coordinates; by default the n-th name sits in the middle of the front strip of the n-th tray
function trayLabelsPlaced(frames){
  if(!frames.length)return[];
  const act=trayLabelsActive(),nf=frames.length;
  return act.map(({idx,l},k)=>{const sh=trayTextCache.get([l.text.trim(),LCFG.font,l.size].join("|"));if(!sh||!sh.length)return null;
    // names sharing a tray are spread across its front strip
    const j=k%nf,cnt=Math.ceil((act.length-j)/nf),m=Math.floor(k/nf),f=frames[j],x=l.x??(f.cx+(m-(cnt-1)/2)*f.cw/cnt),y=l.y??(f.cy-f.ch/2+(trayStrip()||l.size*1.5)/2),t=l.rot*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
    const mv=p=>[x+p[0]*c-p[1]*s,y+p[0]*s+p[1]*c];
    return{idx,l,x,y,shapes:trayDeco(sh,l).map(q=>({outer:q.outer.map(mv),holes:q.holes.map(h=>h.map(mv))}))};}).filter(Boolean);
}
// can this name go on this tray? "" = yes, otherwise why not
function trayLabelCheck(f,lab,others){
  const where=lab.l.where,pts=[].concat(...lab.shapes.map(s=>s.outer)),inR=(cx,cy,w,h,ins)=>pts.every(p=>Math.abs(p[0]-cx)<=w/2-ins&&Math.abs(p[1]-cy)<=h/2-ins);
  const hits=polys=>polys.some(w=>shapesOverlap(lab.shapes,[{outer:w,holes:[]}])||lab.shapes.some(s=>pipL(s.outer[0],w))||pipL(w[0],s0(lab)));
  if(where==="floor"){if(!inR(f.cx,f.cy,f.cw,f.ch,1.0))return"トレーの底からはみ出しています";if(hits(f.keys))return"キーキャップの下に重なっています";}
  else{if(!inR(f.cx,f.lidCy,f.lidW,f.lidH,1.2))return"蓋からはみ出しています";if(hits(f.wins))return"蓋の窓に重なっています";}
  for(const o of others||[])if(o!==lab&&o.l.where===where&&(shapesOverlap(lab.shapes,o.shapes)))return"ほかの名前と重なっています";
  return"";
}
function s0(lab){return lab.shapes[0]?lab.shapes[0].outer:[[0,0]];}
// the tray holding a name: the one whose outline contains its centre
function trayLabelOwner(frames,lab){if(!lab)return -1;return frames.findIndex(f=>Math.abs(lab.x-f.cx)<=f.ow/2&&Math.abs(lab.y-f.cy)<=f.oh/2);}
// nested pockets: every loop of the shapes finds its parent (the smallest loop around it); outers are cut to zIn, holes stay at zOut
function trayNest(shapes,zIn,zOut){
  const loops=[];for(const s of shapes){loops.push({loop:s.outer,z:zIn,a:Math.abs(LEG.area(s.outer)),kids:[]});for(const h of s.holes)loops.push({loop:h,z:zOut,a:Math.abs(LEG.area(h)),kids:[]});}
  loops.sort((a,b)=>b.a-a.a);const top=[];
  loops.forEach((n,i)=>{let par=null;for(let j=i-1;j>=0;j--){if(loops[j].a>n.a&&pipL(n.loop[0],loops[j].loop)){par=loops[j];break;}}
    // the smallest container is the latest bigger one that contains it
    (par?par.kids:top).push(n);});
  return top;
}
// everything of one tray: {tray:[tris], lid:[tris], win:[tris], keysAt, dims}
// the tray body: a rounded box with a cavity (closed shell)
function trayBody(ow,oh,orad,cw,ch,crad,cx,cy,Zw,Tf){
  const outer=rrectPts(ow,oh,orad,cx,cy,8),cav=rrectPts(cw,ch,crad,cx,cy,8);
  const T=pocketTop(outer.map(p=>[p[0],p[1],Zw]),[{outer:cav,holes:[]}],Zw-Tf,null,null,0,{zs:()=>Zw,flat:true});
  for(let i=0;i<outer.length;i++){const p=outer[i],q=outer[(i+1)%outer.length];
    T.push([[p[0],p[1],0],[q[0],q[1],0],[q[0],q[1],Zw],0],[[p[0],p[1],0],[q[0],q[1],Zw],[p[0],p[1],Zw],0]);}
  const {poly,tris}=LEG.triangulate({outer,holes:[]});for(const [a,b,c] of tris)T.push([[poly[a][0],poly[a][1],0],[poly[c][0],poly[c][1],0],[poly[b][0],poly[b][1],0],0]);
  return orient(T);
}
// lock mechanisms: snap = fingers with hooks and pull tabs / onetouch = press on, pull off (ridges in a solid skirt)
//   slide = the lid slides into rails along the tray, a ridge under its end clicks behind the entry wall / none = the lid just sits on
const TRAY_MECH=["snap","onetouch","slide","none"];
// the outline of one tray (light: for the label map too): key footprints, windows, cavity, tray and lid outlines
// --- spare keycaps: extra slots on a grid (one key pitch, lined up with the keyboard's first key and lowest row) ---
function trayGrid(L){L=L||layoutBox();const f=keyFrame(0);let lowY=-Infinity;
  KM.keys.forEach((_,i)=>{const k=keyFrame(i);lowY=Math.max(lowY,k.cy);});
  const s=trayPos().s;return{ox:(f.cx-L.cx)*s,oy:(L.cy-lowY)*s,step:P.pitch*s};}
function traySpares(){const v=trayCfg().spares;return Array.isArray(v)?v.filter(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isInteger)):[];}
function traySpareXY(a,G){return[G.ox+a[0]*G.step,G.oy+a[1]*G.step];}
// key footprints of the whole keymap (world), for the overlap test of spares
// half size of the room a key (or a spare) keeps to itself: with dividers its clearance and half a rib
function trayFootHalf(){const b=derive(P).base;return trayDivOn()?b/2+trayGridClr()+TRAY_RIB/2-0.01:b/2+0.3;}
function trayKeyFoot(L){const b=2*trayFootHalf();return KM.keys.map((_,i)=>{const mv=trayMv(i,L);return[[-b/2,-b/2],[b/2,-b/2],[b/2,b/2],[-b/2,b/2]].map(mv);});}
function traySpareFree(x,y,foot){const h=trayFootHalf(),sq={outer:[[x-h,y-h],[x+h,y-h],[x+h,y+h],[x-h,y+h]],holes:[]};
  return!foot.some(k=>shapesOverlap([sq],[{outer:k,holes:[]}])||pipL([x,y],k)||k.some(p=>Math.abs(p[0]-x)<h&&Math.abs(p[1]-y)<h));}
// --- dividers: a low rib around every key (in the gap between neighbours); a side that would cut into another key is left out ---
function trayGridH(){const v=+trayCfg().gridH;return isFinite(v)&&v>0?Math.min(4,Math.max(0.8,v)):1.5;}
function trayDividers(F){
  // the rib starts the clearance away from the keycap; a rib that would come into another key's clearance is left out
  const b=derive(P).base,clr=trayGridClr(),w=TRAY_RIB,a=b/2+clr,o=a+w,out=[],grow=(b/2+clr-0.02)/(b/2);
  const near=(poly,k)=>{const c=k.reduce((s,p)=>[s[0]+p[0]/4,s[1]+p[1]/4],[0,0]),sh=k.map(p=>[c[0]+(p[0]-c[0])*grow,c[1]+(p[1]-c[1])*grow]);
    return shapesOverlap([{outer:poly,holes:[]}],[{outer:sh,holes:[]}])||poly.some(p=>pipL(p,sh));};
  F.keys.forEach((k,ki)=>{
    // key-local frame from the footprint corners (works for rotated keys and spares)
    const c=k.reduce((s,p)=>[s[0]+p[0]/4,s[1]+p[1]/4],[0,0]),ux=[(k[1][0]-k[0][0])/b,(k[1][1]-k[0][1])/b],uy=[(k[3][0]-k[0][0])/b,(k[3][1]-k[0][1])/b];
    const mv=([x,y])=>[c[0]+ux[0]*x+uy[0]*y,c[1]+ux[1]*x+uy[1]*y];
    const sides=[[[-o,-o],[o,-o],[o,-a],[-o,-a]],[[-o,a],[o,a],[o,o],[-o,o]],[[-o,-a],[-a,-a],[-a,a],[-o,a]],[[a,-a],[o,-a],[o,a],[a,a]]];
    for(const sd of sides){const poly=sd.map(mv);if(F.keys.some((k2,j)=>j!==ki&&near(poly,k2)))continue;out.push({outer:poly,holes:[]});}
  });
  return out;
}
function trayFrame(ids,L,spares,pitch){spares=spares||[];
  const c=trayCfg(),mech=TRAY_MECH.includes(c.mech)?c.mech:"snap",b=derive(P).base,slide=mech==="slide",wall=slide?3.0:TRAY.wall;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;const keys=[],kids=[],wins=[],winIds=[],off=trayWinOff();
  const ws=Math.max(4,P.top_size-3),wr=Math.min(2.5,ws/2-0.5);
  // a window over every key unless it was closed on the window map
  const add=(mv,id)=>{const k=[[-b/2,-b/2],[b/2,-b/2],[b/2,b/2],[-b/2,b/2]].map(mv);keys.push(k);kids.push(id);
    for(const [x,y] of k){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    if(c.style!=="solid"&&!off.has(id)){wins.push(rrectPts(ws,ws,wr,0,0,5).map(mv));winIds.push(id);}};
  for(const i of ids)add(trayMv(i,L),"k"+i);
  for(const [sx,sy,id] of spares)add(p=>[sx+p[0],sy+p[1]],id||"s?");
  y0-=trayStrip(); // room for the name in front of the keys
  const m=TRAY.margin,cx=(x0+x1)/2,cy=(y0+y1)/2,cw=x1-x0+2*m,ch=y1-y0+2*m,ow=cw+2*wall,oh=ch+2*wall,g=TRAY.gap,sk=TRAY.skirt;
  const lidW=slide?ow-3.6:ow+2*g+2*sk,lidH=slide?oh-3.6:oh+2*g+2*sk;
  return{ids,spares,keys,kids,wins,winIds,cx,cy,cw,ch,ow,oh,wall,slide,mech,lidW,lidH,lidCy:cy,pitch:pitch||P.pitch};
}
function trayBuild(ids,L,labs,spares,pitch,spec){
  const c=trayCfg(),mech=TRAY_MECH.includes(c.mech)?c.mech:"snap",D=derive(P),keyH=trayKeyHeight(),fitC=TRAY_FIT[c.fit]??TRAY_FIT.std,eng=TRAY_LOCK[c.lock]??TRAY_LOCK.std;
  const F=trayFrame(ids,L,spares,pitch),{cx,cy,cw,ch,ow,oh,slide,wall}=F,orad=slide?1.5:4,g=TRAY.gap,sk=TRAY.skirt;
  // names on this tray (each checked on its own) and the SVG art; both are cut as pockets, inlays become parts
  labs=labs||[];const labErrs=labs.map(l=>({idx:l.idx,err:trayLabelCheck(F,l,labs)})),okLabs=labs.filter((l,k)=>!labErrs[k].err);
  const dep=w=>Math.max(0.2,Math.min(TL_DEPTH,w==="floor"?TRAY.floor-0.4:TRAY.plate-0.6));
  const extras=[];      // [{kind:"name"|"art", where, tris, ext}]
  // the spec plate (parameters and section of the keycap) on the lid top or the tray's underside
  const specErr=spec?traySpecCheck(F,spec,okLabs):"",okSpec=spec&&!specErr?spec:null;
  if(okSpec&&okSpec.style==="inlay")extras.push({kind:"spec",where:okSpec.where,ext:traySpecExt(),tris:okSpec.where==="bottom"?trayExtrude(okSpec.shapes,0,TRAY_SPEC_BOTTOM):[]});
  const pockets=(where,z)=>{const d=dep(where),nodes=[];
    for(const l of okLabs)if(l.l.where===where){nodes.push(...trayNest(l.shapes,z-d,z));if(l.l.style==="inlay")extras.push({kind:"name",where,ext:trayLabelExt(),tris:trayExtrude(l.shapes,z-d,z)});}
    if(okSpec&&okSpec.where===where){nodes.push(...trayNest(okSpec.shapes,z-d,z));if(okSpec.style==="inlay")extras.find(e=>e.kind==="spec").tris=trayExtrude(okSpec.shapes,z-d,z);}
    const art=typeof trayArtShapes==="function"?trayArtShapes(F,where,okLabs.filter(l=>l.l.where===where).concat(okSpec&&okSpec.where===where?[okSpec]:[]),L):null;
    if(art){nodes.push(...trayNest(art.union,z-d,z));for(const a of art.layers)extras.push({kind:"art",where,ext:a.layer.ext,name:a.layer.name,tris:trayExtrude(a.shapes,z-d,z)});}
    return nodes;};
  const Tf=TRAY.floor,ceil=Tf+keyH+TRAY.clear,Tp=TRAY.plate,zsb=TRAY.skirtBottom;
  const Zw=slide?ceil:Tf+Math.min(keyH,4.5);
  // --- tray: box with a cavity (the name may be cut into its floor), posts on the floor ---
  // on the underside the spec is cut from below: the box starts at the pockets' roof and stands on a pad with the
  // pockets (built upside down, then turned over); the two shells overlap a little
  const under=okSpec&&okSpec.where==="bottom",zb=under?TRAY_SPEC_BOTTOM:0;
  const tray=orient(terraceMesh({loop:rrectPts(ow,oh,orad,cx,cy,8),z:Zw,kids:[{loop:rrectPts(cw,ch,slide?1:orad-TRAY.wall*0.6,cx,cy,8),z:Tf,
    kids:pockets("floor",Tf)}]},zb));
  if(under){const H=zb+0.1,pad=terraceMesh({loop:rrectPts(ow,oh,orad,cx,cy,8),z:H,kids:trayNest(okSpec.shapes,H-zb,H)},0);
    tray.push(...orient(pad.map(t=>[[t[0][0],t[0][1],H-t[0][2]],[t[1][0],t[1][1],H-t[1][2]],[t[2][0],t[2][1],H-t[2][2]],t[3]])));}
  const postH=Math.min(P.cross_depth-0.3,2.6),ca=P.cross_len/2-fitC,cb=P.cross_w/2-fitC;
  const cross=[[ca,cb],[cb,cb],[cb,ca],[-cb,ca],[-cb,cb],[-ca,cb],[-ca,-cb],[-cb,-cb],[-cb,-ca],[cb,-ca],[cb,-cb],[ca,-cb]];
  const posts=[];for(const i of ids){const mv=trayMv(i,L);posts.push({outer:cross.map(mv),holes:[]});}
  for(const [sx,sy] of F.spares)posts.push({outer:cross.map(p=>[sx+p[0],sy+p[1]]),holes:[]});
  if(c.fit==="grid")tray.push(...trayExtrude(trayDividers(F),Tf-0.3,Tf+trayGridH()));
  else if(c.fit!=="none")tray.push(...trayExtrude(posts,Tf-0.3,Tf+postH));
  // windows over the keys
  const win=[],dropped=[];
  F.wins.forEach((w,k)=>{const s={outer:w,holes:[]};if(win.some(x=>shapesOverlap([x],[s])))dropped.push(F.winIds[k]);else win.push(s);});
  const lidKids=z=>win.map(w=>({loop:w.outer,z:null,kids:[]})).concat(pockets("lid",z));
  const winParts=c.style==="clearwin"?trayExtrude(win,ceil,ceil+Tp):[];
  const lid=[];let top=ceil+Tp,latches=0,closedH,lw,lh;
  if(slide){
    // rails on the front, back and left edges: a post above the wall and a lip leaning in at 45° (printable)
    const post=1.55,lipIn=1.6,lipZ=ceil+Tp+0.05,zt=lipZ+lipIn+0.6;
    const rail=(base,n,t,half)=>{tray.push(...trayPrism(base,n,t,[[0,Zw-0.3],[-post,Zw-0.3],[-post,zt],[0,zt]],half));
      tray.push(...trayPrism(base,n,t,[[-post+0.1,lipZ],[-post-lipIn,lipZ+lipIn],[-post-lipIn,zt],[-post+0.1,zt]],half));};
    rail([cx,cy-oh/2],[0,-1],[1,0],ow/2);rail([cx,cy+oh/2],[0,1],[1,0],ow/2);rail([cx-ow/2,cy],[-1,0],[0,1],oh/2);
    // the lid: a plate between the rails, a grip past the open (right) end, a ridge under that end
    const ins=1.8,lx0=cx-ow/2+ins,lx1=cx+ow/2+4,ly0=cy-oh/2+ins,ly1=cy+oh/2-ins;
    const plate=[[lx0,ly0],[lx1,ly0],[lx1,ly1],[lx0,ly1]];
    lid.push(...orient(terraceMesh({loop:plate,z:top,kids:lidKids(top)},ceil)));
    const dh=Math.max(0.2,Math.min(eng,TRAY.clear-0.1)),xr=cx+ow/2-wall-0.15; // the catch face meets the inner face of the entry wall
    lid.push(...trayPrism([xr,cy],[1,0],[0,1],[[0,ceil+0.3],[0,ceil-dh],[-0.4,ceil-dh],[-0.4-dh*1.6,ceil+0.3]],(ly1-ly0)*0.3));
    latches=1;closedH=zt;lw=lx1-lx0;lh=ly1-ly0;
  }else{
    const iw=ow+2*g,ih=oh+2*g,irad=orad+g,path=rrectPath(iw,ih,irad,cx,cy);lw=iw+2*sk;lh=ih+2*sk;closedH=top;
    const lidOuter=rrectPts(lw,lh,irad+sk,cx,cy,8);
    lid.push(...orient(terraceMesh({loop:lidOuter,z:top,kids:lidKids(top)},ceil)));
    const h=Math.max(0.1,g-0.05);
    if(mech==="snap"){
      // snap fingers on the front and back edges (and the short sides of tall trays)
      const fw=TRAY.finger,sw=TRAY.slit,at=[];
      const put=(e,cnt)=>{const [s0,len]=path.edges[e];if(len<fw+2*sw+4)return;for(let k=0;k<cnt;k++)at.push(s0+len*(k+0.5)/cnt);};
      const nl=Math.max(1,Math.min(4,Math.round(ow/80)));put("bottom",nl);put("top",nl);if(oh>70){put("left",1);put("right",1);}
      const cuts=[];for(const s of at)cuts.push([s-fw/2-sw,s-fw/2],[s+fw/2,s+fw/2+sw]);cuts.sort((a,b2)=>a[0]-b2[0]);
      const pieces=[];for(let k=0;k<cuts.length;k++){const u0=cuts[k][1],u1=k+1<cuts.length?cuts[k+1][0]:cuts[0][0]+path.per;if(u1-u0>0.05)pieces.push([u0,u1]);}
      const ringPiece=([u0,u1])=>{const us=path.sample(u0,u1),inn=us.map(u=>path.at(u)),o=inn.map(q=>[q.p[0]+q.n[0]*sk,q.p[1]+q.n[1]*sk]);
        return{outer:o.concat(inn.map(q=>q.p).reverse()),holes:[]};};
      lid.push(...trayExtrude(pieces.map(ringPiece),zsb,ceil+0.3));
      const bump=eng+(g-h),hookH=h+0.8,zc=zsb+hookH+0.1;
      for(const s of at){const q=path.at(s),half=fw/2-1;
        lid.push(...trayPrism(q.p,q.n,q.t,[[0.3,zsb],[0,zsb],[-h,zsb+h],[-h,zsb+hookH],[0.3,zsb+hookH]],half));
        lid.push(...trayPrism(q.p,q.n,q.t,[[sk-0.3,zsb],[sk+1.2,zsb],[sk+1.2,zsb+0.8],[sk-0.3,zsb+2.6]],half));
        tray.push(...trayPrism(q.p,q.n,q.t,[[-g-0.3,zc],[-g+bump,zc],[-g+bump,zc+0.6],[-g-0.3,zc+0.9+bump]],half-0.5));}
      latches=at.length;
    }else{
      // a solid skirt (the long sides flex a little)
      const inner=rrectPts(iw,ih,irad,cx,cy,8);
      lid.push(...orient(LEG.extrude([{outer:lidOuter,holes:[inner.slice().reverse()]}],()=>zsb,()=>ceil+0.3,0)));
      if(mech==="onetouch"){
        // a ridge inside the skirt along each long side, bumps on the tray wall: both faces sloped -> press on, pull off
        const e1=eng*0.6,bump=e1+(g-h),zr=zsb+2*h+0.4,zc=zr+0.1;
        for(const e of ["bottom","top"]){const [s0,len]=path.edges[e];if(len<20)continue;const q=path.at(s0+len/2);
          lid.push(...trayPrism(q.p,q.n,q.t,[[0.3,zsb],[0,zsb],[-h,zsb+h],[-h,zsb+h+0.4],[0,zr],[0.3,zr]],len/2-3));
          const nb=Math.max(2,Math.round(len/45));
          for(let k=0;k<nb;k++){const r=path.at(s0+len*(k+0.5)/nb);
            tray.push(...trayPrism(r.p,r.n,r.t,[[-g-0.3,zc-0.3],[-g+bump,zc+bump],[-g+bump,zc+bump+0.4],[-g-0.3,zc+2*bump+1.0]],6));}
          latches+=nb;}
      }
    }
  }
  return{tray,lid,win:winParts,extras,labErrs,specErr,frame:F,dropped,cx,cy,top,Tf,mech,dims:{ow,oh,lw,lh,trayH:slide?closedH:Zw,closedH,keyH,latches}};
}
// the lid as printed: upside down (a half turn about x keeps the windows over the right keys), resting on z=0
function trayLidPrint(T,top,cy){return T.map(t=>[...[0,1,2].map(k=>[t[k][0],2*cy-t[k][1],top-t[k][2]]),t[3]]);}
// every tray of the keymap; call trayPrepare() first when the name label is on (the text needs the font)
function trayFrames(){
  const L=layoutBox();
  if(trayArr()==="grid")return[trayFrame([],L,trayGridSlots(),trayGridCfg().pitch)]; // every slot is a "spare": a plain keycap place
  const groups=trayClusters(trayCfg().split),G=trayGrid(L),sp=groups.map(()=>[]);
  const cen=groups.map(ids=>ids.map(i=>trayMv(i,L)([0,0])));
  // each spare goes to the tray of the nearest key
  for(const a of traySpares()){const [x,y]=traySpareXY(a,G);let best=0,bd=Infinity;
    cen.forEach((cs,k)=>cs.forEach(c=>{const d=Math.hypot(c[0]-x,c[1]-y);if(d<bd){bd=d;best=k;}}));sp[best].push([x,y,"s"+a[0]+","+a[1]]);}
  return groups.map((ids,k)=>trayFrame(ids,L,sp[k]));
}
function trayAll(){
  const L=layoutBox(),frames=trayFrames(),labs=trayLabelsPlaced(frames),own=labs.map(l=>trayLabelOwner(frames,l));
  const spec=traySpecPlaced(frames),so=spec?traySpecOwner(frames,spec):-1;
  const all=frames.map((f,k)=>({ids:f.ids,...trayBuild(f.ids,L,labs.filter((l,j)=>own[j]===k),f.spares,f.pitch,so===k?spec:null)}));
  all.specErr=spec?(so<0?(spec.where==="bottom"?"トレーの外にあります":"蓋の外にあります"):all[so].specErr):"";
  // why a name could not go on: {idx: reason}
  all.labelErrs={};labs.forEach((l,j)=>{if(own[j]<0)all.labelErrs[l.idx]="トレーの外にあります";});
  for(const t of all)for(const e of t.labErrs)if(e.err)all.labelErrs[e.idx]=e.err;
  all.labelErr=Object.values(all.labelErrs).join("、");
  return all;
}
function trayLabelExt(){return EXP.labelExt||2;}
const TRAY_G_PER_MM3=0.00124;
function trayGrams(T){return Math.abs(signedVol(T))*TRAY_G_PER_MM3;}
function traySummary(all){const d=all[0].dims,ns=all.reduce((a,t)=>a+t.frame.spares.length,0),gr=trayArr()==="grid"?trayGridCfg():null;
  return(all.length>1?all.length+"組・":"")+(gr?gr.cols+"×"+gr.rows+"="+ns+"マス・":ns?"予備"+ns+"個・":"")+"トレー"+all.map(t=>fmt(Math.round(t.dims.ow))+"×"+fmt(Math.round(t.dims.oh))).join("と")+"mm・閉じた高さ約"+fmt(Math.round(d.closedH*10)/10)+"mm・約"+Math.round(all.reduce((a,t)=>a+trayGrams(t.tray)+trayGrams(t.lid)+trayGrams(t.win),0))+"g（PLA）";}

// ---------- preview (view "tray") ----------
let trayTok=0,trayTimer=0,trayLast=null,traySpanKey="";
function traySpan(){const a=trayLast&&trayLast.all;if(!a)return 260;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  const open=trayCfg().show!=="closed";
  for(const t of a){const sl=t.mech==="slide";x0=Math.min(x0,t.cx-t.dims.lw/2);x1=Math.max(x1,t.cx+t.dims.lw/2+(open&&sl?t.dims.ow*0.55:0));y0=Math.min(y0,t.cy-t.dims.lh/2);y1=Math.max(y1,t.cy+(open&&!sl?t.dims.lh*1.5+12:t.dims.lh/2));}
  return Math.max(x1-x0,(y1-y0)*1.3)*1.05+10;}
function scheduleTray(){clearTimeout(trayTimer);trayTimer=setTimeout(buildTrayPreview,150);}
function trayReset(){trayTok++;clearTimeout(trayTimer);}
function trayMat(ext){return ext===EXP.bodyExt?1:3+Math.min(16,Math.max(1,ext|0));}
async function buildTrayPreview(){
  const tok=++trayTok;if(!trayReady()){tris=[];dirty=true;wholeNote("キーマップを読み込むとトレーを作れます");return;}
  wholeNote("トレーを作成中…");await new Promise(r=>setTimeout(r,0));if(tok!==trayTok)return;
  let all;try{await trayPrepare();if(tok!==trayTok)return;all=trayAll();}catch(e){console.error(e);wholeNote("トレーを作れませんでした");return;}
  const L=layoutBox(),T=[],c=trayCfg();
  for(const t of all){
    T.push(...recolor(t.tray,trayMat(EXP.trayExt||1)));
    for(const e of t.extras)if(e.where==="floor"||e.where==="bottom")T.push(...recolor(e.tris,3+e.ext));
    // the keycaps in place
    if(c.keys){for(const i of t.ids){const k=buildMesh(paramsFor(i),6,24),D=trayPos().d[i]||[0,0];T.push(...placeTris(k,i,L).map(q=>[0,1,2].map(j=>[q[j][0]+D[0],q[j][1]+D[1],q[j][2]+t.Tf]).concat([q[3]])));}
      const plain=t.frame.spares.length?buildMesh({...P,homing:false},6,24):null; // spare keycaps: plain ones
      for(const [sx,sy] of t.frame.spares)T.push(...plain.map(q=>[[q[0][0]+sx,q[0][1]+sy,q[0][2]+t.Tf],[q[1][0]+sx,q[1][1]+sy,q[1][2]+t.Tf],[q[2][0]+sx,q[2][1]+sy,q[2][2]+t.Tf],q[3]]));}
    // the lid: beside it (behind the tray) or closed on it; a clear insert is left out when closed so the keys show through
    // a sliding lid is shown half pulled out of its rails
    const closed=c.show==="closed",sl=t.mech==="slide",dx=closed||!sl?0:t.dims.ow*0.55,dy=closed||sl?0:t.dims.lh+12,mv=q=>[q[0]+dx,q[1]+dy,q[2]];
    T.push(...t.lid.map(q=>[mv(q[0]),mv(q[1]),mv(q[2]),trayMat(EXP.lidExt||1)]));
    if(c.style==="clearwin"&&!closed)T.push(...t.win.map(q=>[mv(q[0]),mv(q[1]),mv(q[2]),3+(EXP.winExt||3)]));
    for(const e of t.extras)if(e.where==="lid")T.push(...e.tris.map(q=>[mv(q[0]),mv(q[1]),mv(q[2]),3+e.ext]));
    await new Promise(r=>setTimeout(r,0));if(tok!==trayTok)return;
  }
  const key=all.map(t=>fmt(t.dims.lw)+"x"+fmt(t.dims.lh)).join(",")+c.show;
  trayLast={all};tris=T;dirty=true;if(key!==traySpanKey){traySpanKey=key;ts=traySpan();} // keep the zoom while options change
  const drop=all.reduce((a,t)=>a+t.dropped.length,0);
  wholeNote(traySummary(all)+(drop?" ・重なるため窓を省いたキー: "+drop:"")+(all.labelErr?" ・名前を入れられません（"+all.labelErr+"）":"")+(all.specErr?" ・仕様を入れられません（"+all.specErr+"）":""));
  if(typeof drawTrayMap==="function")drawTrayMap();
  if(typeof scheduleCard==="function")scheduleCard(200);
}
function showTray(){const b=document.querySelector('.views button[data-view="tray"]');if(!b)return;b.hidden=false;if(view!=="tray")b.click();else rebuildPreview();
  const st=document.querySelector(".stage");if(st){const r=st.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)st.scrollIntoView({behavior:"smooth",block:"start"});}}

// ---------- export ----------
async function exportTray(){
  const st=document.getElementById("tray-st");if(!trayReady()){st.textContent="キーマップを読み込むか、並べ方を「格子状」にしてください。";return;}
  st.textContent="トレーを作っています…";await new Promise(r=>setTimeout(r,0));
  try{
    await trayPrepare();const all=trayAll(),c=trayCfg(),items=[],files=[],pl=EXP.plate;let x=0;
    all.forEach((t,k)=>{
      const n=all.length>1?String(k+1):"",cen=T=>T.map(q=>[...[0,1,2].map(j=>[q[j][0]-t.cx,q[j][1]-t.cy,q[j][2]]),q[3]]);
      const tray=cen(t.tray),lid=cen(trayLidPrint(t.lid,t.top,t.cy)),win=cen(trayLidPrint(t.win,t.top,t.cy));
      // lids rest on z=0: the skirt bottom (zsb) becomes the top after the flip; the plate is at z=0
      const w=Math.max(t.dims.ow,t.dims.lw);
      // names and art: one part per filament on the tray and on the lid
      const extra=where=>{const m=new Map();for(const e of t.extras){if(where==="floor"?e.where!=="floor"&&e.where!=="bottom":e.where!==where)continue;const k=e.kind+":"+e.ext;if(!m.has(k))m.set(k,{name:e.kind+"_f"+e.ext,ext:e.ext,tris:[]});m.get(k).tris.push(...e.tris);}
        return [...m.values()].map(v=>({name:v.name,extruder:v.ext,tris:where==="lid"?cen(trayLidPrint(v.tris,t.top,t.cy)):cen(v.tris)}));};
      const ef=extra("floor"),el=extra("lid");
      const tp=[{name:"tray",tris:tray,extruder:EXP.trayExt||1},...ef];
      items.push({name:"トレー"+n,x:pl/2+x,y:pl/2+t.dims.oh/2+6,parts:tp});
      const lp=[{name:"lid",tris:lid,extruder:EXP.lidExt||1}];if(win.length)lp.push({name:"window",tris:win,extruder:EXP.winExt||3});
      lp.push(...el);
      for(const e of ef)files.push({name:"tray"+n+"_"+e.name+".stl",data:toSTL(e.tris)});for(const e of el)files.push({name:"lid"+n+"_"+e.name+".stl",data:toSTL(e.tris)});
      items.push({name:"蓋"+n,x:pl/2+x,y:pl/2-t.dims.lh/2-6,parts:lp});
      files.push({name:"tray"+n+".stl",data:toSTL(tray)},{name:"lid"+n+".stl",data:toSTL(lid)});if(win.length)files.push({name:"lid"+n+"_window.stl",data:toSTL(win)});
      x+=w+10;});
    if(EXP.format==="3mf"){
      let extra=null;if(EXP.colors3mf===true){const hi=Math.max(EXP.trayExt||1,EXP.lidExt||1,c.style==="clearwin"?EXP.winExt||3:1,...all.map(t=>Math.max(1,...t.extras.map(e=>e.ext))));extra={"filament_colour":Array.from({length:hi},(_,i)=>filColor(i+1))};}
      const blob=await build3MF(items,extra),fname="lak_keycap_tray.3mf";
      if(window.claude){const z=await makeZipAsync([{name:fname,data:new Uint8Array(await blob.arrayBuffer())}]);await saveFile(z,"lak_keycap_tray_3mf.zip","tray-st");}
      else await saveFile(blob,fname,"tray-st");
    }else await saveFile(makeZip(files),"lak_keycap_tray.zip","tray-st");
    const big=all.some(t=>Math.max(t.dims.lw,t.dims.lh)>pl-6);
    st.textContent+=" "+traySummary(all)+"。"+(all.labelErr?" 名前は入れていません（"+all.labelErr+"）。":"")+(all.specErr?" 仕様は入れていません（"+all.specErr+"）。":"")+(big?" プレート（"+pl+"mm）より大きいため、そのままでは印刷できません。"+(trayArr()==="grid"?"列か行を減らしてください。":"「左右で分ける」を試してください。"):" トレーと蓋は別々に印刷してください（蓋は上下逆さの向きで出力しています）。");
  }catch(e){console.error(e);st.textContent="作れませんでした（"+(e&&e.message||e)+"）。";}
}

// ---------- form (output tab) ----------
function buildTrayForm(){
  const box=document.getElementById("tray-form");if(!box)return;box.innerHTML="";const c=trayCfg();
  const hint=document.createElement("p");hint.className="hint";hint.style.padding="8px 0 4px";
  const arr=trayArr(),grid=arr==="grid";
  hint.textContent="作ったキーキャップを保管するトレーと蓋です。キーボードと同じ並びのまま、または格子状に並べて入れられます。トレーの底には各キーの位置に十字の突起があり、キーキャップをスイッチのように差して固定します。蓋はキーの上に窓があり、選んだロックでトレーに留まります。";
  box.appendChild(hint);
  const seg=(title,key,opts,note,cur,set)=>{const w=document.createElement("div");w.className="seg";const h=document.createElement("div");h.className="seghead";h.textContent=title;w.appendChild(h);
    for(const [t,v,off] of opts){const b=document.createElement("button");b.type="button";b.textContent=t;b.setAttribute("aria-pressed",String((cur!==undefined?cur:c[key])===v));
      if(off){b.disabled=true;b.title=off;}
      b.onclick=()=>{(set||(x=>setTray(key,x)))(v);buildTrayForm();if(typeof renderOut==="function")renderOut();};w.appendChild(b);}
    if(note){const p=document.createElement("p");p.className="hint";p.style.cssText="width:100%;padding:2px 0 0";p.textContent=note;w.appendChild(p);}
    box.appendChild(w);};
  seg("並べ方","arr",[["キーボードの配列どおり","layout",KM.keys.length?"":"キーマップを読み込むと選べます"],["格子状","grid"]],
    grid?(KM.keys.length?"キーボードの配列を使わず、同じ大きさのマスを縦横に並べます。キーの数に合わせたり、自由な数にしたりできます。":"キーボードの配列を使わず、同じ大きさのマスを縦横に並べます（キーマップを読み込むと、配列どおりにも並べられます）。"):
    "キーボードと同じ並びでキーキャップを入れます。どのキーがどこか、迷わずに戻せます。",arr,setTrayArr);
  if(grid)buildTrayGridForm(box);
  seg("蓋の窓","style",[["窓あき","window"],["窓に透明パーツ","clearwin"],["窓なし","solid"]],
    c.style==="window"?"キーの上を窓として抜きます。どのフィラメントでも中が見えます。":c.style==="clearwin"?"窓を透明フィラメントの別パーツで埋めます（3MFで2色印刷、またはSTLの lid_window を別に印刷）。":"平らな蓋です。透明フィラメントで印刷すると中が見えます。");
  if(c.style!=="solid")buildTrayWinForm(box);
  seg("キーの固定","fit",[["なし","none"],["仕切り","grid"],["突起・ゆるめ","loose"],["突起・標準","std"],["突起・きつめ","tight"]],
    c.fit==="none"?"突起を付けず、平らな底にキーキャップを置きます。蓋を閉じればキーは並びのまま収まりますが、少し動くことがあります。":
    c.fit==="grid"?"突起の代わりに、各キーのまわりに低い仕切り（幅"+fmt(TRAY_RIB)+"mmの壁）を付けます。キーキャップを置くだけで並びがそろいます。":
    "十字の突起を、キーキャップの十字穴より片側"+fmt(TRAY_FIT[c.fit]??0.12)+"mm細くしています。キーキャップをスイッチのように差して固定します。");
  if(c.fit==="grid"){
    const clr=trayGridClr(),cw=document.createElement("div");cw.className="seg";cw.id="tray-clr";const chd=document.createElement("div");chd.className="seghead";chd.textContent="仕切りのクリアランス";cw.appendChild(chd);
    for(const [t,v] of TRAY_CLR){const b=document.createElement("button");b.type="button";b.textContent=t+" "+fmt(v)+"mm";b.setAttribute("aria-pressed",String(clr===v));
      b.onclick=()=>{setTray("gridClr",v);buildTrayForm();if(typeof renderOut==="function")renderOut();};cw.appendChild(b);}
    const cn=document.createElement("p");cn.className="hint";cn.id="tray-clrnote";cn.style.cssText="width:100%;padding:2px 0 0";
    let note="キーキャップと仕切りのすき間（片側）です。はまらないキーがあるときは広げてください。";
    if(grid)note+=" 格子状では、マスの間隔をキーの大きさ＋クリアランス×2＋仕切りの幅（"+fmt(trayGridMin())+"mm）以上に自動で広げます。";
    else if(KM.keys.length){const tp=trayPos(),pct=Math.round((tp.s-1)*1000)/10;
      note+=pct>0||tp.pushed?" 仕切りが入るように、キーの位置を自動でずらしています（"+(pct>0?"全体の間隔を"+fmt(pct)+"%広げる":"")+(pct>0&&tp.pushed?"・":"")+(tp.pushed?"近すぎる"+tp.pushed+"キーを個別に移動":"")+"）。並び順はキーボードと同じです。":" 今のキーの間隔のままで仕切りが入ります。";}
    cn.textContent=note;cw.appendChild(cn);box.appendChild(cw);
    const g=document.createElement("div");g.className="km-exgrid";g.style.padding="0 0 6px";
    const num=(label,id,val,min,max,step,key)=>{const l=document.createElement("label");l.textContent=label;const i=document.createElement("input");i.type="number";i.id=id;i.min=min;i.max=max;i.step=step;i.inputMode="decimal";i.value=fmt(val);
      i.onchange=()=>{let v=parseFloat(i.value);if(isNaN(v))v=val;v=Math.min(max,Math.max(min,Math.round(v*100)/100));i.value=fmt(v);setTray(key,v);buildTrayForm();if(typeof renderOut==="function")renderOut();};l.appendChild(i);g.appendChild(l);};
    num("クリアランス（mm）","tray-clrin",clr,0.1,1.5,0.05,"gridClr");num("仕切りの高さ（mm）","tray-gridh",trayGridH(),0.8,4,0.1,"gridH");
    box.appendChild(g);}
  const mech=TRAY_MECH.includes(c.mech)?c.mech:"snap";
  seg("ロックの方式","mech",[["ツメ","snap"],["ワンタッチ","onetouch"],["スライド","slide"],["なし","none"]],
    mech==="snap"?"蓋のふちのツメがトレーの突起にパチンと掛かります。外すときはツメの下のつまみを外へ引きます。しっかり留まるので、持ち運びに向いています。":
    mech==="onetouch"?"蓋を押すとパチッとはまり、引き上げると外れます。蓋の長辺の内側の出っ張りが、トレーの壁の突起を乗り越えて留まります（つまみ操作は不要）。":
    mech==="slide"?"蓋をトレーの右端から差し込んで、レールに沿って奥まで滑らせます。奥まで入れると、蓋の裏の出っ張りが入口の壁の内側にカチッと掛かります。開けるときは、右端のつまみを少し持ち上げて引き出します。":
    "ロックなし。蓋はトレーにかぶせるだけです。");
  if(mech!=="none")seg("ロックの強さ","lock",[["弱","weak"],["標準","std"],["強","strong"]],
    (mech==="slide"?"出っ張りの高さ ":mech==="onetouch"?"掛かり ":"ツメの掛かり ")+fmt(mech==="onetouch"?Math.round((TRAY_LOCK[c.lock]??0.45)*0.6*100)/100:mech==="slide"?Math.min(TRAY_LOCK[c.lock]??0.45,TRAY.clear-0.1):(TRAY_LOCK[c.lock]??0.45))+"mm。"+(mech==="snap"?"PLAで割れる場合は「弱」、PETGなら「強」も使えます。":"固すぎる・ゆるすぎる場合に調整してください。"));
  if(!grid)seg("分け方","split",[["1つにまとめる",false],["左右で分ける",true]],"分割キーボードは「左右で分ける」にすると、離れたまとまりごとにトレーと蓋を作ります（プレートに収まりやすくなります）。");
  const fw=document.createElement("div");fw.className="seg";const fh=document.createElement("div");fh.className="seghead";fh.textContent="形式";fw.appendChild(fh);
  [["STL（ZIP）","stl"],["3MF（Bambu Studio / OrcaSlicer）","3mf"]].forEach(([t,v])=>{const b=document.createElement("button");b.type="button";b.textContent=t;b.setAttribute("aria-pressed",String(EXP.format===v));
    b.onclick=()=>{EXP.format=v;saveWs();buildTrayForm();buildExportForm();};fw.appendChild(b);});
  box.appendChild(fw);
  if(!grid)buildTraySpareForm(box);
  buildTrayLabelForm(box);
  buildTraySpecForm(box);
  buildTrayArtForm(box);
  // preview: shown as soon as the tray is chosen; how to look at it
  const pw=document.createElement("div");pw.className="seg";const ph=document.createElement("div");ph.className="seghead";ph.textContent="プレビューの表示";pw.appendChild(ph);
  [["蓋を外して","open"],["蓋を閉じて","closed"]].forEach(([t,v])=>{const b=document.createElement("button");b.type="button";b.textContent=t;b.setAttribute("aria-pressed",String(c.show===v));
    b.onclick=()=>{setTray("show",v);buildTrayForm();showTray();};pw.appendChild(b);});
  const kl=document.createElement("label");kl.className="km-lname";kl.style.cssText="width:100%;padding:4px 0 0";const kc=document.createElement("input");kc.type="checkbox";kc.checked=c.keys;
  kc.onchange=()=>{setTray("keys",kc.checked);showTray();};kl.appendChild(kc);kl.appendChild(document.createTextNode(" キーキャップを入れて表示"));pw.appendChild(kl);
  const pn=document.createElement("p");pn.className="hint";pn.style.cssText="width:100%;padding:2px 0 0";pn.textContent="「保管トレー」を選ぶと3D表示がトレーに切り替わり、設定を変えるとその場で作り直します（保存前に確認できます）。プレビューの表示は出力するファイルには影響しません。";pw.appendChild(pn);
  box.appendChild(pw);
  const row=document.createElement("div");row.className="km-btns";const pv=document.createElement("button");pv.type="button";pv.textContent="トレーを3Dで表示";pv.onclick=showTray;row.appendChild(pv);box.appendChild(row);
}

// ---------- which keys get a window: click (or drag across) keys on the lid map ----------
let trayWinView=null,trayWinDrag=null,trayWinHover=null;
function trayWinKeys(){const o=[];for(const f of trayFrames())f.keys.forEach((k,j)=>o.push({id:f.kids[j],k}));return o;}
function setTrayWinOff(set){EXP.tray={...trayCfg(),winOff:[...set]};}
function buildTrayWinForm(box){
  const sec=document.createElement("div");sec.className="tray-wins";
  const h=document.createElement("div");h.className="seghead";h.style.padding="2px 0 4px";h.textContent="窓を開けるキー";sec.appendChild(h);
  const wrap=document.createElement("div");wrap.className="km-mapwrap";const cv=document.createElement("canvas");cv.id="tray-winmap";cv.className="art-map";
  cv.setAttribute("aria-label","窓を開けるキー。キーをクリックで窓の有無を切り替え、ドラッグでまとめて切り替え");wrap.appendChild(cv);sec.appendChild(wrap);
  const at=e=>{const v=trayWinView;if(!v)return null;const r=cv.getBoundingClientRect(),x=(e.clientX-r.left-v.ox)/v.sc,y=-(e.clientY-r.top-v.oy)/v.sc;const hit=v.keys.find(o=>pipL([x,y],o.k));return hit?hit.id:null;};
  const apply=id=>{const off=trayWinOff();if(trayWinDrag.close)off.add(id);else off.delete(id);setTrayWinOff(off);};
  cv.addEventListener("pointerdown",e=>{const id=at(e);if(!id)return;trayWinDrag={close:!trayWinOff().has(id),seen:new Set([id])};apply(id);drawTrayWinMap();try{cv.setPointerCapture(e.pointerId);}catch(_){}});
  cv.addEventListener("pointermove",e=>{const id=at(e);
    if(!trayWinDrag){if(id!==trayWinHover){trayWinHover=id;drawTrayWinMap();}return;}
    if(id&&!trayWinDrag.seen.has(id)){trayWinDrag.seen.add(id);apply(id);drawTrayWinMap();}});
  cv.addEventListener("pointerleave",()=>{if(!trayWinDrag&&trayWinHover){trayWinHover=null;drawTrayWinMap();}});
  const end=()=>{if(!trayWinDrag)return;trayWinDrag=null;saveWs();trayDirty();drawTrayWinMap();drawTrayMapSoon();};
  cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);
  const bt=document.createElement("div");bt.className="km-btns";
  const b=(t,fn)=>{const x=document.createElement("button");x.type="button";x.className="ghost";x.textContent=t;x.onclick=()=>{fn();saveWs();trayDirty();drawTrayWinMap();drawTrayMapSoon();};bt.appendChild(x);};
  b("すべて開ける",()=>setTrayWinOff(new Set()));
  b("すべて閉じる",()=>setTrayWinOff(new Set(trayWinKeys().map(o=>o.id))));
  b("反転",()=>{const off=trayWinOff(),n=new Set();for(const o of trayWinKeys())if(!off.has(o.id))n.add(o.id);setTrayWinOff(n);});
  sec.appendChild(bt);
  const st=document.createElement("p");st.className="hint";st.id="tray-winst";st.style.padding="2px 0 6px";sec.appendChild(st);
  box.appendChild(sec);drawTrayWinMap();
}
function drawTrayWinMap(){
  const cv=document.getElementById("tray-winmap");if(!cv||!trayReady())return;
  const frames=trayFrames(),m=trayMapFit(cv,frames),{g,sc,ox,oy,X,Y}=m,off=trayWinOff(),keys=trayWinKeys();
  trayMapSurface(m,frames,"lid");
  const acc=css("--accent"),line=css("--line"),muted=css("--muted"),panel=css("--panel");
  const ws=Math.max(4,P.top_size-3),wr=Math.min(2.5,ws/2-0.5);
  const poly=(pts,fill,stroke,dash)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.setLineDash(dash||[]);g.strokeStyle=stroke;g.lineWidth=1;g.stroke();g.setLineDash([]);}};
  let open=0;
  for(const {id,k} of keys){const c=k.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]),bb=Math.hypot(k[1][0]-k[0][0],k[1][1]-k[0][1]),ux=[(k[1][0]-k[0][0])/bb,(k[1][1]-k[0][1])/bb],uy=[(k[3][0]-k[0][0])/bb,(k[3][1]-k[0][1])/bb];
    const w=rrectPts(ws,ws,wr,0,0,4).map(([x,y])=>[c[0]+ux[0]*x+uy[0]*y,c[1]+ux[1]*x+uy[1]*y]),isOff=off.has(id);
    poly(k,null,id===trayWinHover?acc:line,isOff?[3,3]:null);
    if(isOff){g.strokeStyle=muted;g.lineWidth=1;const d=ws*0.25;g.beginPath();g.moveTo(X(c[0]-d),Y(c[1]-d));g.lineTo(X(c[0]+d),Y(c[1]+d));g.moveTo(X(c[0]-d),Y(c[1]+d));g.lineTo(X(c[0]+d),Y(c[1]-d));g.stroke();}
    else{poly(w,acc,null);open++;}}
  trayWinView={sc,ox,oy,keys};
  const st=document.getElementById("tray-winst");
  if(st)st.textContent="窓あり "+open+"／"+keys.length+"キー。キーをクリックすると窓の有無が切り替わります（ドラッグでまとめて切り替え）。"+(open===0?"すべて閉じると窓なしの蓋と同じです。":"窓のないキーの上には、名前やアートを置けます。");
}
window.addEventListener("resize",()=>{if(document.getElementById("tray-winmap"))drawTrayWinMap();});

// ---------- grid arrangement: columns, rows, spacing ----------
function buildTrayGridForm(box){
  const gc=trayGridCfg(),sec=document.createElement("div");sec.className="tray-grid";
  const g=document.createElement("div");g.className="km-exgrid";
  const num=(label,key,val,min,max,step,int)=>{const l=document.createElement("label");l.textContent=label;const i=document.createElement("input");i.type="number";i.min=min;i.max=max;i.step=step;i.inputMode=int?"numeric":"decimal";i.value=fmt(val);i.id="tray-g"+key;
    i.onchange=()=>{let v=parseFloat(i.value);if(isNaN(v))v=val;v=Math.min(max,Math.max(min,int?Math.round(v):Math.round(v*10)/10));i.value=fmt(v);setTray(key,v);buildTrayForm();if(typeof renderOut==="function")renderOut();};l.appendChild(i);g.appendChild(l);};
  num("列（横の数）","gcols",gc.cols,1,20,1,true);num("行（縦の数）","grows",gc.rows,1,20,1,true);num("マスの間隔（mm）","gpitch",gc.pitch,trayGridMin(),trayGridMin()+12,0.1,false);
  sec.appendChild(g);
  const bt=document.createElement("div");bt.className="km-btns";
  if(KM.keys.length){const n=KM.keys.length,fit=trayGridFor(n),b=document.createElement("button");b.type="button";b.className="ghost";b.textContent="キーの数（"+n+"）に合わせる";
    b.title=fit.cols+"列×"+fit.rows+"行（"+fit.cols*fit.rows+"マス）にします";
    b.onclick=()=>{EXP.tray={...trayCfg(),gcols:fit.cols,grows:fit.rows};saveWs();trayDirty();buildTrayForm();if(typeof renderOut==="function")renderOut();};bt.appendChild(b);}
  const r=document.createElement("button");r.type="button";r.className="ghost";r.textContent="間隔をキーピッチ（"+fmt(Math.max(trayGridMin(),P.pitch))+"mm）に戻す";
  r.onclick=()=>{setTray("gpitch",undefined);buildTrayForm();};if(gc.pitch!==Math.max(trayGridMin(),P.pitch))bt.appendChild(r);
  if(bt.children.length)sec.appendChild(bt);
  const f=trayFrames()[0],pl=EXP.plate||256,big=f&&Math.max(f.lidW,f.lidH)>pl-6,st=document.createElement("p");st.className="hint";st.id="tray-gridst";st.style.padding="2px 0 6px";
  st.textContent=gc.cols*gc.rows+"マス"+(KM.keys.length?"（キーマップは"+KM.keys.length+"キー）":"")+"。トレーの外形 約"+(f?fmt(Math.round(f.ow))+"×"+fmt(Math.round(f.oh)):"–")+"mm。"+
    (big?"プレート（"+pl+"mm）に収まりません。列か行を減らすか、間隔を詰めてください。":"マスの間隔は、仕切りやキーどうしのすき間を含めた中心間の距離です（最小"+fmt(trayGridMin())+"mm）。");
  if(big)st.style.color=css("--err")||"#B3261E";
  sec.appendChild(st);box.appendChild(sec);
}

// ---------- spec plate: the keycap's shape parameters and its section, cut into the lid top or the tray's underside ----------
// Both faces are printed on the bed (the lid upside down, the tray upright), so a 2-colour plate costs only a few layers.
const TRAY_SPEC_BOTTOM=0.4; // pocket depth on the underside (the floor is 1.2mm; names / art on the floor take 0.6 from above)
const TSDEF={on:false,where:"bottom",style:"engrave",size:2.5,x:null,y:null,rot:0,title:"",showTitle:true,showParams:true,showSection:true,frame:true};
function traySpecCfg(){const c=trayCfg().spec,o={...TSDEF,...(c&&typeof c==="object"?c:{})};
  o.where=o.where==="lid"?"lid":"bottom";o.style=o.style==="inlay"?"inlay":"engrave";o.size=Math.min(8,Math.max(2,+o.size||2.5));o.rot=((+o.rot||0)%360+360)%360;o.title=String(o.title||"").slice(0,40);return o;}
function setTraySpec(k,v){EXP.tray={...trayCfg(),spec:{...traySpecCfg(),[k]:v}};saveWs();trayDirty();}
function traySpecExt(){return EXP.specExt||trayLabelExt();}
function traySpecTitle(c){return(c||traySpecCfg()).title.trim()||(typeof shareName!=="undefined"&&shareName)||"LAK風キーキャップ";}
// the lines of text: [label, value]
function traySpecLines(){const L=typeof paramLines==="function"?paramLines(P):[];
  L.splice(2,0,["天面の幅",fmt(P.top_size)+" mm"],["外周の高さ",fmt(P.edge_h)+" mm"]);
  if(P.homing){const S=homingSpec(P);L.push(["ホーミング",["突起","凹み","差し込み"][S.mode]+"・"+(S.dot?"ドット":"バー")]);}
  return L;}
// the section through the centre (as in the section view), one outline: body, cavity, stem and cross hole (mm, y up)
function traySpecSection(){
  const D=derive(P),w=D.w,b=P.edge_band,zAt=(x,low)=>{const d=w-Math.abs(x);return ztop(x,0,d,low===undefined?d<b:low,P,D);};
  const top=[];for(let i=0;i<=120;i++){const x=-w+2*w*i/120;top.push([x,zAt(x)]);}
  if(P.boundary==0&&!(P.step_run>0)){const s2=w-b,ins=(x,pts)=>{let j=top.findIndex(p=>p[0]>x);if(j<0)j=top.length;top.splice(j,0,...pts);};
    ins(-s2,[[-s2,zAt(-s2,true)],[-s2,zAt(-s2,false)]]);ins(s2,[[s2,zAt(s2,false)],[s2,zAt(s2,true)]]);}
  const bi=D.base-2*P.wall,it=D.base-(D.base-P.top_size)*P.cavity_h/P.edge_h-2*P.wall,so=P.stem_od/2,a=P.cross_len/2,c=Math.min(P.chamfer,so-a-0.05),ch=P.cavity_h;
  const o=[[-D.base/2,0],[-w,zAt(-w,true)],...top,[w,zAt(w,true)],[D.base/2,0],[bi/2,0],[it/2,ch],[so,ch],[so,0],[a+c,0],[a,c],[a,P.cross_depth],[-a,P.cross_depth],[-a,c],[-a-c,0],[-so,0],[-so,ch],[-it/2,ch],[-bi/2,0]];
  const out=[];for(const p of o){const q=out[out.length-1];if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>1e-4)out.push(p);}
  return LEG.area(out)>0?out:out.reverse();
}
// local shapes (mm, centred), cached; built from text shapes and the section outline
let traySpecCache={key:"",shapes:[],w:0,h:0};
async function traySpecPrepare(){
  const c=traySpecCfg();if(!c.on){return;}
  const key=JSON.stringify([P,c.size,c.showTitle,c.showParams,c.showSection,c.frame,traySpecTitle(c),LCFG.font]);
  if(traySpecCache.key===key)return;
  await ensureFont(LCFG.font);
  const t=c.size,lh=t*1.65,gap=t*1.2,parts=[];
  const bbox=sh=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const q of sh)for(const p of q.outer){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}return{x0,y0,x1,y1};};
  const move=(sh,dx,dy)=>sh.map(q=>({outer:q.outer.map(p=>[p[0]+dx,p[1]+dy]),holes:q.holes.map(h=>h.map(p=>[p[0]+dx,p[1]+dy]))}));
  const text=async(str,size)=>{const sh=await LEG.textShapes(str,{font:LCFG.font,weight:700,size,maxW:400,cx:0,cy:0});const b=bbox(sh);return{sh:move(sh,-b.x0,-b.y0),w:b.x1-b.x0,h:b.y1-b.y0};};
  // stacked: the name, the section, then the parameters in two columns
  const rows=[];if(c.showParams)for(const [k,v] of traySpecLines())rows.push(await text(k+" "+v,t));
  const nc=rows.length>=4?2:1,per=Math.ceil(rows.length/nc),cols=[];for(let j=0;j<nc;j++)cols.push(rows.slice(j*per,(j+1)*per));
  const colWs=cols.map(cl=>Math.max(0,...cl.map(r=>r.w))),gridW=colWs.reduce((a,b)=>a+b,0)+(nc-1)*t*2,gridH=rows.length?(per-1)*lh+t:0;
  let sec=null;if(c.showSection){const o=traySpecSection(),D=derive(P),hh=P.edge_h+D.E+Math.max(0,D.dome),k=Math.max(1.5,t*0.9);
    sec={sh:[{outer:o.map(p=>[(p[0]+D.base/2)*k,p[1]*k]),holes:[]}],w:D.base*k,h:hh*k};}
  const ti=c.showTitle?await text(traySpecTitle(c),t*1.35):null;
  const W=Math.max(gridW,sec?sec.w:0,ti?ti.w:0),Htot=(ti?ti.h:0)+(sec?sec.h:0)+gridH+gap*((ti?1:0)+(sec?1:0)+(rows.length?1:0)-1);
  if(!W||!(Htot>0)){traySpecCache={key,shapes:[],w:0,h:0};return;}
  let y=Htot;
  if(ti){parts.push(...move(ti.sh,(W-ti.w)/2,y-ti.h));y-=ti.h+gap;}
  if(sec){parts.push(...move(sec.sh,(W-sec.w)/2,y-sec.h));y-=sec.h+gap;}
  let x=(W-gridW)/2;cols.forEach((cl,j)=>{cl.forEach((r,i)=>parts.push(...move(r.sh,x,y-i*lh-t)));x+=colWs[j]+t*2;});
  let shapes=move(parts,-W/2,-Htot/2);
  if(c.frame){const pad=t*0.9,fw=Math.max(0.6,t*0.18),ow=W+2*pad+2*fw,oh=Htot+2*pad+2*fw;
    shapes=[{outer:rrectPts(ow,oh,Math.min(3,t),0,0,6),holes:[rrectPts(ow-2*fw,oh-2*fw,Math.max(0.3,Math.min(3,t)-fw),0,0,6).reverse()]}].concat(shapes);
    traySpecCache={key,shapes,w:ow,h:oh};return;}
  traySpecCache={key,shapes,w:W,h:Htot};
}
// in world coordinates: on the underside the plate is mirrored front to back, so it reads right when the tray is
// tipped over towards you (about its long side) (x, y: its centre in world coordinates; rot: as seen by the reader)
function traySpecPlaced(frames){
  const c=traySpecCfg();if(!c.on||!traySpecCache.shapes.length||!frames.length)return null;
  const f=frames[0],under=c.where==="bottom",x=c.x??f.cx,y=c.y??(under?f.cy:f.lidCy),t=c.rot*Math.PI/180,co=Math.cos(t),si=Math.sin(t);
  const mv=p=>{const vx=p[0]*co-p[1]*si,vy=p[0]*si+p[1]*co;return[x+vx,y+(under?-vy:vy)];};
  const fix=l=>under?l.slice().reverse():l; // mirroring turns loops round
  return{where:c.where,style:c.style,x,y,shapes:traySpecCache.shapes.map(q=>({outer:fix(q.outer.map(mv)),holes:q.holes.map(h=>fix(h.map(mv)))})),l:{where:c.where}};
}
function traySpecOwner(frames,sp){return frames.findIndex(f=>Math.abs(sp.x-f.cx)<=f.ow/2&&Math.abs(sp.y-f.cy)<=f.oh/2);}
function traySpecCheck(f,sp,labs){
  const pts=[].concat(...sp.shapes.map(q=>q.outer)),inR=(w,h,ins,cy)=>pts.every(p=>Math.abs(p[0]-f.cx)<=w/2-ins&&Math.abs(p[1]-cy)<=h/2-ins);
  if(sp.where==="bottom")return inR(f.ow,f.oh,2,f.cy)?"":"トレーの裏からはみ出しています";
  if(!inR(f.lidW,f.lidH,1.2,f.lidCy))return"蓋からはみ出しています";
  const out=sp.shapes.filter(q=>q.outer.length).map(q=>({outer:q.outer,holes:[]}));
  if(f.wins.some(w=>shapesOverlap(out,[{outer:w,holes:[]}])||out.some(q=>pipL(w[0],q.outer))))return"蓋の窓に重なっています（窓を閉じたキーの上なら置けます）";
  for(const l of labs||[])if(l.l.where==="lid"&&shapesOverlap(out,l.shapes))return"名前と重なっています";
  return"";
}

// form and placement map
let traySpecView=null,traySpecDrag=null;
function buildTraySpecForm(box){
  const c=traySpecCfg(),sec=document.createElement("div");sec.className="tray-spec";
  const h=document.createElement("div");h.className="km-edhead";h.style.cssText="padding:12px 0 2px;border-top:1px solid var(--line)";h.textContent="仕様の刻印（パラメータ・断面図）";sec.appendChild(h);
  const ol=document.createElement("label");ol.className="km-lname";ol.style.padding="4px 0";const cb=document.createElement("input");cb.type="checkbox";cb.checked=c.on;
  cb.onchange=()=>{setTraySpec("on",cb.checked);buildTrayForm();if(typeof renderOut==="function")renderOut();};ol.appendChild(cb);ol.appendChild(document.createTextNode(" キーキャップの形のパラメータと断面図を入れる"));sec.appendChild(ol);
  if(!c.on){box.appendChild(sec);return;}
  const hint=document.createElement("p");hint.className="hint";hint.style.padding="0 0 4px";
  hint.textContent="Xに投稿する画像のように、名前・形のパラメータ・中心の断面図をまとめた板を、トレーの裏か蓋の上に入れます。どちらも印刷するとき下になる面なので、2色にしても色替えは最初の数層だけです。トレーの裏は、手前に倒して裏返したときに読める向きで入れます。";sec.appendChild(hint);
  const seg=(title,key,opts,note)=>{const w=document.createElement("div");w.className="seg";const hh=document.createElement("div");hh.className="seghead";hh.textContent=title;w.appendChild(hh);
    for(const [tx,v] of opts){const b=document.createElement("button");b.type="button";b.textContent=tx;b.setAttribute("aria-pressed",String(c[key]===v));
      b.onclick=()=>{if(key==="where"){EXP.tray={...trayCfg(),spec:{...traySpecCfg(),where:v,x:null,y:null}};saveWs();trayDirty();}else setTraySpec(key,v);buildTrayForm();if(typeof renderOut==="function")renderOut();};w.appendChild(b);}
    if(note){const p=document.createElement("p");p.className="hint";p.style.cssText="width:100%;padding:2px 0 0";p.textContent=note;w.appendChild(p);}
    sec.appendChild(w);};
  seg("入れる場所","where",[["トレーの裏","bottom"],["蓋の上","lid"]],c.where==="bottom"?"トレーの底の外側（印刷で下になる面）に、深さ"+fmt(TRAY_SPEC_BOTTOM)+"mmで入れます。":"蓋の天面に入れます。窓と重ならない場所に置いてください（「窓を開けるキー」で窓を閉じたキーの上にも置けます）。");
  seg("仕上げ","style",[["彫り込み","engrave"],["2色（はめ込み）","inlay"]],c.style==="inlay"?"彫った部分を別のフィラメントのパーツで埋めます（フィラメントは割り当て表の「仕様の刻印」）。":"");
  const ck=document.createElement("div");ck.className="seg";const ckh=document.createElement("div");ckh.className="seghead";ckh.textContent="入れる内容";ck.appendChild(ckh);
  for(const [k,t] of [["showTitle","名前"],["showParams","パラメータ"],["showSection","断面図"],["frame","枠"]]){const l=document.createElement("label");l.className="km-lname";l.style.marginRight="12px";
    const i=document.createElement("input");i.type="checkbox";i.checked=c[k];i.onchange=()=>{setTraySpec(k,i.checked);drawTraySpecSoon();};l.appendChild(i);l.appendChild(document.createTextNode(" "+t));ck.appendChild(l);}
  sec.appendChild(ck);
  const g=document.createElement("div");g.className="km-exgrid";
  const tl=document.createElement("label");tl.textContent="名前";const ti=document.createElement("input");ti.maxLength=40;ti.value=c.title;ti.placeholder=traySpecTitle({...c,title:""});ti.id="tray-spectitle";
  ti.onchange=()=>{setTraySpec("title",ti.value.trim());drawTraySpecSoon();};tl.appendChild(ti);g.appendChild(tl);
  const zl=document.createElement("label");zl.textContent="文字の大きさ（mm）";const zi=document.createElement("input");zi.type="number";zi.min=2;zi.max=8;zi.step=0.5;zi.inputMode="decimal";zi.value=fmt(c.size);zi.id="tray-specsize";
  zi.onchange=()=>{let v=parseFloat(zi.value);if(isNaN(v))v=c.size;v=Math.min(8,Math.max(2,v));zi.value=fmt(v);setTraySpec("size",v);drawTraySpecSoon();};zl.appendChild(zi);g.appendChild(zl);
  sec.appendChild(g);
  const bt=document.createElement("div");bt.className="km-btns";const b=(tx,fn)=>{const x=document.createElement("button");x.type="button";x.className="ghost";x.textContent=tx;x.onclick=fn;bt.appendChild(x);};
  b("初めの位置に戻す",()=>{EXP.tray={...trayCfg(),spec:{...traySpecCfg(),x:null,y:null}};saveWs();trayDirty();drawTraySpecSoon();});
  b("↺ 90°",()=>{setTraySpec("rot",(c.rot+90)%360);buildTrayForm();});b("↻ 90°",()=>{setTraySpec("rot",(c.rot+270)%360);buildTrayForm();});
  sec.appendChild(bt);
  const wrap=document.createElement("div");wrap.className="km-mapwrap";const cv=document.createElement("canvas");cv.id="tray-specmap";cv.className="art-map";
  cv.setAttribute("aria-label","仕様の刻印の位置。ドラッグで動かせます");wrap.appendChild(cv);sec.appendChild(wrap);
  const cp=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  cv.addEventListener("pointerdown",e=>{const v=traySpecView;if(!v||!v.box)return;const p=cp(e),bx=v.box;
    if(p[0]<bx[0]-6||p[0]>bx[2]+6||p[1]<bx[1]-6||p[1]>bx[3]+6)return;traySpecDrag={p,x:v.x,y:v.y,moved:false};try{cv.setPointerCapture(e.pointerId);}catch(_){}});
  cv.addEventListener("pointermove",e=>{const d=traySpecDrag,v=traySpecView;if(!d||!v)return;const p=cp(e),dx=(p[0]-d.p[0])/v.sc,dy=(p[1]-d.p[1])/v.sc*(v.under?1:-1);
    if(Math.hypot(p[0]-d.p[0],p[1]-d.p[1])>2)d.moved=true;if(!d.moved)return;
    EXP.tray={...trayCfg(),spec:{...traySpecCfg(),x:Math.round((d.x+dx)*10)/10,y:Math.round((d.y+dy)*10)/10}};drawTraySpecMap();});
  const end=()=>{const d=traySpecDrag;traySpecDrag=null;if(d&&d.moved){saveWs();trayDirty();drawTraySpecMap();}};
  cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);
  const st=document.createElement("p");st.className="hint";st.id="tray-specst";st.style.padding="2px 0 6px";sec.appendChild(st);
  box.appendChild(sec);drawTraySpecSoon();
}
function drawTraySpecSoon(){trayPrepare().then(()=>{drawTraySpecMap();drawTrayMap();if(typeof drawTrayArtMap==="function")drawTrayArtMap();}).catch(e=>console.error(e));}
function drawTraySpecMap(){
  const cv=document.getElementById("tray-specmap");if(!cv||!trayReady())return;
  const c=traySpecCfg(),under=c.where==="bottom",frames=trayFrames();
  // the underside is drawn as seen from below (mirrored), so the plate reads right on the map too
  const vf=under?frames.map(f=>({...f,cy:-f.cy,lidW:f.ow,lidH:f.oh,lidCy:-f.cy})):frames,m=trayMapFit(cv,vf),{g,sc,ox,oy}=m,X=x=>ox+x*sc,Y=y=>oy-(under?-y:y)*sc;
  const poly=(pts,fill,stroke)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=1;g.stroke();}};
  if(under)for(const f of frames)poly(rrectPts(f.ow,f.oh,4,f.cx,f.cy,6),css("--panel"),css("--line"));
  else{trayMapSurface(m,frames,"lid");trayMapSurfaceTop(m,frames,"lid",(pts,f2,s2)=>poly(pts,f2,s2));
    for(const lb of trayLabelsPlaced(frames)){if(lb.l.where!=="lid")continue;g.beginPath();for(const q of lb.shapes)for(const lp of [q.outer,...q.holes]){lp.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();}g.fillStyle=css("--muted");g.fill("evenodd");}}
  const sp=traySpecPlaced(frames),st=document.getElementById("tray-specst");traySpecView={sc,ox,oy,under,box:null,x:sp?sp.x:0,y:sp?sp.y:0};
  if(!sp){if(st)st.textContent=c.showTitle||c.showParams||c.showSection?"作成中…":"入れる内容を選んでください。";return;}
  const k=traySpecOwner(frames,sp),err=k<0?(under?"トレーの外にあります":"蓋の外にあります"):traySpecCheck(frames[k],sp,trayLabelsPlaced(frames).filter(l=>trayLabelOwner(frames,l)===k)),errc=css("--err")||"#B3261E";
  g.beginPath();for(const q of sp.shapes)for(const lp of [q.outer,...q.holes]){lp.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();}
  g.fillStyle=err?errc:css("--ink");g.fill("evenodd");
  let a=Infinity,b=Infinity,cc=-Infinity,d=-Infinity;for(const q of sp.shapes)for(const p of q.outer){a=Math.min(a,X(p[0]));cc=Math.max(cc,X(p[0]));b=Math.min(b,Y(p[1]));d=Math.max(d,Y(p[1]));}
  g.setLineDash([4,3]);g.strokeStyle=err?errc:css("--accent");g.lineWidth=1.2;g.strokeRect(a-3,b-3,cc-a+6,d-b+6);g.setLineDash([]);
  traySpecView.box=[a,b,cc,d];
  if(st){st.textContent=(err?"入れられません（"+err+"）。ドラッグで場所を動かすか、文字を小さくしてください。":"ドラッグで動かせます。"+(under?"図はトレーを手前に倒して裏返した向きです。":"灰色の四角は蓋の窓です。"))+" 大きさ 約"+Math.round(traySpecCache.w)+"×"+Math.round(traySpecCache.h)+"mm。";st.style.color=err?errc:"";}
}
window.addEventListener("resize",()=>{if(document.getElementById("tray-specmap"))drawTraySpecMap();});

// ---------- names: list, settings of the selected one, placement map ----------
let trayMapView=null,trayMapDrag=null,trayLabelSel=0;
function buildTrayLabelForm(box){
  const on=trayLabelsOn(),sec=document.createElement("div");sec.className="tray-label";
  const h=document.createElement("div");h.className="km-edhead";h.style.cssText="padding:12px 0 2px;border-top:1px solid var(--line)";h.textContent="名前の刻印";sec.appendChild(h);
  const ol=document.createElement("label");ol.className="km-lname";ol.style.padding="4px 0";const cb=document.createElement("input");cb.type="checkbox";cb.checked=on;
  cb.onchange=()=>{const ls=trayLabelsAll();if(cb.checked&&!ls.length)ls.push(trayLabelNorm({}));EXP.tray={...trayCfg(),labelsOn:cb.checked,labels:ls.map(trayLabelNorm),label:undefined};saveWs();trayDirty();buildTrayForm();if(typeof renderOut==="function")renderOut();};
  ol.appendChild(cb);ol.appendChild(document.createTextNode(" 蓋またはトレーに名前を入れる"));sec.appendChild(ol);
  if(!on){box.appendChild(sec);return;}
  const ls=trayLabelsAll();if(trayLabelSel>=ls.length)trayLabelSel=Math.max(0,ls.length-1);
  const ntr=trayFrames().length;
  const hint=document.createElement("p");hint.className="hint";hint.style.padding="0 0 4px";
  hint.textContent="名前は複数入れられます"+(ntr>1?"（トレーを分けたときは、1つ目の名前が左のトレー、2つ目が右のトレーに初めは置かれます）":"")+"。それぞれの場所・仕上げ・大きさ・位置を選べます。";sec.appendChild(hint);
  // the list
  const list=document.createElement("div");list.className="tray-names";
  ls.forEach((l,k)=>{const row=document.createElement("div");row.className="tray-name"+(k===trayLabelSel?" sel":"");
    const pick=document.createElement("button");pick.type="button";pick.className="tray-name-no";pick.textContent=String(k+1);pick.setAttribute("aria-pressed",String(k===trayLabelSel));pick.setAttribute("aria-label",(k+1)+"つ目の名前を選ぶ");
    pick.onclick=()=>{trayLabelSel=k;buildTrayForm();};
    const ti=document.createElement("input");ti.value=l.text;ti.maxLength=40;ti.placeholder=ntr>1?(k===0?"例：Corne 左":"例：Corne 右"):"例：Corne LAK";ti.setAttribute("aria-label",(k+1)+"つ目の名前");
    ti.onfocus=()=>{if(trayLabelSel!==k){trayLabelSel=k;sec.querySelectorAll(".tray-name").forEach((r,j)=>r.classList.toggle("sel",j===k));sec.querySelectorAll(".tray-name-no").forEach((b,j)=>b.setAttribute("aria-pressed",String(j===k)));drawTrayMapSoon();}};
    ti.onchange=()=>{setTrayLabelAt(k,"text",ti.value.trim());drawTrayMapSoon();};
    const del=document.createElement("button");del.type="button";del.className="ghost danger";del.textContent="削除";del.onclick=()=>{const a=trayLabelsAll();a.splice(k,1);trayLabelSel=Math.max(0,k-1);setTrayLabels(a);buildTrayForm();};
    row.appendChild(pick);row.appendChild(ti);row.appendChild(del);list.appendChild(row);});
  sec.appendChild(list);
  const ab=document.createElement("div");ab.className="km-btns";const add=document.createElement("button");add.type="button";add.textContent="＋ 名前を追加";
  add.onclick=()=>{const a=trayLabelsAll(),cur=a[trayLabelSel]||trayLabelNorm({});a.push(trayLabelNorm({where:cur.where,style:cur.style,size:cur.size}));trayLabelSel=a.length-1;setTrayLabels(a);buildTrayForm();};ab.appendChild(add);
  if(ntr>1&&ls.length<ntr){const fill=document.createElement("button");fill.type="button";fill.className="ghost";fill.textContent="トレーごとに1つずつ用意";
    fill.onclick=()=>{const a=trayLabelsAll(),base=a[0]||trayLabelNorm({});while(a.length<ntr)a.push(trayLabelNorm({where:base.where,style:base.style,size:base.size}));setTrayLabels(a);buildTrayForm();};ab.appendChild(fill);}
  sec.appendChild(ab);
  const l=ls[trayLabelSel];
  if(l){
    const sub=document.createElement("div");sub.className="tray-name-opts";
    const t=document.createElement("div");t.className="km-edhead";t.style.cssText="padding:6px 0 0;font-size:13px";t.textContent=(trayLabelSel+1)+"つ目の名前の設定";sub.appendChild(t);
    const seg=(title,key,opts,note)=>{const w=document.createElement("div");w.className="seg";const hh=document.createElement("div");hh.className="seghead";hh.textContent=title;w.appendChild(hh);
      for(const [tx,v] of opts){const b=document.createElement("button");b.type="button";b.textContent=tx;b.setAttribute("aria-pressed",String(l[key]===v));
        b.onclick=()=>{setTrayLabelAt(trayLabelSel,key,v);buildTrayForm();if(typeof renderOut==="function")renderOut();};w.appendChild(b);}
      if(note){const p=document.createElement("p");p.className="hint";p.style.cssText="width:100%;padding:2px 0 0";p.textContent=note;w.appendChild(p);}
      sub.appendChild(w);};
    seg("入れる場所","where",[["蓋の上","lid"],["トレーの底（内側）","floor"]],l.where==="lid"?"蓋の天面に入れます（窓と重ならない場所に置いてください）。":"トレーの底に入れます。キーキャップの下は見えないので、キーのない場所に置いてください。");
    seg("仕上げ","style",[["彫り込み","engrave"],["2色（はめ込み）","inlay"]],l.style==="engrave"?"深さ"+fmt(TL_DEPTH)+"mmで彫り込みます。":"彫り込んだ部分を別のフィラメントのパーツで埋めます（3MFで2色印刷。フィラメントは割り当て表の「名前」）。"+(l.where==="lid"?"蓋は天面を下にして印刷するので、名前は最初の数層に入ります。":""));
    seg("装飾","deco",TL_DECOS.map(([k,t])=>[t,k]),l.deco==="none"?"名前を枠で囲んだり、下線や飾りを付けたりできます。":l.deco==="plate"?"名前のまわりを板のように塗りつぶし、文字を抜きます（2色にすると板の部分が別の色になります）。":"装飾も名前と同じ仕上げ（"+(l.style==="inlay"?"2色":"彫り込み")+"）で入ります。");
    if(!["none","plate"].includes(l.deco))seg("線の太さ","decoW",[["細い","thin"],["標準","std"],["太い","bold"]]);
    const g=document.createElement("div");g.className="km-exgrid";
    const zl=document.createElement("label");zl.textContent="文字の大きさ（mm）";const zi=document.createElement("input");zi.type="number";zi.min=2;zi.max=30;zi.step=0.5;zi.inputMode="decimal";zi.value=fmt(l.size);
    zi.onchange=()=>{let v=parseFloat(zi.value);if(isNaN(v))v=l.size;v=Math.min(30,Math.max(2,v));zi.value=fmt(v);setTrayLabelAt(trayLabelSel,"size",v);drawTrayMapSoon();};zl.appendChild(zi);g.appendChild(zl);sub.appendChild(g);
    const bt=document.createElement("div");bt.className="km-btns";
    const b=(tx,fn)=>{const x=document.createElement("button");x.type="button";x.className="ghost";x.textContent=tx;x.onclick=fn;bt.appendChild(x);};
    b("初めの位置に戻す",()=>{const a=trayLabelsAll();a[trayLabelSel]={...a[trayLabelSel],x:null,y:null};setTrayLabels(a);drawTrayMapSoon();});
    b("↺ 90°",()=>{setTrayLabelAt(trayLabelSel,"rot",(l.rot+90)%360);drawTrayMapSoon();});
    b("↻ 90°",()=>{setTrayLabelAt(trayLabelSel,"rot",(l.rot+270)%360);drawTrayMapSoon();});
    sub.appendChild(bt);sec.appendChild(sub);
  }
  const pd=document.createElement("label");pd.className="km-lname";pd.style.padding="6px 0 2px";const pc=document.createElement("input");pc.type="checkbox";pc.checked=trayLabelPad();
  pc.onchange=()=>{setTray("labelPad",pc.checked);drawTrayMapSoon();};pd.appendChild(pc);pd.appendChild(document.createTextNode(" 名前用の余白をキーの手前に足す（トレーが少し大きくなります）"));sec.appendChild(pd);
  // placement map: drag a name to move it (it becomes the selected one)
  const wrap=document.createElement("div");wrap.className="km-mapwrap";const cv=document.createElement("canvas");cv.id="tray-map";cv.className="art-map";
  cv.setAttribute("aria-label","名前の位置。名前をドラッグで動かせます");wrap.appendChild(cv);sec.appendChild(wrap);
  const cp=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  cv.addEventListener("pointerdown",e=>{const v=trayMapView;if(!v)return;const p=cp(e),X=(p[0]-v.ox)/v.sc,Y=-(p[1]-v.oy)/v.sc;
    let hit=v.boxes.find(bx=>X>=bx.a-1&&X<=bx.c+1&&Y>=bx.b-1&&Y<=bx.d+1);if(!hit)hit=v.boxes.find(bx=>bx.idx===trayLabelSel);if(!hit)return;
    if(hit.idx!==trayLabelSel){trayLabelSel=hit.idx;}
    trayMapDrag={p,x:hit.x,y:hit.y,idx:hit.idx,moved:false};try{cv.setPointerCapture(e.pointerId);}catch(_){}});
  cv.addEventListener("pointermove",e=>{if(!trayMapDrag)return;const p=cp(e),v=trayMapView,dx=(p[0]-trayMapDrag.p[0])/v.sc,dy=-(p[1]-trayMapDrag.p[1])/v.sc;
    if(Math.hypot(dx,dy)*v.sc>2)trayMapDrag.moved=true;if(!trayMapDrag.moved)return;
    const a=trayLabelsAll();a[trayMapDrag.idx]={...a[trayMapDrag.idx],x:Math.round((trayMapDrag.x+dx)*10)/10,y:Math.round((trayMapDrag.y+dy)*10)/10};
    EXP.tray={...trayCfg(),labelsOn:trayLabelsOn(),labelPad:trayLabelPad(),labels:a,label:undefined};drawTrayMap();});
  const end=()=>{const d=trayMapDrag;trayMapDrag=null;if(!d)return;if(d.moved){saveWs();trayDirty();}buildTrayForm();};
  cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);
  const st=document.createElement("p");st.className="hint";st.id="tray-labst";st.style.padding="2px 0 6px";sec.appendChild(st);
  box.appendChild(sec);drawTrayMapSoon();
}
function drawTrayMapSoon(){trayPrepare().then(()=>{drawTrayMap();if(typeof drawTrayArtMap==="function")drawTrayArtMap();drawTrayWinMap();}).catch(e=>console.error(e));}
// shared by the name and art maps: fit the trays (lids) into a canvas
function trayMapFit(cv,frames){
  const g=cv.getContext("2d"),Wc=cv.clientWidth||340,Hc=Math.max(150,Math.min(300,Wc*0.45)),dpr=window.devicePixelRatio||1;
  cv.style.height=Hc+"px";cv.width=Wc*dpr;cv.height=Hc*dpr;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,Wc,Hc);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const f of frames){x0=Math.min(x0,f.cx-f.lidW/2);x1=Math.max(x1,f.cx+f.lidW/2);y0=Math.min(y0,f.cy-f.lidH/2);y1=Math.max(y1,f.cy+f.lidH/2);}
  const pad=16,sc=Math.min((Wc-2*pad)/(x1-x0),(Hc-2*pad)/(y1-y0)),ox=Wc/2-(x0+x1)/2*sc,oy=Hc/2+(y0+y1)/2*sc;
  return{g,sc,ox,oy,X:x=>ox+x*sc,Y:y=>oy-y*sc};
}
function trayMapSurface(m,frames,where){
  const {g,X,Y}=m,line=css("--line");
  const poly=(pts,fill,stroke)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=1;g.stroke();}};
  for(const f of frames){poly(rrectPts(f.lidW,f.lidH,4,f.cx,f.lidCy,6),css("--panel"),line);poly(rrectPts(f.cw,f.ch,2,f.cx,f.cy,6),where==="floor"?css("--bg"):null,line);}
  return poly;
}
function trayMapSurfaceTop(m,frames,where,poly){const lid=where==="lid"&&trayCfg().style!=="solid";for(const f of frames)for(const k of (lid?f.wins:f.keys))poly(k,css("--stage"),css("--line"));}
function drawTrayMap(){
  const cv=document.getElementById("tray-map");if(!cv||!trayReady())return;
  const frames=trayFrames(),labs=trayLabelsPlaced(frames),m=trayMapFit(cv,frames),{g,sc,ox,oy,X,Y}=m;
  const all=trayLabelsAll(),sel=all[trayLabelSel],where=sel?sel.where:"lid";
  const poly=trayMapSurface(m,frames,where);trayMapSurfaceTop(m,frames,where,poly);
  const ink=css("--ink"),acc=css("--accent"),errc=css("--err")||"#B3261E",muted=css("--muted");
  const errs={};labs.forEach(l=>{const k=trayLabelOwner(frames,l);errs[l.idx]=k<0?"トレーの外にあります":trayLabelCheck(frames[k],l,labs.filter(o=>trayLabelOwner(frames,o)===k));});
  const boxes=[];
  for(const lab of labs){const err=errs[lab.idx],isSel=lab.idx===trayLabelSel;
    g.beginPath();for(const s of lab.shapes)for(const lp of [s.outer,...s.holes]){lp.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();}
    g.globalAlpha=lab.l.where===where?1:0.45;g.fillStyle=err?errc:ink;g.fill("evenodd");g.globalAlpha=1;
    let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const s of lab.shapes)for(const p of s.outer){a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]);}
    boxes.push({idx:lab.idx,a,b,c,d,x:lab.x,y:lab.y});
    g.setLineDash(isSel?[4,3]:[2,3]);g.strokeStyle=err?errc:isSel?acc:muted;g.lineWidth=isSel?1.4:1;g.strokeRect(X(a)-3,Y(d)-3,(c-a)*sc+6,(d-b)*sc+6);g.setLineDash([]);
    g.fillStyle=err?errc:isSel?acc:muted;g.font="600 11px 'IBM Plex Sans JP',system-ui,sans-serif";g.textBaseline="bottom";g.fillText(String(lab.idx+1),X(a)-3,Y(d)-5);}
  trayMapView={sc,ox,oy,boxes};
  const st=document.getElementById("tray-labst");if(!st)return;
  const bad=labs.filter(l=>errs[l.idx]);
  st.textContent=bad.length?bad.map(l=>(l.idx+1)+"つ目「"+l.l.text+"」：入れられません（"+errs[l.idx]+"）").join(" ／ ")+"。ドラッグで場所を動かすか、文字を小さくしてください。":
    labs.length?"名前をドラッグで動かせます。番号の付いた点線の枠が名前です（選んだ名前と同じ場所の名前は濃く表示）。"+(where==="lid"?"灰色の四角は蓋の窓です。":"灰色の四角はキーキャップの位置です。"):"名前を入力してください。";
  st.style.color=bad.length?errc:"";
}
window.addEventListener("resize",()=>{if(document.getElementById("tray-map"))drawTrayMap();});

// ---------- SVG art on the lid or the tray floor (the same groups and colour layers as 天面アート) ----------
let trayArtView=null,trayArtDrag=null;
function trayArtRef(){
  let a=EXP.tray&&EXP.tray.art;
  if(!a||!a._n){const o=a&&typeof a==="object"?a:{};a={_n:true,on:!!o.on,where:o.where==="floor"?"floor":"lid",
      groups:(Array.isArray(o.groups)?o.groups:[]).filter(g=>g&&typeof g==="object").map((g,i)=>artNormGroup(g,i)),cur:0};
    EXP.tray={...trayCfg(),art:a};}
  a.cur=Math.min(Math.max(0,a.cur|0),Math.max(0,a.groups.length-1));
  return a;
}
function trayArtGroup(){const a=trayArtRef();return a.groups[a.cur]||null;}
function trayArtLayers(){const a=trayArtRef();return [].concat(...a.groups.filter(g=>!g.hidden).map(g=>g.layers.filter(l=>!l.hidden)));}
function trayArtActive(){const a=trayArtRef();return a.on&&trayArtLayers().length>0;}
function trayArtApply(rebuildForm){saveWs();trayDirty();if(rebuildForm)buildTrayForm();else drawTrayArtMap();if(typeof renderOut==="function"&&rebuildForm)renderOut();}
async function trayArtPrepare(){
  const a=trayArtRef();if(!a.groups.length)return;
  const ls=[].concat(...a.groups.map(g=>g.layers));
  await Promise.all(ls.map(l=>artRaster(l,ART_LO,artLo).catch(()=>null)));
  if(a.on)await Promise.all(trayArtLayers().map(l=>artRaster(l,ART_HI,artHi).catch(()=>null)));
}
// the picture on one surface of a tray: {union, layers:[{layer, shapes}]} (world mm), kept clear of windows / keys and names
function trayArtShapes(F,where,labs,L){
  const A=trayArtRef();if(!A.on||A.where!==where)return null;
  const items=[];for(const g of A.groups){if(g.hidden)continue;const X=artXf(g);for(const l of g.layers){if(l.hidden)continue;const r=artHi.get(l.id);if(r)items.push({l,X,r});}}
  if(!items.length)return null;
  const lid=where==="lid",cx=F.cx,cy=lid?F.lidCy:F.cy,w=lid?F.lidW-2.4:F.cw-2,h=lid?F.lidH-2.4:F.ch-2,PXL=8,W=Math.ceil(w*PXL)+4,H=Math.ceil(h*PXL)+4;
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;const g=cv.getContext("2d");
  const tx=x=>(x-cx)*PXL+W/2+0.5,ty=y=>H/2-(y-cy)*PXL-0.5;
  g.fillStyle="#000";g.fillRect(0,0,W,H);g.globalCompositeOperation="destination-out";g.beginPath();g.roundRect(tx(cx-w/2),ty(cy+h/2),w*PXL,h*PXL,(lid?3:1.5)*PXL);g.fill();g.globalCompositeOperation="source-over";
  const path=polys=>{g.beginPath();for(const l of polys){l.forEach((p,i)=>i?g.lineTo(tx(p[0]),ty(p[1])):g.moveTo(tx(p[0]),ty(p[1])));g.closePath();}};
  g.lineJoin="round";g.strokeStyle="#000";
  path(lid?F.wins:F.keys);g.fill();g.lineWidth=1.2*PXL;g.stroke();
  for(const lb of labs){path(lb.shapes.map(s=>s.outer));g.fill();g.lineWidth=1.0*PXL;g.stroke();}
  const mask=g.getImageData(0,0,W,H).data,owner=new Int8Array(W*H).fill(-1);let any=false;
  for(let r=0;r<H;r++){const y=cy+(H-1-r-H/2)/PXL,Y=L.cy-y;
    for(let i=0;i<W;i++){const o=r*W+i;if(mask[o*4+3]>0)continue;const X=cx+(i-W/2)/PXL+L.cx;let last=null,u=0,v=0;
      for(let k=0;k<items.length;k++){const it=items[k];if(it.X!==last){[u,v]=toArt(X,Y,it.X);last=it.X;}if(sampleInk(it.r,u,v)>=128){owner[o]=k;any=true;break;}}}}
  if(!any)return null;
  const trace=val=>{const loops=LEG.contours(val,W,H).map(l=>LEG.rdpClosed(l.map(([x,y])=>[cx+(x-W/2)/PXL,cy+(y-H/2)/PXL]),0.04)).filter(l=>l.length>=3);
    return LEG.group(loops,0.05);};
  const uval=new Float32Array(W*H);for(let o=0;o<W*H;o++)uval[o]=owner[o]>=0?1:0;
  const layers=[];items.forEach(({l},k)=>{const val=new Float32Array(W*H);let n=0;for(let o=0;o<W*H;o++)if(owner[o]===k){val[o]=1;n++;}if(n){const sh=trace(val);if(sh.length)layers.push({layer:l,shapes:sh});}});
  return{union:trace(uval),layers};
}
function trayArtUsedExts(){return new Set([EXP.trayExt||1,EXP.lidExt||1,EXP.winExt||3,trayLabelExt(),traySpecExt(),EXP.bodyExt,...trayArtLayers().map(l=>l.ext)]);}
async function trayArtAddSvgs(files){
  const a=trayArtRef();let g=trayArtGroup();if(!g){g=artNormGroup({name:"グループ1"},0);a.groups.unshift(g);a.cur=0;}
  const wasEmpty=!g.layers.length,used=trayArtUsedExts(),bad=[];let n=0;
  for(const f of files){try{let t=await f.text();t=t.replace(/<\?xml[^>]*>/g,"").replace(/<!--[\s\S]*?-->/g,"").replace(/<metadata[\s\S]*?<\/metadata>/gi,"").replace(/>\s+</g,"><").trim();
      if(t.length>1500000)throw new Error("大きすぎます（1.5MBまで）");LEG.svgPrepare(t);await LEG.svgThumb(t,32);
      const col=await svgMainColor(t).catch(()=>null);g.layers.push(artNormLayer({name:f.name.replace(/\.svg$/i,"").slice(0,30)||"アート",svg:t,mode:"all",ext:artPickExt(col,used)}));n++;}
    catch(e){bad.push(f.name+"（"+(e&&e.message||"読めません")+"）");}}
  if(n){a.on=true;if(wasEmpty)trayArtFit(g);setCols();}
  trayArtApply(true);return{n,bad};
}
async function trayArtAddSample(sm){
  const a=trayArtRef();let g=trayArtGroup();if(!g||g.layers.length){g=artNormGroup({name:sm.name},a.groups.length);a.groups.unshift(g);a.cur=0;}
  const used=trayArtUsedExts();
  for(const l of sm.layers){const col=await svgMainColor(l.svg).catch(()=>null);g.layers.push(artNormLayer({name:l.name,svg:l.svg,mode:l.mode,ext:artPickExt(col,used)}));}
  trayArtFit(g,sm.fit==="small"?0.25:0.8);a.on=true;setCols();trayArtApply(true);
}
// fit a group on the first tray's surface (share of its width), centred
function trayArtFit(g,share){const f=trayFrames()[0];if(!f)return;const vb=artUnion(g),a=trayArtRef(),lid=a.where==="lid",w=(lid?f.lidW:f.cw)*(share||0.8),h=(lid?f.lidH:f.ch)*(share||0.8);
  g.width=Math.max(5,Math.round(Math.min(w,h*vb[2]/vb[3])*10)/10);g.height=Math.round(g.width*vb[3]/vb[2]*10)/10;g.cx=f.cx;g.cy=-(lid?f.lidCy:f.cy);g.rot=0;}
function buildTrayArtForm(box){
  const a=trayArtRef(),sec=document.createElement("div");sec.className="tray-art";
  const h=document.createElement("div");h.className="km-edhead";h.style.cssText="padding:12px 0 2px;border-top:1px solid var(--line)";h.textContent="アート（SVG）";sec.appendChild(h);
  const ol=document.createElement("label");ol.className="km-lname";ol.style.padding="4px 0";const cb=document.createElement("input");cb.type="checkbox";cb.checked=a.on;
  cb.onchange=()=>{a.on=cb.checked;trayArtApply(true);};ol.appendChild(cb);ol.appendChild(document.createTextNode(" 蓋またはトレーにアートを入れる"));sec.appendChild(ol);
  if(!a.on){box.appendChild(sec);return;}
  const hint=document.createElement("p");hint.className="hint";hint.style.padding="0 0 4px";
  hint.textContent="天面アートと同じように、色ごとに分けたSVGをグループにまとめて置けます。SVGごとのフィラメントで、彫り込んだ部分を埋める2色（多色）印刷になります。窓・キーキャップの位置・名前とは重ならないように切り抜きます。";sec.appendChild(hint);
  const sw=document.createElement("div");sw.className="seg";const sh=document.createElement("div");sh.className="seghead";sh.textContent="入れる場所";sw.appendChild(sh);
  [["蓋の上","lid"],["トレーの底（内側）","floor"]].forEach(([t,v])=>{const b=document.createElement("button");b.type="button";b.textContent=t;b.setAttribute("aria-pressed",String(a.where===v));b.onclick=()=>{a.where=v;trayArtApply(true);};sw.appendChild(b);});
  sec.appendChild(sw);
  // map
  const wrap=document.createElement("div");wrap.className="km-mapwrap";const cv=document.createElement("canvas");cv.id="tray-artmap";cv.className="art-map";
  cv.setAttribute("aria-label","アートの配置。絵をクリックでグループを選択、ドラッグで移動、角で拡大縮小");wrap.appendChild(cv);sec.appendChild(wrap);
  const cp=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  cv.addEventListener("pointerdown",e=>{const v=trayArtView;if(!v)return;const p=cp(e);
    if(v.corners&&v.corners.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<=(e.pointerType==="touch"?20:11))){const g=trayArtGroup();trayArtDrag={mode:"scale",d0:Math.max(1,Math.hypot(p[0]-v.C[0],p[1]-v.C[1])),w:g.width,h:artSize(g).h};}
    else{const gi=trayArtGroupAt(p);if(gi<0)return;a.cur=gi;const g=trayArtGroup();trayArtDrag={mode:"move",p,cx:g.cx,cy:g.cy};drawTrayArtMap();renderTrayArtPanel();}
    trayArtDrag.moved=false;try{cv.setPointerCapture(e.pointerId);}catch(_){}});
  cv.addEventListener("pointermove",e=>{const d=trayArtDrag,v=trayArtView;if(!d||!v)return;const p=cp(e),g=trayArtGroup();if(!g)return;d.moved=true;
    if(d.mode==="scale"){const f=Math.hypot(p[0]-v.C[0],p[1]-v.C[1])/d.d0;g.width=Math.min(600,Math.max(5,Math.round(d.w*f*2)/2));if(g.lock===false)g.height=Math.min(600,Math.max(5,Math.round(d.h*f*2)/2));}
    else{g.cx=Math.round((d.cx+(p[0]-d.p[0])/v.sc)*10)/10;g.cy=Math.round((d.cy+(p[1]-d.p[1])/v.sc)*10)/10;}
    syncTrayArtNums();drawTrayArtMap();});
  const end=()=>{const d=trayArtDrag;trayArtDrag=null;if(d&&d.moved)trayArtApply(false);};
  cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);
  const gb=document.createElement("div");gb.id="tray-art-panel";sec.appendChild(gb);
  box.appendChild(sec);renderTrayArtPanel();drawTrayMapSoon();
}
let trayArtNums={};
function syncTrayArtNums(){const g=trayArtGroup();for(const k in trayArtNums)if(trayArtNums[k].isConnected)trayArtNums[k].value=g?fmt(k==="height"?Math.round(artSize(g).h*10)/10:g[k]):"";}
function renderTrayArtPanel(){
  const box=document.getElementById("tray-art-panel");if(!box)return;box.innerHTML="";trayArtNums={};const a=trayArtRef(),g=trayArtGroup();
  // groups
  const row=document.createElement("div");row.className="km-btns art-groups";
  a.groups.forEach((q,i)=>{const b=document.createElement("button");b.type="button";b.textContent=q.name+(q.layers.length?"":"（空）");b.setAttribute("aria-pressed",String(i===a.cur));b.onclick=()=>{a.cur=i;renderTrayArtPanel();drawTrayArtMap();};row.appendChild(b);});
  const nb=document.createElement("button");nb.type="button";nb.className="ghost";nb.textContent="＋ 新しいグループ";nb.onclick=()=>{a.groups.unshift(artNormGroup({name:"グループ"+(a.groups.length+1)},a.groups.length));a.cur=0;saveWs();renderTrayArtPanel();drawTrayArtMap();};row.appendChild(nb);
  box.appendChild(row);
  const fi=document.createElement("input");fi.type="file";fi.accept=".svg,image/svg+xml";fi.multiple=true;fi.hidden=true;box.appendChild(fi);
  const note=document.createElement("p");note.className="hint";note.id="tray-art-note";
  fi.onchange=async()=>{const fs=[...(fi.files||[])];fi.value="";const r=await trayArtAddSvgs(fs);const nn=document.getElementById("tray-art-note");if(nn)nn.textContent=(r.n?r.n+"個のSVGを追加しました。":"")+(r.bad.length?" 追加できなかったファイル: "+r.bad.join("、"):"");};
  const ar=document.createElement("div");ar.className="km-btns";const ab=document.createElement("button");ab.type="button";ab.textContent=g&&g.layers.length?"このグループにSVGを追加…":"SVGを追加…";ab.onclick=()=>fi.click();ar.appendChild(ab);
  if(typeof ART_SAMPLES!=="undefined"){const sel=document.createElement("select");sel.setAttribute("aria-label","サンプルの絵・図形から追加");const o0=document.createElement("option");o0.value="";o0.textContent="サンプルから追加…";sel.appendChild(o0);
    ART_SAMPLES.forEach((sm,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=sm.name+"（"+sm.layers.length+"色）";sel.appendChild(o);});
    sel.onchange=()=>{const i=parseInt(sel.value,10);if(!isNaN(i))trayArtAddSample(ART_SAMPLES[i]);};ar.appendChild(sel);}
  box.appendChild(ar);
  if(!g){box.appendChild(note);return;}
  // the selected group: placement numbers and its SVGs
  const ng=document.createElement("div");ng.className="km-exgrid";ng.style.marginTop="6px";
  const num=(label,key,min,max,step)=>{const l=document.createElement("label");l.textContent=label;const i=document.createElement("input");i.type="number";i.min=min;i.max=max;i.step=step;i.inputMode="decimal";
    i.onchange=()=>{let v=parseFloat(i.value);if(isNaN(v))v=g[key];v=Math.min(max,Math.max(min,v));g[key]=v;i.value=fmt(v);trayArtApply(false);};l.appendChild(i);ng.appendChild(l);trayArtNums[key]=i;};
  num("幅（mm）","width",5,600,0.5);num("回転（度）","rot",-180,180,1);box.appendChild(ng);syncTrayArtNums();
  const bt=document.createElement("div");bt.className="km-btns";const b=(t,fn,cls)=>{const x=document.createElement("button");x.type="button";x.textContent=t;x.className=cls||"ghost";x.onclick=fn;bt.appendChild(x);};
  b("↺ 15°",()=>{g.rot=normDeg(g.rot-15);syncTrayArtNums();trayArtApply(false);});b("↻ 15°",()=>{g.rot=normDeg(g.rot+15);syncTrayArtNums();trayArtApply(false);});
  b("全体に合わせる",()=>{trayArtFit(g,0.95);syncTrayArtNums();trayArtApply(false);});
  b("グループを削除",()=>{a.groups.splice(a.cur,1);a.cur=0;trayArtApply(true);},"ghost danger");
  box.appendChild(bt);
  const list=document.createElement("div");list.className="km-svglist";
  g.layers.forEach((l,li)=>{const r=document.createElement("div");r.className="km-svgrow art-row";
    const th=document.createElement("div");th.className="km-svgthumb";LEG.svgThumb(l.svg,64).then(im=>{im.alt="";th.appendChild(im);}).catch(()=>{th.textContent="?";});
    const nm=document.createElement("input");nm.value=l.name;nm.maxLength=30;nm.setAttribute("aria-label","SVGの名前");nm.onchange=()=>{l.name=nm.value.trim()||l.name;nm.value=l.name;saveWs();};
    const ctl=document.createElement("div");ctl.className="art-ctl";const del=document.createElement("button");del.type="button";del.className="danger";del.textContent="削除";del.onclick=()=>{g.layers.splice(li,1);trayArtApply(true);};ctl.appendChild(del);
    const opt=document.createElement("div");opt.className="art-opt";const ex=document.createElement("label");ex.className="art-ext";
    const swc=document.createElement("input");swc.type="color";swc.className="art-color";swc.value=filColor(l.ext).toLowerCase();swc.setAttribute("aria-label","フィラメント"+l.ext+"の色");swc.oninput=()=>{setFilColor(l.ext,swc.value);drawTrayArtMap();};
    ex.appendChild(swc);ex.appendChild(document.createTextNode("フィラメント"));const es=document.createElement("select");for(let k=1;k<=16;k++){const o=document.createElement("option");o.value=k;o.textContent=String(k);es.appendChild(o);}
    es.value=String(l.ext);es.onchange=()=>{l.ext=parseInt(es.value,10);setCols();trayArtApply(true);};ex.appendChild(es);opt.appendChild(ex);
    const vis=document.createElement("label");vis.className="art-vis";const vc=document.createElement("input");vc.type="checkbox";vc.checked=!l.hidden;vc.onchange=()=>{l.hidden=!vc.checked;trayArtApply(false);};vis.appendChild(vc);vis.appendChild(document.createTextNode("表示"));opt.appendChild(vis);
    r.appendChild(th);r.appendChild(nm);r.appendChild(ctl);r.appendChild(opt);list.appendChild(r);});
  box.appendChild(list);box.appendChild(note);
}
function trayArtGroupAt(p){const v=trayArtView,a=trayArtRef();if(!v)return -1;const L=layoutBox();
  for(let i=0;i<a.groups.length;i++){const g=a.groups[i];if(g.hidden||!g.layers.length)continue;const X=artXf(g);
    const lx=(p[0]-v.ox)/v.sc+L.cx,ly=L.cy-(v.oy-p[1])/v.sc,dx=lx-X.ax,dy=ly-X.ay;
    if(Math.abs(dx*X.c+dy*X.s)<=X.vb[2]*X.sx/2&&Math.abs(-dx*X.s+dy*X.c)<=X.vb[3]*X.sy/2)return i;}
  return -1;}
function drawTrayArtMap(){
  const cv=document.getElementById("tray-artmap");if(!cv||!trayReady())return;
  const a=trayArtRef(),frames=trayFrames(),m=trayMapFit(cv,frames),{g,sc,ox,oy,X,Y}=m,L=layoutBox();
  const poly=trayMapSurface(m,frames,a.where);
  const shown=a.groups.filter(q=>!q.hidden&&q.layers.length);
  const drawGroup=q=>{const Xf=artXf(q);for(let k=q.layers.length-1;k>=0;k--){const l=q.layers[k];if(l.hidden)continue;const t=artTintCanvas(l);if(!t)continue;let vb;try{vb=artVB(l);}catch(_){continue;}
    g.save();g.translate(ox+(Xf.ax-L.cx)*sc,oy-(L.cy-Xf.ay)*sc);g.rotate(Xf.t);g.drawImage(t,(vb[0]-Xf.ucx)*Xf.sx*sc,(vb[1]-Xf.vcy)*Xf.sy*sc,vb[2]*Xf.sx*sc,vb[3]*Xf.sy*sc);g.restore();}};
  g.globalAlpha=0.3;for(let i=shown.length-1;i>=0;i--)drawGroup(shown[i]);g.globalAlpha=1;
  g.save();g.beginPath();for(const f of frames){const r=a.where==="lid"?rrectPts(f.lidW-2.4,f.lidH-2.4,3,f.cx,f.lidCy,6):rrectPts(f.cw-2,f.ch-2,1.5,f.cx,f.cy,6);r.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();}
  g.clip();for(let i=shown.length-1;i>=0;i--)drawGroup(shown[i]);g.restore();
  trayMapSurfaceTop(m,frames,a.where,poly);
  // names on the same surface
  for(const lb of trayLabelsPlaced(frames)){if(lb.l.where!==a.where)continue;g.beginPath();for(const s of lb.shapes)for(const lp of [s.outer,...s.holes]){lp.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();}g.fillStyle=css("--ink");g.fill("evenodd");}
  trayArtView={sc,ox,oy,corners:null,C:null};
  const cur=trayArtGroup(),acc=css("--accent");
  if(cur&&!cur.hidden&&cur.layers.length){const Xf=artXf(cur),hw=Xf.vb[2]*Xf.sx*sc/2,hh=Xf.vb[3]*Xf.sy*sc/2,C=[ox+(Xf.ax-L.cx)*sc,oy-(L.cy-Xf.ay)*sc];
    g.save();g.translate(C[0],C[1]);g.rotate(Xf.t);g.setLineDash([5,4]);g.strokeStyle=acc;g.lineWidth=1.2;g.strokeRect(-hw,-hh,2*hw,2*hh);g.setLineDash([]);
    g.fillStyle=css("--panel");for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){g.fillRect(sx*hw-5,sy*hh-5,10,10);g.strokeRect(sx*hw-5,sy*hh-5,10,10);}g.restore();
    const rp=(lx,ly)=>[C[0]+lx*Math.cos(Xf.t)-ly*Math.sin(Xf.t),C[1]+lx*Math.sin(Xf.t)+ly*Math.cos(Xf.t)];
    trayArtView.C=C;trayArtView.corners=[rp(-hw,-hh),rp(hw,-hh),rp(hw,hh),rp(-hw,hh)];}
}
window.addEventListener("resize",()=>{if(document.getElementById("tray-artmap"))drawTrayArtMap();});

// ---------- spare keycaps: form and grid map ----------
let spareView=null,spareDrag=null,spareHover=null;
function buildTraySpareForm(box){
  const sec=document.createElement("div");sec.className="tray-spares";
  const h=document.createElement("div");h.className="km-edhead";h.style.cssText="padding:12px 0 2px;border-top:1px solid var(--line)";h.textContent="予備のキーキャップ";sec.appendChild(h);
  const p=document.createElement("p");p.className="hint";p.style.padding="2px 0 6px";
  p.textContent="空いているマスをクリックすると、予備のキーキャップ用の場所（突起と窓）を追加します。もう一度クリックで削除、ドラッグで移動できます。キーと重ならないよう、キーピッチ（"+fmt(P.pitch)+"mm）の格子に沿って置きます。キーの外に置くと、トレーがその分大きくなります。";sec.appendChild(p);
  const wrap=document.createElement("div");wrap.className="km-mapwrap";const cv=document.createElement("canvas");cv.id="tray-sparemap";cv.className="art-map";
  cv.setAttribute("aria-label","予備のキーキャップの配置。クリックで追加・削除、ドラッグで移動");wrap.appendChild(cv);sec.appendChild(wrap);
  const cell=e=>{if(!spareView)return null;const r=cv.getBoundingClientRect(),v=spareView,x=(e.clientX-r.left-v.ox)/v.sc,y=-(e.clientY-r.top-v.oy)/v.sc;
    return[Math.round((x-v.G.ox)/v.G.step),Math.round((y-v.G.oy)/v.G.step)];};
  const same=(a,b)=>a&&b&&a[0]===b[0]&&a[1]===b[1];
  cv.addEventListener("pointerdown",e=>{const c=cell(e);if(!c)return;const sp=traySpares(),i=sp.findIndex(a=>same(a,c));spareDrag={from:i,start:c,at:c,moved:false};try{cv.setPointerCapture(e.pointerId);}catch(_){}});
  cv.addEventListener("pointermove",e=>{const c=cell(e);if(!c)return;
    if(!spareDrag){if(!same(c,spareHover)){spareHover=c;drawSpareMap();}return;}
    if(!same(c,spareDrag.at)){spareDrag.at=c;spareDrag.moved=true;spareHover=c;drawSpareMap();}});
  cv.addEventListener("pointerleave",()=>{if(!spareDrag){spareHover=null;drawSpareMap();}});
  const end=()=>{const d=spareDrag;spareDrag=null;if(!d)return;const sp=traySpares();
    if(d.from>=0&&!d.moved)sp.splice(d.from,1);                                         // click on a spare: remove
    else if(d.from>=0){if(spareCellFree(d.at,d.from))sp[d.from]=d.at;}                    // drag: move when the cell is free
    else if(!d.moved&&spareCellFree(d.at,-1))sp.push(d.at);                              // click on an empty cell: add
    setTray("spares",sp);drawSpareMap();};
  cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",()=>{spareDrag=null;drawSpareMap();});
  const bt=document.createElement("div");bt.className="km-btns";
  const b=(t,fn)=>{const x=document.createElement("button");x.type="button";x.className="ghost";x.textContent=t;x.onclick=fn;bt.appendChild(x);};
  b("手前に1列並べる",()=>{const sp=traySpares(),G=trayGrid(),L=layoutBox(),foot=trayKeyFoot(L);let xs=[],x0=Infinity,x1=-Infinity;
    foot.forEach(k=>k.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);}));
    const row=Math.min(-1,...sp.map(a=>a[1]-1));for(let i=Math.ceil((x0+G.step/2-G.ox)/G.step);G.ox+i*G.step<=x1-G.step/2+0.01;i++)xs.push(i);
    const free=xs.filter(i=>spareCellFree([i,row],-1,sp));setTray("spares",sp.concat(free.map(i=>[i,row])));drawSpareMap();});
  b("すべて消す",()=>{setTray("spares",[]);drawSpareMap();});
  sec.appendChild(bt);
  const st=document.createElement("p");st.className="hint";st.id="tray-sparest";st.style.padding="2px 0 6px";sec.appendChild(st);
  box.appendChild(sec);drawSpareMap();
}
function spareCellFree(c,self,list){const sp=list||traySpares();if(sp.some((a,i)=>i!==self&&a[0]===c[0]&&a[1]===c[1]))return false;
  const G=trayGrid(),[x,y]=traySpareXY(c,G);return traySpareFree(x,y,trayKeyFoot(layoutBox()));}
function drawSpareMap(){
  const cv=document.getElementById("tray-sparemap");if(!cv||!KM.keys.length)return;
  const L=layoutBox(),G=trayGrid(L),foot=trayKeyFoot(L),sp=traySpares(),b=derive(P).base;
  const g=cv.getContext("2d"),Wc=cv.clientWidth||340,Hc=Math.max(160,Math.min(320,Wc*0.5)),dpr=window.devicePixelRatio||1;
  cv.style.height=Hc+"px";cv.width=Wc*dpr;cv.height=Hc*dpr;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,Wc,Hc);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;const grow=p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);};
  foot.forEach(k=>k.forEach(grow));sp.forEach(a=>{const [x,y]=traySpareXY(a,G);grow([x-b/2,y-b/2]);grow([x+b/2,y+b/2]);});
  const mg=G.step*1.6;x0-=mg;x1+=mg;y0-=mg;y1+=mg;
  const sc=Math.min((Wc-16)/(x1-x0),(Hc-16)/(y1-y0)),ox=Wc/2-(x0+x1)/2*sc,oy=Hc/2+(y0+y1)/2*sc,X=x=>ox+x*sc,Y=y=>oy-y*sc;
  spareView={sc,ox,oy,G};
  const ink=css("--ink"),line=css("--line"),acc=css("--accent"),errc=css("--err")||"#B3261E",stage=css("--stage");
  const sq=(x,y,fill,stroke,dash)=>{const s=b*sc;g.beginPath();g.roundRect(X(x)-s/2,Y(y)-s/2,s,s,2);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.setLineDash(dash||[]);g.strokeStyle=stroke;g.lineWidth=1.2;g.stroke();g.setLineDash([]);}};
  // the trays as they come out
  for(const f of trayFrames()){const r=rrectPts(f.ow,f.oh,3,f.cx,f.cy,6);g.beginPath();r.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();g.fillStyle=css("--panel");g.fill();g.strokeStyle=line;g.stroke();}
  // free grid cells
  const i0=Math.floor((x0-G.ox)/G.step),i1=Math.ceil((x1-G.ox)/G.step),j0=Math.floor((y0-G.oy)/G.step),j1=Math.ceil((y1-G.oy)/G.step);
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const [x,y]=traySpareXY([i,j],G);if(traySpareFree(x,y,foot))sq(x,y,null,line,[2,3]);}
  // keys
  for(const k of foot){const s=b/(2*trayFootHalf());g.beginPath();const c=k.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]);
    k.forEach((p,i)=>{const q=[c[0]+(p[0]-c[0])*s,c[1]+(p[1]-c[1])*s];i?g.lineTo(X(q[0]),Y(q[1])):g.moveTo(X(q[0]),Y(q[1]));});g.closePath();g.fillStyle=stage;g.fill();g.strokeStyle=line;g.stroke();}
  // spares (the one being dragged at its new cell)
  sp.forEach((a,i)=>{if(spareDrag&&spareDrag.from===i&&spareDrag.moved)return;const [x,y]=traySpareXY(a,G);sq(x,y,acc,null);});
  if(spareDrag&&spareDrag.moved&&spareDrag.from>=0){const [x,y]=traySpareXY(spareDrag.at,G),ok=spareCellFree(spareDrag.at,spareDrag.from);sq(x,y,ok?acc:errc,null);}
  else if(spareHover&&!spareDrag){const [x,y]=traySpareXY(spareHover,G),i=sp.findIndex(a=>a[0]===spareHover[0]&&a[1]===spareHover[1]);
    if(i>=0)sq(x,y,null,errc);else if(spareCellFree(spareHover,-1))sq(x,y,null,acc);}
  const st=document.getElementById("tray-sparest");if(st)st.textContent=sp.length?"予備 "+sp.length+"個。":"予備はありません。";
}
window.addEventListener("resize",()=>{if(document.getElementById("tray-sparemap"))drawSpareMap();});
