// =====================================================
//  LAK風 ロープロファイル キーキャップ（Kailh Choc V2 / 17mmピッチ）
//  初期値はオリジナルのLAKに近い形（図面・写真からの推定）
//  OpenSCAD で開き、F6 → STLエクスポート
// =====================================================

pitch       = 17;
gap         = 1;
top_size    = 16;    // 底面と同じ＝側面が垂直
edge_h      = 3.5;   // 外周帯の高さ
r_base      = 0.5;
r_top       = 0.5;

boundary    = 0;     // 0:段差 / 1:なだらか / 2:段差なし
dome        = -0.6;  // マイナスで皿状（凹）
dome_type   = 1;     // 0:球面 / 1:円筒（左右）/ 2:円筒（前後）
dome_scope  = 1;     // 0:天面全体 / 1:中央部のみ（外周帯は平ら）
edge_drop   = 2.8;   // 段差の高さ
edge_band   = 0.75;  // 外周帯の幅
step_run    = 1;     // 段差の傾斜幅（0で垂直）
step_rs     = 1;     // 段差の肩の丸みR
step_rf     = 0.6;   // 段差の裾の丸みR
r_plateau   = 1.8;   // 中央部の角R

wall        = 1.2;
cavity_h    = 2.6;

stem_od     = 5.5;
cross_len   = 4.15;  // FDM:4.15前後 / 光造形:4.05前後
cross_w     = 1.35;  // FDM:1.35前後 / 光造形:1.25前後
cross_depth = 3.0;   // 内側天井より深くすると天面の中まで掘ります
chamfer     = 0.3;

homing      = false;
N           = 12;
$fa = 2; $fs = 0.2;

// ---------- 計算 ----------
base_size = pitch - gap;
w_half = top_size / 2;
ad     = abs(dome);   // マイナスなら皿状（凹）
E      = boundary == 2 ? 0 : edge_drop;
run    = boundary == 0 ? max(0, step_run) : 0;          // 段差の傾斜幅
// 段差の断面：裾の丸み(step_rf, 凹)と肩の丸み(step_rs, 凸)
th     = run > 0 ? atan2(E, run) : 90;
t2     = tan(th/2);
Lw     = run > 0 ? sqrt(run*run + E*E) : E;
sc1    = (max(0,step_rf) + max(0,step_rs))*t2 > Lw*0.98 && (max(0,step_rf) + max(0,step_rs)) > 0
         ? Lw*0.98 / ((max(0,step_rf) + max(0,step_rs))*t2) : 1;
rs     = max(0, step_rs)*sc1;
rf1    = max(0, step_rf)*sc1;
rf     = rf1*t2 > max(0, edge_band - 0.05) ? max(0, edge_band - 0.05)/t2 : rf1;
Lf     = rf*t2;
Ls     = rs*t2;
plain_step = run <= 0 && rf <= 0 && rs <= 0;
d1     = boundary == 2 ? 0 : edge_band + run + (boundary == 0 ? Ls : 0);   // 中央部の始まり（外周からの距離）
capped = dome_scope == 1 && boundary != 2;   // 盛り上がりを中央部だけにする
wp     = capped ? max(0.5, w_half - d1) : w_half;
R      = ad < 0.001 ? 1 : (wp*wp + ad*ad) / (2*ad);

assert(cavity_h + 0.8 <= edge_h, "天面が薄すぎます（edge_h を上げるか cavity_h を下げる）");
assert(top_size <= base_size, "天面の幅が底面より大きくなっています");
assert(boundary == 2 || d1 < w_half - 1, "edge_band（＋step_run）が大きすぎます");

function rr(size, r, n) = let(h = size/2 - r)
    [for (k = [0:3]) for (i = [0:n])
        let(a  = k*90 + i*90/n,
            cx = (k == 0 || k == 3) ? h : -h,
            cy = (k < 2) ? h : -h)
        [cx + r*cos(a), cy + r*sin(a)]];

// dome_type 0:球面 / 1:円筒（左右にカーブ）/ 2:円筒（前後にカーブ）
function sph(x, y) = let(q = dome_type == 1 ? x*x : dome_type == 2 ? y*y : x*x + y*y,
                         h = sqrt(max(R*R - q, 0)) - (R - ad))
    ad < 0.001 ? 0 : sign(dome) * (capped ? max(0, h) : h);
function stepH(x, low) =
    (Lf > 0 ? x <= -Lf : x < 0) ? 0 :
    run <= 0 ? (x < 0 ? rf - sqrt(max(0, rf*rf - (x + rf)*(x + rf))) :
                abs(x) < 1e-9 ? (low ? rf : E - rs) :
                x < rs ? E - rs + sqrt(max(0, rs*rs - (x - rs)*(x - rs))) : E)
             : let(c = cos(th), xa = Lf*c, xb = run - Ls*c)
               x < xa ? rf - sqrt(max(0, rf*rf - (x + Lf)*(x + Lf))) :
               x <= xb ? x*tan(th) :
               x < run + Ls ? E - rs + sqrt(max(0, rs*rs - (x - run - Ls)*(x - run - Ls))) : E;
function dropv(d, low) =
    boundary == 0 ? (plain_step ? (low ? E : 0) :
                     E - stepH(d - edge_band, low && abs(d - edge_band) < 1e-9)) :
    boundary == 1 ? (d >= edge_band ? 0 : E * (1 + cos(180*d/edge_band)) / 2) : 0;
