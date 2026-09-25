// zmk.js — minimal ZMK Studio RPC client (protobuf, framing, Web Serial / Web Bluetooth)
// LAK風キーキャップジェネレータ / MIT License

// ===== ZMK Studio RPC client (minimal, dependency-free) =====
const ZS=(()=>{
  // --- protobuf wire helpers ---
  function pushVarint(out,n){n=Math.floor(n);if(n<0)n+=4294967296;while(n>=128){out.push((n%128)|128);n=Math.floor(n/128);}out.push(n);}
  function field(no,wt){return no*8+wt;}
  function encMsg(parts){ // parts: [[no,'v'|'b'|'m'|'s', value]]
    const out=[];
    for(const [no,t,v] of parts){
      if(t==='v'||t==='b'){pushVarint(out,field(no,0));pushVarint(out,t==='b'?(v?1:0):v);}
      else if(t==='m'){pushVarint(out,field(no,2));pushVarint(out,v.length);for(const x of v)out.push(x);}
      else if(t==='s'){const b=new TextEncoder().encode(v);pushVarint(out,field(no,2));pushVarint(out,b.length);for(const x of b)out.push(x);}
    }
    return Uint8Array.from(out);
  }
  function readVarint(b,p){let r=0,m=1,x;do{if(p.i>=b.length)throw new Error("truncated varint");x=b[p.i++];r+=(x&127)*m;m*=128;}while(x&128);return r;}
  function dec(b){ // -> Map(no -> [{wt,v}])
    const m=new Map(),p={i:0};
    while(p.i<b.length){
      const key=readVarint(b,p),no=Math.floor(key/8),wt=key%8;let v;
      if(wt===0)v=readVarint(b,p);
      else if(wt===2){const n=readVarint(b,p);v=b.subarray(p.i,p.i+n);p.i+=n;}
      else if(wt===5){v=b[p.i]|(b[p.i+1]<<8)|(b[p.i+2]<<16)|(b[p.i+3]<<24);p.i+=4;}
      else if(wt===1){p.i+=8;v=0;}
      else throw new Error("bad wire type "+wt);
      if(!m.has(no))m.set(no,[]);m.get(no).push({wt,v});
    }
    return m;
  }
  const one=(m,no)=>{const a=m.get(no);return a?a[a.length-1]:undefined;};
  const num=(m,no,d=0)=>{const f=one(m,no);return f&&f.wt===0?f.v:d;};
  const sint=n=>(n%2)?-(n+1)/2:n/2;
  const u32=n=>n%4294967296;
  const bytes=(m,no)=>{const f=one(m,no);return f&&f.wt===2?f.v:null;};
  const str=(m,no)=>{const b=bytes(m,no);return b?new TextDecoder().decode(b):"";};
  const all=(m,no)=>m.get(no)||[];
  function repeatedU32(m,no){const o=[];for(const f of all(m,no)){if(f.wt===0)o.push(f.v);else if(f.wt===2){const p={i:0};while(p.i<f.v.length)o.push(readVarint(f.v,p));}}return o;}

  // --- framing ---
  const SOF=0xAB,ESC=0xAC,EOF=0xAD;
  function frame(payload){const o=[SOF];for(const x of payload){if(x===SOF||x===ESC||x===EOF)o.push(ESC);o.push(x);}o.push(EOF);return Uint8Array.from(o);}
  class Deframer{
    constructor(cb){this.cb=cb;this.buf=null;this.esc=false;}
    push(chunk){for(const x of chunk){
      if(this.buf===null){if(x===SOF){this.buf=[];this.esc=false;}continue;}
      if(this.esc){this.buf.push(x);this.esc=false;continue;}
      if(x===ESC){this.esc=true;continue;}
      if(x===SOF){this.buf=[];continue;}
      if(x===EOF){const b=Uint8Array.from(this.buf);this.buf=null;try{this.cb(b);}catch(e){console.error(e);}continue;}
      this.buf.push(x);
    }}
  }

  // --- transports ---
  const BLE_SERVICE="00000000-0196-6107-c967-c5cfb1c2482a";
  const BLE_CHAR="00000001-0196-6107-c967-c5cfb1c2482a";
  async function openSerial(){
    if(!("serial" in navigator))throw Object.assign(new Error("このブラウザはUSB接続（Web Serial）に対応していません。"),{code:"unsupported"});
    const port=await navigator.serial.requestPort();
    await port.open({baudRate:12500});
    const writer=port.writable.getWriter();let reader=null,closed=false,onData=null,onClose=null;
    (async()=>{
      try{while(!closed&&port.readable){reader=port.readable.getReader();
        try{for(;;){const {value,done}=await reader.read();if(done)break;if(value&&onData)onData(value);}}
        finally{try{reader.releaseLock();}catch(_){}}}}
      catch(e){}finally{if(onClose)onClose();}
    })();
    return{
      kind:"usb",
      set onData(f){onData=f;},set onClose(f){onClose=f;},
      async write(b){await writer.write(b);},
      async close(){closed=true;try{if(reader)await reader.cancel();}catch(_){}try{writer.releaseLock();}catch(_){}try{await port.close();}catch(_){}}
    };
  }
  // Keyboards usually do not put the Studio service in their advertisement, so a service filter alone finds nothing.
  // First time: list all devices; afterwards: only keyboards that connected successfully before (by name).
  const NAMES_KEY="lakgen:bleNames";
  function knownNames(){try{const a=JSON.parse(localStorage.getItem(NAMES_KEY)||"[]");return Array.isArray(a)?a.filter(x=>typeof x==="string"&&x):[];}catch(_){return[];}}
  function rememberName(n){if(!n)return;try{localStorage.setItem(NAMES_KEY,JSON.stringify([n,...knownNames().filter(x=>x!==n)].slice(0,5)));}catch(_){}}
  async function openBle(all,log){
    log=log||(()=>{});
    if(!("bluetooth" in navigator))throw Object.assign(new Error("このブラウザはBluetooth接続（Web Bluetooth）に対応していません。"),{code:"unsupported"});
    if(navigator.bluetooth.getAvailability){try{const ok=await navigator.bluetooth.getAvailability();log("Bluetoothアダプタ: "+(ok?"利用可能":"見つかりません"));}catch(_){}}
    // same request as ZMK Studio / DYA Studio: devices that expose the Studio service
    // ZMK keyboards advertise the Battery service (with HID, which Web Bluetooth does not allow as a filter)
    const names=all?[]:knownNames();
    const opts=all?{acceptAllDevices:true,optionalServices:[BLE_SERVICE]}
      :{filters:[{services:[BLE_SERVICE]},{services:["battery_service"]},...names.map(name=>({name}))],optionalServices:[BLE_SERVICE]};
    log("デバイス選択: "+(all?"すべてのデバイス":"Studioサービス／バッテリーサービスを持つ機器"+(names.length?"＋前回のキーボード（"+names.join(", ")+"）":"")));
    const dev=await navigator.bluetooth.requestDevice(opts);
    log("選択: "+(dev.name||"(名前なし)"));
    let gatt;
    for(let i=0;i<3;i++){ // the first GATT connection sometimes fails right after pairing
      try{log("GATT接続"+(i?"（再試行"+i+"）":"")+"…");gatt=await dev.gatt.connect();break;}
      catch(e){log("GATT接続に失敗: "+(e&&e.message));if(i===2)throw e;await new Promise(r=>setTimeout(r,800));}
    }
    let svc,ch;
    try{log("Studioサービスを検索…");svc=await gatt.getPrimaryService(BLE_SERVICE);ch=await svc.getCharacteristic(BLE_CHAR);}
    catch(e){log("サービス取得に失敗: "+(e&&e.message));try{gatt.disconnect();}catch(_){}
      throw Object.assign(new Error("「"+(dev.name||"選んだデバイス")+"」にZMK Studioの通信サービスが見つかりません。ファームウェアでStudioのBluetooth接続が有効か、スプリットの場合は左右どちら（central側）を選んだか確認してください。"),{code:"no_service"});}
    const pr=ch.properties;log("特性: "+["read","write","writeWithoutResponse","notify","indicate"].filter(k=>pr[k]).join(", "));
    let onData=null,onClose=null;
    ch.addEventListener("characteristicvaluechanged",e=>{const v=e.target.value;if(onData)onData(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));});
    dev.addEventListener("gattserverdisconnected",()=>{log("切断されました");if(onClose)onClose();});
    try{await ch.startNotifications();log("通知の受信を開始");rememberName(dev.name);}
    catch(e){log("通知の開始に失敗: "+(e&&e.message));throw Object.assign(new Error("キーボードからの通知を受け取れませんでした（"+(e&&e.message)+"）。キーボードをアンロックしてから、もう一度接続してください。"),{code:"notify"});}
    return{
      kind:"ble",name:dev.name,
      set onData(f){onData=f;},set onClose(f){onClose=f;},
      async write(b){ // prefer write-without-response when offered (this is what worked on real keyboards)
        const noResp=pr.writeWithoutResponse&&ch.writeValueWithoutResponse;
        for(let i=0;i<b.length;i+=180){const part=b.subarray(i,i+180);
          try{if(noResp)await ch.writeValueWithoutResponse(part);else if(ch.writeValueWithResponse)await ch.writeValueWithResponse(part);else await ch.writeValue(part);}
          catch(e){log("書き込みに失敗: "+(e&&e.message));
            if(!noResp&&pr.writeWithoutResponse&&ch.writeValueWithoutResponse)await ch.writeValueWithoutResponse(part);
            else if(noResp&&pr.write)await ch.writeValue(part);else throw e;}}},
      async close(){try{gatt.disconnect();}catch(_){}}
    };
  }

  // --- client ---
  class Client{
    constructor(tr){
      this.tr=tr;this.nextId=1;this.pending=new Map();this.onNotify=null;this.onClose=null;
      this.def=new Deframer(b=>this._msg(b));
      this.rxBytes=0;this.lastRx=0;this.onProgress=null;
      tr.onData=d=>{this.rxBytes+=d.length;this.lastRx=Date.now();if(this.onProgress)this.onProgress(this.rxBytes);this.def.push(d);};
      tr.onClose=()=>{for(const [,p] of this.pending)p.reject(Object.assign(new Error("接続が切れました"),{code:"closed"}));this.pending.clear();if(this.onClose)this.onClose();};
    }
    _msg(b){
      const r=dec(b);const rr=bytes(r,1),nt=bytes(r,2);
      if(rr){const m=dec(rr),id=num(m,1),p=this.pending.get(id);if(!p)return;this.pending.delete(id);clearTimeout(p.t);
        const meta=bytes(m,2);
        if(meta){const mm=dec(meta);const e=Object.assign(new Error("キーボードが要求を拒否しました（ロック中の可能性）"),{code:"meta",detail:num(mm,2,-1)});p.reject(e);return;}
        for(const sub of [3,4,5]){const s=bytes(m,sub);if(s){p.resolve({sub,msg:dec(s)});return;}}
        p.resolve({sub:0,msg:new Map()});
      }else if(nt&&this.onNotify){this.onNotify(dec(nt));}
    }
    call(sub,inner,idle=8000,max=120000){
      const id=this.nextId++,start=Date.now();
      const payload=encMsg([[1,'v',id],[sub,'m',inner]]);
      return new Promise((resolve,reject)=>{
        const p={resolve,reject,t:0};
        const tick=()=>{ // fail only when nothing has arrived for `idle` ms (or after `max` ms in total)
          const quiet=Date.now()-Math.max(start,this.lastRx);
          if(quiet>=idle||Date.now()-start>=max){this.pending.delete(id);reject(Object.assign(new Error("キーボードから応答がありません"),{code:"timeout"}));}
          else p.t=setTimeout(tick,Math.min(1000,idle-quiet+10));
        };
        p.t=setTimeout(tick,idle);
        this.pending.set(id,p);
        this.tr.write(frame(payload)).catch(e=>{clearTimeout(p.t);this.pending.delete(id);reject(e);});
      });
    }
    async deviceName(){try{const r=await this.call(3,encMsg([[1,'b',true]]));const info=bytes(r.msg,1);return info?str(dec(info),1):"";}catch(_){return"";}}
    async keymap(){const r=await this.call(5,encMsg([[1,'b',true]]));const km=bytes(r.msg,1);if(!km)throw Object.assign(new Error("キーマップを取得できませんでした"),{code:"empty"});return parseKeymap(dec(km));}
    async layouts(){const r=await this.call(5,encMsg([[6,'b',true]]));const pl=bytes(r.msg,6);return pl?parseLayouts(dec(pl)):{active:0,layouts:[]};}
    async behaviors(){
      const r=await this.call(4,encMsg([[1,'b',true]]));const lb=bytes(r.msg,1);const ids=lb?repeatedU32(dec(lb),1):[];
      const out={};
      for(const id of ids){
        try{const d=await this.call(4,encMsg([[2,'m',encMsg([[1,'v',id]])]]));const det=bytes(d.msg,2);if(!det)continue;
          const m=dec(det);out[id]={name:str(m,2),consts:parseConsts(m)};}catch(e){if(e.code==="closed")throw e;}
      }
      return out;
    }
    async close(){await this.tr.close();}
  }
  function parseConsts(m){ // metadata -> {p1:{value:name}, p2:{value:name}, p1Layer:bool, p1Hid:bool...}
    const c={p1:{},p2:{},p1Kind:"",p2Kind:""};
    for(const s of all(m,3)){if(s.wt!==2)continue;const set=dec(s.v);
      for(const [pn,key] of [[1,"p1"],[2,"p2"]])for(const d of all(set,pn)){if(d.wt!==2)continue;const vd=dec(d.v);const nm=str(vd,1);
        if(one(vd,3))c[key][num(vd,3)]=nm;
        if(one(vd,5))c[key+"Kind"]="hid";
        if(one(vd,6))c[key+"Kind"]="layer";
      }}
    return c;
  }
  function parseKeymap(m){
    const layers=[];
    for(const f of all(m,1)){if(f.wt!==2)continue;const L=dec(f.v);
      // heuristic: varint field -> id, string field -> name, repeated submessages -> bindings
      let id=null,name="",bind=null;
      for(const [no,arr] of L){
        if(arr[0].wt===0&&id===null)id=arr[0].v;
        else if(arr[0].wt===2){
          if(arr.length>1||!isText(arr[0].v)){if(!bind||arr.length>bind.length)bind=arr;}
          else if(!name)name=new TextDecoder().decode(arr[0].v);
        }
      }
      const bindings=(bind||[]).map(b=>{const bm=dec(b.v);return{b:sint(num(bm,1)),p1:u32(num(bm,2)),p2:u32(num(bm,3))};});
      layers.push({id:id===null?layers.length:id,name,bindings});
    }
    return layers;
  }
  function isText(b){if(!b.length)return true;for(const x of b){if(x<9||(x>13&&x<32&&x!==27))return false;}try{new TextDecoder("utf-8",{fatal:true}).decode(b);return true;}catch(_){return false;}}
  function parseLayouts(m){
    const layouts=[];
    for(const f of all(m,2)){if(f.wt!==2)continue;const L=dec(f.v);
      const keys=all(L,2).filter(k=>k.wt===2).map(k=>{const km=dec(k.v);const g=n=>sint(num(km,n));return{w:g(1),h:g(2),x:g(3),y:g(4),r:g(5),rx:g(6),ry:g(7)};});
      layouts.push({name:str(L,1),keys});}
    return{active:num(m,1),layouts};
  }
  return{Client,openSerial,openBle,knownNames,encMsg,dec,frame,Deframer,parseKeymap,parseLayouts,_test:{pushVarint}};
})();
