// app.js — parameters UI, validation, 3D preview, STL export, presets & history
// LAK風キーキャップジェネレータ / MIT License

const BUILD="standalone";
// defaults = shape close to the original LAK
const DEF={pitch:17,gap:1,top_size:16,edge_h:3.5,r_base:0.5,r_top:0.5,boundary:0,dome:-0.6,dome_scope:1,edge_drop:2.8,edge_band:0.75,step_run:1,step_rs:1,step_rf:0.6,r_plateau:1.8,dome_type:1,
  wall:1.2,cavity_h:2.6,stem_od:5.5,cross_len:4.15,cross_w:1.35,cross_depth:3.0,chamfer:0.3,homing:false,quality:1};
// values of the earlier defaults: used to fill keys missing from older saved data and v1 share links
const LEGACY_DEF={pitch:17,gap:1,top_size:14.2,edge_h:4.2,r_base:1.2,r_top:2,boundary:0,dome:0.4,dome_scope:0,edge_drop:0.5,edge_band:2,step_run:0,step_rs:0,step_rf:0,r_plateau:0.3,dome_type:0,
  wall:1.2,cavity_h:3.2,stem_od:5.5,cross_len:4.15,cross_w:1.35,cross_depth:3.0,chamfer:0.3,homing:false,quality:1};
let P={...DEF};

const GROUPS=[
  {title:"サイズ",open:true,items:[
    {k:"pitch",label:"キーピッチ",min:15,max:19.05,step:0.05},
    {k:"gap",label:"隣のキーとの隙間",min:0.3,max:2.5,step:0.1},
    {k:"top_size",label:"天面の幅",min:10,max:18,step:0.1},
    {k:"edge_h",label:"外周の高さ",hint:"底面から天面の外周（辺の中央）まで",min:3,max:8,step:0.1},
    {k:"r_base",label:"底面の角R",min:0.3,max:3,step:0.1},
    {k:"r_top",label:"天面の角R",min:0.3,max:4,step:0.1}]},
  {title:"天面の形",open:true,items:[
    {seg:"boundary",label:"中央と外周の境界",options:[["直角の段差",0],["なだらか",1],["段差なし",2]]},
    {k:"dome",label:"中央の盛り上がり",hint:"マイナスにすると皿状にへこみます",min:-1.5,max:1.5,step:0.05},
    {seg:"dome_type",label:"曲面の形",options:[["球面",0],["円筒（左右にカーブ）",1],["円筒（前後にカーブ）",2]]},
    {seg:"dome_scope",label:"盛り上がりの範囲",options:[["天面全体",0],["中央部のみ（外周帯は平ら）",1]],dep:()=>P.boundary!=2},
    {k:"edge_drop",label:"段差の高さ",hint:"外周帯から中央部までの高さの差",min:0,max:4,step:0.05,dep:()=>P.boundary!=2},
    {k:"edge_band",label:"外周帯の幅",hint:"外周から段差の始まりまで",min:0.3,max:4,step:0.05,dep:()=>P.boundary!=2},
    {k:"step_run",label:"段差の傾斜幅",hint:"段差の斜面の水平方向の幅。0で垂直",min:0,max:4,step:0.05,dep:()=>P.boundary==0},
    {k:"step_rs",label:"段差の肩の丸みR",hint:"段差の上の角（凸）の丸み",min:0,max:3,step:0.05,dep:()=>P.boundary==0},
    {k:"step_rf",label:"段差の裾の丸みR",hint:"段差の根元（凹）の丸み。外周帯の幅より大きくはなりません",min:0,max:3,step:0.05,dep:()=>P.boundary==0},
    {k:"r_plateau",label:"中央部の角R",hint:"段差の上側の輪郭の角の丸み",min:0.3,max:5,step:0.1,dep:()=>P.boundary==0},
  ]},
  {title:"肉厚",open:false,items:[
    {k:"wall",label:"側壁の厚み",min:0.8,max:2.5,step:0.05},
    {k:"cavity_h",label:"内側天井の高さ",hint:"ステム円柱の高さと同じ",min:2,max:6,step:0.05}]},
  {title:"ステム",open:false,items:[
    {preset:true},
    {k:"cross_len",label:"十字穴の長さ",min:3.8,max:4.4,step:0.01},
    {k:"cross_w",label:"十字穴の幅",min:1.1,max:1.6,step:0.01},
    {k:"cross_depth",label:"十字穴の深さ",min:2,max:5,step:0.05},
    {k:"chamfer",label:"入口の面取り",hint:"エレファントフット対策",min:0,max:0.6,step:0.05},
    {k:"stem_od",label:"ステム外径",min:4.8,max:6.5,step:0.05}]},
  {title:"オプション",open:false,items:[
    {check:"homing",label:"ホームポジション用の突起を付ける"},
    {seg:"quality",label:"STLの分割の細かさ",options:[["標準",1],["高精細",2]]}]}
];

const fmt=v=>(Math.round(v*100)/100).toString();
const RST_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
const resets={};
function defText(k){const v=DEF[k];if(typeof v==="boolean")return v?"オン":"オフ";const g=GROUPS.flatMap(x=>x.items).find(i=>i.seg===k);if(g){const o=g.options.find(o=>o[1]===v);return o?o[0]:String(v);}return fmt(v)+"mm";}
function mkReset(k,apply){const b=document.createElement("button");b.type="button";b.className="rst";b.innerHTML=RST_SVG;
  b.title="初期値（"+defText(k)+"）に戻す";b.setAttribute("aria-label",b.title);
  b.onclick=()=>{apply(DEF[k]);update();};resets[k]=b;return b;}