function ztop(x, y, d, low) =
    capped && E > 0 ? edge_h + (E - dropv(d, low)) / E * (E + sph(x, y))   // 中央部のみ：段差が曲面の高さまで立ち上がる
                    : edge_h + E + sph(x, y) - dropv(d, low);

xs_foot = Lf > 0 ? let(xa = run > 0 ? Lf*cos(th) : 0) [for (i = [1:6]) -Lf + (xa + Lf)*i/6] : [];
xs_wall = run > 0 ? let(xa = Lf*cos(th), xb = run - Ls*cos(th)) [for (i = [1:3]) xa + (xb - xa)*i/3] : [0];
xs_sh   = Ls > 0 ? let(xb = run > 0 ? run - Ls*cos(th) : 0) [for (i = [1:8]) xb + (run + Ls - xb)*i/8] : [];
xs_all  = concat(xs_foot, xs_wall, xs_sh);
step_insets = [for (i = [0:len(xs_all)-1])
    [edge_band + xs_all[i], run <= 0 && abs(xs_all[i]) < 1e-9 && Lf > 0 && i == len(xs_foot) - 1]];
plateau_insets = [for (i = [1:6]) [d1 + (w_half - 0.5 - d1)*i/6, false]];

// [外周からのオフセット量, 段差の外側か]
insets =
    boundary == 0 ? (plain_step
        ? concat([for (i = [0:4]) [edge_band*i/4, true]], [[edge_band, false]], plateau_insets)
        : concat([for (i = [0:4]) [(edge_band - Lf)*i/4, true]], step_insets, plateau_insets)) :
    boundary == 1 ? concat([for (i = [0:7]) [edge_band*i/8, false]],
                           [for (i = [0:6]) [edge_band + (w_half - 0.5 - edge_band)*i/6, false]]) :
                    [for (i = [0:10]) [(w_half - 0.5)*i/10, false]];

// 外周から d だけ内側の輪郭の角R
function ringR(d) = let(
    rp = max(0.3, r_plateau), rfr = rp + (d1 - edge_band), b0 = max(0, edge_band - Lf),
    r  = boundary != 0 ? max(r_top - d, 0.3) :
         d <= b0 ? r_top + (rfr + Lf - r_top) * (b0 > 0 ? d / b0 : 1) :
         d <= d1 ? rp + (d1 - d) : max(rp - (d - d1), 0.3))
    max(0.05, min(r, (top_size - 2*d)/2 - 0.01));

function ring(d, low) = [for (p = rr(top_size - 2*d, ringR(d), N))
                         [p[0], p[1], ztop(p[0], p[1], d, low)]];

module outer_body() {
    NP    = 4*(N+1);
    base  = [for (p = rr(base_size, r_base, N)) [p[0], p[1], 0]];
    rings = concat([base], [for (q = insets) ring(q[0], q[1])]);
    nr    = len(rings);
    C     = nr*NP;
    pts   = concat([for (r = rings) for (p = r) p], [[0, 0, edge_h + E + dome]]);
    faces = concat(
        [[for (i = [0:NP-1]) i]],
        [for (k = [0:nr-2]) for (i = [0:NP-1]) for (t = [0:1])
            let(j = (i+1) % NP, a = k*NP, b = (k+1)*NP)
            t == 0 ? [b+i, b+j, a+j] : [b+i, a+j, a+i]],
        [for (i = [0:NP-1]) let(j = (i+1) % NP, c = (nr-1)*NP) [C, c+j, c+i]]
    );
    polyhedron(points = pts, faces = faces, convexity = 4);
}

module rrect(size, r, h) {
    linear_extrude(h) offset(r = r) square(size - 2*r, center = true);
}

module inner_cavity() {
    inner_top = base_size - (base_size - top_size) * cavity_h / edge_h - 2*wall;
    hull() {
        translate([0, 0, -0.01]) rrect(base_size - 2*wall, max(r_base - wall, 0.3), 0.01);
        translate([0, 0, cavity_h - 0.01]) rrect(inner_top, max(r_top - wall, 0.3), 0.01);
    }
}

module cross_hole() {
    translate([0, 0, -0.01]) linear_extrude(cross_depth + 0.01) {
        square([cross_len, cross_w], center = true);
        square([cross_w, cross_len], center = true);
    }
    if (chamfer > 0) for (a = [0, 90]) rotate([0, 0, a])
        hull() {
            cube([cross_len + 2*chamfer, cross_w + 2*chamfer, 0.02], center = true);
            translate([0, 0, chamfer]) cube([cross_len, cross_w, 0.02], center = true);
        }
}

module homing_bar() {
    z = ztop(0, -4, w_half - 4, w_half - 4 < edge_band);
    translate([0, -4, z - 0.2])
        hull() {
            translate([-2, 0, 0]) sphere(d = 0.9);
            translate([ 2, 0, 0]) sphere(d = 0.9);
        }
}

module keycap() {
    difference() {
        union() {
            difference() { outer_body(); inner_cavity(); }
            cylinder(d = stem_od, h = cavity_h + 0.3);
            if (homing) homing_bar();
        }
        cross_hole();
    }
}

keycap();
