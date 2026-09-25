// geom.js — keycap mesh generation, STL / 3MF / ZIP writers
// LAK風キーキャップジェネレータ / MIT License

// ===== geometry core =====
function derive(P){
  const base=P.pitch-P.gap, w=P.top_size/2, dome=P.dome, ad=Math.abs(dome);
  // dome_scope 1: the dome lives only inside the plateau (band stays flat)
  const E=P.boundary==2?0:P.edge_drop;
  const run=P.boundary==0?Math.max(0,+P.step_run||0):0,fil=stepFillets(P,E,run);
  const d1=P.boundary==2?0:P.edge_band+run+(P.boundary==0?fil.Ls:0); // d1: where the plateau (centre) starts
  const capped=P.dome_scope==1&&P.boundary!=2, wp=capped?Math.max(0.5,w-d1):w;
  const R=ad<1e-3?1:(wp*wp+ad*ad)/(2*ad);
  return {base,w,dome,ad,R,E,capped,run,d1,fil,cyl:+P.dome_type||0};
}
// top curvature: 0 sphere, 1 cylinder curving left-right, 2 cylinder curving front-back
function sph(x,y,D){if(D.ad<1e-3)return 0;const q=D.cyl==1?x*x:D.cyl==2?y*y:x*x+y*y;
  const h=Math.sqrt(Math.max(D.R*D.R-q,0))-(D.R-D.ad);return Math.sign(D.dome)*(D.capped?Math.max(0,h):h);}