function refreshResets(){for(const k in resets)resets[k].disabled=(P[k]===DEF[k]);}
const inputs={};
function buildForm(){
  const root=document.getElementById("params");root.innerHTML="";
  GROUPS.forEach(g=>{
    const d=document.createElement("details");if(g.open)d.open=true;
    const s=document.createElement("summary");s.textContent=g.title;d.appendChild(s);
    g.items.forEach(it=>{
      if(it.seg){
        const w=document.createElement("div");w.className="seg";w.setAttribute("role","group");w.setAttribute("aria-label",it.label);
        const head=document.createElement("div");head.className="seghead";const lab=document.createElement("span");lab.textContent=it.label;head.appendChild(lab);
        const opts=[];
        const setSeg=v=>{P[it.seg]=v;opts.forEach(([b,ov])=>b.setAttribute("aria-pressed",String(ov===v)));refreshDeps();};
        head.appendChild(mkReset(it.seg,setSeg));w.appendChild(head);
        it.options.forEach(([t,v])=>{const b=document.createElement("button");b.type="button";b.textContent=t;
          b.setAttribute("aria-pressed",String(P[it.seg]===v));
          b.onclick=()=>{setSeg(v);update();};opts.push([b,v]);
          w.appendChild(b);});
        d.appendChild(w);inputs[it.seg]={seg:w,it};
      }else if(it.check){
        const l=document.createElement("div");l.className="check";
        const lab=document.createElement("label");lab.style.cssText="display:flex;align-items:center;gap:10px;cursor:pointer";
        const c=document.createElement("input");c.type="checkbox";c.checked=P[it.check];
        c.onchange=()=>{P[it.check]=c.checked;update();};
        lab.appendChild(c);lab.appendChild(document.createTextNode(it.label));l.appendChild(lab);
        l.appendChild(mkReset(it.check,v=>{P[it.check]=v;c.checked=v;}));d.appendChild(l);inputs[it.check]={check:c};
      }else if(it.preset){
        const w=document.createElement("div");w.className="seg";
        const lab=document.createElement("div");lab.style.cssText="width:100%;font-size:14px";lab.textContent="十字穴のプリセット";w.appendChild(lab);
        [["FDM",4.15,1.35],["光造形",4.05,1.25]].forEach(([t,l,wd])=>{const b=document.createElement("button");b.type="button";b.className="chip";b.textContent=t;
          b.onclick=()=>{setVal("cross_len",l);setVal("cross_w",wd);update();};w.appendChild(b);});
        const h=document.createElement("p");h.className="hint";h.style.width="100%";h.textContent="きつい・緩いときは0.05mm刻みで調整してください。";w.appendChild(h);
        d.appendChild(w);
      }else{
        const r=document.createElement("div");r.className="row";
        const id="p-"+it.k;
        const lab=document.createElement("label");lab.htmlFor=id;lab.textContent=it.label+(it.unit===""?"":"（mm）");
        if(it.hint){const sm=document.createElement("small");sm.textContent=it.hint;lab.appendChild(sm);}
        const num=document.createElement("input");num.type="number";num.id=id;num.min=it.min;num.max=it.max;num.step=it.step;num.value=P[it.k];num.inputMode="decimal";
        const rb=mkReset(it.k,v=>setVal(it.k,v));
        const rng=document.createElement("input");rng.type="range";rng.min=it.min;rng.max=it.max;rng.step=it.step;rng.value=P[it.k];rng.setAttribute("aria-label",it.label);
        rng.oninput=()=>{P[it.k]=parseFloat(rng.value);num.value=fmt(P[it.k]);update();};
        num.onchange=()=>{let v=parseFloat(num.value);if(isNaN(v))v=P[it.k];v=Math.min(it.max,Math.max(it.min,v));P[it.k]=v;num.value=fmt(v);rng.value=v;update();};
        r.appendChild(lab);r.appendChild(num);r.appendChild(rb);r.appendChild(rng);d.appendChild(r);inputs[it.k]={num,rng,row:r,it};
      }
    });
    root.appendChild(d);
  });
  const rs=document.createElement("button");rs.className="reset";rs.type="button";rs.textContent="すべて初期値に戻す";
  rs.onclick=()=>{P={...DEF};for(const k in resets)delete resets[k];buildForm();update();};root.appendChild(rs);
  refreshDeps();
}
function setVal(k,v){P[k]=v;const i=inputs[k];if(i&&i.num){i.num.value=fmt(v);i.rng.value=v;}}
function refreshDeps(){for(const k in inputs){const i=inputs[k];const el=i.row||i.seg;if(el&&i.it&&i.it.dep){el.style.display=i.it.dep()?"":"none";}}}

// ---------- validation ----------
function sdRR(x,y,s,r){const h=s/2-r,qx=Math.abs(x)-h,qy=Math.abs(y)-h;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r;}
function analyze(){
  const D=derive(P),errs=[],warns=[];
  if(P.top_size>D.base+1e-9)errs.push("天面の幅が底面（"+fmt(D.base)+"mm）より大きくなっています。側面を垂直にするなら同じ値にしてください。");
  if(P.boundary!=2&&D.d1>=D.w-1)errs.push(P.boundary==0?"外周帯の幅と段差の傾斜幅の合計が大きすぎます。"+fmt(D.w-1)+"mm未満にしてください。":"外周帯の幅が広すぎます。"+fmt(D.w-1)+"mm未満にしてください。");
  if(P.cross_depth>P.cavity_h){ // hole continues into the solid top: needs material above it
    let zmin=Infinity;const rs=Math.hypot(P.cross_len/2,P.cross_w/2)+0.2;
    for(let i=0;i<24;i++){const a=i/24*2*Math.PI,x=rs*Math.cos(a),y=rs*Math.sin(a),d=-sdRR(x,y,P.top_size,P.r_top);zmin=Math.min(zmin,ztop(x,y,d,d<P.edge_band,P,D));}
    if(zmin-P.cross_depth<0.6)errs.push("十字穴の上に残る肉が0.6mm未満です。十字穴を浅くするか、天面を高くしてください。");
  }
  if(P.cavity_h>=P.edge_h)errs.push("内側天井が外周の高さを超えています。");
  const itop=D.base-(D.base-P.top_size)*P.cavity_h/P.edge_h-2*P.wall;
  let thin=Infinity;
  const pts=rr(itop,Math.max(P.r_top-P.wall,0.3),16).concat([[0,0]]);
  for(const p of pts){const d=-sdRR(p[0],p[1],P.top_size,P.r_top);thin=Math.min(thin,ztop(p[0],p[1],d,d<P.edge_band,P,D)-P.cavity_h);}
  if(thin<0.3)errs.push("天面に穴が開くほど薄くなっています。外周の高さを上げるか、内側天井を下げてください。");
  else if(thin<0.8)warns.push("天面の最薄部が0.8mmを下回っています。印刷で割れやすくなります。");
  const cr=Math.hypot(P.cross_len/2,P.cross_w/2);
  if(cr>P.stem_od/2-0.4)warns.push("十字穴に対してステム外径が細く、肉が薄くなっています。");
  if(itop<P.stem_od+1)warns.push("内側空洞がステムに対して狭くなっています。側壁を薄くしてください。");
  return {errs,warns,thin,center:P.edge_h+D.E+D.dome,base:D.base};
}

