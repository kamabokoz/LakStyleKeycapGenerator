// legend.js — text rasterising, contour tracing, triangulation and extrusion for legends
// LAK風キーキャップジェネレータ / MIT License

// ===== legend geometry =====
const LEG=(()=>{
  // --- marching squares on a float grid (values 0..1), math coords (y up), inside = v>=0.5 ---
  function contours(val,W,H){
    const g=(i,j)=>(i<0||j<0||i>=W||j>=H)?0:val[(H-1-j)*W+i]; // val is image rows top->bottom
    const segs=new Map();
    const P=(k,x,y)=>({k,x,y});
    const lerp=(a,b)=>{const d=b-a;return Math.abs(d)<1e-9?0.5:Math.min(1,Math.max(0,(0.5-a)/d));};
    for(let j=-1;j<H;j++)for(let i=-1;i<W;i++){
      const a=g(i,j),b=g(i+1,j),c=g(i+1,j+1),d=g(i,j+1);
      const idx=(a>=.5?1:0)|(b>=.5?2:0)|(c>=.5?4:0)|(d>=.5?8:0);
      if(idx===0||idx===15)continue;
      const e=[
        ()=>P("h"+i+","+j,i+lerp(a,b),j),
        ()=>P("v"+(i+1)+","+j,i+1,j+lerp(b,c)),
        ()=>P("h"+i+","+(j+1),i+lerp(d,c),j+1),
        ()=>P("v"+i+","+j,i,j+lerp(a,d))];
      const add=(s,t)=>{const A=e[s](),B=e[t]();segs.set(A.k,{a:A,b:B});};
      const center=(a+b+c+d)/4>=.5;
      switch(idx){
        case 1:add(0,3);break; case 2:add(1,0);break; case 4:add(2,1);break; case 8:add(3,2);break;
        case 14:add(3,0);break; case 13:add(0,1);break; case 11:add(1,2);break; case 7:add(2,3);break;
        case 3:add(1,3);break; case 6:add(2,0);break; case 12:add(3,1);break; case 9:add(0,2);break;
        case 5:if(center){add(0,1);add(2,3);}else{add(0,3);add(2,1);}break;
        case 10:if(center){add(3,0);add(1,2);}else{add(1,0);add(3,2);}break;
      }
    }
    const loops=[];
    while(segs.size){
      const [k0,s0]=segs.entries().next().value;segs.delete(k0);
      const loop=[[s0.a.x,s0.a.y]];let cur=s0;let guard=0;
      while(guard++<1e6){const nx=segs.get(cur.b.k);if(!nx)break;segs.delete(cur.b.k);loop.push([nx.a.x,nx.a.y]);cur=nx;}
      if(loop.length>=3)loops.push(loop);
    }
    return loops;
  }
  function area(p){let s=0;for(let i=0,n=p.length;i<n;i++){const a=p[i],b=p[(i+1)%n];s+=a[0]*b[1]-b[0]*a[1];}return s/2;}
  function rdpClosed(p,eps){
    if(p.length<8)return p;
    // split at two far points
    let i0=0,i1=0,best=-1;for(let i=0;i<p.length;i++){const d=(p[i][0]-p[0][0])**2+(p[i][1]-p[0][1])**2;if(d>best){best=d;i1=i;}}
    const A=p.slice(i0,i1+1),B=p.slice(i1).concat([p[0]]);
    const ra=rdp(A,eps),rb=rdp(B,eps);
    return ra.slice(0,-1).concat(rb.slice(0,-1));
  }
  function rdp(pts,eps){
    if(pts.length<3)return pts.slice();
    const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;
    const st=[[0,pts.length-1]];
    while(st.length){const [s,e]=st.pop();const [ax,ay]=pts[s],[bx,by]=pts[e];const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy)||1e-12;
      let md=-1,mi=-1;for(let i=s+1;i<e;i++){const d=Math.abs((pts[i][0]-ax)*dy-(pts[i][1]-ay)*dx)/L;if(d>md){md=d;mi=i;}}
      if(md>eps){keep[mi]=1;st.push([s,mi],[mi,e]);}}
    return pts.filter((_,i)=>keep[i]);
  }
  function pip(pt,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
  // group loops into {outer, holes}
  function group(loops,minArea){
    const L=loops.map(p=>({p,a:area(p)})).filter(o=>Math.abs(o.a)>=minArea);
    const outers=L.filter(o=>o.a>0).map(o=>({outer:o.p,a:o.a,holes:[]}));
    for(const h of L.filter(o=>o.a<0)){
      let best=null;for(const o of outers){if(pip(h.p[0],o.outer)&&(!best||o.a<best.a))best=o;}
      if(best)best.holes.push(h.p);
    }
    return outers;
  }
  // --- triangulation: bridge holes then ear clip ---
  function cross(o,a,b){return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);}
  function segInter(p,q,r,s){ // proper intersection
    const d1=cross(p,q,r),d2=cross(p,q,s),d3=cross(r,s,p),d4=cross(r,s,q);
    return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));
  }
  function sectorOk(poly,i,M){
    const n=poly.length,P=poly[i],A=poly[(i+n-1)%n],B=poly[(i+1)%n];
    const ang=q=>Math.atan2(q[1]-P[1],q[0]-P[0]);const tw=Math.PI*2;
    const norm=a=>((a%tw)+tw)%tw;
    const b=ang(B),a=norm(ang(A)-b),m=norm(ang(M)-b);
    return m>1e-9&&m<a-1e-9;
  }
  function bridge(outer,holes){
    let poly=outer.slice();
    const hs=holes.map(h=>{let mi=0;for(let i=1;i<h.length;i++)if(h[i][0]>h[mi][0])mi=i;return{h,mi,mx:h[mi][0]};}).sort((a,b)=>b.mx-a.mx);
    for(const {h,mi} of hs){
      const M=h[mi];
      // candidate vertices on poly visible from M, prefer to the right and closest
      let bi=-1,bd=Infinity;
      const order=poly.map((p,i)=>({i,d:(p[0]>=M[0]-1e-9?0:1e6)+Math.hypot(p[0]-M[0],p[1]-M[1])})).sort((a,b)=>a.d-b.d);
      const allHoles=hs.map(o=>o.h);
      for(const {i} of order){
        const P=poly[i];let ok=true;
        for(let k=0;k<poly.length&&ok;k++){const a=poly[k],b=poly[(k+1)%poly.length];if(a===P||b===P)continue;if(segInter(M,P,a,b))ok=false;}
        for(const H of allHoles){if(!ok)break;for(let k=0;k<H.length;k++){const a=H[k],b=H[(k+1)%H.length];if(a===M||b===M)continue;if(segInter(M,P,a,b)){ok=false;break;}}}
        if(ok&&!sectorOk(poly,i,M))ok=false;
        if(ok){bi=i;break;}
      }
      if(bi<0)continue;
      const hr=h.length===1?[M]:h.slice(mi).concat(h.slice(0,mi+1));
      poly=poly.slice(0,bi+1).concat(hr,[poly[bi]],poly.slice(bi+1));
    }
    return poly;
  }
  function inTri(p,a,b,c){const d1=cross(a,b,p),d2=cross(b,c,p),d3=cross(c,a,p);return d1>=-1e-12&&d2>=-1e-12&&d3>=-1e-12;}
  function earclip(poly){
    const idx=poly.map((_,i)=>i),tris=[];let guard=0;
    while(idx.length>3&&guard++<50000){
      let found=false;const n=idx.length;
      for(let k=0;k<n;k++){
        const i0=idx[(k+n-1)%n],i1=idx[k],i2=idx[(k+1)%n];const a=poly[i0],b=poly[i1],c=poly[i2];
        if(cross(a,b,c)<=1e-12)continue;
        let ok=true;
        for(let m=0;m<n;m++){const j=idx[m];if(j===i0||j===i1||j===i2)continue;const p=poly[j];
          if((p[0]===a[0]&&p[1]===a[1])||(p[0]===b[0]&&p[1]===b[1])||(p[0]===c[0]&&p[1]===c[1]))continue;
          if(inTri(p,a,b,c)){ok=false;break;}}
        if(ok){tris.push([i0,i1,i2]);idx.splice(k,1);found=true;break;}
      }
      if(!found){ // degenerate: remove a near-collinear vertex
        let best=0,bv=Infinity;for(let k=0;k<n;k++){const a=poly[idx[(k+n-1)%n]],b=poly[idx[k]],c=poly[idx[(k+1)%n]];const v=Math.abs(cross(a,b,c));if(v<bv){bv=v;best=k;}}
        if(bv<1e-9){tris.push([idx[(best+n-1)%n],idx[best],idx[(best+1)%n]]);idx.splice(best,1);continue;} // keep topology (zero-area)
        // last resort: clip the most convex vertex
        let bk=0,bc=-Infinity;for(let k=0;k<n;k++){const a=poly[idx[(k+n-1)%n]],b=poly[idx[k]],c=poly[idx[(k+1)%n]];const v=cross(a,b,c);if(v>bc){bc=v;bk=k;}}
        tris.push([idx[(bk+n-1)%n],idx[bk],idx[(bk+1)%n]]);idx.splice(bk,1);
      }
    }
    if(idx.length===3&&cross(poly[idx[0]],poly[idx[1]],poly[idx[2]])>0)tris.push([idx[0],idx[1],idx[2]]);
    return tris;
  }
  function weld(poly,tris){const idx=new Map(),remap=[],pts=[];
    poly.forEach((p,i)=>{const k=p[0]+","+p[1];if(idx.has(k))remap[i]=idx.get(k);else{idx.set(k,pts.length);remap[i]=pts.length;pts.push(p);}});
    return{poly:pts,tris:tris.map(t=>t.map(i=>remap[i])).filter(t=>t[0]!==t[1]&&t[1]!==t[2]&&t[0]!==t[2])};}
  // Lawson flips: improve triangle quality without moving the boundary
  function flip(poly,tris){
    const T=tris.map(t=>t.slice()),P=poly;
    const inCirc=(a,b,c,d)=>{const ax=a[0]-d[0],ay=a[1]-d[1],bx=b[0]-d[0],by=b[1]-d[1],cx=c[0]-d[0],cy=c[1]-d[1];
      return (ax*ax+ay*ay)*(bx*cy-cx*by)-(bx*bx+by*by)*(ax*cy-cx*ay)+(cx*cx+cy*cy)*(ax*by-bx*ay);};
    const ek=(a,b)=>a<b?a*1048576+b:b*1048576+a;
    for(let pass=0;pass<40;pass++){
      const E=new Map();T.forEach((t,ti)=>{for(let i=0;i<3;i++){const k=ek(t[i],t[(i+1)%3]);const v=E.get(k);if(v)v.push(ti);else E.set(k,[ti]);}});
      let flips=0;const used=new Uint8Array(T.length);
      for(const [,arr] of E){
        if(arr.length!==2)continue;const [t1,t2]=arr;if(used[t1]||used[t2])continue;
        const A=T[t1],B=T[t2];
        // shared edge a->b in A (A = a,b,c), B contains b->a
        let i=0;for(;i<3;i++){const a=A[i],b=A[(i+1)%3];if(B.some((v,j)=>v===b&&B[(j+1)%3]===a))break;}
        if(i===3)continue;
        const a=A[i],b=A[(i+1)%3],c=A[(i+2)%3],j=B.indexOf(b),d=B[(j+2)%3];
        if(inCirc(P[a],P[b],P[c],P[d])<=1e-12)continue;
        if(cross(P[a],P[d],P[c])<=1e-12||cross(P[d],P[b],P[c])<=1e-12)continue;
        T[t1]=[a,d,c];T[t2]=[d,b,c];used[t1]=used[t2]=1;flips++;
      }
      if(!flips)break;
    }
    return T;
  }
  function triangulate(shape,steiner){const raw=bridge(shape.outer,shape.holes.concat((steiner||[]).map(p=>[p])));
    const w=weld(raw,earclip(raw));return{poly:w.poly,tris:flip(w.poly,w.tris)};}
  // --- extrusion conforming to a surface z(x,y) ---
  function extrude(shapes,zb,zt,m){
    const T=[];
    for(const s of shapes){
      const {poly,tris}=triangulate(s);
      const top=poly.map(p=>[p[0],p[1],zt(p[0],p[1])]),bot=poly.map(p=>[p[0],p[1],zb(p[0],p[1])]);
      for(const [a,b,c] of tris){T.push([top[a],top[b],top[c],m]);T.push([bot[a],bot[c],bot[b],m]);}
      for(const ring of [s.outer,...s.holes]){
        const n=ring.length;
        for(let i=0;i<n;i++){const p=ring[i],q=ring[(i+1)%n];
          const pb=[p[0],p[1],zb(p[0],p[1])],qb=[q[0],q[1],zb(q[0],q[1])],qt=[q[0],q[1],zt(q[0],q[1])],pt=[p[0],p[1],zt(p[0],p[1])];
          T.push([pb,qb,qt,m]);T.push([pb,qt,pt,m]);}
      }
    }
    return T;
  }
  // --- raster text (browser) ---
  const PX=22; // px per mm
  async function textShapes(text,o){ // o:{font,weight,size(mm cap-ish),maxW(mm),cx,cy}
    if(!text)return[];
    const fam=`${o.weight} ${Math.round(o.size*PX/0.72)}px "${o.font}", "IBM Plex Sans JP", "Noto Sans JP", sans-serif`;
    try{if(document.fonts&&document.fonts.load)await document.fonts.load(fam,text);}catch(_){}
    const cv=document.createElement("canvas"),cx=cv.getContext("2d");
    let fpx=Math.round(o.size*PX/0.72);
    const setF=()=>{cx.font=`${o.weight} ${fpx}px "${o.font}", "IBM Plex Sans JP", "Noto Sans JP", sans-serif`;};
    setF();let mt=cx.measureText(text);
    let w=mt.actualBoundingBoxLeft+mt.actualBoundingBoxRight;
    const maxPx=o.maxW*PX;
    if(w>maxPx){fpx=Math.max(6,Math.floor(fpx*maxPx/w));setF();mt=cx.measureText(text);w=mt.actualBoundingBoxLeft+mt.actualBoundingBoxRight;}
    const asc=mt.actualBoundingBoxAscent,des=mt.actualBoundingBoxDescent,h=asc+des;
    const pad=4,W=Math.ceil(w)+pad*2,H=Math.ceil(h)+pad*2;
    cv.width=W;cv.height=H;setF();cx.fillStyle="#000";cx.fillRect(0,0,W,H);cx.fillStyle="#fff";cx.textBaseline="alphabetic";
    cx.fillText(text,pad+mt.actualBoundingBoxLeft,pad+asc);
    const img=cx.getImageData(0,0,W,H).data,val=new Float32Array(W*H);
    for(let i=0;i<W*H;i++)val[i]=img[i*4]/255;
    const loops=contours(val,W,H);
    const s=1/PX,ox=W/2,oy=H/2;
    const dedupe=l=>{const o2=[];for(const p of l){const q=o2[o2.length-1];if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>2e-3)o2.push(p);}
      while(o2.length>3&&Math.hypot(o2[0][0]-o2[o2.length-1][0],o2[0][1]-o2[o2.length-1][1])<=2e-3)o2.pop();return o2;};
    const mm=loops.map(l=>dedupe(rdpClosed(l.map(([x,y])=>[(x-ox)*s+o.cx,(y-oy)*s+o.cy]),0.012))).filter(l=>l.length>=3);
    return group(mm,0.004);
  }
  return{contours,group,triangulate,extrude,textShapes,area,rdpClosed,PX};
})();