// step profile: wall from the foot corner (x=0) rising E over run, with a concave foot fillet and a convex shoulder
function stepFillets(P,E,run){
  let rf=Math.max(0,+P.step_rf||0),rs=Math.max(0,+P.step_rs||0);
  const th=run>0?Math.atan2(E,run):Math.PI/2,t2=Math.tan(th/2),L=run>0?Math.hypot(run,E):E;
  let Lf=rf*t2,Ls=rs*t2;
  if(Lf+Ls>L*0.98&&Lf+Ls>0){const s=L*0.98/(Lf+Ls);rf*=s;rs*=s;Lf*=s;Ls*=s;}
  const bmax=Math.max(0,P.edge_band-0.05);if(Lf>bmax){const s=bmax/Lf;rf*=s;Lf=bmax;}
  return{rf,rs,Lf,Ls,th};
}
function stepH(x,low,D){
  const E=D.E,run=D.run,{rf,rs,Lf,Ls,th}=D.fil;
  if(Lf>0?x<=-Lf:x<0)return 0;
  if(run<=0){
    if(x<0)return rf-Math.sqrt(Math.max(0,rf*rf-(x+rf)*(x+rf)));
    if(x===0||Math.abs(x)<1e-12)return low?rf:E-rs;
    if(x<rs)return E-rs+Math.sqrt(Math.max(0,rs*rs-(x-rs)*(x-rs)));
    return E;
  }
  const c=Math.cos(th),xa=Lf*c,xb=run-Ls*c;
  if(x<xa)return rf-Math.sqrt(Math.max(0,rf*rf-(x+Lf)*(x+Lf)));
  if(x<=xb)return x*Math.tan(th);
  if(x<run+Ls)return E-rs+Math.sqrt(Math.max(0,rs*rs-(x-run-Ls)*(x-run-Ls)));
  return E;
}
function dropv(d,low,P,D){
  if(P.boundary==0){
    const x=d-P.edge_band;
    if(D.run<=0&&D.fil.rf<=0&&D.fil.rs<=0)return low?D.E:0; // plain vertical step
    return D.E-stepH(x,low&&Math.abs(x)<1e-9,D);
  }
  if(P.boundary==1) return d>=P.edge_band?0:D.E*(1+Math.cos(Math.PI*d/P.edge_band))/2;
  return 0;
}
function ztop(x,y,d,low,P,D){
  const dr=dropv(d,low,P,D);
  // centre-only curvature: the step rises from the flat band to the local height of the curved centre
  if(D.capped&&D.E>0)return P.edge_h+(D.E-dr)/D.E*(D.E+sph(x,y,D));
  return P.edge_h+D.E+sph(x,y,D)-dr;
}
function insetList(P,D){
  const w=D.w,b=P.edge_band,o=[];
  if(P.boundary==0){const d1=D.d1,{Lf,Ls,th}=D.fil,run=D.run;
    if(run<=0&&D.fil.rf<=0&&D.fil.rs<=0){for(let i=0;i<=4;i++)o.push([b*i/4,true]);o.push([b,false]);}
    else{
      const b0=b-Lf;for(let i=0;i<=4;i++)o.push([b0*i/4,true]);
      const xs=[];const c=Math.cos(th);
      if(Lf>0){const xa=run>0?Lf*c:0;for(let i=1;i<=6;i++)xs.push(-Lf+(xa+Lf)*i/6);}
      if(run>0){const xa=Lf*c,xb=run-Ls*c;for(let i=1;i<=3;i++)xs.push(xa+(xb-xa)*i/3);}
      else xs.push(0); // vertical wall: the top of the wall (the foot side is the previous ring)
      if(Ls>0){const xb=run>0?run-Ls*c:0;for(let i=1;i<=8;i++)xs.push(xb+(run+Ls-xb)*i/8);}
      let seenZero=false;
      for(const x of xs){if(run<=0&&Math.abs(x)<1e-12){o.push([b,Lf>0&&!seenZero]);seenZero=true;}else o.push([b+x,false]);}
    }
    for(let i=1;i<=6;i++)o.push([d1+(w-0.5-d1)*i/6,false]);}
  else if(P.boundary==1){for(let i=0;i<8;i++)o.push([b*i/8,false]);for(let i=0;i<=6;i++)o.push([b+(w-0.5-b)*i/6,false]);}
  else{for(let i=0;i<=10;i++)o.push([(w-0.5)*i/10,false]);}
  return o;
}
function rr(s,r,n,seg,fixedM){
  const h=s/2-r,o=[],c=[[h,h],[-h,h],[-h,-h],[h,-h]];
  for(let k=0;k<4;k++){for(let i=0;i<=n;i++){const a=(k*90+i*90/n)*Math.PI/180;o.push([c[k][0]+r*Math.cos(a),c[k][1]+r*Math.sin(a)]);}
    if(seg){const p=o[o.length-1],kk=(k+1)%4,a2=(kk*90)*Math.PI/180,q=[c[kk][0]+r*Math.cos(a2),c[kk][1]+r*Math.sin(a2)];
      const L=Math.hypot(q[0]-p[0],q[1]-p[1]),m=fixedM||Math.floor(L/seg);for(let j=1;j<m;j++)o.push([p[0]+(q[0]-p[0])*j/m,p[1]+(q[1]-p[1])*j/m]);}}
  return o;
}
// split long interior edges of a 2D triangulation (boundary edges untouched -> no T-junctions)
function refineTris(poly,tris,maxLen){
  // weld duplicate vertices (hole bridges) so shared edges are recognised as interior
  const idx=new Map(),remap=[],pts=[];
  poly.forEach((p,i)=>{const k=p[0]+","+p[1];if(idx.has(k))remap[i]=idx.get(k);else{idx.set(k,pts.length);remap[i]=pts.length;pts.push(p);}});
  const T=tris.map(t=>t.map(i=>remap[i]));
  const ek=(a,b)=>a<b?a*1048576+b:b*1048576+a;
  for(let pass=0;pass<60;pass++){
    const E=new Map();T.forEach((t,ti)=>{for(let i=0;i<3;i++){const k=ek(t[i],t[(i+1)%3]);const v=E.get(k);if(v)v.push(ti);else E.set(k,[ti]);}});
    const cand=[];
    for(const [k,arr] of E){if(arr.length!==2)continue;const a=Math.floor(k/1048576),b=k%1048576;const l=Math.hypot(pts[a][0]-pts[b][0],pts[a][1]-pts[b][1]);if(l>maxLen)cand.push([l,a,b,arr]);}
    if(!cand.length)break;
    cand.sort((x,y)=>y[0]-x[0]);
    const used=new Uint8Array(T.length);
    for(const [,a,b,[t1,t2]] of cand){
      if(used[t1]||used[t2])continue;used[t1]=used[t2]=1;
      const m=pts.length;pts.push([(pts[a][0]+pts[b][0])/2,(pts[a][1]+pts[b][1])/2]);
      for(const ti of [t1,t2]){const t=T[ti];const i=t.findIndex((v,j)=>(v===a&&t[(j+1)%3]===b)||(v===b&&t[(j+1)%3]===a));
        const u=t[i],v=t[(i+1)%3],w=t[(i+2)%3];T[ti]=[u,m,w];T.push([m,v,w]);}
    }
  }
  return{poly:pts,tris:T};
}
function crossPoly(P){
  const a=P.cross_len/2,b=P.cross_w/2;
  return [[a,b],[b,b],[b,a],[-b,a],[-b,b],[-a,b],[-a,-b],[-b,-b],[-b,-a],[b,-a],[b,-b],[a,-b]];
}
function angOrder(R){
  const a=R.map(p=>{let t=Math.atan2(p[1],p[0]);if(t<0)t+=2*Math.PI;return t;});
  let k=0;for(let i=1;i<a.length;i++)if(a[i]<a[k])k=i;
  const RR=R.slice(k).concat(R.slice(0,k)),aa=a.slice(k).concat(a.slice(0,k));
  for(let i=1;i<aa.length;i++)while(aa[i]<aa[i-1])aa[i]+=2*Math.PI;
  aa.push(aa[0]+2*Math.PI);
  return [RR,aa];
}
function zipRings(A,B,out,m){
  if(A.length===1){for(let j=0;j<B.length;j++)out.push([A[0],B[j],B[(j+1)%B.length],m]);return;}
  if(B.length===1){for(let i=0;i<A.length;i++)out.push([A[i],B[0],A[(i+1)%A.length],m]);return;}
  const [a,aa]=angOrder(A),[b,bb]=angOrder(B),nA=a.length,nB=b.length;let i=0,j=0;
  while(i<nA||j<nB){
    if(j>=nB||(i<nA&&aa[i+1]<=bb[j+1])){out.push([a[i%nA],b[j%nB],a[(i+1)%nA],m]);i++;}
    else{out.push([a[i%nA],b[j%nB],b[(j+1)%nB],m]);j++;}
  }
}
function signedVol(T){let v=0;for(const t of T){const[a,b,c]=t;v+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}return v;}
function orient(T){if(signedVol(T)<0)for(const t of T){const x=t[1];t[1]=t[2];t[2]=x;}return T;}
function sdRR(x,y,s,r){const h=s/2-r,qx=Math.abs(x)-h,qy=Math.abs(y)-h;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r;}
// height of the plateau (inside the edge band): no drop applies there
function zPlateau(x,y,P,D){return P.edge_h+D.E+sph(x,y,D);}
// inset of the plateau boundary ring used when pockets are cut
// corner radius of the ring inset by d from the top outline
function ringR(d,P,D){
  let r;
  if(P.boundary!=0)r=Math.max(P.r_top-d,0.3);
  else{const b=P.edge_band,rp=Math.max(0.3,+P.r_plateau||0.3),rf=rp+(D.d1-b);
    const b0=Math.max(0,b-D.fil.Lf);
    if(d<=b0)r=P.r_top+(rf+D.fil.Lf-P.r_top)*(b0>0?d/b0:1);
    else if(d<=D.d1)r=rp+(D.d1-d);  // offset curve of the plateau outline
    else r=Math.max(rp-(d-D.d1),0.3);}
  return Math.max(0.05,Math.min(r,(P.top_size-2*d)/2-0.01));
}
function plateauRect(P,D){const k=plateauRingIndex(P,D),d=insetList(P,D)[k][0];return{size:P.top_size-2*d,r:ringR(d,P,D),d};}
function plateauRingIndex(P,D){const L=insetList(P,D);const lim=P.boundary==2?0.3:D.d1;
  for(let k=0;k<L.length;k++){if(L[k][0]>=lim-1e-7&&!L[k][1])return k;}return L.length-1;}