// ---------- viewer ----------
const cv=document.getElementById("cv"),ctx=cv.getContext("2d");
let W=0,H=0,view="iso",tris=[],dirty=true;
let yaw=-0.6,el=0.55,ty=-0.6,te=0.55,span=24,ts=24;
const VIEWS={iso:[-0.6,0.55,24],side:[0,0.04,24],bottom:[0,-1.4,24],row:[0,0.45,58],section:[0,0,24]};
const vw=document.getElementById("vw"),glc=document.getElementById("gl");
function resize(){W=vw.clientWidth||360;H=vw.clientHeight||340;const d=window.devicePixelRatio||1;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0);
  glc.width=Math.round(W*d);glc.height=Math.round(H*d);dirty=true;}
// ---------- WebGL renderer (depth buffer + smooth shading); falls back to canvas painter ----------
let GLR=(()=>{
  let gl=null;try{gl=glc.getContext("webgl",{antialias:true,alpha:true,premultipliedAlpha:true});}catch(_){}
  if(!gl)return null;
  const vs=`attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform vec4 rot;uniform vec4 prm;varying vec3 vn;varying vec3 vc;
  void main(){float cy=rot.x,sy=rot.y,ce=rot.z,se=rot.w;
    vec3 q=vec3(p.x*cy-p.y*sy,p.x*sy+p.y*cy,p.z-prm.w);vec3 v=vec3(q.x,q.y*se+q.z*ce,q.y*ce-q.z*se);
    vec3 m=vec3(n.x*cy-n.y*sy,n.x*sy+n.y*cy,n.z);vn=vec3(m.x,m.y*se+m.z*ce,m.y*ce-m.z*se);vc=c;
    float D=prm.z;float w=D+v.z;gl_Position=vec4(v.x*prm.x*D,v.y*prm.y*D,v.z/80.0*w,w);}`;
  const fs=`precision mediump float;varying vec3 vn;varying vec3 vc;uniform vec3 L;
  void main(){vec3 n=normalize(vn);float d=abs(dot(n,L));
    gl_FragColor=vec4(vc*(0.36+0.64*d),1.0);}`;
  const sh=(type,src)=>{const o=gl.createShader(type);gl.shaderSource(o,src);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
  let prog;try{prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,vs));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error("link");}catch(e){console.warn(e);return null;}
  const loc={p:gl.getAttribLocation(prog,"p"),n:gl.getAttribLocation(prog,"n"),c:gl.getAttribLocation(prog,"c"),rot:gl.getUniformLocation(prog,"rot"),prm:gl.getUniformLocation(prog,"prm"),L:gl.getUniformLocation(prog,"L")};
  const buf={p:gl.createBuffer(),n:gl.createBuffer(),c:gl.createBuffer()};let count=0,ref=null;
  function upload(T){
    const nf=T.length,pos=new Float32Array(nf*9),nor=new Float32Array(nf*9),col=new Float32Array(nf*9);
    const fn=new Float32Array(nf*3),fa=new Float32Array(nf);
    const groups=new Map(),key=q=>Math.round(q[0]*2e4)+","+Math.round(q[1]*2e4)+","+Math.round(q[2]*2e4);
    T.forEach((t,i)=>{const a=t[0],b=t[1],c=t[2];const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      const x=u[1]*w[2]-u[2]*w[1],y=u[2]*w[0]-u[0]*w[2],z=u[0]*w[1]-u[1]*w[0],l=Math.hypot(x,y,z)||1e-12;
      fn[i*3]=x/l;fn[i*3+1]=y/l;fn[i*3+2]=z/l;fa[i]=l/2;
      for(let k=0;k<3;k++){const kk=key(t[k]);let g=groups.get(kk);if(!g)groups.set(kk,g=[]);g.push(i);}});
    const cosT=Math.cos(38*Math.PI/180);
    T.forEach((t,i)=>{const col3=COLS[t[3]||0];
      for(let k=0;k<3;k++){const q=t[k],o=i*9+k*3;pos[o]=q[0];pos[o+1]=q[1];pos[o+2]=q[2];
        let sx=0,sy=0,sz=0;for(const j of groups.get(key(q))){const d=fn[i*3]*fn[j*3]+fn[i*3+1]*fn[j*3+1]+fn[i*3+2]*fn[j*3+2];
          if(d>=cosT&&(T[j][3]||0)===(t[3]||0)){sx+=fn[j*3]*fa[j];sy+=fn[j*3+1]*fa[j];sz+=fn[j*3+2]*fa[j];}}
        const l=Math.hypot(sx,sy,sz);if(l>1e-12){nor[o]=sx/l;nor[o+1]=sy/l;nor[o+2]=sz/l;}else{nor[o]=fn[i*3];nor[o+1]=fn[i*3+1];nor[o+2]=fn[i*3+2];}
        col[o]=col3[0]/255;col[o+1]=col3[1]/255;col[o+2]=col3[2]/255;}});
    for(const [b,d] of [[buf.p,pos],[buf.n,nor],[buf.c,col]]){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);}
    count=nf*3;ref=T;
  }
  function draw(T){
    if(T!==ref)upload(T);
    gl.viewport(0,0,glc.width,glc.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.useProgram(prog);
    const k=Math.min(W,H*1.25)/span,Dd=140;
    gl.uniform4f(loc.rot,Math.cos(yaw),Math.sin(yaw),Math.cos(el),Math.sin(el));
    gl.uniform4f(loc.prm,k/(W/2),k/(H/2),Dd,2.4);gl.uniform3f(loc.L,L[0],L[1],L[2]);
    for(const [b,l] of [[buf.p,loc.p],[buf.n,loc.n],[buf.c,loc.c]]){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,3,gl.FLOAT,false,0,0);}
    gl.drawArrays(gl.TRIANGLES,0,count);
  }
  function clear(){gl.viewport(0,0,glc.width,glc.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}
  glc.addEventListener("webglcontextlost",e=>{e.preventDefault();glFail("context lost");});
  return{draw,clear};
})();
let prevTok=0;
function rebuildPreview(){
  tris=[];const xs=view==="row"?[-P.pitch,0,P.pitch]:[0];
  xs.forEach(x=>{tris=tris.concat(buildMesh(P,8,48,x));});dirty=true;
  const tok=++prevTok;
  if(typeof KM!=="undefined"&&KM.layers.length&&curKey!==null){
    const keysToShow=view==="row"?[[curKey-1,-P.pitch],[curKey,0],[curKey+1,P.pitch]].filter(([k])=>k>=0&&k<KM.keys.length):[[curKey,0]];
    Promise.all(keysToShow.map(([k,x])=>legendParts(k,x,8,48))).then(arr=>{if(tok!==prevTok)return;
      const set=new Set(keysToShow.map(([,x])=>x));
      tris=[];xs.forEach(x=>{if(!set.has(x))tris=tris.concat(buildMesh(P,8,48,x));});
      arr.forEach(pt=>{tris=tris.concat(pt.body);if(LCFG.style!=="engrave")tris=tris.concat(pt.legend);});dirty=true;
      const hint=document.getElementById("km-warn");
      legendShapes(curKey).then(r=>{const w=[];if(r.dropped.length)w.push("入りきらない・重なるため省いたLegend: "+r.dropped.join(", "));
        if(LCFG.style==="engrave"&&r.shapes.length&&minPocketFloor(r.shapes)<0.5)w.push("彫り込みの底と内側の天井の間が0.5mm未満です。彫り込みを浅くしてください。");
        hint.textContent=w.join(" ");hint.hidden=!w.length;});
    }).catch(e=>console.error(e));
  }
}
const L=(()=>{const v=[-0.45,0.7,-0.55],n=Math.hypot(...v);return v.map(x=>x/n);})();
const COLS=[[216,213,205],[160,157,150],[110,108,103],[58,62,68]];
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function render3D(){
  ctx.clearRect(0,0,W,H);
  const cy=Math.cos(yaw),sy=Math.sin(yaw),ce=Math.cos(el),se=Math.sin(el),zc=2.4,Dd=140,k=Math.min(W,H*1.25)/span,out=[];
  for(const t of tris){
    const v=[t[0],t[1],t[2]].map(p=>{const x1=p[0]*cy-p[1]*sy,y1=p[0]*sy+p[1]*cy,z1=p[2]-zc;return[x1,y1*se+z1*ce,y1*ce-z1*se];});
    const u=[v[1][0]-v[0][0],v[1][1]-v[0][1],v[1][2]-v[0][2]],w=[v[2][0]-v[0][0],v[2][1]-v[0][1],v[2][2]-v[0][2]];
    const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],nl=Math.hypot(...n);if(nl<1e-12)continue;
    const it=0.36+0.64*Math.abs((n[0]*L[0]+n[1]*L[1]+n[2]*L[2])/nl);
    out.push({v,d:(v[0][2]+v[1][2]+v[2][2])/3,c:COLS[t[3]||0].map(x=>Math.round(x*it))});
  }
  out.sort((a,b)=>b.d-a.d);
  for(const o of out){ctx.beginPath();o.v.forEach((q,i)=>{const s=Dd/(Dd+q[2]),X=W/2+q[0]*k*s,Y=H/2-q[1]*k*s;i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);});ctx.closePath();
    const col="rgb("+o.c.join(",")+")";ctx.fillStyle=col;ctx.strokeStyle=col;ctx.lineWidth=0.6;ctx.fill();ctx.stroke();}
}
function renderSection(){
  ctx.clearRect(0,0,W,H);
  const D=derive(P),w=D.w,b=P.edge_band,apex=P.edge_h+D.E+D.dome;
  const k=Math.min((W-48)/(D.base+1),(H-80)/(apex+1.2)),x0=W/2,y0=H/2+apex*k/2;
  const m=(x,z)=>[x0+x*k,y0-z*k];
  const zAt=(x,low)=>{const d=w-Math.abs(x);return ztop(x,0,d,low===undefined?d<b:low,P,D);};
  const top=[];const S=240;
  for(let i=0;i<=S;i++){const x=-w+2*w*i/S;top.push([x,zAt(x)]);}
  if(P.boundary==0&&!(P.step_run>0)){const s=w-b;
    const ins=(x,pts)=>{let j=top.findIndex(p=>p[0]>x);if(j<0)j=top.length;top.splice(j,0,...pts);};
    ins(-s,[[-s,zAt(-s,true)],[-s,zAt(-s,false)]]);ins(s,[[s,zAt(s,false)],[s,zAt(s,true)]]);}
  const poly=(pts,fill)=>{ctx.beginPath();pts.forEach((p,i)=>{const q=m(p[0],p[1]);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();};
  const key=css("--key")||"#D8D5CD",stage=css("--stage")||"#D3D9DE",ink=css("--ink")||"#1C252D",muted=css("--muted")||"#56626C";
  poly([[-D.base/2,0],[-w,zAt(-w,true)],...top,[w,zAt(w,true)],[D.base/2,0]],key);
  const bi=D.base-2*P.wall,itop=D.base-(D.base-P.top_size)*P.cavity_h/P.edge_h-2*P.wall;
  poly([[-bi/2,0],[-itop/2,P.cavity_h],[itop/2,P.cavity_h],[bi/2,0]],stage);
  poly([[-P.stem_od/2,0],[-P.stem_od/2,P.cavity_h+0.02],[P.stem_od/2,P.cavity_h+0.02],[P.stem_od/2,0]],key);
  const a=P.cross_len/2,c=P.chamfer;
  poly([[-a-c,0],[-a,c],[-a,P.cross_depth],[a,P.cross_depth],[a,c],[a+c,0]],stage);
  ctx.strokeStyle=muted;ctx.lineWidth=1;ctx.setLineDash([4,4]);
  const g0=m(-D.base/2-0.6,0),g1=m(D.base/2+0.6,0);ctx.beginPath();ctx.moveTo(g0[0],g0[1]);ctx.lineTo(g1[0],g1[1]);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=ink;ctx.font="500 13px 'IBM Plex Sans JP',system-ui,sans-serif";ctx.textAlign="center";
  const t=m(0,apex);ctx.fillText("中央 "+fmt(apex)+" mm",t[0],t[1]-10);
  ctx.fillStyle=muted;ctx.font="12px 'IBM Plex Sans JP',system-ui,sans-serif";
  const bl=m(0,0);ctx.fillText("幅 "+fmt(D.base)+" mm（中心を通る断面）",bl[0],bl[1]+22);
}
function glFail(why){ // fall back to the canvas renderer so the preview never freezes
  console.warn("WebGL preview disabled:",why);GLR=null;glc.style.display="none";dirty=true;}
function render(){
  if(view==="section"){if(GLR)try{GLR.clear();}catch(_){}renderSection();return;}
  if(GLR){ctx.clearRect(0,0,W,H);try{GLR.draw(tris);return;}catch(e){glFail(e&&e.message);}}
  render3D();
}
function loop(){
  const dy=ty-yaw,de=te-el,ds=ts-span;
  if(Math.abs(dy)>1e-3||Math.abs(de)>1e-3||Math.abs(ds)>1e-2){const f=matchMedia("(prefers-reduced-motion: reduce)").matches?1:0.2;yaw+=dy*f;el+=de*f;span+=ds*f;dirty=true;}
  if(dirty){render();dirty=false;}requestAnimationFrame(loop);
}
document.querySelectorAll(".views button").forEach(b=>b.addEventListener("click",()=>{
  const prev=view;view=b.dataset.view;document.querySelectorAll(".views button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  const v=VIEWS[view];ty=v[0];te=v[1];ts=v[2];if(prev==="row"||view==="row")rebuildPreview();dirty=true;}));
let drag=null;
cv.addEventListener("pointerdown",e=>{if(view==="section")return;drag=[e.clientX,e.clientY];try{cv.setPointerCapture(e.pointerId);}catch(_){}});
cv.addEventListener("pointermove",e=>{if(!drag)return;ty+=(e.clientX-drag[0])*0.01;te=Math.max(-1.5,Math.min(1.5,te+(e.clientY-drag[1])*0.01));drag=[e.clientX,e.clientY];});
["pointerup","pointercancel"].forEach(n=>cv.addEventListener(n,()=>drag=null));
window.addEventListener("resize",resize);

// ---------- floating preview while adjusting (mobile) ----------
const pip=document.getElementById("pip"),pipSlot=document.getElementById("pip-slot"),stage=document.querySelector(".stage");
let pipTimer=0,pipPinned=false,pipHold=false,stageVisible=true;
if("IntersectionObserver" in window)new IntersectionObserver(es=>{stageVisible=es[0].intersectionRatio>=0.5;},{threshold:[0,0.5,1]}).observe(stage);
const pipOn=()=>!pip.hidden;
function showPip(y){
  if(window.innerWidth>=900)return;
  if(!pipOn()){
    if(stageVisible)return;
    stage.style.minHeight=stage.offsetHeight+"px";pipSlot.appendChild(vw);pip.hidden=false;resize();
  }
  pip.classList.toggle("top",y>=window.innerHeight*0.45);pip.classList.toggle("bottom",y<window.innerHeight*0.45);
  schedulePipHide();
}
function schedulePipHide(){clearTimeout(pipTimer);if(!pipPinned&&!pipHold)pipTimer=setTimeout(hidePip,1800);}
function hidePip(force){
  if(!pipOn()||(pipPinned&&!force))return;
  clearTimeout(pipTimer);stage.appendChild(vw);stage.style.minHeight="";pip.hidden=true;resize();
}
const inPanel=el=>el&&el.closest&&el.closest("#params,#km-legend,#km-editor");
document.addEventListener("pointerdown",e=>{if(e.target.matches&&e.target.matches('input[type=range]')&&inPanel(e.target)){pipHold=true;showPip(e.target.getBoundingClientRect().top);}},true);
document.addEventListener("pointerup",()=>{if(pipHold){pipHold=false;schedulePipHide();}},true);
document.addEventListener("pointercancel",()=>{if(pipHold){pipHold=false;schedulePipHide();}},true);
document.addEventListener("input",e=>{if(inPanel(e.target))showPip(e.target.getBoundingClientRect().top);},true);
document.addEventListener("change",e=>{if(inPanel(e.target))showPip(e.target.getBoundingClientRect().top);},true);
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("button");if(b&&inPanel(b)&&!b.classList.contains("rst"))showPip(b.getBoundingClientRect().top);},true);
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest(".rst");if(b&&inPanel(b))setTimeout(()=>showPip(b.getBoundingClientRect().top),0);},true);
cv.addEventListener("pointerdown",()=>{if(pipOn())clearTimeout(pipTimer);});
cv.addEventListener("pointerup",()=>{if(pipOn())schedulePipHide();});
document.getElementById("pip-pin").onclick=e=>{pipPinned=!pipPinned;e.currentTarget.setAttribute("aria-pressed",String(pipPinned));schedulePipHide();};
document.getElementById("pip-close").onclick=()=>{pipPinned=false;document.getElementById("pip-pin").setAttribute("aria-pressed","false");hidePip(true);};
window.addEventListener("resize",()=>{if(window.innerWidth>=900)hidePip(true);});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>dirty=true);

// ---------- update ----------
let lastA=null;
function update(){
  const A=analyze();lastA=A;
  document.getElementById("s-center").textContent=fmt(A.center)+" mm";
  document.getElementById("s-thin").textContent=isFinite(A.thin)?fmt(A.thin)+" mm":"–";
  document.getElementById("s-base").textContent=fmt(A.base)+" mm";
  document.getElementById("pip-cap").textContent="中央 "+fmt(A.center)+"mm・最薄 "+(isFinite(A.thin)?fmt(A.thin):"–")+"mm";
  const box=document.getElementById("msgs");box.innerHTML="";
  A.errs.forEach(t=>{const d=document.createElement("div");d.className="msg err";d.textContent=t;box.appendChild(d);});
  A.warns.forEach(t=>{const d=document.createElement("div");d.className="msg";d.textContent=t;box.appendChild(d);});
  if(A.errs.length===0)rebuildPreview();
  refreshResets();
  updateSaveState();
}


// ---------- library (presets & history) ----------
const HIST_MAX=20,PRESET_MAX=50,LS="lakgen:";
const Store={mode:"pending",db:null,uid:null,data:{presets:[],history:[]}};
function cleanParams(src,base){const o={...(base||LEGACY_DEF)};if(src&&typeof src==="object")for(const k in DEF){const v=src[k];if(typeof v===typeof DEF[k]&&(typeof v!=="number"||isFinite(v)))o[k]=v;}return o;}
function col(kind){return Store.db.doc("data/users/"+Store.uid+"/lib").collection(kind);}
function lsGet(kind){try{const a=JSON.parse(localStorage.getItem(LS+kind)||"[]");return Array.isArray(a)?a:[];}catch(_){return[];}}
function lsSet(kind,a){try{localStorage.setItem(LS+kind,JSON.stringify(a));return true;}catch(_){return false;}}
function libStatus(t){document.getElementById("lib-status").textContent=t||"";}
function dbErr(e){const c=e&&e.code;return c==="quota_exceeded"?"保存できる件数の上限に達しました。不要な項目を削除してください。":"保存先に書き込めませんでした（"+(c||"error")+"）。";}
async function initStore(){
  try{
    if(window.claude&&window.claude.use){
      const [db,user]=await Promise.all([window.claude.use("db"),window.claude.use("user")]);
      if(db&&user){const uid=await user.id();if(uid){Store.db=db;Store.uid=uid;Store.mode="db";}}
    }
  }catch(_){}
  if(Store.mode!=="db"){try{localStorage.setItem(LS+"t","1");localStorage.removeItem(LS+"t");Store.mode="local";}catch(_){Store.mode="none";}}
  if(Store.mode==="db"){
    ["presets","history"].forEach(kind=>{
      col(kind).orderBy("createdAt","desc").limit((kind==="history"?HIST_MAX:PRESET_MAX)+10).onSnapshot(
        s=>{Store.data[kind]=s.docs.map(d=>({id:d.id,...d.data()}));renderLib();},
        e=>{libStatus("一覧を読み込めませんでした（"+(e&&e.code)+"）。ページを開き直してください。");});
    });
  }else if(Store.mode==="local"){Store.data.presets=lsGet("presets");Store.data.history=lsGet("history");}
  renderLib();
}
async function addItem(kind,obj){
  const max=kind==="history"?HIST_MAX:PRESET_MAX;
  if(Store.mode==="db"){
    await col(kind).add(obj);
    const s=await col(kind).orderBy("createdAt","desc").get();
    for(let i=max;i<s.docs.length;i++){try{await col(kind).doc(s.docs[i].id).delete();}catch(_){}}
  }else if(Store.mode==="local"){
    const a=[{id:"l"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),...obj},...Store.data[kind]].slice(0,max);
    if(!lsSet(kind,a))throw{code:"storage"};Store.data[kind]=a;renderLib();
  }
}
async function updateItem(kind,id,patch){
  if(Store.mode==="db"){await col(kind).doc(id).update(patch);}
  else if(Store.mode==="local"){const a=Store.data[kind].map(x=>x.id===id?{...x,...patch}:x);if(!lsSet(kind,a))throw{code:"storage"};Store.data[kind]=a;renderLib();}
}
async function deleteItem(kind,id){
  if(Store.mode==="db"){await col(kind).doc(id).delete();}
  else if(Store.mode==="local"){const a=Store.data[kind].filter(x=>x.id!==id);lsSet(kind,a);Store.data[kind]=a;renderLib();}
}
const BND=["直角の段差","なだらか","段差なし"];
function summary(p){p=cleanParams(p);return "ピッチ "+fmt(p.pitch)+" / 高さ "+fmt(p.edge_h)+" / 盛り上がり "+fmt(p.dome)+" / "+BND[p.boundary]+(p.boundary!=2?" "+fmt(p.edge_drop):"")+" / 十字 "+fmt(p.cross_len)+"×"+fmt(p.cross_w);}
function when(ts){const d=new Date(ts);if(isNaN(d))return"";const z=n=>String(n).padStart(2,"0");return d.getFullYear()+"/"+z(d.getMonth()+1)+"/"+z(d.getDate())+" "+z(d.getHours())+":"+z(d.getMinutes());}
function loadParams(p,label){P=cleanParams(p);for(const k in resets)delete resets[k];buildForm();update();libStatus("「"+label+"」を読み込みました。");}
function btn(text,cls,fn){const b=document.createElement("button");b.type="button";b.textContent=text;if(cls)b.className=cls;b.onclick=fn;return b;}
function confirmBtn(text,fn){const b=btn(text,"danger",null);let armed=false,tm=0;
  b.onclick=()=>{if(!armed){armed=true;b.textContent="本当に削除";tm=setTimeout(()=>{armed=false;b.textContent=text;},3000);return;}clearTimeout(tm);fn();};return b;}
