// art.js — 天面アート: one picture spread over the tops of many keys
// LAK風キーキャップジェネレータ / MIT License
//
// Several SVGs (colour separations of one picture) share the same SVG origin, are scaled / moved / rotated
// together over the key layout, and each is printed with its own filament. Every key prints the part of the
// picture that falls on its top (the plateau); gaps between keys are simply ignored.

// groups: [{id, name, cx, cy, width, height, lock, rot, hidden, layers:[{id, name, svg, mode:"dark"|"all", ext, hidden}]}]
//   every group is one picture placed on its own: its SVGs share the SVG origin and move / scale / rotate together.
//   The first group is the front-most, and inside a group the first SVG is the front-most.
// cx, cy: centre of the picture relative to the centre of the layout (mm, y down); width (mm, of all SVGs of the group); rot (deg, clockwise)
// lock: keep the aspect ratio of the SVGs (height follows the width); unlocked: height (mm) is its own
// cur: the group being edited
// legend: "legend" = legends win (the art is cut around them) / "art" = keys with art print no legends
// area: "center" = the plateau only / "band" = the outer band too (the step between them stays plain)
const ADEF={on:false,groups:[],cur:0,legend:"legend",area:"center"};
const newArtId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
var ART=artNormalize(null);
let ARTV=1;                                        // bumps on every change (cache key)
const artHi=new Map(),artLo=new Map(),artTint=new Map();
const ART_HI=3000,ART_LO=1024,ART_MARGIN=0.15,ART_AVOID=0.25;
function artGroup(){return ART.groups[ART.cur]||null;}
function artAllLayers(){return [].concat(...ART.groups.map(g=>g.layers));}
function artShownGroups(){return ART.groups.filter(g=>!g.hidden&&g.layers.some(l=>!l.hidden));}
function artShownLayers(){return [].concat(...artShownGroups().map(g=>g.layers.filter(l=>!l.hidden)));}
function artActive(){return ART.on&&artShownGroups().length>0;}
function artGroupOf(l){return ART.groups.find(g=>g.layers.includes(l))||null;}
// name of an SVG for part / file names: "group・svg" when there are several groups
function artLayerLabel(l){const g=artGroupOf(l);return g&&ART.groups.length>1?g.name+"・"+l.name:l.name;}
function artChanged(){ARTV++;shapeCache.clear();}
function artNormLayer(l){return{id:String(l.id||newArtId("a")),name:String(l.name||"アート").slice(0,30),svg:l.svg,mode:l.mode==="dark"?"dark":"all",
  ext:Math.min(16,Math.max(1,parseInt(l.ext,10)||2)),hidden:!!l.hidden};}
function artNormGroup(g,i){
  const o={id:String(g.id||newArtId("g")),name:String(g.name||("グループ"+(i+1))).slice(0,30),hidden:!!g.hidden,
    layers:(Array.isArray(g.layers)?g.layers:[]).filter(l=>l&&typeof l.svg==="string").map(artNormLayer)};
  for(const k of ["cx","cy","width","height","rot"])o[k]=+g[k]||0;
  o.lock=g.lock!==false;
  return o;
}
function artNormalize(a){
  a=a&&typeof a==="object"?a:{};
  let gs=Array.isArray(a.groups)?a.groups:[];
  // saved before groups existed: all SVGs were one picture
  if(!gs.length&&Array.isArray(a.layers)&&a.layers.length)gs=[{name:"グループ1",cx:a.cx,cy:a.cy,width:a.width,rot:a.rot,layers:a.layers}];
  const o={on:!!a.on,legend:a.legend==="art"?"art":"legend",area:a.area==="band"?"band":"center",groups:gs.filter(g=>g&&typeof g==="object").map(artNormGroup)};
  o.cur=Math.min(Math.max(0,parseInt(a.cur,10)||0),Math.max(0,o.groups.length-1));
  return o;
}
// the main colour of an SVG (most used colour of its drawn pixels), "#RRGGBB"
async function svgMainColor(svg){
  const im=await LEG.svgThumb(svg,96),cv=document.createElement("canvas");cv.width=im.width;cv.height=im.height;
  const g=cv.getContext("2d");g.drawImage(im,0,0);const d=g.getImageData(0,0,cv.width,cv.height).data,hist=new Map();
  for(let i=0;i<d.length;i+=4){if(d[i+3]<128)continue;const k=(d[i]>>4)<<8|(d[i+1]>>4)<<4|(d[i+2]>>4);const e=hist.get(k)||[0,0,0,0];e[0]+=d[i];e[1]+=d[i+1];e[2]+=d[i+2];e[3]++;hist.set(k,e);}
  let best=null;for(const e of hist.values())if(!best||e[3]>best[3])best=e;
  if(!best)return null;return "#"+best.slice(0,3).map(v=>Math.round(v/best[3]).toString(16).padStart(2,"0")).join("").toUpperCase();
}
function artVB(l){const {root}=LEG.svgPrepare(l.svg);return root.getAttribute("viewBox").trim().split(/[\s,]+/).map(Number);}
// union of the viewBoxes of a group (SVG user units): the shared frame of its picture
function artUnion(g){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const l of (g||artGroup()||{layers:[]}).layers){try{const v=artVB(l);x0=Math.min(x0,v[0]);y0=Math.min(y0,v[1]);x1=Math.max(x1,v[0]+v[2]);y1=Math.max(y1,v[1]+v[3]);}catch(_){}}
  return isFinite(x0)?[x0,y0,x1-x0,y1-y0]:[0,0,100,100];
}
// ink raster of one layer (0..255), longest side maxPx
async function artRaster(l,maxPx,cache){
  const key=l.id+":"+l.mode+":"+maxPx+":"+l.svg.length;let r=cache.get(l.id);if(r&&r.key===key)return r;
  const {root}=LEG.svgPrepare(l.svg);const vb=root.getAttribute("viewBox").trim().split(/[\s,]+/).map(Number);
  const a=vb[2]/vb[3],w=a>=1?maxPx:Math.max(1,Math.round(maxPx*a)),h=a>=1?Math.max(1,Math.round(maxPx/a)):maxPx;
  const img=await LEG.svgImage(root,w,h);
  const cv=document.createElement("canvas");cv.width=w;cv.height=h;const g=cv.getContext("2d");g.drawImage(img,0,0,w,h);
  const d=g.getImageData(0,0,w,h).data,ink=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++){const al=d[i*4+3];if(l.mode==="all"){ink[i]=al;continue;}
    const lum=(0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2])/255;ink[i]=Math.round(al*(1-lum));}
  r={key,vb,w,h,ink};cache.set(l.id,r);return r;
}
function sampleInk(r,u,v){
  const px=(u-r.vb[0])/r.vb[2]*r.w-0.5,py=(v-r.vb[1])/r.vb[3]*r.h-0.5;
  if(px<-0.5||py<-0.5||px>r.w-0.5||py>r.h-0.5)return 0;
  const x0=Math.max(0,Math.min(r.w-1,Math.floor(px))),y0=Math.max(0,Math.min(r.h-1,Math.floor(py))),x1=Math.min(r.w-1,x0+1),y1=Math.min(r.h-1,y0+1);
  const fx=Math.min(1,Math.max(0,px-x0)),fy=Math.min(1,Math.max(0,py-y0)),I=r.ink,W=r.w;
  return (I[y0*W+x0]*(1-fx)+I[y0*W+x1]*fx)*(1-fy)+(I[y1*W+x0]*(1-fx)+I[y1*W+x1]*fx)*fy;
}
// --- layout geometry (mm, y down) ---
function keyFrame(i){const k=KM.keys[i],q=keyPoly(k),pm=P.pitch,t=(k.r||0)/100*Math.PI/180;
  return{cx:q.reduce((a,p)=>a+p[0],0)/4*pm,cy:q.reduce((a,p)=>a+p[1],0)/4*pm,c:Math.cos(t),s:Math.sin(t),t};}