function buildMesh(P,N,M,offx,opts){
  offx=offx||0;
  const D=derive(P),chain=[],mats=[];
  const mv=p=>[p[0]+offx,p[1],p[2]];
  const ins=insetList(P,D);
  const rings=ins.map(q=>rr(P.top_size-2*q[0],ringR(q[0],P,D),N,0.8).map(p=>[p[0],p[1],ztop(p[0],p[1],q[0],q[1],P,D)]));
  const pocket=opts&&opts.shapes&&opts.shapes.length?opts:null;
  let k0=rings.length-1,topT=null;
  if(pocket){k0=plateauRingIndex(P,D);topT=pocketTop(rings[k0],pocket.shapes,pocket.depth,P,D,offx);}
  else{chain.push([[0,0,P.edge_h+D.E+D.dome]]);mats.push(0);}
  for(let k=k0;k>=0;k--){chain.push(rings[k]);mats.push(0);}
  { // outer side: match the top edge ring point-for-point so the twisted side face is split finely
    const m0=Math.floor((P.top_size-2*Math.max(P.r_top,0.3))/0.8);
    chain.push(rr(D.base,P.r_base,N,m0>1?1:0,m0>1?m0:0).map(p=>[p[0],p[1],0]));mats.push(0);
  }
  chain.push(rr(D.base-2*P.wall,Math.max(P.r_base-P.wall,0.3),N).map(p=>[p[0],p[1],0]));mats.push(0);
  const itop=D.base-(D.base-P.top_size)*P.cavity_h/P.edge_h-2*P.wall;
  chain.push(rr(itop,Math.max(P.r_top-P.wall,0.3),N).map(p=>[p[0],p[1],P.cavity_h]));mats.push(0);
  const circ=z=>{const o=[];for(let i=0;i<M;i++){const t=i/M*2*Math.PI;o.push([P.stem_od/2*Math.cos(t),P.stem_od/2*Math.sin(t),z]);}return o;};
  chain.push(circ(P.cavity_h));mats.push(0);
  chain.push(circ(0));mats.push(1);
  const cp=crossPoly(P),c=P.chamfer;
  if(c>0){chain.push(cp.map(p=>[p[0]+Math.sign(p[0])*c,p[1]+Math.sign(p[1])*c,0]));mats.push(1);
          chain.push(cp.map(p=>[p[0],p[1],c]));mats.push(2);}
  else{chain.push(cp.map(p=>[p[0],p[1],0]));mats.push(1);}
  chain.push(cp.map(p=>[p[0],p[1],P.cross_depth]));mats.push(2);
  chain.push([[0,0,P.cross_depth]]);mats.push(2);
  let T=[];
  for(let k=0;k<chain.length-1;k++)zipRings(chain[k].map(mv),chain[k+1].map(mv),T,mats[k+1]);
  if(topT){
    // make the chain consistent with the top faces (which use up-facing normals, ring traversed CCW)
    const R=rings[k0].map(mv),a=R[0],b=R[1],eq=(p,q)=>p[0]===q[0]&&p[1]===q[1]&&p[2]===q[2];
    let same=false;for(const t of T){for(let i=0;i<3;i++){if(eq(t[i],a)&&eq(t[(i+1)%3],b)){same=true;break;}}if(same)break;}
    if(same)for(const t of T){const x=t[1];t[1]=t[2];t[2]=x;}
    T=T.concat(topT);
  }
  orient(T);
  const parts=[T];
  if(P.homing){
    const H=[],cz=ztop(0,-4,D.w-4,D.w-4<P.edge_band,P,D)-0.2,U=24,V=10,rx=2.45,rs=0.45;
    const pt=(u,v)=>{const th=u/U*2*Math.PI,ph=v/V*Math.PI;return[offx+rx*Math.sin(ph)*Math.cos(th),-4+rs*Math.sin(ph)*Math.sin(th),cz+rs*Math.cos(ph)];};
    for(let v=0;v<V;v++)for(let u=0;u<U;u++){
      const a=pt(u,v),b=pt(u+1,v),cc=pt(u+1,v+1),d=pt(u,v+1);
      if(v>0)H.push([a,b,cc,0]);if(v<V-1)H.push([a,cc,d,0]);
    }
    orient(H);parts.push(H);
  }
  return [].concat(...parts);
}
function steinerPts(outer,holes,step,clear){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of outer){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}
  const inside=(pt,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};
  const segD=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1e-12;let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
  const loops=[outer,...holes],out=[];
  for(let y=y0+step/2,r=0;y<y1;y+=step*0.866,r++)for(let x=x0+step/2+(r%2?step/2:0);x<x1;x+=step){
    const jh=Math.sin(x*12.9898+y*78.233)*43758.5453,jx=(jh-Math.floor(jh)-0.5)*step*0.18,jy=((jh*1.7)-Math.floor(jh*1.7)-0.5)*step*0.18;
    const p=[x+jx,y+jy];if(!inside(p,outer)||holes.some(h=>inside(p,h)))continue;
    let ok=true;for(const l of loops){for(let i=0;i<l.length&&ok;i++)if(segD(p,l[i],l[(i+1)%l.length])<clear)ok=false;if(!ok)break;}
    if(ok)out.push(p);}
  return out;
}
// top of the plateau with legend pockets: surface faces, pocket walls and floors (up-normal convention)
function pocketTop(ring,shapes,depth,P,D,offx){
  const zs=(x,y)=>zPlateau(x,y,P,D);
  const loops=[];
  for(const s of shapes){loops.push(s.outer);for(const h of s.holes)loops.push(h);}
  const pipf=(pt,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};
  const info=loops.map(l=>({l:(LEG.area(l)>0?l:l.slice().reverse()),depth:1}));
  info.forEach((o,i)=>{o.depth=1+info.filter((q,j)=>j!==i&&pipf(o.l[0],q.l)).length;});
  const ring2=ring.map(p=>[p[0],p[1]]);const ringZ=new Map(ring.map(p=>[p[0]+","+p[1],p[2]]));
  const root={l:ring2,depth:0};
  const all=[root,...info];
  const kids=o=>info.filter(q=>q.depth===o.depth+1&&(o===root||pipf(q.l[0],o.l)));
  const T=[],m3=3,sh=p=>[p[0]+offx,p[1],p[2]];
  const face=(outer,holes,zf,mat,refine)=>{const {poly,tris}=LEG.triangulate({outer,holes},refine?steinerPts(outer,holes,0.9,0.35):null);
    const V=poly.map(p=>sh([p[0],p[1],zf(p[0],p[1])]));for(const [a,b,c] of tris)T.push([V[a],V[b],V[c],mat]);};
  for(const o of all){
    const holes=kids(o).map(q=>q.l.slice().reverse());
    if(o.depth%2===0)face(o.l,holes,(x,y)=>{const z=ringZ.get(x+","+y);return z!==undefined?z:zs(x,y);},0,true);
    else face(o.l,holes,(x,y)=>zs(x,y)-depth,m3);
  }
  for(const o of info){ // walls; loop is CCW. odd depth: air inside -> normal inward
    const l=o.l,n=l.length,inward=o.depth%2===1;
    for(let i=0;i<n;i++){const p=l[i],q=l[(i+1)%n];
      const pt=sh([p[0],p[1],zs(p[0],p[1])]),qt=sh([q[0],q[1],zs(q[0],q[1])]),pb=sh([p[0],p[1],zs(p[0],p[1])-depth]),qb=sh([q[0],q[1],zs(q[0],q[1])-depth]);
      if(inward){T.push([pb,qt,qb,m3]);T.push([pb,pt,qt,m3]);}else{T.push([pb,qb,qt,m3]);T.push([pb,qt,pt,m3]);}}
  }
  return T;
}

