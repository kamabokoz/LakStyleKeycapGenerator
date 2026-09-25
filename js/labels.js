// labels.js — keymap binding to legend text (US / JIS host layouts)
// LAK風キーキャップジェネレータ / MIT License

// ===== binding -> legend text =====
const LBL=(()=>{
  const K={};
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((c,i)=>K[0x04+i]=c);
  "1234567890".split("").forEach((c,i)=>K[0x1E+i]=c);
  Object.assign(K,{0x28:"Enter",0x29:"Esc",0x2A:"Bksp",0x2B:"Tab",0x2C:"Space",0x39:"Caps",
    0x46:"PrtSc",0x47:"ScrLk",0x48:"Pause",0x49:"Ins",0x4A:"Home",0x4B:"PgUp",0x4C:"Del",0x4D:"End",0x4E:"PgDn",
    0x4F:"→",0x50:"←",0x51:"↓",0x52:"↑",0x53:"NumLk",0x54:"/",0x55:"*",0x56:"-",0x57:"+",0x58:"Enter",
    0x59:"1",0x5A:"2",0x5B:"3",0x5C:"4",0x5D:"5",0x5E:"6",0x5F:"7",0x60:"8",0x61:"9",0x62:"0",0x63:".",0x65:"Menu",
    0x88:"かな",0x8A:"変換",0x8B:"無変換",0x90:"かな",0x91:"英数",
    0xE0:"Ctrl",0xE1:"Shift",0xE2:"Alt",0xE3:"GUI",0xE4:"Ctrl",0xE5:"Shift",0xE6:"Alt",0xE7:"GUI"});
  for(let i=0;i<12;i++)K[0x3A+i]="F"+(i+1);
  for(let i=0;i<12;i++)K[0x68+i]="F"+(13+i);
  // symbol keys: [unshifted, shifted]
  const US={0x1E:["1","!"],0x1F:["2","@"],0x20:["3","#"],0x21:["4","$"],0x22:["5","%"],0x23:["6","^"],0x24:["7","&"],0x25:["8","*"],0x26:["9","("],0x27:["0",")"],
    0x2D:["-","_"],0x2E:["=","+"],0x2F:["[","{"],0x30:["]","}"],0x31:["\\","|"],0x32:["#","~"],0x33:[";",":"],0x34:["'","\""],0x35:["`","~"],
    0x36:[",","<"],0x37:[".",">"],0x38:["/","?"],0x64:["\\","|"],0x87:["\\","_"],0x89:["¥","|"]};
  const JIS={0x1E:["1","!"],0x1F:["2","\""],0x20:["3","#"],0x21:["4","$"],0x22:["5","%"],0x23:["6","&"],0x24:["7","'"],0x25:["8","("],0x26:["9",")"],0x27:["0",""],
    0x2D:["-","="],0x2E:["^","~"],0x2F:["@","`"],0x30:["[","{"],0x31:["]","}"],0x32:["]","}"],0x33:[";","+"],0x34:[":","*"],0x35:["半/全","半/全"],
    0x36:[",","<"],0x37:[".",">"],0x38:["/","?"],0x64:["\\","_"],0x87:["\\","_"],0x89:["¥","|"]};
  const CONS={0xE9:"Vol+",0xEA:"Vol-",0xE2:"Mute",0xCD:"Play",0xB5:"Next",0xB6:"Prev",0xB7:"Stop",0x6F:"Bri+",0x70:"Bri-",0xB8:"Eject",0x192:"Calc",0x223:"WWW"};
  const MODS=[["C",1],["S",2],["A",4],["G",8],["C",16],["S",32],["A",64],["G",128]];
  function hid(p,host){
    const mods=Math.floor(p/16777216)%256,page=Math.floor(p/65536)%256,id=p%65536;
    if(page===0x0C)return CONS[id]||("C:"+id.toString(16));
    if(page!==0x07&&page!==0)return "0x"+p.toString(16);
    const tbl=host==="us"?US:JIS;
    const shiftOnly=mods===2||mods===32;
    let base;
    if(tbl[id])base=shiftOnly&&tbl[id][1]?tbl[id][1]:tbl[id][0];
    else base=K[id]||("0x"+id.toString(16));
    if(shiftOnly&&tbl[id]&&tbl[id][1])return base;
    const pre=[];MODS.forEach(([n,b])=>{if(mods&b&&!pre.includes(n))pre.push(n);});
    if(shiftOnly&&!tbl[id]&&/^[A-Z]$/.test(base))return base;
    return pre.length?pre.join("")+"-"+base:base;
  }
  function label(bind,beh,layers,host){
    const B=beh&&beh[bind.b],name=(B&&B.name||"").toLowerCase(),c=B&&B.consts||{p1:{},p2:{}};
    const lname=i=>{const L=layers.find(l=>l.id===i)||layers[i];return L?(L.name||("L"+i)):("L"+i);};
    if(!B)return "";
    if(name.includes("transparent"))return "";
    if(name==="none"||name.includes("none"))return "";
    if(name.includes("key press")||name.includes("sticky key")||name.includes("key toggle"))return hid(bind.p1,host);
    if(name.includes("mod-tap")||name.includes("mod tap"))return hid(bind.p2,host);
    if(name.includes("layer-tap")||name.includes("layer tap"))return hid(bind.p2,host);
    if(name.includes("momentary layer")||name.includes("sticky layer"))return lname(bind.p1);
    if(name.includes("toggle layer"))return "TG "+lname(bind.p1);
    if(name.includes("to layer"))return "TO "+lname(bind.p1);
    if(name.includes("caps word"))return "CapsW";
    if(name.includes("key repeat"))return "Rep";
    if(name.includes("grave"))return "Esc";
    if(name.includes("bootloader"))return "Boot";
    if(name.includes("studio unlock"))return "Unlock";
    if(name.includes("soft off"))return "Off";
    if(name==="reset")return "Reset";
    if(c.p1Kind==="hid")return hid(bind.p1,host);
    if(c.p1Kind==="layer")return lname(bind.p1);
    if(c.p1&&c.p1[bind.p1]!==undefined){const s=c.p1[bind.p1];return name.includes("bluetooth")&&bind.p2!==undefined&&/select/i.test(s)?"BT"+(bind.p2+1):shorten(s);}
    if(name.includes("bluetooth"))return "BT";
    if(name.includes("mouse")){if(name.includes("scroll"))return "Scrl";if(name.includes("move"))return "Mouse";return "MB"+(Math.log2(bind.p1||1)+1);}
    return shorten(B.name);
  }
  function shorten(s){s=String(s||"").trim();if(s.length<=6)return s;return s.split(/\s+/).map(w=>w[0]).join("").slice(0,5)||s.slice(0,6);}
  return{hid,label};
})();