let renaming=null;
function renderLib(){
  const where=document.getElementById("lib-where"),form=document.getElementById("preset-add"),nameI=document.getElementById("preset-name");
  where.textContent=Store.mode==="db"?"あなただけに表示されます":Store.mode==="local"?"このブラウザに保存されます":Store.mode==="none"?"この表示では保存できません":"読み込み中…";
  const off=Store.mode==="none"||Store.mode==="pending";form.disabled=off;nameI.disabled=off;
  const lp=document.getElementById("list-presets");lp.innerHTML="";
  if(!Store.data.presets.length){const li=document.createElement("li");li.innerHTML='<span class="empty">まだプリセットはありません。名前を付けて現在の設定を保存できます。</span>';lp.appendChild(li);}
  Store.data.presets.forEach(it=>{
    const li=document.createElement("li");
    const nm=document.createElement("div");nm.className="nm";
    if(renaming&&renaming.id===it.id){
      const f=document.createElement("div");f.className="rename";
      const inp=document.createElement("input");inp.maxLength=40;inp.value=renaming.draft;inp.setAttribute("aria-label","新しいプリセット名");
      inp.oninput=()=>{renaming.draft=inp.value;};
      const save=async()=>{const name=inp.value.trim().slice(0,40);if(!name){libStatus("名前を入力してください。");return;}
        const old=it.name;renaming=null;
        try{await updateItem("presets",it.id,{name});libStatus("「"+old+"」を「"+name+"」に変更しました。");}catch(er){libStatus(dbErr(er));}
        renderLib();};
      inp.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();save();}else if(e.key==="Escape"){renaming=null;renderLib();}};
      const ok=btn("保存","primary",save),cancel=btn("やめる","",()=>{renaming=null;renderLib();});
      f.appendChild(inp);f.appendChild(ok);f.appendChild(cancel);nm.appendChild(f);
      li.appendChild(nm);li.style.gridTemplateColumns="minmax(0,1fr)";lp.appendChild(li);
      setTimeout(()=>{if(document.activeElement!==inp){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);}},0);
      return;
    }
    nm.textContent=it.name||"名称未設定";
    const meta=document.createElement("div");meta.className="meta";meta.textContent=summary(it.params)+"　"+when(it.updatedAt||it.createdAt);
    const acts=document.createElement("div");acts.className="acts";
    acts.appendChild(btn("読み込む","primary",()=>loadParams(it.params,it.name)));
    acts.appendChild(btn("Xに投稿","",()=>{loadParams(it.params,it.name);openShare(it.name);}));
    acts.appendChild(btn("上書き","",async e=>{const b=e.currentTarget;b.disabled=true;
      try{await updateItem("presets",it.id,{params:{...P},updatedAt:Date.now()});libStatus("「"+it.name+"」を現在の設定で上書きしました。");}catch(er){libStatus(dbErr(er));}finally{b.disabled=false;}}));
    acts.appendChild(btn("名前変更","",()=>{renaming={id:it.id,draft:it.name||""};renderLib();}));
    acts.appendChild(confirmBtn("削除",async()=>{try{await deleteItem("presets",it.id);libStatus("「"+it.name+"」を削除しました。");}catch(er){libStatus(dbErr(er));}}));
    li.appendChild(nm);li.appendChild(acts);li.appendChild(meta);lp.appendChild(li);
  });
  const lh=document.getElementById("list-history");lh.innerHTML="";
  if(!Store.data.history.length){const li=document.createElement("li");li.innerHTML='<span class="empty">まだ履歴はありません。STLを保存すると、ここに設定が残ります。</span>';lh.appendChild(li);}
  Store.data.history.forEach(it=>{
    const li=document.createElement("li");
    const nm=document.createElement("div");nm.className="nm";nm.textContent=when(it.createdAt)+"　"+(it.quality==2?"高精細":"標準");
    const meta=document.createElement("div");meta.className="meta";meta.textContent=summary(it.params);
    const acts=document.createElement("div");acts.className="acts";
    acts.appendChild(btn("読み込む","primary",()=>loadParams(it.params,when(it.createdAt)+" の履歴")));
    acts.appendChild(btn("Xに投稿","",()=>{loadParams(it.params,when(it.createdAt)+" の履歴");openShare("");}));
    acts.appendChild(btn("プリセットに","",async e=>{const b=e.currentTarget;b.disabled=true;const name="履歴 "+when(it.createdAt);
      try{await addItem("presets",{name,params:cleanParams(it.params),createdAt:Date.now()});libStatus("「"+name+"」としてプリセットに保存しました。");}catch(er){libStatus(dbErr(er));}finally{b.disabled=false;}}));
    acts.appendChild(confirmBtn("削除",async()=>{try{await deleteItem("history",it.id);}catch(er){libStatus(dbErr(er));}}));
    li.appendChild(nm);li.appendChild(acts);li.appendChild(meta);lh.appendChild(li);
  });
}
document.getElementById("preset-form").addEventListener("submit",async()=>{
  if(Store.mode==="none"||Store.mode==="pending")return;
  const i=document.getElementById("preset-name"),b=document.getElementById("preset-add");
  const name=(i.value.trim()||("プリセット "+(Store.data.presets.length+1))).slice(0,40);
  if(Store.data.presets.length>=PRESET_MAX){libStatus("プリセットは"+PRESET_MAX+"件までです。不要なものを削除してください。");return;}
  b.disabled=true;
  try{await addItem("presets",{name,params:{...P},createdAt:Date.now()});i.value="";libStatus("「"+name+"」を保存しました。");}
  catch(er){libStatus(dbErr(er));}finally{b.disabled=false;}
});
document.querySelectorAll(".lib-tabs button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".lib-tabs button").forEach(x=>{const on=x===b;x.setAttribute("aria-pressed",String(on));x.setAttribute("aria-selected",String(on));});
  document.getElementById("tab-presets").hidden=b.dataset.tab!=="presets";document.getElementById("tab-history").hidden=b.dataset.tab!=="history";}));