// ===== 3MF (Bambu Studio / OrcaSlicer layout: one object per key, one part per mesh) =====
function uuid4(){const b=new Uint8Array(16);(typeof crypto!=="undefined"&&crypto.getRandomValues)?crypto.getRandomValues(b):b.forEach((_,i)=>b[i]=Math.random()*256|0);
  b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,"0")).join("");
  return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);}
function xmlEsc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));}
function meshXml(T){
  const idx=new Map(),V=[],F=[];
  const f5=v=>(Math.abs(v)<5e-6?0:v).toFixed(5);const vi=p=>{const k=f5(p[0])+","+f5(p[1])+","+f5(p[2]);let i=idx.get(k);if(i===undefined){i=V.length;idx.set(k,i);V.push(k);}return i;};
  for(const t of T){const a=vi(t[0]),b=vi(t[1]),c=vi(t[2]);if(a!==b&&b!==c&&a!==c)F.push(a,b,c);}
  const out=["<mesh><vertices>"];
  for(const v of V){const [x,y,z]=v.split(",");out.push(`<vertex x="${+x}" y="${+y}" z="${+z}"/>`);}
  out.push("</vertices><triangles>");
  for(let i=0;i<F.length;i+=3)out.push(`<triangle v1="${F[i]}" v2="${F[i+1]}" v3="${F[i+2]}"/>`);
  out.push("</triangles></mesh>");
  return out.join("");
}
// items: [{name, x, y, parts:[{name, tris, extruder}]}]
function build3MF(items){
  const enc=s=>new TextEncoder().encode(s),files=[];
  const NS='xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"';
  let nextId=1;const rootObjs=[],buildItems=[],rels=[],cfg=[];
  items.forEach((it,k)=>{
    const path="/3D/Objects/object_"+(k+1)+".model";
    const parts=it.parts.filter(p=>p.tris.length).map(p=>({...p,id:nextId++,uuid:uuid4()}));
    const objXml=[`<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" ${NS}>`,
      `<metadata name="BambuStudio:3mfVersion">1</metadata><resources>`];
    for(const p of parts)objXml.push(`<object id="${p.id}" p:UUID="${p.uuid}" type="model">${meshXml(p.tris)}</object>`);
    objXml.push(`</resources><build/></model>`);
    files.push({name:path.slice(1),data:enc(objXml.join("\n"))});
    rels.push(`<Relationship Target="${path}" Id="rel-${k+1}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>`);
    const oid=nextId++;
    rootObjs.push(`<object id="${oid}" p:UUID="${uuid4()}" type="model"><components>`+
      parts.map(p=>`<component p:path="${path}" objectid="${p.id}" p:UUID="${uuid4()}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`).join("")+`</components></object>`);
    buildItems.push(`<item objectid="${oid}" p:UUID="${uuid4()}" transform="1 0 0 0 1 0 0 0 1 ${+it.x.toFixed(3)} ${+it.y.toFixed(3)} 0" printable="1"/>`);
    cfg.push(`  <object id="${oid}">\n    <metadata key="name" value="${xmlEsc(it.name)}"/>\n    <metadata key="extruder" value="${parts[0]?parts[0].extruder:1}"/>\n`+
      parts.map(p=>`    <part id="${p.id}" subtype="normal_part">\n      <metadata key="name" value="${xmlEsc(p.name)}"/>\n      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n      <metadata key="extruder" value="${p.extruder}"/>\n    </part>`).join("\n")+`\n  </object>`);
  });
  files.unshift({name:"3D/3dmodel.model",data:enc(`<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" ${NS}>\n<metadata name="Application">BambuStudio-01.10.00.00</metadata>\n<metadata name="BambuStudio:3mfVersion">1</metadata>\n<metadata name="Title">LAK keycaps</metadata>\n<resources>\n${rootObjs.join("\n")}\n</resources>\n<build p:UUID="${uuid4()}">\n${buildItems.join("\n")}\n</build>\n</model>\n`)});
  files.unshift({name:"3D/_rels/3dmodel.model.rels",data:enc(`<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n${rels.join("\n")}\n</Relationships>\n`)});
  files.unshift({name:"_rels/.rels",data:enc(`<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n`)});
  files.unshift({name:"[Content_Types].xml",data:enc(`<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n<Default Extension="config" ContentType="text/xml"/>\n</Types>\n`)});
  files.push({name:"Metadata/model_settings.config",data:enc(`<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${cfg.join("\n")}\n</config>\n`)});
  return makeZipAsync(files);
}
// grid layout on a square plate, centred
function plateLayout(n,pitch,plate){
  const gap=3,step=pitch+gap,cols=Math.max(1,Math.min(n,Math.floor((plate-10)/step)));const rows=Math.ceil(n/cols);
  const w=(cols-1)*step,h=(rows-1)*step,out=[];
  for(let i=0;i<n;i++){const c=i%cols,r=Math.floor(i/cols);out.push([plate/2-w/2+c*step,plate/2+h/2-r*step]);}
  return out;
}
function toSTL(T){
  const buf=new ArrayBuffer(84+50*T.length),dv=new DataView(buf);
  const hdr="LAK keycap Choc V2";for(let i=0;i<hdr.length;i++)dv.setUint8(i,hdr.charCodeAt(i));
  dv.setUint32(80,T.length,true);let o=84;
  for(const t of T){
    const[a,b,c]=t,u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    let n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];const l=Math.hypot(...n)||1;n=n.map(x=>x/l);
    for(const v of [n,a,b,c])for(let k=0;k<3;k++){dv.setFloat32(o,v[k],true);o+=4;}
    dv.setUint16(o,0,true);o+=2;
  }
  return new Uint8Array(buf);
}
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(d){let c=0xFFFFFFFF;for(let i=0;i<d.length;i++)c=CRC[(c^d[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
async function makeZipAsync(files){
  if(typeof CompressionStream==="undefined")return makeZip(files);
  const out=[];
  for(const f of files){
    const raw=f.data;let comp=null;
    try{comp=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());}catch(_){comp=null;}
    out.push(comp&&comp.length<raw.length?{name:f.name,data:comp,raw:raw.length,crc:crc32(raw),method:8}:{name:f.name,data:raw});
  }
  return makeZip(out);
}
function makeZip(files){
  const enc=new TextEncoder(),chunks=[],central=[];let off=0;
  for(const f of files){
    const name=enc.encode(f.name),data=f.data,crc=f.crc!==undefined?f.crc:crc32(data),meth=f.method||0,usize=f.raw!==undefined?f.raw:data.length;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x800,true);lh.setUint16(8,meth,true);
    lh.setUint16(10,0,true);lh.setUint16(12,0x21,true);lh.setUint32(14,crc,true);
    lh.setUint32(18,data.length,true);lh.setUint32(22,usize,true);lh.setUint16(26,name.length,true);lh.setUint16(28,0,true);
    chunks.push(new Uint8Array(lh.buffer),name,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x800,true);ch.setUint16(10,meth,true);
    ch.setUint16(12,0,true);ch.setUint16(14,0x21,true);ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,usize,true);
    ch.setUint16(28,name.length,true);ch.setUint16(30,0,true);ch.setUint16(32,0,true);ch.setUint16(34,0,true);ch.setUint16(36,0,true);
    ch.setUint32(38,0,true);ch.setUint32(42,off,true);
    central.push(new Uint8Array(ch.buffer),name);
    off+=30+name.length+data.length;
  }
  const cdSize=central.reduce((s,c)=>s+c.length,0);
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);
  end.setUint32(12,cdSize,true);end.setUint32(16,off,true);
  return new Blob([...chunks,...central,new Uint8Array(end.buffer)],{type:"application/zip"});
}
