// icons.js — built-in SVG icons for legends (original drawings, 24x24, lines thick enough to print)
// LAK風キーキャップジェネレータ / MIT License

const ICONS=(()=>{
  const S=(body,extra)=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'+(extra||"")+'>'+body+'</svg>';
  const F='fill="#000"';
  const spk='<path d="M3 9h4l5-4v14l-5-4H3z" '+F+'/>';
  const list=[
    // --- modifiers & editing ---
    ["shift","Shift",S('<path d="M12 3l9 9h-5v8H8v-8H3z"/>')],
    ["shift_fill","Shift（塗り）",S('<path d="M12 3l9 9h-5v8H8v-8H3z" '+F+'/>')],
    ["enter","Enter",S('<path d="M20 5v8H6"/><path d="M10 9l-4 4 4 4"/>')],
    ["backspace","Backspace",S('<path d="M8 5h13v14H8l-6-7z"/><path d="M11.5 9.5l5 5M16.5 9.5l-5 5"/>')],
    ["delete","Delete",S('<path d="M16 5H3v14h13l6-7z"/><path d="M7.5 9.5l5 5M12.5 9.5l-5 5"/>')],
    ["tab","Tab",S('<path d="M3 12h15"/><path d="M13 7l5 5-5 5"/><path d="M21 5v14"/>')],
    ["capslock","Caps Lock",S('<path d="M12 3l8 8h-4.5v5h-7v-5H4z"/><path d="M8.5 20.5h7"/>')],
    ["esc","Esc",S('<path d="M4 9V4h5"/><path d="M4 4l7 7"/><path d="M13.5 4.2A8 8 0 1 1 4.2 13.5"/>')],
    ["space","Space",S('<path d="M3 9v6h18V9"/>')],
    ["command","⌘ Command",S('<path d="M15 9V6.5A2.5 2.5 0 1 1 17.5 9H6.5A2.5 2.5 0 1 1 9 6.5v11A2.5 2.5 0 1 1 6.5 15h11a2.5 2.5 0 1 1-2.5 2.5z"/>')],
    ["option","⌥ Option",S('<path d="M3 6h6l6 12h6M14 6h7"/>')],
    ["control","⌃ Control",S('<path d="M5 15l7-7 7 7"/>')],
    ["globe","地球儀（Fn）",S('<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>')],
    // --- arrows ---
    ["up","↑ 矢印",S('<path d="M12 20V5M6 11l6-6 6 6"/>')],
    ["down","↓ 矢印",S('<path d="M12 4v15M6 13l6 6 6-6"/>')],
    ["left","← 矢印",S('<path d="M20 12H5M11 6l-6 6 6 6"/>')],
    ["right","→ 矢印",S('<path d="M4 12h15M13 6l6 6-6 6"/>')],
    ["tri_up","▲ 三角",S('<path d="M12 5l8 13H4z" '+F+'/>')],
    ["tri_down","▼ 三角",S('<path d="M12 19L4 6h16z" '+F+'/>')],
    ["tri_left","◀ 三角",S('<path d="M5 12l13-8v16z" '+F+'/>')],
    ["tri_right","▶ 三角",S('<path d="M19 12L6 20V4z" '+F+'/>')],
    ["home","Home",S('<path d="M3 11l9-8 9 8"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5h4v5"/>')],
    ["pgup","Page Up",S('<path d="M5 3h14"/><path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>')],
    ["pgdn","Page Down",S('<path d="M5 21h14"/><path d="M6 11l6 6 6-6M6 5l6 6 6-6"/>')],
    ["undo","元に戻す",S('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>')],
    ["redo","やり直し",S('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/>')],
    // --- media & system ---
    ["volup","音量＋",S(spk+'<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>')],
    ["voldown","音量－",S(spk+'<path d="M15.5 8.5a5 5 0 0 1 0 7"/>')],
    ["mute","ミュート",S(spk+'<path d="M16 9l5 6M21 9l-5 6"/>')],
    ["play","再生／一時停止",S('<path d="M3 5l9 7-9 7z" '+F+' stroke-width="1.5"/><path d="M16 5v14M20.5 5v14"/>')],
    ["next","次の曲",S('<path d="M3 5l8 7-8 7zM11 5l8 7-8 7z" '+F+' stroke-width="1.5"/><path d="M21.5 5v14"/>')],
    ["prev","前の曲",S('<path d="M21 5l-8 7 8 7zM13 5l-8 7 8 7z" '+F+' stroke-width="1.5"/><path d="M2.5 5v14"/>')],
    ["briup","明るさ＋",S('<circle cx="12" cy="12" r="4" '+F+'/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>')],
    ["bridown","明るさ－",S('<circle cx="12" cy="12" r="4"/><path d="M12 4v1M12 19v1M4 12h1M19 12h1M6.3 6.3l.7.7M17 17l.7.7M6.3 17.7l.7-.7M17 7l.7-.7"/>')],
    ["power","電源",S('<path d="M7 6.5a8 8 0 1 0 10 0"/><path d="M12 3v9"/>')],
    ["lock","ロック",S('<rect x="5" y="11" width="14" height="10" rx="2" '+F+'/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')],
    ["search","検索",S('<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L21 21"/>')],
    ["camera","スクリーンショット",S('<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/>')],
    ["mouse","マウス",S('<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>')],
    // --- layers & fun ---
    ["layers","レイヤー",S('<path d="M12 3l10 5-10 5L2 8z" '+F+'/><path d="M2 12.5l10 5 10-5M2 16.5l10 5 10-5"/>')],
    ["raise","Raise（上の層）",S('<path d="M5 14l7-7 7 7" stroke-width="3.2"/>')],
    ["lower","Lower（下の層）",S('<path d="M5 10l7 7 7-7" stroke-width="3.2"/>')],
    ["keyboard","キーボード",S('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" stroke-width="2.6"/>')],
    ["heart","ハート",S('<path d="M12 20.5S3 14.6 3 8.7A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.1c0 5.9-9 11.8-9 11.8z" '+F+'/>')],
    ["star","星",S('<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" '+F+' stroke-width="1.5"/>')],
    ["smile","スマイル",S('<circle cx="12" cy="12" r="9"/><path d="M8 14.5a5 5 0 0 0 8 0"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="3"/>')],
    ["cat","ねこ",S('<path d="M4 20V6l4 4h8l4-4v14z" '+F+'/><path d="M9 14h.01M15 14h.01" stroke="#fff" stroke-width="2.4"/>')]
  ].map(([id,name,svg])=>({id:"b_"+id,name,svg}));
  // key label (as shown for the keymap) -> icon, for "replace labels with icons"
  const BY_LABEL={"Shift":"shift","Enter":"enter","Bksp":"backspace","Del":"delete","Tab":"tab","Caps":"capslock","Esc":"esc","Space":"space",
    "↑":"up","↓":"down","←":"left","→":"right","Home":"home","PgUp":"pgup","PgDn":"pgdn",
    "Vol+":"volup","Vol-":"voldown","Mute":"mute","Play":"play","Next":"next","Prev":"prev","Bri+":"briup","Bri-":"bridown","Power":"power","Search":"search","PrtSc":"camera"};
  const get=id=>list.find(x=>x.id===id);
  const forLabel=t=>{const k=BY_LABEL[String(t||"").trim()];return k?get("b_"+k):null;};
  return{list,get,forLabel};
})();