function layoutBox(){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;const pm=P.pitch;
  for(const k of KM.keys)for(const [x,y] of keyPoly(k)){x0=Math.min(x0,x*pm);y0=Math.min(y0,y*pm);x1=Math.max(x1,x*pm);y1=Math.max(y1,y*pm);}
  return isFinite(x0)?{x0,y0,x1,y1,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2}:{x0:0,y0:0,x1:1,y1:1,w:1,h:1,cx:0,cy:0};}
// layout mm <-> art user units (of one group)
// size of a group's picture (mm): the height follows the width while the aspect ratio is kept
function artSize(g,vb){vb=vb||artUnion(g);const w=g.width>0?g.width:layoutBox().w;return{w,h:g.lock!==false||!(g.height>0)?w*vb[3]/vb[2]:g.height};}
function artXf(g){
  g=g||artGroup();const vb=artUnion(g),L=layoutBox(),{w,h}=artSize(g,vb),sx=w/vb[2],sy=h/vb[3],t=g.rot*Math.PI/180;
  return{vb,sc:sx,sx,sy,ax:L.cx+g.cx,ay:L.cy+g.cy,c:Math.cos(t),s:Math.sin(t),t,ucx:vb[0]+vb[2]/2,vcy:vb[1]+vb[3]/2};
}
function toArt(X,Y,x){const dx=X-x.ax,dy=Y-x.ay;return[(dx*x.c+dy*x.s)/x.sx+x.ucx,(-dx*x.s+dy*x.c)/x.sy+x.vcy];}
// fit a group's picture inside the layout (share < 1: that part of it, centred)
function artFit(g,share){g=g||artGroup();if(!g)return;const vb=artUnion(g),L=layoutBox();
  g.width=Math.max(5,Math.round(Math.min(L.w,L.h*vb[2]/vb[3])*(share||1)*10)/10);g.height=Math.round(g.width*vb[3]/vb[2]*10)/10;g.cx=0;g.cy=0;g.rot=0;}
// scale a group by f (both sides when the aspect ratio is free)
function artScale(g,f){const h=artSize(g).h;g.width=Math.min(600,Math.max(5,Math.round(g.width*f*10)/10));if(g.lock===false)g.height=Math.min(600,Math.max(5,Math.round(h*f*10)/10));}

// trace an ink grid (values 0..1, rows top->bottom) into shapes in key-local mm
function traceGrid(val,W,H,PXL){
  const dedupe=l=>{const o=[];for(const p of l){const q=o[o.length-1];if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>2e-3)o.push(p);}
    while(o.length>3&&Math.hypot(o[0][0]-o[o.length-1][0],o[0][1]-o[o.length-1][1])<=2e-3)o.pop();return o;};
  const loops=LEG.contours(val,W,H).map(l=>dedupe(LEG.rdpClosed(l.map(([x,y])=>[(x-W/2)/PXL,(y-H/2)/PXL]),0.012))).filter(l=>l.length>=3);
  // short edges so the outlines follow the step where they cross it
  const dens=l=>{const o=[];for(let i=0;i<l.length;i++){const a=l[i],b=l[(i+1)%l.length],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/0.2);
    for(let k=0;k<n;k++)o.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return o;};
  return LEG.group(loops,0.01).map(s=>({outer:dens(s.outer),holes:s.holes.map(dens)}));
}
// the picture on the top of key `pos`: {union: shapes (for pockets), layers:[{layer, shapes}]} or null
// avoid: shapes (legends, marks) the picture keeps clear of
async function artShapes(pos,avoid){
  if(!artActive()||!KM.keys[pos])return null;
  const f=keyFrame(pos),D=derive(P),pr=plateauRect(P,D),inArt=artRegion(D,pr);
  // SVGs of the groups that reach this key, front-most first
  const items=[],reach=P.top_size*0.75;
  for(const g of artShownGroups()){const X=artXf(g),dx=f.cx-X.ax,dy=f.cy-X.ay,lx=dx*X.c+dy*X.s,ly=-dx*X.s+dy*X.c;
    if(Math.abs(lx)>X.vb[2]*X.sx/2+reach||Math.abs(ly)>X.vb[3]*X.sy/2+reach)continue;
    for(const l of g.layers)if(!l.hidden)items.push({l,X});}
  if(!items.length)return{union:[],layers:[]};
  const R=await Promise.all(items.map(it=>artRaster(it.l,ART_HI,artHi)));
  const PXL=LEG.PX,W=Math.ceil((ART.area==="band"?P.top_size:pr.size)*PXL)+6,H=W;
  // keep-out mask: legends (grown a little) and the homing bump
  let mask=null;const Q=paramsFor(pos);
  if((avoid&&avoid.length)||Q.homing){
    const cv=document.createElement("canvas");cv.width=W;cv.height=H;const g=cv.getContext("2d");
    const tx=x=>x*PXL+W/2+0.5,ty=y=>H/2-y*PXL-0.5;
    g.fillStyle="#000";g.strokeStyle="#000";g.lineJoin="round";g.lineCap="round";
    if(avoid&&avoid.length){g.beginPath();for(const s of avoid)for(const l of [s.outer,...s.holes]){l.forEach((p,i)=>i?g.lineTo(tx(p[0]),ty(p[1])):g.moveTo(tx(p[0]),ty(p[1])));g.closePath();}
      g.fill("evenodd");g.lineWidth=2*ART_AVOID*PXL;g.stroke();}
    if(Q.homing){const S=homingSpec(Q),L=Math.max(0,S.len-S.w);g.lineWidth=(S.w+0.6)*PXL;g.beginPath();
      g.moveTo(tx(S.x-L/2),ty(S.y));g.lineTo(tx(S.x+L/2+1e-3),ty(S.y));g.stroke();}
    mask=g.getImageData(0,0,W,H).data;
  }
  const owner=new Int8Array(W*H).fill(-1);let any=false;
  for(let r=0;r<H;r++){const ly=(H-1-r-H/2)/PXL;
    for(let i=0;i<W;i++){const lx=(i-W/2)/PXL,o=r*W+i;
      if(!inArt(lx,ly))continue;
      if(mask&&mask[o*4+3]>0)continue;
      const WX=f.cx+lx*f.c+ly*f.s,WY=f.cy+lx*f.s-ly*f.c;let lastX=null,u=0,v=0;
      for(let k=0;k<R.length;k++){const X=items[k].X;if(X!==lastX){[u,v]=toArt(WX,WY,X);lastX=X;}
        if(sampleInk(R[k],u,v)>=128){owner[o]=k;any=true;break;}}}}
  if(!any)return{union:[],layers:[]};
  const uval=new Float32Array(W*H);for(let o=0;o<W*H;o++)uval[o]=owner[o]>=0?1:0;
  const layers=[];
  items.forEach(({l},k)=>{const val=new Float32Array(W*H);let n=0;for(let o=0;o<W*H;o++)if(owner[o]===k){val[o]=1;n++;}
    if(n)layers.push({layer:l,shapes:traceGrid(val,W,H,PXL)});});
  return{union:traceGrid(uval,W,H,PXL),layers:layers.filter(x=>x.shapes.length)};
}
// where the picture is printed on a key top (key-local mm)
function artRegion(D,pr){
  const plate=(x,y)=>sdRR(x,y,pr.size,pr.r)<=-ART_MARGIN;
  if(ART.area!=="band"||P.boundary==2)return plate;
  const d=(x,y)=>-sdRR(x,y,P.top_size,P.r_top);
  if(P.boundary==1||D.run>0)return(x,y)=>d(x,y)>=ART_MARGIN;         // continuous top (slope, sloped step): all of it
  const b0=P.edge_band-D.fil.Lf;                                       // vertical step: plateau + flat outer band
  return(x,y)=>plate(x,y)||(()=>{const v=d(x,y);return v>=ART_MARGIN&&v<=b0-ART_MARGIN;})();
}
function artCacheKey(pos){if(!artActive())return 0;const Q=paramsFor(pos);return[ARTV,ART.legend,ART.area,P.pitch,Q.homing?[P.homing_type,P.homing_len,P.homing_w,P.homing_x,P.homing_y,P.homing_mode,P.homing_hole_d]:0];}

