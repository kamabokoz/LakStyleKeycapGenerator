// vial.js — Vial / VIA support: WebHID client, .vil files, keyboard definitions (KLE), QMK keycode labels
// LAK風キーキャップジェネレータ / MIT License

const VIAL=(()=>{
  // ===== XZ / LZMA decoder (the Vial definition stored in the keyboard is xz-compressed JSON) =====
  function lzmaDecoder(out){
    // out: growable byte sink {buf, len}
    let lc=0,lp=0,pb=0,probs=null,state=0,rep0=0,rep1=0,rep2=0,rep3=0;
    let src=null,sp=0,range=0,code=0;
    const P=(n)=>{const a=new Uint16Array(n);a.fill(1024);return a;};
    let isMatch,isRep,isRepG0,isRepG1,isRepG2,isRep0Long,posSlot,posDec,align,lit,lenD,repD;
    const lenCoder=()=>({choice:P(2),low:P(16<<3),mid:P(16<<3),high:P(256)});
    function setProps(d){if(d>=225)throw new Error("LZMA: 不正なプロパティ");lc=d%9;d=(d/9)|0;lp=d%5;pb=(d/5)|0;}
    function resetState(){
      isMatch=P(12<<4);isRep=P(12);isRepG0=P(12);isRepG1=P(12);isRepG2=P(12);isRep0Long=P(12<<4);
      posSlot=P(4<<6);posDec=P(115);align=P(16);lit=P(0x300<<(lc+lp));lenD=lenCoder();repD=lenCoder();
      state=0;rep0=rep1=rep2=rep3=0;
    }
    function initRc(s,p){src=s;sp=p;if(src[sp++]!==0)throw new Error("LZMA: 範囲符号の開始が不正");code=0;range=0xFFFFFFFF;for(let i=0;i<4;i++)code=((code<<8)|src[sp++])>>>0;}
    function norm(){if(range<0x1000000){range=(range<<8)>>>0;code=((code<<8)|src[sp++])>>>0;}}
    function bit(pr,i){const p=pr[i],bound=(range>>>11)*p;
      if(code<bound){range=bound;pr[i]=p+((2048-p)>>5);norm();return 0;}
      range-=bound;code-=bound;pr[i]=p-(p>>5);norm();return 1;}
    function tree(pr,base,n){let m=1;for(let i=0;i<n;i++)m=(m<<1)|bit(pr,base+m);return m-(1<<n);}
    function rtree(pr,base,n){let m=1,s=0;for(let i=0;i<n;i++){const b=bit(pr,base+m);m=(m<<1)+b;s|=b<<i;}return s;}
    function direct(n){let r=0;for(let i=0;i<n;i++){range=range>>>1;let b=0;if(code>=range){code-=range;b=1;}r=(r*2)+b;norm();}return r;}
    function decLen(L,ps){if(!bit(L.choice,0))return tree(L.low,ps<<3,3);if(!bit(L.choice,1))return 8+tree(L.mid,ps<<3,3);return 16+tree(L.high,0,8);}
    function put(b){if(out.len>=out.buf.length){const nb=new Uint8Array(out.buf.length*2+1024);nb.set(out.buf);out.buf=nb;}out.buf[out.len++]=b;}
    // decode until `limit` output bytes (or the end marker when limit<0)
    function run(limit){
      const end=limit<0?Infinity:out.len+limit;
      while(out.len<end){
        const pos=out.len,ps=pos&((1<<pb)-1);
        if(!bit(isMatch,(state<<4)+ps)){
          const prev=pos>0?out.buf[pos-1]:0,base=0x300*(((pos&((1<<lp)-1))<<lc)+(prev>>(8-lc)));
          let s=1;
          if(state>=7){let mb=out.buf[pos-rep0-1];
            do{const m=(mb>>7)&1;mb=(mb<<1)&255;const b=bit(lit,base+((1+m)<<8)+s);s=(s<<1)|b;if(m!==b)break;}while(s<0x100);}
          while(s<0x100)s=(s<<1)|bit(lit,base+s);
          put(s&255);state=state<4?0:state<10?state-3:state-6;continue;
        }
        let len;
        if(!bit(isRep,state)){
          rep3=rep2;rep2=rep1;rep1=rep0;len=decLen(lenD,ps);state=state<7?7:10;
          const ls=Math.min(len,3),slot=tree(posSlot,ls<<6,6);
          if(slot<4)rep0=slot;
          else{const nd=(slot>>1)-1;let d=(2|(slot&1))*Math.pow(2,nd);
            if(slot<14)d+=rtree(posDec,d-slot,nd);else d+=direct(nd-4)*16+rtree(align,0,4);
            rep0=d;}
          if(rep0>=0xFFFFFFFF)return true; // end marker
        }else{
          if(!bit(isRepG0,state)){
            if(!bit(isRep0Long,(state<<4)+ps)){state=state<7?9:11;put(out.buf[pos-rep0-1]);continue;}
          }else{let d;
            if(!bit(isRepG1,state))d=rep1;else{if(!bit(isRepG2,state))d=rep2;else{d=rep3;rep3=rep2;}rep2=rep1;}
            rep1=rep0;rep0=d;}
          len=decLen(repD,ps);state=state<7?8:11;
        }
        if(rep0+1>out.len)throw new Error("LZMA: 参照位置が不正");
        for(let i=0;i<len+2&&out.len<end;i++)put(out.buf[out.len-rep0-1]);
      }
      return false;
    }
    return{setProps,resetState,initRc,run,get sp(){return sp;},get lc(){return lc;}};
  }
  function lzma2(buf,p,out){
    const D=lzmaDecoder(out);let propsSet=false;
    for(;;){
      const c=buf[p++];
      if(c===0x00)return p;
      if(c===0x01||c===0x02){const n=((buf[p]<<8)|buf[p+1])+1;p+=2;for(let i=0;i<n;i++){if(out.len>=out.buf.length){const nb=new Uint8Array(out.buf.length*2+n);nb.set(out.buf);out.buf=nb;}out.buf[out.len++]=buf[p+i];}p+=n;continue;}
      if(c<0x80)throw new Error("LZMA2: 不正なチャンク");
      const un=((c&0x1F)<<16)+(buf[p]<<8)+buf[p+1]+1,pk=((buf[p+2]<<8)|buf[p+3])+1;p+=4;
      const mode=(c>>5)&3;
      if(mode>=2){D.setProps(buf[p++]);propsSet=true;}
      if(!propsSet)throw new Error("LZMA2: プロパティがありません");
      if(mode>=1)D.resetState();
      D.initRc(buf,p);D.run(un);p+=pk;
    }
  }
  function unxz(buf){
    const out={buf:new Uint8Array(Math.max(4096,buf.length*6)),len:0};
    if(buf[0]===0xFD&&buf[1]===0x37&&buf[2]===0x7A&&buf[3]===0x58&&buf[4]===0x5A&&buf[5]===0){
      let p=12;
      for(;;){ // blocks until the index (header size byte 0 = index indicator)
        const hs=buf[p];if(hs===0)break;
        const hsz=(hs+1)*4,flags=buf[p+1];let q=p+2;
        const rd=()=>{let v=0,m=1,b;do{b=buf[q++];v+=(b&127)*m;m*=128;}while(b&128);return v;};
        if(flags&0x40)rd();if(flags&0x80)rd();
        const nf=(flags&3)+1;for(let i=0;i<nf;i++){const id=rd(),ps=rd();if(id!==0x21&&i===nf-1)throw new Error("XZ: LZMA2以外のフィルタ");q+=ps;}
        p+=hsz;const start=p;p=lzma2(buf,p,out);
        while((p-start)%4)p++;
        const chk=buf[7]&0x0F;p+=chk===0?0:chk===1?4:chk===4?8:chk===10?32:0;
      }
    }else{ // .lzma (alone) format
      const D=lzmaDecoder(out);D.setProps(buf[0]);D.resetState();
      let size=0;for(let i=0;i<8;i++)size+=buf[5+i]*Math.pow(2,8*i);
      const known=!(buf[5]===255&&buf[6]===255&&buf[12]===255);
      D.initRc(buf,13);D.run(known?size:-1);
    }
    return out.buf.subarray(0,out.len);
  }

  // ===== KLE (keyboard-layout-editor) parsing, as used by VIA / Vial definitions =====
  const LABEL_MAP=[[0,6,2,8,9,11,3,5,1,4,7,10],[1,7,-1,-1,9,11,4,-1,-1,-1,-1,10],[3,-1,5,-1,9,11,-1,-1,4,-1,-1,10],[4,-1,-1,-1,9,11,-1,-1,-1,-1,-1,10],
    [0,6,2,8,10,-1,3,5,1,4,7,-1],[1,7,-1,-1,10,-1,4,-1,-1,-1,-1,-1],[3,-1,5,-1,10,-1,-1,-1,4,-1,-1,-1],[4,-1,-1,-1,10,-1,-1,-1,-1,-1,-1,-1]];
  function kle(rows){
    const keys=[];let cur={x:0,y:0,w:1,h:1,r:0,rx:0,ry:0,decal:false},align=4;const cl={x:0,y:0};
    for(const row of rows){
      if(!Array.isArray(row))continue; // metadata
      for(let k=0;k<row.length;k++){
        const it=row[k];
        if(typeof it==="string"){
          const raw=it.split("\n"),labels=new Array(12).fill("");
          raw.forEach((t,i)=>{const m=(LABEL_MAP[align]||LABEL_MAP[4])[i];if(m>=0&&m!==undefined)labels[m]=t;});
          keys.push({x:cur.x,y:cur.y,w:cur.w,h:cur.h,r:cur.r,rx:cur.rx,ry:cur.ry,decal:cur.decal,labels});
          cur.x+=cur.w;cur.w=1;cur.h=1;cur.decal=false;
        }else if(it&&typeof it==="object"){
          if(it.r!=null)cur.r=it.r;
          if(it.rx!=null){cur.rx=cl.x=it.rx;cur.x=cl.x;cur.y=cl.y;}
          if(it.ry!=null){cur.ry=cl.y=it.ry;cur.x=cl.x;cur.y=cl.y;}
          if(it.a!=null)align=it.a;
          if(it.x)cur.x+=it.x;if(it.y)cur.y+=it.y;
          if(it.w)cur.w=it.w;if(it.h)cur.h=it.h;
          if(it.d)cur.decal=true;
        }
      }
      cur.y+=1;cur.x=cur.rx;
    }
    return keys;
  }
  // layout option groups from definition labels: [{name, choices:[...], bits}]
  function optionGroups(def){
    const L=(def.layouts&&def.layouts.labels)||[];
    return L.map(o=>{const ch=Array.isArray(o)?o.slice(1):["オフ","オン"];return{name:Array.isArray(o)?o[0]:o,choices:ch,bits:Math.max(1,Math.ceil(Math.log2(ch.length)))};});
  }
  function unpackOptions(def,value){ // first option occupies the most significant bits
    const g=optionGroups(def),sel=new Array(g.length).fill(0);let v=value>>>0;
    for(let i=g.length-1;i>=0;i--){sel[i]=v&((1<<g[i].bits)-1);v=v>>>g[i].bits;if(sel[i]>=g[i].choices.length)sel[i]=0;}
    return sel;
  }
  // keys of the physical layout -> {keys:[{w,h,x,y,r,rx,ry,ro}], rc:[[row,col]]}
  function layoutFromDef(def,optValue){
    const all=kle((def.layouts&&def.layouts.keymap)||[]);
    const sel=unpackOptions(def,optValue||0);
    const ks=all.filter(k=>!k.decal&&k.labels[4]!=="e"&&/^\s*\d+\s*,\s*\d+\s*$/.test(k.labels[0]));
    const opt=k=>{const m=/^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(k.labels[8]||"");return m?[+m[1],+m[2]]:null;};
    // chosen option keys are drawn where option 0 is (VIA convention)
    const shift=new Map();
    const minXY=list=>list.reduce((a,k)=>[Math.min(a[0],k.x),Math.min(a[1],k.y)],[Infinity,Infinity]);
    const groups=new Map();ks.forEach(k=>{const o=opt(k);if(!o)return;const key=o[0]+","+o[1];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(k);});
    sel.forEach((c,g)=>{if(c===0)return;const a=groups.get(g+",0"),b=groups.get(g+","+c);if(!a||!b)return;
      const m0=minXY(a.filter(k=>!k.r)),m1=minXY(b.filter(k=>!k.r));if(isFinite(m0[0])&&isFinite(m1[0]))shift.set(g+","+c,[m0[0]-m1[0],m0[1]-m1[1]]);});
    const keys=[],rc=[],seen=new Set();
    for(const k of ks){const o=opt(k);
      if(o&&(sel[o[0]]||0)!==o[1])continue;
      const id=k.labels[0].replace(/\s/g,"");if(seen.has(id))continue;seen.add(id); // one switch per matrix position
      const s=o?shift.get(o[0]+","+o[1])||[0,0]:[0,0];
      const m=/^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(k.labels[0]);
      keys.push({w:Math.round(k.w*100),h:Math.round(k.h*100),x:Math.round((k.x+s[0])*100),y:Math.round((k.y+s[1])*100),r:Math.round((k.r||0)*100),rx:Math.round(k.rx*100),ry:Math.round(k.ry*100),ro:1});
      rc.push([+m[1],+m[2]]);}
    return{keys,rc};
  }
  function gridLayout(rows,cols,used){ // no definition: plain matrix grid
    const keys=[],rc=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(used&&!used(r,c))continue;keys.push({w:100,h:100,x:c*100,y:r*100,r:0,rx:0,ry:0});rc.push([r,c]);}
    return{keys,rc};
  }

  // ===== QMK keycodes =====
  const BASIC={};
  const addN=(code,...names)=>names.forEach(n=>BASIC[n]=code);
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((c,i)=>addN(0x04+i,"KC_"+c));
  "1234567890".split("").forEach((c,i)=>addN(0x1E+i,"KC_"+c));
  [[0x28,"ENTER","ENT"],[0x29,"ESCAPE","ESC"],[0x2A,"BACKSPACE","BSPC","BSPACE"],[0x2B,"TAB"],[0x2C,"SPACE","SPC"],[0x2D,"MINUS","MINS"],[0x2E,"EQUAL","EQL"],
   [0x2F,"LEFT_BRACKET","LBRC","LBRACKET"],[0x30,"RIGHT_BRACKET","RBRC","RBRACKET"],[0x31,"BACKSLASH","BSLS","BSLASH"],[0x32,"NONUS_HASH","NUHS"],[0x33,"SEMICOLON","SCLN","SCOLON"],
   [0x34,"QUOTE","QUOT"],[0x35,"GRAVE","GRV","ZKHK"],[0x36,"COMMA","COMM"],[0x37,"DOT"],[0x38,"SLASH","SLSH"],[0x39,"CAPS_LOCK","CAPS","CAPSLOCK","CLCK"],
   [0x46,"PRINT_SCREEN","PSCR","PSCREEN"],[0x47,"SCROLL_LOCK","SCRL","SLCK","BRMD"],[0x48,"PAUSE","PAUS","BRK","BRMU"],[0x49,"INSERT","INS"],[0x4A,"HOME"],[0x4B,"PAGE_UP","PGUP"],
   [0x4C,"DELETE","DEL"],[0x4D,"END"],[0x4E,"PAGE_DOWN","PGDN","PGDOWN"],[0x4F,"RIGHT","RGHT"],[0x50,"LEFT"],[0x51,"DOWN"],[0x52,"UP"],[0x53,"NUM_LOCK","NUM","NLCK","NUMLOCK"],
   [0x54,"KP_SLASH","PSLS"],[0x55,"KP_ASTERISK","PAST"],[0x56,"KP_MINUS","PMNS"],[0x57,"KP_PLUS","PPLS"],[0x58,"KP_ENTER","PENT"],[0x63,"KP_DOT","PDOT"],
   [0x64,"NONUS_BACKSLASH","NUBS"],[0x65,"APPLICATION","APP"],[0x67,"KP_EQUAL","PEQL"],[0x85,"KP_COMMA","PCMM"],
   [0x87,"INTERNATIONAL_1","INT1","RO"],[0x88,"INTERNATIONAL_2","INT2","KANA"],[0x89,"INTERNATIONAL_3","INT3","JYEN"],[0x8A,"INTERNATIONAL_4","INT4","HENK"],[0x8B,"INTERNATIONAL_5","INT5","MHEN"],
   [0x90,"LANGUAGE_1","LNG1","LANG1"],[0x91,"LANGUAGE_2","LNG2","LANG2"],
   [0xE0,"LEFT_CTRL","LCTL","LCTRL"],[0xE1,"LEFT_SHIFT","LSFT","LSHIFT"],[0xE2,"LEFT_ALT","LALT","LOPT"],[0xE3,"LEFT_GUI","LGUI","LCMD","LWIN"],
   [0xE4,"RIGHT_CTRL","RCTL","RCTRL"],[0xE5,"RIGHT_SHIFT","RSFT","RSHIFT"],[0xE6,"RIGHT_ALT","RALT","ROPT","ALGR"],[0xE7,"RIGHT_GUI","RGUI","RCMD","RWIN"],
   [0xA5,"SYSTEM_POWER","PWR"],[0xA6,"SYSTEM_SLEEP","SLEP"],[0xA7,"SYSTEM_WAKE","WAKE"],[0xA8,"AUDIO_MUTE","MUTE"],[0xA9,"AUDIO_VOL_UP","VOLU"],[0xAA,"AUDIO_VOL_DOWN","VOLD"],
   [0xAB,"MEDIA_NEXT_TRACK","MNXT"],[0xAC,"MEDIA_PREV_TRACK","MPRV"],[0xAD,"MEDIA_STOP","MSTP"],[0xAE,"MEDIA_PLAY_PAUSE","MPLY"],[0xAF,"MEDIA_SELECT","MSEL"],[0xB0,"MEDIA_EJECT","EJCT"],
   [0xB1,"MAIL"],[0xB2,"CALCULATOR","CALC"],[0xB3,"MY_COMPUTER","MYCM"],[0xB4,"WWW_SEARCH","WSCH"],[0xB5,"WWW_HOME","WHOM"],[0xB6,"WWW_BACK","WBAK"],[0xB7,"WWW_FORWARD","WFWD"],
   [0xB8,"WWW_STOP","WSTP"],[0xB9,"WWW_REFRESH","WREF"],[0xBA,"WWW_FAVORITES","WFAV"],[0xBB,"MEDIA_FAST_FORWARD","MFFD"],[0xBC,"MEDIA_REWIND","MRWD"],[0xBD,"BRIGHTNESS_UP","BRIU"],[0xBE,"BRIGHTNESS_DOWN","BRID"],
   [0xCD,"MS_UP","MS_U"],[0xCE,"MS_DOWN","MS_D"],[0xCF,"MS_LEFT","MS_L"],[0xD0,"MS_RIGHT","MS_R"],
   [0xD9,"MS_WH_UP","WH_U"],[0xDA,"MS_WH_DOWN","WH_D"],[0xDB,"MS_WH_LEFT","WH_L"],[0xDC,"MS_WH_RIGHT","WH_R"],[0xDD,"MS_ACCEL0","ACL0"],[0xDE,"MS_ACCEL1","ACL1"],[0xDF,"MS_ACCEL2","ACL2"]
  ].forEach(([c,...n])=>n.forEach(x=>BASIC["KC_"+x]=c));
  for(let i=0;i<12;i++){BASIC["KC_F"+(i+1)]=0x3A+i;BASIC["KC_F"+(13+i)]=0x68+i;}
  for(let i=1;i<=9;i++){BASIC["KC_KP_"+i]=BASIC["KC_P"+i]=0x58+i;}BASIC.KC_KP_0=BASIC.KC_P0=0x62;
  for(let i=1;i<=8;i++){BASIC["KC_MS_BTN"+i]=BASIC["KC_BTN"+i]=BASIC["MS_BTN"+i]=0xD0+i;}
  Object.assign(BASIC,{MS_UP:0xCD,MS_DOWN:0xCE,MS_LEFT:0xCF,MS_RGHT:0xD0,MS_WHLU:0xD9,MS_WHLD:0xDA,MS_WHLL:0xDB,MS_WHLR:0xDC,MS_ACL0:0xDD,MS_ACL1:0xDE,MS_ACL2:0xDF,
    KC_NO:0,XXXXXXX:0,KC_TRANSPARENT:1,KC_TRNS:1,_______:1});
  const MODN={LCTL:1,C:1,CTL:1,LSFT:2,S:2,SFT:2,LALT:4,A:4,ALT:4,LOPT:4,OPT:4,LGUI:8,G:8,GUI:8,LCMD:8,CMD:8,LWIN:8,WIN:8,
    RCTL:0x11,RSFT:0x12,RALT:0x14,ROPT:0x14,ALGR:0x14,RGUI:0x18,RCMD:0x18,RWIN:0x18,HYPR:0x0F,ALL:0x0F,MEH:0x07,LCAG:0x0D,SGUI:0x0A,SCMD:0x0A,SWIN:0x0A,
    LCA:0x05,LSA:0x06,RSA:0x16,RCS:0x13,LCS:0x03,C_S:0x03,LSG:0x0A,LAG:0x0C,RSG:0x1A,RAG:0x1C,LCG:0x09,RCG:0x19,RCAG:0x1D};
  const modOf=s=>{s=String(s).trim().replace(/^MOD_/,"");let v=0;for(const p of s.split("|")){const q=p.trim().replace(/^MOD_/,"");if(MODN[q]===undefined)return null;v|=MODN[q];}return v;};
  // quantum keycodes that deserve a legend (v6 numbering)
  const Q6={QK_BOOT:0x7C00,QK_BOOTLOADER:0x7C00,RESET:0x7C00,QK_REBOOT:0x7C01,QK_RBT:0x7C01,QK_CLEAR_EEPROM:0x7C03,EE_CLR:0x7C03,
    QK_GRAVE_ESCAPE:0x7C16,QK_GESC:0x7C16,KC_GESC:0x7C16,QK_CAPS_WORD_TOGGLE:0x7C73,CW_TOGG:0x7C73,QK_REPEAT_KEY:0x7C79,QK_REP:0x7C79,QK_ALT_REPEAT_KEY:0x7C7A,QK_AREP:0x7C7A};
  const QNAME={0x7C00:"Boot",0x7C01:"Reboot",0x7C03:"EEClr",0x7C16:"Esc",0x7C73:"CapsW",0x7C79:"Rep",0x7C7A:"ARep"};
  const MOUSE={0xCD:"M↑",0xCE:"M↓",0xCF:"M←",0xD0:"M→",0xD9:"W↑",0xDA:"W↓",0xDB:"W←",0xDC:"W→",0xDD:"Acl0",0xDE:"Acl1",0xDF:"Acl2"};
  const CONSUMER={0xA8:0xE2,0xA9:0xE9,0xAA:0xEA,0xAB:0xB5,0xAC:0xB6,0xAD:0xB7,0xAE:0xCD,0xB0:0xB8,0xB2:0x192,0xB5:0x223,0xBD:0x6F,0xBE:0x70};
  const SYS={0xA5:"Power",0xA6:"Sleep",0xA7:"Wake",0xAF:"Media",0xB1:"Mail",0xB3:"PC",0xB4:"Search",0xB6:"Back",0xB7:"Fwd",0xB8:"Stop",0xB9:"Reload",0xBA:"Fav",0xBB:"FF",0xBC:"Rew"};
  // v5 (older QMK / Vial protocol < 6) -> v6 numbering
  function v5to6(k){
    if(k<0x100){if(k>=0xF0&&k<=0xFF){const m={0xF0:0xCD,0xF1:0xCE,0xF2:0xCF,0xF3:0xD0,0xF9:0xD9,0xFA:0xDA,0xFB:0xDB,0xFC:0xDC,0xFD:0xDD,0xFE:0xDE,0xFF:0xDF};if(m[k])return m[k];if(k>=0xF4&&k<=0xF8)return 0xD1+(k-0xF4);}return k;}
    if(k<0x2000)return k;                                   // mods
    if(k>=0x4000&&k<0x5000)return k;                        // LT
    if(k>=0x5000&&k<0x5100)return 0x5200|(k&0x1F);          // TO
    if(k>=0x5100&&k<0x5200)return 0x5220|(k&0x1F);          // MO
    if(k>=0x5200&&k<0x5300)return 0x5240|(k&0x1F);          // DF
    if(k>=0x5300&&k<0x5400)return 0x5260|(k&0x1F);          // TG
    if(k>=0x5400&&k<0x5500)return 0x5280|(k&0x1F);          // OSL
    if(k>=0x5500&&k<0x5600)return 0x52A0|(k&0x1F);          // OSM
    if(k>=0x5700&&k<0x5800)return k;                        // TD
    if(k>=0x5800&&k<0x5900)return 0x52C0|(k&0x1F);          // TT
    if(k>=0x5900&&k<0x5A00)return 0x5000|(((k>>4)&0xF)<<5)|(k&0xF); // LM
    if(k>=0x6000&&k<0x8000)return 0x2000|(k&0x1FFF);        // MT
    if(k===0x5C00)return 0x7C00;if(k===0x5C16)return 0x7C16;
    if(k>=0x5F12&&k<0x5F22)return 0x7700+(k-0x5F12);        // Vial macros M0..M15
    if(k>=0x5F80&&k<0x5FC0)return 0x7E00+(k-0x5F80);        // USER00..
    return 0x10000|k;                                       // unknown: keep as-is
  }
  function parseName(s,layers){ // .vil keycode string -> v6 number (or null)
    s=String(s).trim();
    if(/^0x[0-9a-f]+$/i.test(s))return null; // numeric values are resolved by the caller (need the protocol version)
    if(BASIC[s]!==undefined)return BASIC[s];
    if(Q6[s]!==undefined)return Q6[s];
    let m;
    if((m=/^M(\d+)$/.exec(s))||(m=/^MACRO(\d+)$/.exec(s))||(m=/^QK_MACRO_(\d+)$/.exec(s)))return 0x7700+(+m[1]);
    if((m=/^USER(\d+)$/.exec(s)))return 0x7E00+(+m[1]);
    if((m=/^TD\((\d+)\)$/.exec(s)))return 0x5700+(+m[1]);
    const lay=(fn,base)=>{const r=new RegExp("^"+fn+"\\((\\d+)\\)$").exec(s);return r?base+(+r[1]&0x1F):null;};
    for(const [fn,base] of [["TO",0x5200],["MO",0x5220],["DF",0x5240],["TG",0x5260],["OSL",0x5280],["TT",0x52C0],["PDF",0x5240]]){const v=lay(fn,base);if(v!==null)return v;}
    if((m=/^OSM\((.+)\)$/.exec(s))){const md=modOf(m[1]);return md===null?null:0x52A0|md;}
    if((m=/^LT(\d+)\((.+)\)$/.exec(s))){const k=parseName(m[2]);return k===null?null:0x4000|((+m[1]&0xF)<<8)|(k&0xFF);}
    if((m=/^LT\((\d+)\s*,\s*(.+)\)$/.exec(s))){const k=parseName(m[2]);return k===null?null:0x4000|((+m[1]&0xF)<<8)|(k&0xFF);}
    if((m=/^LM\((\d+)\s*,\s*(.+)\)$/.exec(s))){const md=modOf(m[2]);return md===null?null:0x5000|((+m[1]&0xF)<<5)|(md&0x1F);}
    if((m=/^MT\((.+?)\s*,\s*(.+)\)$/.exec(s))){const md=modOf(m[1]),k=parseName(m[2]);return md===null||k===null?null:0x2000|(md<<8)|(k&0xFF);}
    if((m=/^([A-Z_]+)_T\((.+)\)$/.exec(s))){const md=modOf(m[1]),k=parseName(m[2]);return md===null||k===null?null:0x2000|(md<<8)|(k&0xFF);}
    if((m=/^([A-Z_]+)\((.+)\)$/.exec(s))){const md=modOf(m[1]);if(md!==null){const k=parseName(m[2]);if(k!==null&&k<0x2000)return (k&0x1FFF)|(md<<8)|((k>>8)<<8);}}
    return null;
  }
  // Human-readable fallback for names we do not know (e.g. RGB_TOG -> RGB TOG)
  function nameFallback(s){s=String(s).replace(/^(KC_|QK_)/,"").replace(/_/g," ").trim();return s.length<=7?s:s.split(/\s+/).map(w=>w.slice(0,3)).join("").slice(0,7);}
  const lname=(layers,i)=>{const L=layers[i];return L&&L.name?L.name:"L"+i;};
  const modText=m=>{const r=m&0x10,b=m&0xF,n=[];if(b&1)n.push("Ctrl");if(b&2)n.push("Shift");if(b&4)n.push("Alt");if(b&8)n.push("GUI");
    if(b===0xF)return "Hyper";if(b===7)return "Meh";return (n.length>1?n.map(x=>x[0]).join(""):n[0]||"Mod");};
  function basicLabel(k,mods,host){
    k&=0xFF;
    if(k===0||k===1)return "";
    if(MOUSE[k])return MOUSE[k];
    if(k>=0xD1&&k<=0xD8)return "MB"+(k-0xD0);
    if(SYS[k])return SYS[k];
    if(CONSUMER[k]!==undefined)return LBL.hid(0x0C*65536+CONSUMER[k],host);
    const zm=mods?((mods&0x10)?(mods&0xF)<<4:(mods&0xF)):0;
    return LBL.hid(zm*16777216+0x07*65536+k,host);
  }
  function codeLabel(k,meta,layers,host){
    if(k>=0x10000)return "0x"+(k&0xFFFF).toString(16);
    if(k<0x100)return basicLabel(k,0,host);
    if(k<0x2000)return basicLabel(k&0xFF,(k>>8)&0x1F,host);           // mods + key
    if(k<0x4000){const t=basicLabel(k&0xFF,0,host);return t||modText((k>>8)&0x1F);} // mod-tap: tap key
    if(k<0x5000){const t=basicLabel(k&0xFF,0,host);return t||lname(layers,(k>>8)&0xF);} // layer-tap
    if(k<0x5200)return lname(layers,(k>>5)&0xF);                        // LM
    if(k<0x5220)return "TO "+lname(layers,k&0x1F);
    if(k<0x5240)return lname(layers,k&0x1F);                            // MO
    if(k<0x5260)return "DF "+lname(layers,k&0x1F);
    if(k<0x5280)return "TG "+lname(layers,k&0x1F);
    if(k<0x52A0)return lname(layers,k&0x1F);                            // OSL
    if(k<0x52C0)return modText(k&0x1F);                                 // OSM
    if(k<0x52E0)return "TT "+lname(layers,k&0x1F);
    if(k>=0x5600&&k<0x5700)return "SH";
    if(k>=0x5700&&k<0x5800)return "TD"+(k&0xFF);
    if(k>=0x7700&&k<0x7780)return "M"+(k&0x7F);
    if(k>=0x7E00&&k<0x7E40){const c=meta&&meta.custom&&meta.custom[k-0x7E00];return c?(c.shortName||c.name||"").replace(/\n/g," ").slice(0,8):"U"+(k-0x7E00);}
    if(k>=0x7E40&&k<0x7F00)return "U"+(k-0x7E00);
    if(QNAME[k])return QNAME[k];
    if(k>=0x7800&&k<0x7900)return k<0x7820?"BL":"RGB";
    if(k>=0x7000&&k<0x7100)return "Magic";
    return "0x"+k.toString(16);
  }
  // binding from a Vial source: {qk:number(v6)} or {qs:string}
  function label(b,meta,layers,host){
    if(b.qk!==undefined)return codeLabel(b.qk,meta,layers,host);
    if(b.qs!==undefined){const n=parseName(b.qs);return n===null?nameFallback(b.qs):codeLabel(n,meta,layers,host);}
    return "";
  }
  const isVialBinding=b=>!!b&&(b.qk!==undefined||b.qs!==undefined);

  // ===== keymap assembly =====
  // codeAt(layer,row,col) -> binding; drops trailing layers that have nothing on the layout
  function assemble(nLayers,lay,bindAt){
    const layers=[];
    for(let l=0;l<nLayers;l++)layers.push({id:l,name:"",bindings:lay.rc.map(([r,c])=>bindAt(l,r,c))});
    const empty=L=>L.bindings.every(b=>!b||(b.qk!==undefined?b.qk<=1:(b.qs==="KC_TRNS"||b.qs==="KC_NO"||b.qs==="_______"||b.qs==="KC_TRANSPARENT"||b.qs===-1||b.qs===undefined)));
    while(layers.length>1&&empty(layers[layers.length-1]))layers.pop();
    return layers;
  }
  // .vil (Vial save file) [+ optional keyboard definition] -> keymap data for setKeymap
  function fromVil(vil,def,name){
    const L=vil.layout;if(!Array.isArray(L)||!L.length||!Array.isArray(L[0]))throw new Error(".vilにキーマップがありません");
    const rows=L[0].length,cols=Math.max(...L[0].map(r=>Array.isArray(r)?r.length:0));
    const v6=(+vil.vial_protocol||0)>=6||(+vil.via_protocol||0)>=12;
    let lay;
    if(def&&def.layouts)lay=layoutFromDef(def,vil.layout_options);
    else lay=gridLayout(rows,cols,(r,c)=>L.some(l=>l[r]&&l[r][c]!==-1&&l[r][c]!==undefined));
    const bindAt=(l,r,c)=>{const v=L[l]&&L[l][r]&&L[l][r][c];
      if(v===undefined||v===-1||v===null)return{qk:0};
      if(typeof v==="number")return{qk:v6?v:v5to6(v)};
      if(/^0x[0-9a-f]+$/i.test(v)){const n=parseInt(v,16);return{qk:v6?n:v5to6(n)};}
      return{qs:v};};
    const layers=assemble(L.length,lay,bindAt);
    return{device:name||"Vialキーボード",layers,behaviors:{_qmk:{v:6,custom:(def&&def.customKeycodes)||[]}},keys:lay.keys,grid:!(def&&def.layouts)};
  }

  // ===== WebHID client (VIA raw HID + Vial extensions) =====
  async function open(log,onClose){
    log=log||(()=>{});
    if(!("hid" in navigator))throw Object.assign(new Error("このブラウザはVialの接続（WebHID）に対応していません。PCのChrome/Edgeを使ってください。"),{code:"unsupported"});
    const devs=await navigator.hid.requestDevice({filters:[{usagePage:0xFF60,usage:0x61}]});
    const dev=devs&&devs[0];if(!dev)throw Object.assign(new Error("キーボードが選ばれませんでした。"),{name:"NotFoundError"});
    log("選択: "+(dev.productName||"(名前なし)"));
    if(!dev.opened)await dev.open();
    let waiter=null;
    const onRep=e=>{if(waiter){const w=waiter;waiter=null;w(new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength));}};
    dev.addEventListener("inputreport",onRep);
    const onDisc=e=>{if(e.device===dev){navigator.hid.removeEventListener("disconnect",onDisc);if(onClose)onClose();}};
    navigator.hid.addEventListener("disconnect",onDisc);
    let chain=Promise.resolve();
    function send(bytes){ // one request at a time; 32-byte reports without report id
      const run=async()=>{
        for(let attempt=0;attempt<3;attempt++){
          const buf=new Uint8Array(32);buf.set(bytes.slice(0,32));
          const got=new Promise(res=>{waiter=res;});
          await dev.sendReport(0,buf);
          const r=await Promise.race([got,new Promise(res=>setTimeout(()=>res(null),1500))]);
          if(r)return r;waiter=null;log("応答なし、再送（"+(attempt+1)+"）");
        }
        throw Object.assign(new Error("キーボードから応答がありません"),{code:"timeout"});
      };
      const p=chain.then(run,run);chain=p.catch(()=>{});return p;
    }
    const u32le=(r,o)=>(r[o]|(r[o+1]<<8)|(r[o+2]<<16))+r[o+3]*16777216;
    async function read(extDef,onProgress){
      const pv=await send([0x01]);const viaProto=(pv[1]<<8)|pv[2];log("VIAプロトコル: "+viaProto);
      const id=await send([0xFE,0x00]);let vialProto=u32le(id,0);
      const isVial=!(id[0]===0xFF&&id[1]===0x00)&&vialProto<1000;
      let def=null;
      if(isVial){
        log("Vialプロトコル: "+vialProto);
        const sz=u32le(await send([0xFE,0x01]),0);log("定義データ: "+sz+" バイト");
        if(!(sz>0&&sz<4e6))throw new Error("キーボードの定義データの大きさが不正です（"+sz+"）");
        const raw=new Uint8Array(Math.ceil(sz/32)*32);
        for(let pg=0;pg*32<sz;pg++){const r=await send([0xFE,0x02,pg&255,(pg>>8)&255,(pg>>16)&255,0]);raw.set(r.subarray(0,32),pg*32);if(onProgress)onProgress("定義",pg*32,sz);}
        const txt=new TextDecoder().decode(unxz(raw.subarray(0,sz)));
        def=JSON.parse(txt);log("定義を展開: "+txt.length+" 文字");
      }else{
        vialProto=-1;log("Vialの応答がありません（VIAのみのキーボード）");
        if(!extDef)throw Object.assign(new Error("このキーボードはVialではなくVIAのファームウェアのようです。先にキーボード定義のJSON（VIA用）を「ファイルから読込」で読み込んでから、もう一度接続してください。"),{code:"no_vial"});
        def=extDef;
      }
      const rows=def.matrix&&def.matrix.rows,cols=def.matrix&&def.matrix.cols;
      if(!rows||!cols)throw new Error("定義にマトリクスの大きさ（matrix）がありません");
      const lc=(await send([0x11]))[1];log("レイヤー数: "+lc);
      let opt=0;try{const r=await send([0x02,0x02]);if(r[0]===0x02)opt=((r[2]<<24)>>>0)+(r[3]<<16)+(r[4]<<8)+r[5];}catch(_){}
      const total=lc*rows*cols*2,buf=new Uint8Array(total);
      for(let off=0;off<total;off+=28){const n=Math.min(28,total-off);const r=await send([0x12,(off>>8)&255,off&255,n]);buf.set(r.subarray(4,4+n),off);if(onProgress)onProgress("キーマップ",off,total);}
      const v6=vialProto>=6||(vialProto<0&&viaProto>=12);
      const code=(l,r,c)=>{if(r>=rows||c>=cols)return 0;const o=((l*rows+r)*cols+c)*2;return (buf[o]<<8)|buf[o+1];};
      const lay=layoutFromDef(def,opt);
      const layers=assemble(lc,lay,(l,r,c)=>{const k=code(l,r,c);return{qk:v6?k:v5to6(k)};});
      log("配列: "+lay.keys.length+"キー / 使用レイヤー: "+layers.length);
      return{device:dev.productName||"Vialキーボード",layers,behaviors:{_qmk:{v:6,custom:def.customKeycodes||[]}},keys:lay.keys,vial:isVial};
    }
    return{kind:"vial",name:dev.productName,read,async close(){dev.removeEventListener("inputreport",onRep);navigator.hid.removeEventListener("disconnect",onDisc);try{await dev.close();}catch(_){}}};
  }
  const isVil=d=>d&&Array.isArray(d.layout)&&(d.version!==undefined||d.uid!==undefined||d.vial_protocol!==undefined||d.via_protocol!==undefined);
  const isDef=d=>d&&d.matrix&&d.layouts&&Array.isArray(d.layouts.keymap);
  return{unxz,kle,layoutFromDef,optionGroups,unpackOptions,parseName,codeLabel,label,isVialBinding,fromVil,open,isVil,isDef,v5to6,_test:{gridLayout,assemble}};
})();