// ---------- export ----------
let downloads=null,dlReady=false;
function updateSaveState(){
  const btn=document.getElementById("save"),st=document.getElementById("status");
  if(!dlReady){btn.disabled=true;st.textContent="保存の準備をしています…";return;}
  if(!downloads&&window.claude){btn.disabled=true;st.textContent="この表示では保存を使えません。";return;}
  if(lastA&&lastA.errs.length){btn.disabled=true;st.textContent="赤いメッセージの項目を直すと保存できます。";return;}
  btn.disabled=false;
  st.textContent="STLと同じ形状のOpenSCADファイルを、ZIPにまとめて保存します。";
}
async function rawSave(blob,filename){
  if(downloads){await downloads.save({filename,data:blob});return;}
  if(!window.claude){const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),8000);return;}
  throw {code:"unavailable"};
}
async function saveFile(blob,filename,stId){
  const st=stId?document.getElementById(stId):null;
  try{await rawSave(blob,filename);if(st)st.textContent="保存しました（"+filename+"）。";}
  catch(e){const c=e&&e.code;if(st)st.textContent=c==="declined"?"保存をキャンセルしました。":c==="rate_limited"?"保存の確認がすでに開いています。少し待ってからもう一度押してください。":"保存できませんでした（"+(c||"error")+"）。";}
}
function scadText(){
  const n=v=>fmt(v);
  return `// LAK風キーキャップ（Kailh Choc V2）— ジェネレーターから出力
// OpenSCAD で開き、F6 → STLエクスポート

pitch       = ${n(P.pitch)};
gap         = ${n(P.gap)};
top_size    = ${n(P.top_size)};
edge_h      = ${n(P.edge_h)};
r_base      = ${n(P.r_base)};
r_top       = ${n(P.r_top)};

boundary    = ${P.boundary};   // 0:直角の段差 / 1:なだらか / 2:段差なし
dome        = ${n(P.dome)};
dome_type   = ${P.dome_type};   // 0:球面 / 1:円筒（左右）/ 2:円筒（前後）
dome_scope  = ${P.dome_scope};   // 0:天面全体 / 1:中央部のみ（外周帯は平ら）
step_run    = ${n(P.step_run)};   // 段差の傾斜幅（0で垂直）
step_rs     = ${n(P.step_rs)};   // 段差の肩の丸みR
step_rf     = ${n(P.step_rf)};   // 段差の裾の丸みR
r_plateau   = ${n(P.r_plateau)};   // 中央部の角R
edge_drop   = ${n(P.edge_drop)};
edge_band   = ${n(P.edge_band)};

wall        = ${n(P.wall)};
cavity_h    = ${n(P.cavity_h)};

stem_od     = ${n(P.stem_od)};
cross_len   = ${n(P.cross_len)};
cross_w     = ${n(P.cross_w)};
cross_depth = ${n(P.cross_depth)};
chamfer     = ${n(P.chamfer)};

homing      = ${P.homing?"true":"false"};
N           = 12;
$fa = 2; $fs = 0.2;

`+SCAD_BODY;
}
document.getElementById("save").addEventListener("click",async()=>{
  const btn=document.getElementById("save"),st=document.getElementById("status");
  if(!downloads&&window.claude)return;
  btn.disabled=true;st.textContent="STLを生成しています…";
  try{
    const q=P.quality==2?[24,160]:[14,96];
    const stl=toSTL(buildMesh(P,q[0],q[1],0));
    const tag=fmt(P.pitch).replace(".","_")+"mm";
    const zip=makeZip([{name:"lak_keycap_"+tag+".stl",data:stl},{name:"lak_keycap_"+tag+".scad",data:new TextEncoder().encode(scadText())}]);
    const fname="lak_keycap_"+tag+".zip";
    await rawSave(zip,fname);
    st.textContent="保存しました。ZIPを展開するとSTLが入っています。";
    if(Store.mode==="db"||Store.mode==="local"){addItem("history",{filename:fname,quality:P.quality,params:{...P},createdAt:Date.now()}).catch(er=>libStatus(dbErr(er)));}
  }catch(e){
    const c=e&&e.code;
    st.textContent=c==="declined"?"保存をキャンセルしました。":c==="rate_limited"?"保存の確認がすでに開いています。少し待ってからもう一度押してください。":"保存できませんでした（"+(c||"error")+"）。";
    if(["unavailable","not_granted","capability_disabled","capability_removed"].includes(c)){downloads=null;}
  }finally{btn.disabled=(!downloads&&!!window.claude)||(lastA&&lastA.errs.length>0);}
});
(async()=>{
  try{ if(window.claude&&window.claude.use){downloads=await window.claude.use("downloads");} }catch(_){downloads=null;}
  dlReady=true;updateSaveState();
})();