// ===== UI =====
let artDrag=null,artView=null,artNums={};const ART_ROT_OFF=22;
// which handle of the selected group is under canvas point p (px): "rot" | "scale" (corners) | "sx" / "sy" (sides, aspect ratio free) | null
function artHandleAt(p,touch){if(!artView||!artView.rot)return null;const r=touch?20:11,d=q=>Math.hypot(q[0]-p[0],q[1]-p[1]);
  if(d(artView.rot)<=r)return"rot";if(artView.corners.some(q=>d(q)<=r))return"scale";
  for(const e of artView.edges||[])if(d(e.p)<=r)return e.axis;return null;}
// canvas point -> the selected group's own axes (mm from its centre)
function artLocal(p,g){const X=artXf(g),dx=(p[0]-artView.ox)/artView.sc-X.ax,dy=(p[1]-artView.oy)/artView.sc-X.ay;return[dx*X.c+dy*X.s,-dx*X.s+dy*X.c];}
// the front-most shown group whose frame contains canvas point p, or -1
function artGroupAt(p){if(!artView||!ART.on)return -1;const X0=(p[0]-artView.ox)/artView.sc,Y0=(p[1]-artView.oy)/artView.sc;
  for(let i=0;i<ART.groups.length;i++){const g=ART.groups[i];if(g.hidden||!g.layers.length)continue;const X=artXf(g),dx=X0-X.ax,dy=Y0-X.ay;
    if(Math.abs(dx*X.c+dy*X.s)<=X.vb[2]*X.sx/2&&Math.abs(-dx*X.s+dy*X.c)<=X.vb[3]*X.sy/2)return i;}
  return -1;}
