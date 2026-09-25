// キーキャップ本体のメッシュが閉じた形状（水密・面の向きが正しい）かを確認します。
// 使い方: node tests/mesh-check.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { console, Math, TextEncoder, Blob, Response, CompressionStream: undefined };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/geom.js"), "utf8") + "\n;this.buildMesh=buildMesh;this.signedVol=signedVol;", ctx);

const DEF = { pitch: 17, gap: 1, top_size: 16, edge_h: 3.5, r_base: 0.5, r_top: 0.5, boundary: 0, dome: -0.6, dome_scope: 1,
  edge_drop: 2.8, edge_band: 0.75, step_run: 1, step_rs: 1, step_rf: 0.6, r_plateau: 1.8, dome_type: 1,
  wall: 1.2, cavity_h: 2.6, stem_od: 5.5, cross_len: 4.15, cross_w: 1.35, cross_depth: 3.0, chamfer: 0.3, homing: false };

const cases = [["初期値", {}]];
for (const boundary of [0, 1, 2]) for (const dome_type of [0, 1, 2]) for (const dome of [-0.6, 0, 0.4]) for (const dome_scope of [0, 1])
  cases.push([`境界${boundary} 曲面${dome_type} dome${dome} 範囲${dome_scope}`, { boundary, dome_type, dome, dome_scope }]);
for (const step_run of [0, 1.5]) for (const [step_rf, step_rs] of [[0, 0], [0.5, 0], [0, 0.5], [3, 3]])
  cases.push([`傾斜${step_run} 裾R${step_rf} 肩R${step_rs}`, { step_run, step_rf, step_rs }]);
cases.push(["従来形（テーパー側面）", { top_size: 14.2, edge_h: 4.2, r_base: 1.2, r_top: 2, dome: 0.4, dome_type: 0, dome_scope: 0,
  edge_drop: 0.5, edge_band: 2, step_run: 0, step_rs: 0, step_rf: 0, r_plateau: 0.3, cavity_h: 3.2 }]);
cases.push(["ホーミング突起", { homing: true }]);

const key = p => p.map(v => (Math.abs(v) < 5e-6 ? 0 : v).toFixed(5)).join(",");
let failed = 0;
for (const [name, over] of cases) {
  const T = ctx.buildMesh({ ...DEF, ...over }, 12, 64);
  const E = new Map(); let degenerate = 0;
  for (const t of T) {
    const k = [key(t[0]), key(t[1]), key(t[2])];
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) { degenerate++; continue; }
    for (let i = 0; i < 3; i++) { const e = k[i] + "|" + k[(i + 1) % 3]; E.set(e, (E.get(e) || 0) + 1); }
  }
  let open = 0; for (const [e, c] of E) { const [a, b] = e.split("|"); if ((E.get(b + "|" + a) || 0) !== c) open++; }
  const vol = ctx.signedVol(T), ok = open === 0 && degenerate === 0 && vol > 0;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "NG  "}${name.padEnd(36)} 三角形 ${String(T.length).padStart(5)}  体積 ${vol.toFixed(1)} mm³` + (ok ? "" : `  開いた辺 ${open} / 縮退 ${degenerate}`));
}
console.log(failed ? `\n${failed} 件が失敗しました` : "\nすべて閉じた形状です");
process.exit(failed ? 1 : 0);