const normDeg=a=>{a=((a+180)%360+360)%360-180;return Math.round(a*10)/10;};
function artTintCanvas(l){ // low-res picture of one layer in its filament's preview colour
  const r=artLo.get(l.id);if(!r)return null;const col=COLS[extMat(l.ext)],key=r.key+":"+col.join(",");
  let t=artTint.get(l.id);if(t&&t.key===key)return t.cv;
  const cv=document.createElement("canvas");cv.width=r.w;cv.height=r.h;const g=cv.getContext("2d"),im=g.createImageData(r.w,r.h);
  for(let i=0;i<r.w*r.h;i++){const a=r.ink[i]>=128?255:0;im.data[i*4]=col[0];im.data[i*4+1]=col[1];im.data[i*4+2]=col[2];im.data[i*4+3]=a;}
  g.putImageData(im,0,0);artTint.set(l.id,{key,cv});return cv;
}
async function drawArtMap(){
  const cv=document.getElementById("art-map");if(!cv||!KM.keys.length)return;
  await Promise.all(artAllLayers().map(l=>artRaster(l,ART_LO,artLo).catch(()=>null)));
  const g=cv.getContext("2d"),Wc=cv.clientWidth||340,Hc=Math.max(180,Math.min(340,Wc*0.55)),dpr=window.devicePixelRatio||1;
  cv.style.height=Hc+"px";cv.width=Wc*dpr;cv.height=Hc*dpr;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,Wc,Hc);
  const shown=ART.on?ART.groups.filter(q=>!q.hidden&&q.layers.length):[];
  // fit the layout and the (rotated) frames of the pictures, so the handles stay on the canvas
  const L=layoutBox();let bx0=L.x0,by0=L.y0,bx1=L.x1,by1=L.y1;
  for(const q of shown){const Xf=artXf(q),hw=Xf.vb[2]*Xf.sx/2,hh=Xf.vb[3]*Xf.sy/2;
    for(const [lx,ly] of [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]]){const x=Xf.ax+lx*Xf.c-ly*Xf.s,y=Xf.ay+lx*Xf.s+ly*Xf.c;bx0=Math.min(bx0,x);by0=Math.min(by0,y);bx1=Math.max(bx1,x);by1=Math.max(by1,y);}}
  const pad=34,bw=Math.max(1,bx1-bx0),bh=Math.max(1,by1-by0),sc=Math.min((Wc-2*pad)/bw,(Hc-2*pad)/bh),ox=Wc/2-(bx0+bx1)/2*sc,oy=Hc/2-(by0+by1)/2*sc;
  artView={sc,ox,oy,rot:null,corners:[],edges:[]};
  const D=derive(P),pr=plateauRect(P,D),ink=css("--ink"),line=css("--line"),acc=css("--accent"),muted=css("--muted");
  const drawGroup=q=>{const X=artXf(q);for(let k=q.layers.length-1;k>=0;k--){const l=q.layers[k];if(l.hidden)continue;const t=artTintCanvas(l);if(!t)continue;
    let vb;try{vb=artVB(l);}catch(_){continue;}
    g.save();g.translate(ox+X.ax*sc,oy+X.ay*sc);g.rotate(X.t);
    g.drawImage(t,(vb[0]-X.ucx)*X.sx*sc,(vb[1]-X.vcy)*X.sy*sc,vb[2]*X.sx*sc,vb[3]*X.sy*sc);g.restore();}};
  const drawAll=()=>{for(let i=shown.length-1;i>=0;i--)drawGroup(shown[i]);}; // back to front
  const keyPath=(size,r)=>{g.beginPath();KM.keys.forEach((_,i)=>{const f=keyFrame(i);g.save();g.translate(ox+f.cx*sc,oy+f.cy*sc);g.rotate(f.t);
    const s=size*sc,rr=Math.max(0,r*sc);g.roundRect(-s/2,-s/2,s,s,rr);g.restore();});};
  // printed region of every key: plateau, plus the outer band (annulus) when chosen
  const printPath=()=>{g.beginPath();const band=ART.area==="band"&&P.boundary!=2,b0=P.boundary==0?P.edge_band-D.fil.Lf:0;
    KM.keys.forEach((_,i)=>{const f=keyFrame(i);g.save();g.translate(ox+f.cx*sc,oy+f.cy*sc);g.rotate(f.t);
      const rect=(size,r)=>{const s=size*sc;g.roundRect(-s/2,-s/2,s,s,Math.max(0,Math.min(r*sc,s/2)));};
      if(band&&(P.boundary==1||D.run>0))rect(P.top_size-2*ART_MARGIN,P.r_top);
      else{if(band){rect(P.top_size-2*ART_MARGIN,P.r_top);rect(P.top_size-2*(b0-ART_MARGIN),ringR(b0,P,D));}rect(pr.size-2*ART_MARGIN,pr.r);}
      g.restore();});};
  // keycaps
  keyPath(P.top_size,P.r_top);g.fillStyle=css("--bg");g.fill();g.strokeStyle=line;g.lineWidth=1;g.stroke();
  if(shown.length){
    g.globalAlpha=0.28;drawAll();g.globalAlpha=1;             // whole pictures, faint
    g.save();printPath();g.clip("evenodd");drawAll();g.restore(); // printed parts
    // frames: the other groups thin, the selected one with its handles
    const cur=artGroup();
    for(const q of shown){const X=artXf(q),hw=X.vb[2]*X.sx*sc/2,hh=X.vb[3]*X.sy*sc/2,C=[ox+X.ax*sc,oy+X.ay*sc],sel=q===cur,free=q.lock===false;
      g.save();g.translate(C[0],C[1]);g.rotate(X.t);g.setLineDash(sel?[5,4]:[3,4]);g.strokeStyle=sel?acc:muted;g.lineWidth=sel?1.2:0.8;g.strokeRect(-hw,-hh,2*hw,2*hh);g.setLineDash([]);
      if(ART.groups.length>1){g.fillStyle=sel?acc:muted;g.font=(sel?"600 ":"")+"11px 'IBM Plex Sans JP',system-ui,sans-serif";g.textBaseline="bottom";g.fillText(q.name,-hw+2,-hh-3);}
      if(sel){ // handles: rotate (circle above the top edge) and scale (corners)
        g.strokeStyle=acc;g.lineWidth=1.2;g.beginPath();g.moveTo(0,-hh);g.lineTo(0,-hh-ART_ROT_OFF);g.stroke();
        g.fillStyle=acc;g.beginPath();g.arc(0,-hh-ART_ROT_OFF,7,0,2*Math.PI);g.fill();
        g.strokeStyle=css("--accent-ink");g.lineWidth=1.5;g.beginPath();g.arc(0,-hh-ART_ROT_OFF,3.5,-2.4,1.2);g.stroke();
        g.fillStyle=css("--panel");g.strokeStyle=acc;g.lineWidth=1.5;
        for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){g.fillRect(sx*hw-5,sy*hh-5,10,10);g.strokeRect(sx*hw-5,sy*hh-5,10,10);}
        if(free)for(const [sx,sy] of [[-1,0],[1,0],[0,1]]){g.beginPath();g.arc(sx*hw,sy*hh,4.5,0,2*Math.PI);g.fill();g.stroke();}} // sides: stretch one way
      g.restore();
      if(sel){const rp=(lx,ly)=>[C[0]+lx*Math.cos(X.t)-ly*Math.sin(X.t),C[1]+lx*Math.sin(X.t)+ly*Math.cos(X.t)];
        artView.C=C;artView.rot=rp(0,-hh-ART_ROT_OFF);artView.corners=[rp(-hw,-hh),rp(hw,-hh),rp(hw,hh),rp(-hw,hh)];
        artView.edges=free?[{p:rp(-hw,0),axis:"sx"},{p:rp(hw,0),axis:"sx"},{p:rp(0,hh),axis:"sy"}]:[];}}
  }
  keyPath(pr.size,pr.r);g.strokeStyle=line;g.lineWidth=0.8;g.stroke();
  if(curKey!==null&&KM.keys[curKey]){const f=keyFrame(curKey),s=P.top_size*sc;g.save();g.translate(ox+f.cx*sc,oy+f.cy*sc);g.rotate(f.t);g.strokeStyle=ink;g.lineWidth=2;g.strokeRect(-s/2,-s/2,s,s);g.restore();}
}
function artApply(){artChanged();saveWs();rebuildPreview();drawArtMap();buildExportForm();}
function syncArtNums(){const g=artGroup();for(const k in artNums)if(artNums[k].isConnected)artNums[k].value=g?fmt(k==="height"?Math.round(artSize(g).h*10)/10:g[k]):"";}
// a filament for a new SVG: the art filament that already has this colour, else the next free one
function artPickExt(col,used){
  if(col)for(const l of artAllLayers())if(l.ext!==EXP.bodyExt&&filColor(l.ext).toUpperCase()===col.toUpperCase())return l.ext;
  let ext=2;while(used.has(ext)&&ext<16)ext++;used.add(ext);
  if(col)EXP.filColors={...(EXP.filColors||{}),[ext]:col.toUpperCase()};
  return ext;
}
function artUsedExts(){return new Set([EXP.bodyExt,EXP.legendExt,...artAllLayers().map(l=>l.ext)]);}
// a new empty group in front of the others, selected
function artNewGroup(name){const g=artNormGroup({name:name||("グループ"+(ART.groups.length+1))},ART.groups.length);ART.groups.unshift(g);ART.cur=0;return g;}
function artDropCaches(g){for(const l of g.layers){artHi.delete(l.id);artLo.delete(l.id);artTint.delete(l.id);}}
// a sample picture as a new group (or into the selected group when it is still empty)
async function addArtSample(s){
  let g=artGroup();if(!g||g.layers.length)g=artNewGroup(s.name);else if(/^グループ\d+$/.test(g.name))g.name=s.name.slice(0,30);
  const used=artUsedExts();
  for(const l of s.layers){const col=await svgMainColor(l.svg).catch(()=>null);
    g.layers.push(artNormLayer({name:l.name,svg:l.svg,mode:l.mode,ext:artPickExt(col,used)}));}
  if(s.fit==="small"){const vb=artUnion(g);g.width=Math.round(P.pitch*2*10)/10;g.height=Math.round(g.width*vb[3]/vb[2]*10)/10;g.cx=0;g.cy=0;g.rot=0;}else artFit(g);
  ART.on=true;setCols();buildExportForm();buildArtForm();artApply();
  const nn=document.getElementById("art-note");if(nn)nn.textContent="「"+s.name+"」を追加しました。配置図で位置と大きさを合わせてください。";
}
function buildArtForm(){
  const box=document.getElementById("km-art");if(!box)return;box.innerHTML="";
  const chk=document.createElement("label");chk.className="km-lname";chk.style.padding="8px 0 4px";
  const cb=document.createElement("input");cb.type="checkbox";cb.checked=ART.on;cb.onchange=()=>{ART.on=cb.checked;const g=artGroup();if(ART.on&&g&&!(g.width>0)&&g.layers.length)artFit(g);buildArtForm();artApply();};
  chk.appendChild(cb);chk.appendChild(document.createTextNode(" 天面アートを印字する"));box.appendChild(chk);
  const hint=document.createElement("p");hint.className="hint";
  hint.textContent="複数のキーの天面にまたがる大きな絵を印字します。絵はグループごとに好きな位置・大きさ・向きで置けます。1つのグループには、色ごとに分けたSVG（同じアートボードから書き出したもの）をまとめて読み込むと、SVGの原点をそろえて重ね、SVGごとのフィラメントで印字します。キーのない部分は印字されません。";
  box.appendChild(hint);
  // placement canvas
  const wrap=document.createElement("div");wrap.className="km-mapwrap";
  const cv=document.createElement("canvas");cv.id="art-map";cv.setAttribute("aria-label","天面アートの配置。絵をクリックでグループを選択、ドラッグで移動、丸いつまみで回転、角で拡大縮小、クリックでキーを選択");cv.className="art-map";
  wrap.appendChild(cv);box.appendChild(wrap);
  const cp=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  cv.addEventListener("pointerdown",e=>{if(!artView)return;const p=cp(e);let mode=ART.on&&artGroup()&&artGroup().layers.length?artHandleAt(p,e.pointerType==="touch"):null,picked=false;
    if(!mode){const gi=artGroupAt(p);if(gi>=0&&gi!==ART.cur){ART.cur=gi;picked=true;renderArtGroupUI();drawArtMap();}mode="move";}
    const g=artGroup();
    artDrag={x:e.clientX,y:e.clientY,cx:g?g.cx:0,cy:g?g.cy:0,rot:g?g.rot:0,width:g?g.width:0,height:g?artSize(g).h:0,mode,picked,moved:mode!=="move",
      a0:artView.C?Math.atan2(p[1]-artView.C[1],p[0]-artView.C[0]):0,d0:artView.C?Math.max(1,Math.hypot(p[0]-artView.C[0],p[1]-artView.C[1])):1};
    try{cv.setPointerCapture(e.pointerId);}catch(_){}});
  cv.addEventListener("pointermove",e=>{const p=cp(e);
    if(!artDrag){const h=artHandleAt(p,e.pointerType==="touch");cv.style.cursor=h==="rot"?"alias":h==="scale"?"nwse-resize":h==="sx"?"ew-resize":h==="sy"?"ns-resize":artGroupAt(p)>=0?"move":"grab";return;}
    const g=artGroup();if(!ART.on||!g||!g.layers.length)return;const dx=e.clientX-artDrag.x,dy=e.clientY-artDrag.y;
    if(artDrag.mode==="rot"){ // rotate around the centre of the picture; Shift: 15° steps
      const a=Math.atan2(p[1]-artView.C[1],p[0]-artView.C[0]);let r=artDrag.rot+(a-artDrag.a0)*180/Math.PI;
      g.rot=normDeg(e.shiftKey?Math.round(r/15)*15:Math.round(r*2)/2);syncArtNums();drawArtMap();return;}
    const clampMm=v=>Math.min(600,Math.max(5,Math.round(v*2)/2));
    if(artDrag.mode==="scale"&&(g.lock!==false||e.shiftKey)){ // keep the proportions (aspect ratio free: hold Shift)
      const f=Math.hypot(p[0]-artView.C[0],p[1]-artView.C[1])/artDrag.d0;g.width=clampMm(artDrag.width*f);if(g.lock===false)g.height=clampMm(artDrag.height*f);
      syncArtNums();drawArtMap();return;}
    if(artDrag.mode==="scale"||artDrag.mode==="sx"||artDrag.mode==="sy"){ // stretch: the dragged corner / side follows the pointer
      const [lx,ly]=artLocal(p,g);if(artDrag.mode!=="sy")g.width=clampMm(2*Math.abs(lx));if(artDrag.mode!=="sx")g.height=clampMm(2*Math.abs(ly));
      syncArtNums();drawArtMap();return;}
    if(Math.hypot(dx,dy)>3)artDrag.moved=true;if(!artDrag.moved)return;
    g.cx=Math.round((artDrag.cx+dx/artView.sc)*10)/10;g.cy=Math.round((artDrag.cy+dy/artView.sc)*10)/10;syncArtNums();drawArtMap();});
  cv.addEventListener("pointerup",e=>{const d=artDrag;artDrag=null;if(!d)return;
    if(d.moved){artApply();return;}
    if(d.picked){saveWs();return;} // the click chose another group
    // click: select the key under the pointer
    const r=cv.getBoundingClientRect(),X=(e.clientX-r.left-artView.ox)/artView.sc,Y=(e.clientY-r.top-artView.oy)/artView.sc;
    let best=-1,bd=Infinity;KM.keys.forEach((_,i)=>{const f=keyFrame(i),dd=Math.hypot(f.cx-X,f.cy-Y);if(dd<bd){bd=dd;best=i;}});
    if(best>=0&&bd<P.pitch*0.7){sel.clear();sel.add(best);curKey=best;kmChanged();drawArtMap();}});
  cv.addEventListener("pointercancel",()=>{artDrag=null;});
  const mh=document.createElement("p");mh.className="hint";mh.style.padding="6px 0 4px";
  mh.textContent="配置図では、絵をクリックするとそのグループを選べます。選んだグループは、ドラッグで移動、上の丸いつまみで回転（Shiftを押しながらで15°刻み）、角の四角で拡大縮小できます。キーをクリックするとキーを選べます。濃く表示された部分が印字されます。";
  box.appendChild(mh);
  // groups
  const gb=document.createElement("div");gb.id="art-gbar";box.appendChild(gb);
  const gp=document.createElement("div");gp.id="art-gpanel";box.appendChild(gp);
  // sample pictures
  if(typeof ART_SAMPLES!=="undefined"&&ART_SAMPLES.length){
    const det=document.createElement("details");det.className="km-sub art-samples";det.id="art-samples";
    const sm=document.createElement("summary");sm.textContent="サンプルの絵・図形から追加";det.appendChild(sm);
    const sh=document.createElement("p");sh.className="hint";sh.style.padding="0 0 6px";sh.textContent="選ぶと新しいグループとして追加されます（横長の絵は配列全体に、ワンポイントの絵と図形はキー2個分ほどの大きさで置きます）。SVGごとにフィラメントが割り当てられ、同じ色のフィラメントがあればそれを使います。";det.appendChild(sh);
    for(const [kind,title] of [["picture","絵"],["shape","シンプルな図形（1色・縦横比を外すと自由に伸ばせます）"]]){
      const list=ART_SAMPLES.filter(s=>(s.kind||"picture")===kind);if(!list.length)continue;
      const h=document.createElement("div");h.className="km-edhead";h.style.cssText="padding:6px 0 4px;font-size:13px";h.textContent=title;det.appendChild(h);
      const gr=document.createElement("div");gr.className="km-icongrid art-samplegrid"+(kind==="shape"?" art-shapegrid":"");
      for(const s of list){const b=document.createElement("button");b.type="button";b.title=s.name+"（"+s.layers.length+"色）";
        const im=document.createElement("span");im.className="km-iconimg art-sampleimg";artSampleThumb(s).then(c=>im.appendChild(c)).catch(()=>{});
        const nm=document.createElement("span");nm.className="km-iconname";nm.textContent=kind==="shape"?s.name:s.name+"・"+s.layers.length+"色";
        b.appendChild(im);b.appendChild(nm);b.onclick=()=>addArtSample(s);gr.appendChild(b);}
      det.appendChild(gr);}
    box.appendChild(det);}
  const note=document.createElement("p");note.className="hint";note.id="art-note";box.appendChild(note);
  // legend handling
  const seg=document.createElement("div");seg.className="seg";
  const sh=document.createElement("div");sh.className="seghead";sh.textContent="Legendと重なる部分";seg.appendChild(sh);
  [["Legendを優先（アートを抜く）","legend"],["アートだけ（Legendは印字しない）","art"]].forEach(([t,v])=>{const x=document.createElement("button");x.type="button";x.textContent=t;
    x.setAttribute("aria-pressed",String(ART.legend===v));x.onclick=()=>{ART.legend=v;buildArtForm();artApply();};seg.appendChild(x);});
  box.appendChild(seg);
  const seg2=document.createElement("div");seg2.className="seg";
  const sh2=document.createElement("div");sh2.className="seghead";sh2.textContent="印字する範囲";seg2.appendChild(sh2);
  [["天面の中央部のみ","center"],["外周帯も含める","band"]].forEach(([t,v])=>{const x=document.createElement("button");x.type="button";x.textContent=t;
    x.setAttribute("aria-pressed",String(ART.area===v));x.onclick=()=>{ART.area=v;buildArtForm();artApply();};seg2.appendChild(x);});
  const ah=document.createElement("p");ah.className="hint";ah.style.cssText="width:100%;padding:2px 0 0";
  ah.textContent=P.boundary==2?"段差なしの天面では、どちらでも天面全体に印字されます。":(P.boundary==1||derive(P).run>0)?"「外周帯も含める」では、外周帯と段差の斜面を含む天面全体に印字します。":"「外周帯も含める」では、外周帯（縁の平らな帯）にも印字します。垂直な段差の壁には印字しません。";
  seg2.appendChild(ah);box.appendChild(seg2);
  renderArtGroupUI();
  drawArtMap();
}
// picture of a sample set: its layers stacked in their own colours
const artSampleThumbs=new Map();
async function artSampleThumb(s){
  let c=artSampleThumbs.get(s.id);
  if(!c){const vb=LEG.svgPrepare(s.layers[0].svg).root.getAttribute("viewBox").split(/[\s,]+/).map(Number),W=120,H=Math.max(8,Math.round(W*vb[3]/vb[2]));
    c=document.createElement("canvas");c.width=W;c.height=H;const g=c.getContext("2d");
    for(let i=s.layers.length-1;i>=0;i--){const {root}=LEG.svgPrepare(s.layers[i].svg);g.drawImage(await LEG.svgImage(root,W,H),0,0,W,H);}
    artSampleThumbs.set(s.id,c);}
  const d=document.createElement("canvas");d.width=c.width;d.height=c.height;d.getContext("2d").drawImage(c,0,0);return d; // a copy per form build
}
function renderArtGroupUI(){renderArtGroupBar();renderArtPanel();}
function renderArtGroupBar(){
  const gb=document.getElementById("art-gbar");if(!gb)return;gb.innerHTML="";
  const head=document.createElement("div");head.className="km-edhead";head.style.cssText="padding:10px 0 2px";head.textContent="グループ（上にあるものほど手前）";gb.appendChild(head);
  const row=document.createElement("div");row.className="km-btns art-groups";row.setAttribute("role","group");row.setAttribute("aria-label","グループ");row.style.marginTop="4px";
  ART.groups.forEach((g,i)=>{const b=document.createElement("button");b.type="button";b.textContent=g.name+(g.hidden?"（非表示）":"")+(g.layers.length?"":"（空）");
    b.setAttribute("aria-pressed",String(i===ART.cur));b.onclick=()=>{ART.cur=i;saveWs();renderArtGroupUI();drawArtMap();};row.appendChild(b);});
  const nb=document.createElement("button");nb.type="button";nb.className="ghost";nb.textContent="＋ 新しいグループ";
  nb.onclick=()=>{artNewGroup();saveWs();renderArtGroupUI();drawArtMap();};row.appendChild(nb);
  gb.appendChild(row);
}
function renderArtPanel(){
  const box=document.getElementById("art-gpanel");if(!box)return;box.innerHTML="";artNums={};
  const g=artGroup();
  const fi=document.createElement("input");fi.type="file";fi.accept=".svg,image/svg+xml";fi.multiple=true;fi.hidden=true;box.appendChild(fi);
  fi.onchange=async()=>{const files=[...(fi.files||[])];fi.value="";const bad=[];let n=0;
    let tg=artGroup();if(!tg)tg=artNewGroup();const wasEmpty=!tg.layers.length,used=artUsedExts();
    for(const f of files){try{let t=await f.text();
        t=t.replace(/<\?xml[^>]*>/g,"").replace(/<!--[\s\S]*?-->/g,"").replace(/<metadata[\s\S]*?<\/metadata>/gi,"").replace(/>\s+</g,"><").trim();
        if(t.length>1500000)throw new Error("大きすぎます（1.5MBまで）");
        LEG.svgPrepare(t);await LEG.svgThumb(t,32);
        const col=await svgMainColor(t).catch(()=>null);
        tg.layers.push(artNormLayer({name:f.name.replace(/\.svg$/i,"").slice(0,30)||"アート",svg:t,mode:"all",ext:artPickExt(col,used)}));n++;}
      catch(e){bad.push(f.name+"（"+(e&&e.message||"読めません")+"）");}}
    if(n){if(!ART.on)ART.on=true;
      if(wasEmpty||!(tg.width>0)){const others=ART.groups.some(q=>q!==tg&&q.layers.length);artFit(tg,others?0.4:1);}
      setCols();buildExportForm();}
    buildArtForm();artApply();
    const nn=document.getElementById("art-note");if(nn)nn.textContent=(n?n+"個のSVGを「"+tg.name+"」に追加しました。配置図で位置と大きさを合わせてください。":"")+(bad.length?" 追加できなかったファイル: "+bad.join("、"):"");};
  const addRow=(label)=>{const add=document.createElement("div");add.className="km-btns";add.style.margin="8px 0 4px";
    const ab=document.createElement("button");ab.type="button";ab.textContent=label;ab.onclick=()=>fi.click();add.appendChild(ab);box.appendChild(add);};
  if(!g){const p=document.createElement("p");p.className="hint";p.style.padding="6px 0 0";p.textContent="SVGを追加するか、下の「サンプルの絵・図形から追加」から選んでください。";box.appendChild(p);addRow("SVGを追加…");return;}
  // group name, visibility, order, copy, delete
  const gr=document.createElement("div");gr.className="km-svgrow art-row art-grow";
  const nm=document.createElement("input");nm.value=g.name;nm.maxLength=30;nm.setAttribute("aria-label","グループの名前");
  nm.onchange=()=>{g.name=nm.value.trim().slice(0,30)||g.name;nm.value=g.name;saveWs();renderArtGroupBar();drawArtMap();};
  const ctl=document.createElement("div");ctl.className="art-ctl";const idx=ART.cur;
  const mk=(t,al,fn,dis)=>{const x=document.createElement("button");x.type="button";x.textContent=t;x.setAttribute("aria-label",al);x.disabled=!!dis;x.onclick=fn;ctl.appendChild(x);return x;};
  mk("↑","グループを手前へ",()=>{ART.groups.splice(idx-1,0,ART.groups.splice(idx,1)[0]);ART.cur=idx-1;renderArtGroupUI();artApply();},idx===0);
  mk("↓","グループを奥へ",()=>{ART.groups.splice(idx+1,0,ART.groups.splice(idx,1)[0]);ART.cur=idx+1;renderArtGroupUI();artApply();},idx===ART.groups.length-1);
  mk("複製","グループを複製",()=>{const c=artNormGroup({...JSON.parse(JSON.stringify(g)),id:null,name:(g.name+"のコピー").slice(0,30),
      layers:g.layers.map(l=>({...l,id:null}))},0);c.cx=Math.round((g.cx+P.pitch)*10)/10;ART.groups.splice(idx,0,c);ART.cur=idx;renderArtGroupUI();artApply();
    const nn=document.getElementById("art-note");if(nn)nn.textContent="「"+g.name+"」を複製しました。配置図でドラッグして好きな位置に置いてください。";},!g.layers.length);
  const del=mk("削除","グループを削除",()=>{artDropCaches(g);ART.groups.splice(idx,1);ART.cur=Math.max(0,Math.min(idx,ART.groups.length-1));buildArtForm();artApply();});del.className="danger";
  const opt=document.createElement("div");opt.className="art-opt";
  const vis=document.createElement("label");vis.className="art-vis";const vc=document.createElement("input");vc.type="checkbox";vc.checked=!g.hidden;
  vc.onchange=()=>{g.hidden=!vc.checked;renderArtGroupBar();artApply();};vis.appendChild(vc);vis.appendChild(document.createTextNode("このグループを表示"));opt.appendChild(vis);
  const th=document.createElement("div");th.className="km-svgthumb";th.textContent=String(idx+1);th.style.cssText="font-weight:600;color:var(--muted)";
  gr.appendChild(th);gr.appendChild(nm);gr.appendChild(ctl);gr.appendChild(opt);box.appendChild(gr);
  // placement numbers of this group
  const ng=document.createElement("div");ng.className="km-exgrid";ng.style.marginTop="8px";
  const num=(label,key,min,max,step)=>{const l=document.createElement("label");l.textContent=label;const i=document.createElement("input");i.type="number";i.min=min;i.max=max;i.step=step;i.inputMode="decimal";
    i.onchange=()=>{let v=parseFloat(i.value);if(isNaN(v))v=g[key];v=Math.min(max,Math.max(min,v));g[key]=v;i.value=fmt(v);artApply();};l.appendChild(i);ng.appendChild(l);artNums[key]=i;};
  num("幅（mm）","width",5,600,0.5);num("高さ（mm）","height",5,600,0.5);num("左右の位置（mm）","cx",-400,400,0.1);num("上下の位置（mm）","cy",-400,400,0.1);num("回転（度）","rot",-180,180,0.5);
  // the height: with the aspect ratio kept, it sets the width
  artNums.height.onchange=()=>{const i=artNums.height;let v=parseFloat(i.value);const vb=artUnion(g);if(isNaN(v))v=artSize(g,vb).h;v=Math.min(600,Math.max(5,v));
    if(g.lock!==false)g.width=Math.min(600,Math.max(5,Math.round(v*vb[2]/vb[3]*10)/10));else g.height=v;syncArtNums();artApply();};
  box.appendChild(ng);
  const lk=document.createElement("label");lk.className="km-lname";lk.style.padding="6px 0 2px";const lc=document.createElement("input");lc.type="checkbox";lc.id="art-lock";lc.checked=g.lock!==false;
  lc.onchange=()=>{if(lc.checked){g.lock=true;}else{g.height=Math.round(artSize(g).h*10)/10;g.lock=false;}syncArtNums();artApply();renderArtPanel();};
  lk.appendChild(lc);lk.appendChild(document.createTextNode(" 縦横比を保つ（拡大縮小で縦横の比率を変えない）"));box.appendChild(lk);
  syncArtNums();
  const bt=document.createElement("div");bt.className="km-btns";
  const b=(t,fn,cls)=>{const x=document.createElement("button");x.type="button";x.textContent=t;if(cls)x.className=cls;x.onclick=fn;bt.appendChild(x);return x;};
  b("配列全体に合わせる",()=>{artFit(g);syncArtNums();artApply();});
  b("縮小",()=>{artScale(g,1/1.1);syncArtNums();artApply();},"ghost");
  b("拡大",()=>{artScale(g,1.1);syncArtNums();artApply();},"ghost");
  if(g.lock===false)b("縦横比を元に戻す",()=>{const vb=artUnion(g);g.height=Math.round(g.width*vb[3]/vb[2]*10)/10;syncArtNums();artApply();},"ghost");
  box.appendChild(bt);
  const rt=document.createElement("div");rt.className="km-btns art-rot";rt.setAttribute("role","group");rt.setAttribute("aria-label","回転");
  const rb=(t,al,fn)=>{const x=document.createElement("button");x.type="button";x.className="ghost";x.textContent=t;x.setAttribute("aria-label",al);x.onclick=fn;rt.appendChild(x);};
  const turn=d=>()=>{g.rot=normDeg(g.rot+d);syncArtNums();artApply();};
  rb("↺ 15°","左に15°回転",turn(-15));rb("↺ 1°","左に1°回転",turn(-1));rb("↻ 1°","右に1°回転",turn(1));rb("↻ 15°","右に15°回転",turn(15));
  rb("0°に戻す","回転を0°に戻す",()=>{g.rot=0;syncArtNums();artApply();});
  box.appendChild(rt);
  const wh=document.createElement("p");wh.className="hint";wh.style.padding="4px 0 6px";
  wh.textContent="幅と高さは、このグループのSVG全体（すべてのSVGを重ねた範囲）の大きさです。"+(g.lock===false?"縦横比を保たないときは、配置図の角で縦横を自由に、辺の丸いつまみで横だけ・縦だけを伸縮できます（Shiftを押しながら角をドラッグすると比率を保ちます）。":"「縦横比を保つ」を外すと、縦と横を別々に伸縮できます。");box.appendChild(wh);
  // SVGs of this group
  const lh=document.createElement("div");lh.className="km-edhead";lh.style.cssText="padding:8px 0 2px";lh.textContent="「"+g.name+"」のSVG（上にあるものほど手前）";box.appendChild(lh);
  const list=document.createElement("div");list.className="km-svglist";
  g.layers.forEach((l,li)=>{
    const row=document.createElement("div");row.className="km-svgrow art-row";
    const th=document.createElement("div");th.className="km-svgthumb";LEG.svgThumb(l.svg,64).then(im=>{im.alt="";th.appendChild(im);}).catch(()=>{th.textContent="?";});
    const nm=document.createElement("input");nm.value=l.name;nm.maxLength=30;nm.setAttribute("aria-label","SVGの名前");nm.onchange=()=>{l.name=nm.value.trim()||l.name;nm.value=l.name;saveWs();};
    const ctl=document.createElement("div");ctl.className="art-ctl";
    const mk=(t,al,fn,dis)=>{const x=document.createElement("button");x.type="button";x.textContent=t;x.setAttribute("aria-label",al);x.disabled=!!dis;x.onclick=fn;ctl.appendChild(x);return x;};
    mk("↑","手前へ",()=>{g.layers.splice(li-1,0,g.layers.splice(li,1)[0]);renderArtPanel();artApply();},li===0);
    mk("↓","奥へ",()=>{g.layers.splice(li+1,0,g.layers.splice(li,1)[0]);renderArtPanel();artApply();},li===g.layers.length-1);
    const del=mk("削除","削除",()=>{g.layers.splice(li,1);artHi.delete(l.id);artLo.delete(l.id);artTint.delete(l.id);renderArtGroupUI();artApply();});del.className="danger";
    const opt=document.createElement("div");opt.className="art-opt";
    const ex=document.createElement("label");ex.className="art-ext";
    const sw=document.createElement("input");sw.type="color";sw.className="art-color";sw.value=filColor(l.ext).toLowerCase();sw.setAttribute("aria-label","フィラメント"+l.ext+"の色");
    sw.oninput=()=>setFilColor(l.ext,sw.value);sw.onchange=()=>{buildExportForm();};
    ex.appendChild(sw);ex.appendChild(document.createTextNode("フィラメント"));
    const ei=document.createElement("select");ei.setAttribute("aria-label","フィラメントの番号");
    for(let k=1;k<=16;k++){const o=document.createElement("option");o.value=k;o.textContent=String(k);ei.appendChild(o);}
    ei.value=String(l.ext);ei.onchange=()=>{l.ext=parseInt(ei.value,10);setCols();renderArtPanel();artApply();};ex.appendChild(ei);
    const md=document.createElement("select");md.setAttribute("aria-label","印字する部分");
    [["濃い色の部分","dark"],["描かれた部分すべて","all"]].forEach(([t,v])=>{const o=document.createElement("option");o.value=v;o.textContent=t;md.appendChild(o);});
    md.value=l.mode;md.onchange=()=>{l.mode=md.value;artApply();};
    const vis=document.createElement("label");vis.className="art-vis";const vc=document.createElement("input");vc.type="checkbox";vc.checked=!l.hidden;
    vc.onchange=()=>{l.hidden=!vc.checked;artApply();};vis.appendChild(vc);vis.appendChild(document.createTextNode("表示"));
    const mc=document.createElement("button");mc.type="button";mc.className="art-svgcol";mc.textContent="SVGの色";mc.title="このSVGの色をフィラメントの色にする";
    mc.onclick=async()=>{const c=await svgMainColor(l.svg).catch(()=>null);if(c){setFilColor(l.ext,c);renderArtPanel();buildExportForm();}};
    opt.appendChild(ex);opt.appendChild(mc);opt.appendChild(md);opt.appendChild(vis);
    if(ART.groups.length>1){ // move this SVG to another group
      const mv=document.createElement("select");mv.setAttribute("aria-label","移すグループ");
      const o0=document.createElement("option");o0.value="";o0.textContent="別のグループへ移す…";mv.appendChild(o0);
      ART.groups.forEach((q,qi)=>{if(q===g)return;const o=document.createElement("option");o.value=String(qi);o.textContent=q.name;mv.appendChild(o);});
      mv.onchange=()=>{const qi=parseInt(mv.value,10);if(isNaN(qi))return;const q=ART.groups[qi];g.layers.splice(li,1);
        if(!q.layers.length&&!(q.width>0)){q.layers.push(l);artFit(q,0.4);}else q.layers.push(l);
        renderArtGroupUI();artApply();};
      opt.appendChild(mv);}
    row.appendChild(th);row.appendChild(nm);row.appendChild(ctl);row.appendChild(opt);list.appendChild(row);});
  box.appendChild(list);
  addRow(g.layers.length?"このグループにSVGを追加…":"SVGを追加…");
}
window.addEventListener("resize",()=>{drawArtMap();});
