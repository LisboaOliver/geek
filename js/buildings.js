// ─────────────────────────────────────────────────────────────────────────────
// buildings.js
// Edifícios da ilha em estilo medieval (casebres, torres, castelos), cada um
// com 6 fases (nível 0 a 5) — começam como barracas e vão ganhando elementos.
// A própria ilha cresce com a soma dos níveis: ruínas → obras → andaimes →
// torre de menagem → castelo → castelo dourado.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// O que existe em cada fase (aparece no painel do edifício)
const BUILDING_STAGES = {
  forja:  ["Barraca de lona e fogueira", "Bigorna ao lado do fogo", "Casebre de madeira com chaminé de pedra", "Fole e barril de água", "Paredes de pedra e armas penduradas", "Torre-forja com brasas no telhado"],
  farol:  ["Poste com tocha", "Lanterna de ferro", "Torre de madeira", "Torre de pedra", "Espelho rotativo", "Farol de pedra com chama mágica"],
  altar:  ["Pedra com uma vela", "Círculo de velas", "Altar de pedra com runas", "Colunas antigas", "Capela", "Santuário gótico com vitral"],
  cofre:  ["Baú meio enterrado", "Baú com cadeado", "Cabana de porta reforçada", "Casebre de pedra com grades", "Torre de pedra", "Torre-tesouraria com bandeiras"],
};

// Onde fica o castelo da ilha (cresce com a soma dos níveis)
const CASTLE_SITE = { tx: 9, ty: 3, w: 3, h: 2 };
let BUILD_LEVELS = {}; // níveis atuais (o game.js atualiza)
const ISLAND_STAGES = [
  { from: 0,  name: "Ruínas" },
  { from: 4,  name: "Ruínas em limpeza" },
  { from: 8,  name: "Andaimes e torre em obras" },
  { from: 12, name: "Torre de menagem" },
  { from: 16, name: "Castelo" },
  { from: 20, name: "Castelo dourado" },
];
function islandStage(total) { let s = 0; ISLAND_STAGES.forEach((st, i) => { if (total >= st.from) s = i; }); return s; }

// ═════════════════════════════════════════════════════════════════════════════
// PEÇAS DE CONSTRUÇÃO
// ═════════════════════════════════════════════════════════════════════════════
const P3 = (x, y, z, cam) => { const p = iso(x, y, cam); return { x: p.x, y: p.y - z }; };
const BINK = "#120c0a";

function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/** Textura numa face vertical (a→b no chão, de z0 a z1). */
function faceTexture(ctx, a, b, z0, z1, cam, tex, seed) {
  const A0 = P3(a.x, a.y, z0, cam), B0 = P3(b.x, b.y, z0, cam);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(A0.x, A0.y); ctx.lineTo(B0.x, B0.y); ctx.lineTo(B0.x, B0.y - (z1 - z0)); ctx.lineTo(A0.x, A0.y - (z1 - z0)); ctx.closePath(); ctx.clip();
  const at = (k, z) => { const p = P3(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, z, cam); return p; };
  if (tex === "stone") {
    ctx.strokeStyle = "rgba(0,0,0,0.38)"; ctx.lineWidth = 1;
    let row = 0;
    for (let z = z0 + 7; z < z1 + 7; z += 7, row++) {
      const p = at(0, z), q = at(1, z);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      const n = Math.max(2, Math.round(len * 4));
      for (let i = 0; i < n; i++) {
        const k = (i + (row % 2) * 0.5 + hash2(seed + i, row) * 0.2) / n;
        if (k <= 0 || k >= 1) continue;
        const u = at(k, z), v = at(k, z - 7);
        ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); ctx.stroke();
      }
      // pedras mais claras/escuras
      for (let i = 0; i < n; i++) {
        const h = hash2(seed + i * 3, row * 7);
        if (h < 0.75) continue;
        const k0 = (i + (row % 2) * 0.5) / n, k1 = (i + 1 + (row % 2) * 0.5) / n;
        const p1 = at(k0, z - 7), p2 = at(Math.min(1, k1), z - 7), p3 = at(Math.min(1, k1), z), p4 = at(k0, z);
        poly(ctx, [p1, p2, p3, p4], h > 0.9 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.12)");
      }
    }
  } else if (tex === "wood") {
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
    const n = Math.max(3, Math.round(len * 6));
    for (let i = 1; i < n; i++) { const u = at(i / n, z0), v = at(i / n, z1); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,220,170,0.08)";
    for (let i = 1; i < n; i += 2) { const u = at(i / n + 0.02, z0), v = at(i / n + 0.02, z1); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); ctx.stroke(); }
  } else if (tex === "timber") {
    // enxaimel: reboco claro com vigas escuras
    ctx.strokeStyle = "#3a2618"; ctx.lineWidth = 2.4;
    const beam = (k0, za, k1, zb) => { const u = at(k0, za), v = at(k1, zb); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); ctx.stroke(); };
    beam(0, z0 + 1, 1, z0 + 1); beam(0, z1 - 1, 1, z1 - 1); beam(0, (z0 + z1) / 2, 1, (z0 + z1) / 2);
    const n = Math.max(2, Math.round(len * 2));
    for (let i = 0; i <= n; i++) beam(i / n, z0, i / n, z1);
    for (let i = 0; i < n; i++) beam(i / n, (z0 + z1) / 2, (i + 1) / n, z1);
  }
  ctx.restore();
}

/**
 * Caixa (paredes) com materiais. x,y,w,h em tiles; z0,z1 em px.
 * mat: { base: cor, tex: "stone"|"wood"|"timber"|null, top: cor do topo (opcional) }
 */
function box3(ctx, cam, x, y, w, h, z0, z1, mat, seed = 0) {
  const a = { x, y: y + h }, b = { x: x + w, y: y + h }, c = { x: x + w, y };
  const L = [P3(a.x, a.y, z0, cam), P3(b.x, b.y, z0, cam), P3(b.x, b.y, z1, cam), P3(a.x, a.y, z1, cam)];
  const R = [P3(b.x, b.y, z0, cam), P3(c.x, c.y, z0, cam), P3(c.x, c.y, z1, cam), P3(b.x, b.y, z1, cam)];
  poly(ctx, L, shade(mat.base, -0.12));
  if (mat.tex) faceTexture(ctx, a, b, z0, z1, cam, mat.tex, seed);
  poly(ctx, R, shade(mat.base, -0.42));
  if (mat.tex) faceTexture(ctx, b, c, z0, z1, cam, mat.tex, seed + 17);
  const T = [P3(x, y, z1, cam), P3(x + w, y, z1, cam), P3(x + w, y + h, z1, cam), P3(x, y + h, z1, cam)];
  poly(ctx, T, mat.top || shade(mat.base, 0.06));
  poly(ctx, [...L.slice(0, 2), R[1], R[2], L[2], L[3]], null, BINK, 1);
  return T;
}

/** Ameias por cima de uma caixa (só nas arestas da frente e dos lados). */
function crenels(ctx, cam, x, y, w, h, z, base, size = 0.18) {
  const pts = [];
  const step = size * 2;
  for (let k = 0; k < w - 0.01; k += step) pts.push([x + k, y], [x + k, y + h - size]);
  for (let k = step; k < h - size - 0.01; k += step) pts.push([x, y + k], [x + w - size, y + k]);
  pts.push([x + w - size, y + h - size]);
  pts.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
  pts.forEach(([px, py]) => box3(ctx, cam, px, py, size, size, z, z + 7, { base }, 0));
}

/** Telhado de duas águas. axis "x" = cumeeira ao longo de x. */
function gableRoof(ctx, cam, x, y, w, h, z, rise, color, axis = "x", over = 0.12, tex = "shingle") {
  const o = over;
  let back, front, gable, sideHidden;
  if (axis === "x") {
    const ry = y + h / 2;
    back = [P3(x - o, y - o, z, cam), P3(x + w + o, y - o, z, cam), P3(x + w + o, ry, z + rise, cam), P3(x - o, ry, z + rise, cam)];
    front = [P3(x - o, y + h + o, z, cam), P3(x + w + o, y + h + o, z, cam), P3(x + w + o, ry, z + rise, cam), P3(x - o, ry, z + rise, cam)];
    gable = [P3(x + w, y, z, cam), P3(x + w, y + h, z, cam), P3(x + w, ry, z + rise, cam)];
  } else {
    const rx = x + w / 2;
    back = [P3(x - o, y - o, z, cam), P3(x - o, y + h + o, z, cam), P3(rx, y + h + o, z + rise, cam), P3(rx, y - o, z + rise, cam)];
    front = [P3(x + w + o, y - o, z, cam), P3(x + w + o, y + h + o, z, cam), P3(rx, y + h + o, z + rise, cam), P3(rx, y - o, z + rise, cam)];
    gable = [P3(x, y + h, z, cam), P3(x + w, y + h, z, cam), P3(rx, y + h, z + rise, cam)];
  }
  poly(ctx, back, shade(color, 0.08), BINK);
  poly(ctx, gable, shade(color, -0.55), BINK);
  poly(ctx, front, shade(color, -0.12), BINK);
  // telhas / colmo
  ctx.save();
  ctx.beginPath(); front.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = tex === "thatch" ? "rgba(60,40,10,0.45)" : "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
  for (let k = 0.15; k < 1; k += tex === "thatch" ? 0.12 : 0.2) {
    const p = { x: lerp(front[0].x, front[3].x, k), y: lerp(front[0].y, front[3].y, k) };
    const q = { x: lerp(front[1].x, front[2].x, k), y: lerp(front[1].y, front[2].y, k) };
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  ctx.restore();
}

/** Torre redonda. r em tiles; z0..z1 em px. Devolve info do topo. */
function roundTower(ctx, cam, cx, cy, r, z0, z1, base, opts = {}) {
  const c0 = P3(cx, cy, z0, cam), c1 = P3(cx, cy, z1, cam);
  const rx = r * TW / Math.SQRT2, ry = r * TH / Math.SQRT2;
  const g = ctx.createLinearGradient(c0.x - rx, 0, c0.x + rx, 0);
  g.addColorStop(0, shade(base, 0.02)); g.addColorStop(0.45, shade(base, -0.15)); g.addColorStop(1, shade(base, -0.55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(c1.x - rx, c1.y); ctx.lineTo(c0.x - rx, c0.y);
  ctx.ellipse(c0.x, c0.y, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(c1.x + rx, c1.y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = BINK; ctx.lineWidth = 1; ctx.stroke();
  // fiadas de pedra
  if (opts.tex !== "wood") {
    ctx.strokeStyle = "rgba(0,0,0,0.33)";
    for (let z = z0 + 7, row = 0; z < z1; z += 7, row++) {
      const p = P3(cx, cy, z, cam);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0.05, Math.PI - 0.05); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = 0.25 + i * 0.62 + (row % 2) * 0.3;
        if (a > Math.PI - 0.1) continue;
        const xx = p.x + Math.cos(a) * rx, yy = p.y + Math.sin(a) * ry;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 7); ctx.stroke();
      }
    }
  } else {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    for (let i = 1; i < 6; i++) { const xx = c0.x - rx + (2 * rx * i) / 6; ctx.beginPath(); ctx.moveTo(xx, c1.y + ry * 0.5); ctx.lineTo(xx, c0.y + ry * 0.6); ctx.stroke(); }
  }
  // topo
  ctx.fillStyle = shade(base, -0.05);
  ctx.beginPath(); ctx.ellipse(c1.x, c1.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke();
  if (opts.crenel) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      if (Math.sin(a) < -0.2) continue;
      const xx = c1.x + Math.cos(a) * rx * 0.92, yy = c1.y + Math.sin(a) * ry * 0.92;
      ctx.fillStyle = Math.cos(a) > 0.3 ? shade(base, -0.45) : shade(base, -0.1);
      ctx.fillRect(xx - 3, yy - 7, 6, 7); ctx.strokeStyle = BINK; ctx.strokeRect(xx - 3, yy - 7, 6, 7);
    }
  }
  return { c1, rx, ry };
}

function coneRoof(ctx, top, rise, color) {
  const { c1, rx, ry } = top;
  const ax = c1.x, ay = c1.y - rise;
  const g = ctx.createLinearGradient(c1.x - rx, 0, c1.x + rx, 0);
  g.addColorStop(0, shade(color, 0.1)); g.addColorStop(0.5, shade(color, -0.1)); g.addColorStop(1, shade(color, -0.5));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(c1.x - rx * 1.12, c1.y);
  ctx.ellipse(c1.x, c1.y, rx * 1.12, ry * 1.12, 0, Math.PI, 0, true);
  ctx.lineTo(ax, ay); ctx.closePath(); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  for (let k = 0.3; k < 1; k += 0.25) { ctx.beginPath(); ctx.ellipse(lerp(ax, c1.x, k), lerp(ay, c1.y, k), rx * 1.12 * k, ry * 1.12 * k, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
  return { x: ax, y: ay };
}

// ── adereços ─────────────────────────────────────────────────────────────────
function fireGlow(ctx, x, y, r, t, col = "255,140,50") {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * (1 + Math.sin(t * 9) * 0.06));
  g.addColorStop(0, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function flame(ctx, x, y, s, t, colors = ["#ff7a1a", "#ffd04a", "#fff4c0"]) {
  colors.forEach((c, i) => {
    const k = 1 - i * 0.3, f = Math.sin(t * 14 + i + x) * 1.5 * s;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - 5 * s * k, y);
    ctx.quadraticCurveTo(x - 4 * s * k + f, y - 9 * s * k, x + f * 0.6, y - 15 * s * k);
    ctx.quadraticCurveTo(x + 4 * s * k + f, y - 9 * s * k, x + 5 * s * k, y);
    ctx.closePath(); ctx.fill();
  });
}
function campfire(ctx, cam, x, y, t) {
  const p = P3(x, y, 0, cam);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ctx.fillStyle = i % 2 ? "#5a5552" : "#6e6864"; ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * 9, p.y + Math.sin(a) * 4.5, 3, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = "#3a2618"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x - 6, p.y + 1); ctx.lineTo(p.x + 5, p.y - 3); ctx.moveTo(p.x - 5, p.y - 3); ctx.lineTo(p.x + 6, p.y + 1); ctx.stroke();
  flame(ctx, p.x, p.y, 0.8, t);
  fireGlow(ctx, p.x, p.y - 5, 38, t);
}
function anvil(ctx, cam, x, y) {
  const p = P3(x, y, 0, cam);
  ctx.fillStyle = "#4a3222"; ctx.fillRect(p.x - 5, p.y - 9, 10, 9); ctx.strokeStyle = BINK; ctx.strokeRect(p.x - 5, p.y - 9, 10, 9);
  ctx.fillStyle = "#2c2e33";
  ctx.beginPath(); ctx.moveTo(p.x - 9, p.y - 15); ctx.lineTo(p.x + 7, p.y - 15); ctx.quadraticCurveTo(p.x + 13, p.y - 15, p.x + 13, p.y - 13); ctx.lineTo(p.x + 5, p.y - 12); ctx.lineTo(p.x + 4, p.y - 9); ctx.lineTo(p.x - 4, p.y - 9); ctx.lineTo(p.x - 5, p.y - 12); ctx.lineTo(p.x - 9, p.y - 13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(p.x - 8, p.y - 15, 14, 1.2);
}
function barrel(ctx, cam, x, y, steam, t) {
  const p = P3(x, y, 0, cam);
  ctx.fillStyle = "#6b4626"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 7, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke();
  ctx.strokeStyle = "#2c2e33"; ctx.lineWidth = 1.6; [-11, -3].forEach(dy => { ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + dy); ctx.lineTo(p.x + 7, p.y + dy); ctx.stroke(); });
  ctx.fillStyle = steam ? "#2a4a5a" : "#4a3018"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 15, 6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  if (steam) for (let i = 0; i < 3; i++) {
    const k = ((t * 0.6 + i / 3) % 1);
    ctx.fillStyle = `rgba(220,220,230,${0.3 * (1 - k)})`;
    ctx.beginPath(); ctx.arc(p.x + Math.sin(t * 2 + i) * 3, p.y - 17 - k * 22, 3 + k * 4, 0, Math.PI * 2); ctx.fill();
  }
}
function crate(ctx, cam, x, y, s = 0.32) {
  box3(ctx, cam, x - s / 2, y - s / 2, s, s, 0, 14, { base: "#7a5530", tex: "wood" });
}
function candle(ctx, cam, x, y, t, h = 7) {
  const p = P3(x, y, 0, cam);
  ctx.fillStyle = "#e8dcc0"; ctx.fillRect(p.x - 1.4, p.y - h, 2.8, h);
  flame(ctx, p.x, p.y - h, 0.28, t);
  fireGlow(ctx, p.x, p.y - h - 3, 14, t, "255,170,80");
}
function banner(ctx, x, y, h, t, color, gold) {
  ctx.strokeStyle = "#2a1c12"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = gold ? "#d8a94a" : "#8a6a2e"; ctx.beginPath(); ctx.arc(x, y - h, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y - h + 2);
  for (let i = 0; i <= 6; i++) ctx.lineTo(x + i * 3, y - h + 2 + Math.sin(t * 4 + i * 0.8) * 2);
  for (let i = 6; i >= 0; i--) ctx.lineTo(x + i * 3, y - h + 13 + Math.sin(t * 4 + i * 0.8) * 2 + (i === 6 ? -3 : 0));
  ctx.closePath(); ctx.fill(); ctx.strokeStyle = BINK; ctx.lineWidth = 1; ctx.stroke();
  if (gold) { ctx.fillStyle = "#d8a94a"; ctx.fillRect(x + 6, y - h + 6, 5, 4); }
}
function windowGlow(ctx, x, y, w, h, t, col = "#ffb347", bars = false) {
  ctx.fillStyle = "#1a0e08"; ctx.fillRect(x - w / 2 - 1, y - h - 1, w + 2, h + 2);
  ctx.fillStyle = col; ctx.globalAlpha = 0.75 + Math.sin(t * 3 + x) * 0.15; ctx.fillRect(x - w / 2, y - h, w, h); ctx.globalAlpha = 1;
  if (bars) { ctx.strokeStyle = "#1a1a1e"; ctx.lineWidth = 1.2; for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + (w * i) / 3, y - h); ctx.lineTo(x - w / 2 + (w * i) / 3, y); ctx.stroke(); } }
  fireGlow(ctx, x, y - h / 2, w * 2.2, t, "255,170,80");
}
function archDoor(ctx, x, y, w, h, wood = "#3a2416", studs) {
  ctx.fillStyle = "#120a06";
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 1.5, y); ctx.lineTo(x - w / 2 - 1.5, y - h + w / 2); ctx.arc(x, y - h + w / 2, w / 2 + 1.5, Math.PI, 0); ctx.lineTo(x + w / 2 + 1.5, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = wood;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h + w / 2); ctx.arc(x, y - h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  if (studs) { ctx.fillStyle = "#8a8a92"; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(x - w / 4 + j * w / 2 - 0.8, y - 3 - i * (h / 3.2), 1.6, 1.6); }
}

// ═════════════════════════════════════════════════════════════════════════════
// EDIFÍCIOS
// ═════════════════════════════════════════════════════════════════════════════
const STONE = "#6b6560", STONE_D = "#4f4a46", WOOD = "#6a4a2c", PLASTER = "#c9bda4", THATCH = "#9a7a3a", SLATE = "#3f4652", TILE_R = "#7a3328";

/** Desenha um edifício no nível L. Devolve a altura do topo (px) para a etiqueta. */
function drawBuildingStage(ctx, b, L, cam, t, highlight) {
  if (highlight) {
    ctx.save();
    ctx.strokeStyle = rgba(b.color, 0.9); ctx.lineWidth = 2.5; ctx.shadowColor = b.color; ctx.shadowBlur = 14;
    diamondPath(ctx, b.tx - 0.15, b.ty - 0.15, cam, b.w + 0.3, b.h + 0.3); ctx.stroke();
    ctx.restore();
  }
  // chão do lote (terra batida / lajes conforme o nível)
  ctx.fillStyle = L >= 3 || ["mercado", "portal"].includes(b.id) ? "rgba(90,82,76,0.55)" : "rgba(80,60,40,0.4)";
  diamondPath(ctx, b.tx + 0.04, b.ty + 0.04, cam, b.w - 0.08, b.h - 0.08); ctx.fill();
  const fn = { forja: drawForja, farol: drawFarol, altar: drawAltar, cofre: drawCofre, mercado: drawMercado, portal: drawPortal, quests: drawQuests }[b.id];
  return fn ? fn(ctx, b, L, cam, t) : 40;
}

// ── Forja ────────────────────────────────────────────────────────────────────
function drawForja(ctx, b, L, cam, t) {
  const x = b.tx, y = b.ty;
  let top = 40;
  if (L <= 1) {
    // barraca de lona em A
    const a = P3(x + 0.3, y + 0.3, 0, cam), c = P3(x + 1.7, y + 0.3, 0, cam);
    const d = P3(x + 0.3, y + 1.1, 0, cam), e = P3(x + 1.7, y + 1.1, 0, cam);
    const ra = P3(x + 0.3, y + 0.7, 34, cam), rb = P3(x + 1.7, y + 0.7, 34, cam);
    poly(ctx, [a, c, rb, ra], "#8c7a5a", BINK);
    poly(ctx, [e, c, rb], "#5e5038", BINK);
    poly(ctx, [d, e, rb, ra], "#a8946c", BINK);
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; for (let k = 0.25; k < 1; k += 0.25) { const p = { x: lerp(d.x, e.x, k), y: lerp(d.y, e.y, k) }, q = { x: lerp(ra.x, rb.x, k), y: lerp(ra.y, rb.y, k) }; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    ctx.strokeStyle = "#3a2618"; ctx.lineWidth = 2; [ra, rb].forEach(p => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 5); ctx.stroke(); });
    campfire(ctx, cam, x + 1.0, y + 1.6, t);
    if (L === 0) { const p = P3(x + 1.6, y + 1.5, 0, cam); ctx.fillStyle = "#5e5955"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 4, 7, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke(); }
    else anvil(ctx, cam, x + 1.6, y + 1.55);
    return 44;
  }
  // casebre (L2+)
  const stoneLow = L >= 4;
  const H = 34 + (L >= 4 ? 6 : 0);
  let towerTop = 0;
  if (L >= 5) {
    // torre-forja atrás do casebre, com brasas no topo
    const tw = roundTower(ctx, cam, x + 1.9, y + 0.12, 0.34, 0, H + 50, STONE, { crenel: true });
    const c = tw.c1;
    ctx.fillStyle = "#2a1008"; ctx.beginPath(); ctx.ellipse(c.x, c.y, tw.rx * 0.7, tw.ry * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? "#ff7a1a" : "#ffd04a"; ctx.fillRect(c.x - 8 + hash2(i, 3) * 16, c.y - 3 + Math.sin(t * 6 + i) * 1.5, 2.5, 2.5); }
    flame(ctx, c.x, c.y, 0.7, t);
    fireGlow(ctx, c.x, c.y - 6, 46, t);
    for (let i = 0; i < 3; i++) { const k = (t * 0.7 + i / 3) % 1; ctx.fillStyle = `rgba(255,160,60,${1 - k})`; ctx.fillRect(c.x + Math.sin(t * 3 + i * 2) * 6, c.y - 10 - k * 30, 1.6, 1.6); }
    banner(ctx, c.x + tw.rx * 0.6, c.y - 4, 22, t, "#d0843c");
    towerTop = H + 76;
  }
  if (stoneLow) { box3(ctx, cam, x + 0.15, y + 0.15, 1.7, 1.3, 0, 16, { base: STONE, tex: "stone" }, 3); box3(ctx, cam, x + 0.15, y + 0.15, 1.7, 1.3, 16, H, { base: PLASTER, tex: "timber" }); }
  else box3(ctx, cam, x + 0.15, y + 0.15, 1.7, 1.3, 0, H, { base: WOOD, tex: "wood" }, 5);
  // chaminé de pedra
  const chim = () => {
    box3(ctx, cam, x + 0.25, y + 0.25, 0.35, 0.35, 0, H + 34, { base: STONE_D, tex: "stone" }, 9);
    const p = P3(x + 0.42, y + 0.42, H + 34, cam);
    for (let i = 0; i < 4; i++) { const k = (t * 0.4 + i / 4) % 1; ctx.fillStyle = `rgba(80,76,72,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(p.x - k * 10 + Math.sin(t + i) * 3, p.y - 4 - k * 34, 3 + k * 7, 0, Math.PI * 2); ctx.fill(); }
  };
  chim();
  gableRoof(ctx, cam, x + 0.15, y + 0.15, 1.7, 1.3, H, 20, L >= 4 ? SLATE : L >= 3 ? TILE_R : THATCH, "x", 0.12, L >= 3 ? "shingle" : "thatch");
  // porta com o brilho da forja
  const dm = P3(x + 1.0, y + 1.45, 0, cam);
  archDoor(ctx, dm.x, dm.y, 12, 20, "#2a1408");
  ctx.fillStyle = `rgba(255,110,30,${0.55 + Math.sin(t * 7) * 0.15})`; ctx.fillRect(dm.x - 5, dm.y - 12, 10, 12);
  fireGlow(ctx, dm.x, dm.y - 6, 30, t);
  anvil(ctx, cam, x + 1.75, y + 1.75);
  if (L >= 3) {
    barrel(ctx, cam, x + 0.35, y + 1.75, true, t);
    // fole
    const f = P3(x + 1.95, y + 1.0, 0, cam), pump = Math.sin(t * 3) * 2;
    ctx.fillStyle = "#5a3a20"; ctx.beginPath(); ctx.moveTo(f.x - 8, f.y - 6); ctx.lineTo(f.x + 6, f.y - 9 - pump); ctx.lineTo(f.x + 6, f.y - 2 + pump); ctx.closePath(); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke();
    ctx.fillStyle = "#3a2618"; ctx.fillRect(f.x + 5, f.y - 10 - pump, 3, 10 + pump * 2);
  }
  if (L >= 4) {
    // armas penduradas num suporte
    const r = P3(x + 2.0, y + 0.45, 0, cam);
    ctx.strokeStyle = "#3a2618"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r.x - 8, r.y); ctx.lineTo(r.x - 8, r.y - 24); ctx.lineTo(r.x + 8, r.y - 24); ctx.lineTo(r.x + 8, r.y); ctx.stroke();
    [[-5, "#bfc2c8"], [0, "#9a9ca4"], [5, "#bfc2c8"]].forEach(([dx, c], i) => {
      ctx.fillStyle = c; ctx.fillRect(r.x + dx - 1, r.y - 22, 2, 16);
      ctx.fillStyle = "#6b4a2a"; ctx.fillRect(r.x + dx - 2.5, r.y - 8, 5, 1.6);
      if (i === 1) { ctx.fillStyle = "#9a9ca4"; ctx.beginPath(); ctx.moveTo(r.x + dx, r.y - 22); ctx.lineTo(r.x + dx + 5, r.y - 19); ctx.lineTo(r.x + dx, r.y - 16); ctx.fill(); }
    });
  }
  top = Math.max(H + 20, towerTop);
  return top;
}

// ── Farol ────────────────────────────────────────────────────────────────────
function drawFarol(ctx, b, L, cam, t) {
  const cx = b.tx + 0.5, cy = b.ty + 0.5;
  const base = P3(cx, cy, 0, cam);
  const beam = (y, len, width, col) => {
    const ang = t * 1.1;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(base.x, y, 2, base.x, y, len);
    g.addColorStop(0, `rgba(${col},0.55)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(base.x, y); ctx.arc(base.x, y, len, ang - width, ang + width); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(base.x, y); ctx.arc(base.x, y, len * 0.7, ang + Math.PI - width, ang + Math.PI + width); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  if (L <= 1) {
    ctx.strokeStyle = "#3a2618"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(base.x, base.y - 52); ctx.stroke();
    ctx.strokeStyle = BINK; ctx.lineWidth = 1; ctx.strokeRect(base.x - 2, base.y - 52, 4, 52);
    if (L === 0) { flame(ctx, base.x, base.y - 52, 0.6, t); fireGlow(ctx, base.x, base.y - 58, 34, t); }
    else {
      ctx.strokeStyle = "#2a2a2e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(base.x, base.y - 50); ctx.lineTo(base.x + 10, base.y - 50); ctx.lineTo(base.x + 10, base.y - 46); ctx.stroke();
      ctx.fillStyle = "#2a2a2e"; ctx.fillRect(base.x + 5, base.y - 46, 10, 12);
      ctx.fillStyle = `rgba(255,214,120,${0.85 + Math.sin(t * 5) * 0.1})`; ctx.fillRect(base.x + 6.5, base.y - 44, 7, 8);
      fireGlow(ctx, base.x + 10, base.y - 40, 40, t, "255,214,120");
    }
    return 64;
  }
  let H, top;
  if (L === 2) {
    // torre de madeira (estrutura em treliça)
    H = 62;
    const corners = [[-0.32, -0.32], [0.32, -0.32], [0.32, 0.32], [-0.32, 0.32]].map(([dx, dy]) => [P3(cx + dx * 1.2, cy + dy * 1.2, 0, cam), P3(cx + dx * 0.8, cy + dy * 0.8, H, cam)]);
    ctx.strokeStyle = "#4a3220"; ctx.lineWidth = 3;
    corners.forEach(([g, h]) => { ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(h.x, h.y); ctx.stroke(); });
    ctx.lineWidth = 1.5;
    [[0, 1], [1, 2], [2, 3]].forEach(([i, j]) => { [0.3, 0.65].forEach(k => {
      const a = { x: lerp(corners[i][0].x, corners[i][1].x, k), y: lerp(corners[i][0].y, corners[i][1].y, k) }, c = { x: lerp(corners[j][0].x, corners[j][1].x, k + 0.3), y: lerp(corners[j][0].y, corners[j][1].y, k + 0.3) };
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); }); });
    box3(ctx, cam, cx - 0.32, cy - 0.32, 0.64, 0.64, H, H + 6, { base: WOOD, tex: "wood" });
    top = P3(cx, cy, H + 6, cam);
  } else {
    H = L === 3 ? 72 : L === 4 ? 92 : 108;
    const tw = roundTower(ctx, cam, cx, cy, L >= 4 ? 0.42 : 0.38, 0, H, L >= 5 ? "#8a847c" : STONE, { crenel: L >= 5 });
    const door = P3(cx + 0.2, cy + 0.35, 0, cam); archDoor(ctx, door.x, door.y, 9, 15, "#3a2416");
    const w = P3(cx + 0.3, cy + 0.25, H * 0.55, cam); windowGlow(ctx, w.x, w.y, 4, 7, t);
    top = tw.c1;
    if (L === 3) { box3(ctx, cam, cx - 0.28, cy - 0.28, 0.56, 0.56, H, H + 4, { base: WOOD, tex: "wood" }); top = P3(cx, cy, H + 4, cam); }
  }
  // sala da lanterna
  const lr = top;
  const lh = L >= 4 ? 18 : 14;
  ctx.fillStyle = "#2a2a2e"; ctx.fillRect(lr.x - 9, lr.y - lh, 18, lh); ctx.strokeStyle = BINK; ctx.strokeRect(lr.x - 9, lr.y - lh, 18, lh);
  const lightCol = L >= 5 ? "120,255,230" : "255,220,140";
  ctx.fillStyle = L >= 5 ? `rgba(130,255,230,${0.8 + Math.sin(t * 4) * 0.15})` : `rgba(255,222,140,${0.85 + Math.sin(t * 5) * 0.1})`;
  ctx.fillRect(lr.x - 7, lr.y - lh + 2, 14, lh - 4);
  ctx.fillStyle = "#2a2a2e"; for (let i = -1; i <= 1; i++) ctx.fillRect(lr.x + i * 5 - 0.6, lr.y - lh + 2, 1.2, lh - 4);
  if (L >= 4) { // espelho rotativo
    const m = Math.cos(t * 1.1);
    ctx.fillStyle = "#e8eef4"; ctx.fillRect(lr.x - 3 + m * 3, lr.y - lh + 4, 2 + Math.abs(m) * 3, lh - 8);
  }
  if (L >= 5) { // chama mágica
    flame(ctx, lr.x, lr.y - 4, 0.55, t, ["#2bb3a3", "#7fffe0", "#e0379a"]);
  }
  const roof = coneRoof(ctx, { c1: { x: lr.x, y: lr.y - lh }, rx: 12, ry: 6 }, L >= 5 ? 22 : 14, L >= 5 ? "#2b5a54" : "#4a3a30");
  if (L >= 5) banner(ctx, roof.x, roof.y, 14, t, "#2bb3a3");
  beam(lr.y - lh / 2, L === 2 ? 100 : L === 3 ? 125 : L === 4 ? 160 : 190, L >= 4 ? 0.2 : 0.14, lightCol);
  fireGlow(ctx, lr.x, lr.y - lh / 2, 40 + L * 6, t, lightCol);
  return base.y - roof.y + 18;
}

// ── Altar de Sangue ──────────────────────────────────────────────────────────
function drawAltar(ctx, b, L, cam, t) {
  const cx = b.tx + 1, cy = b.ty + 1;
  const pulse = 0.5 + Math.sin(t * 2.5) * 0.25;
  const menhir = (x, y, h) => {
    const p = P3(x, y, 0, cam);
    ctx.fillStyle = "#5a5552";
    ctx.beginPath(); ctx.moveTo(p.x - 7, p.y); ctx.lineTo(p.x - 6, p.y - h + 4); ctx.quadraticCurveTo(p.x - 1, p.y - h - 2, p.x + 5, p.y - h + 3); ctx.lineTo(p.x + 7, p.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.moveTo(p.x + 1, p.y); ctx.lineTo(p.x + 2, p.y - h + 2); ctx.lineTo(p.x + 5, p.y - h + 3); ctx.lineTo(p.x + 7, p.y); ctx.fill();
    ctx.fillStyle = `rgba(200,20,40,${pulse})`; ctx.fillRect(p.x - 3, p.y - h * 0.6, 2, 6); ctx.fillRect(p.x - 4, p.y - h * 0.6 + 2, 4, 1.5);
  };
  if (L <= 1) {
    menhir(cx, cy - 0.1, 36);
    if (L === 0) candle(ctx, cam, cx + 0.35, cy + 0.25, t);
    else for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; candle(ctx, cam, cx + Math.cos(a) * 0.65, cy + Math.sin(a) * 0.65, t, 5 + (i % 3)); }
    // mancha de sangue
    const p = P3(cx, cy + 0.2, 0, cam); ctx.fillStyle = "rgba(120,10,20,0.45)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    return 48;
  }
  const slab = () => {
    box3(ctx, cam, cx - 0.4, cy - 0.25, 0.8, 0.5, 0, 12, { base: STONE_D, tex: "stone" }, 2);
    box3(ctx, cam, cx - 0.46, cy - 0.31, 0.92, 0.62, 12, 15, { base: "#77706a" });
    const p = P3(cx, cy, 15, cam);
    ctx.fillStyle = `rgba(200,20,40,${pulse})`;
    for (let i = 0; i < 5; i++) ctx.fillRect(p.x - 12 + i * 5, p.y - 1, 3, 1.5);
    ctx.fillStyle = "rgba(140,10,25,0.7)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    fireGlow(ctx, p.x, p.y - 4, 30, t, "200,20,40");
    [[-0.38, 0.2], [0.38, 0.2], [0.38, -0.2]].forEach(([dx, dy]) => candle(ctx, cam, cx + dx, cy + dy, t, 5));
  };
  if (L <= 3) {
    if (L === 3) {
      [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].forEach(([dx, dy], i) => {
        const h = i === 1 ? 26 : 44 - i * 3;
        box3(ctx, cam, cx + dx - 0.12, cy + dy - 0.12, 0.24, 0.24, 0, h, { base: "#8a847c", tex: "stone" }, i);
        if (i !== 1) box3(ctx, cam, cx + dx - 0.16, cy + dy - 0.16, 0.32, 0.32, h, h + 4, { base: "#9a948c" });
      });
    }
    slab();
    return L === 3 ? 60 : 30;
  }
  // capela (L4) / santuário gótico (L5)
  const H = L === 4 ? 40 : 54;
  box3(ctx, cam, cx - 0.75, cy - 0.65, 1.5, 1.3, 0, H, { base: "#6e6862", tex: "stone" }, 11);
  if (L === 5) [[-0.82, 0.3], [0.82, 0.3]].forEach(([dx]) => box3(ctx, cam, cx + 0.72, cy + dx * 0.6 - 0.1, 0.18, 0.22, 0, H - 14, { base: STONE_D, tex: "stone" }, 4));
  gableRoof(ctx, cam, cx - 0.75, cy - 0.65, 1.5, 1.3, H, L === 5 ? 38 : 24, L === 5 ? "#2a2830" : SLATE, "y", 0.1);
  // porta e vitral
  const d = P3(cx, cy + 0.66, 0, cam); archDoor(ctx, d.x, d.y, 11, 22, "#3a1a14", true);
  ctx.fillStyle = `rgba(200,20,40,${0.35 + pulse * 0.3})`; ctx.fillRect(d.x - 3, d.y - 4, 6, 4);
  const g = P3(cx, cy + 0.66, H + (L === 5 ? 12 : 6), cam);
  const rr = L === 5 ? 7 : 4.5;
  ctx.fillStyle = "#1a0a0c"; ctx.beginPath(); ctx.arc(g.x, g.y, rr + 1.5, 0, Math.PI * 2); ctx.fill();
  const segs = L === 5 ? 8 : 4;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i % 2 ? `rgba(220,30,50,${0.8 + Math.sin(t * 2 + i) * 0.15})` : `rgba(140,10,40,0.9)`;
    ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.arc(g.x, g.y, rr, (i / segs) * Math.PI * 2, ((i + 1) / segs) * Math.PI * 2); ctx.closePath(); ctx.fill();
  }
  fireGlow(ctx, g.x, g.y, 26, t, "220,30,50");
  let top = H + (L === 5 ? 38 : 24);
  if (L === 5) {
    // pináculo
    const s = P3(cx, cy - 0.3, H + 30, cam);
    ctx.fillStyle = "#2a2830"; ctx.beginPath(); ctx.moveTo(s.x - 5, s.y); ctx.lineTo(s.x, s.y - 30); ctx.lineTo(s.x + 5, s.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke();
    ctx.fillStyle = `rgba(200,20,40,${pulse})`; ctx.beginPath(); ctx.arc(s.x, s.y - 30, 2.5, 0, Math.PI * 2); ctx.fill();
    candle(ctx, cam, cx - 0.55, cy + 0.85, t, 6); candle(ctx, cam, cx + 0.55, cy + 0.85, t, 6);
    top = H + 70;
  }
  return top;
}

// ── Cofre ────────────────────────────────────────────────────────────────────
function drawCofre(ctx, b, L, cam, t) {
  const x = b.tx, y = b.ty;
  const chest = (cx, cy, lock, buried) => {
    const z0 = buried ? -6 : 0;
    box3(ctx, cam, cx - 0.28, cy - 0.18, 0.56, 0.36, z0, 12, { base: "#6b4626", tex: "wood" });
    box3(ctx, cam, cx - 0.3, cy - 0.2, 0.6, 0.4, 12, 17, { base: "#7a5530" });
    const p = P3(cx, cy + 0.18, 9, cam);
    ctx.strokeStyle = "#2c2e33"; ctx.lineWidth = 2;
    [-0.18, 0.18].forEach(dx => { const a = P3(cx + dx, cy + 0.18, z0 + 1, cam), c = P3(cx + dx, cy + 0.18, 17, cam); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); });
    if (lock) { ctx.fillStyle = "#d8a94a"; ctx.fillRect(p.x - 2.5, p.y - 2, 5, 5); ctx.strokeStyle = "#8a6a2e"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 2, Math.PI, 0); ctx.stroke(); }
    if (buried) { const m = P3(cx, cy, 0, cam); ctx.fillStyle = "#4a3820"; ctx.beginPath(); ctx.ellipse(m.x, m.y + 2, 26, 9, 0, 0, Math.PI); ctx.fill(); }
  };
  if (L <= 1) {
    chest(x + 1, y + 0.5, L === 1, L === 0);
    if (L === 0) { const s = P3(x + 1.7, y + 0.5, 0, cam); ctx.strokeStyle = "#5a4630"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 4, s.y - 18); ctx.stroke(); ctx.fillStyle = "#6b6560"; ctx.fillRect(s.x + 1, s.y - 22, 7, 5); }
    return 34;
  }
  if (L === 2) {
    box3(ctx, cam, x + 0.25, y + 0.1, 1.5, 0.8, 0, 28, { base: WOOD, tex: "wood" }, 7);
    gableRoof(ctx, cam, x + 0.25, y + 0.1, 1.5, 0.8, 28, 16, THATCH, "x", 0.1, "thatch");
    const d = P3(x + 1.0, y + 0.9, 0, cam); archDoor(ctx, d.x, d.y, 10, 18, "#3a2416", true);
    return 52;
  }
  if (L === 3) {
    box3(ctx, cam, x + 0.2, y + 0.1, 1.6, 0.8, 0, 32, { base: STONE, tex: "stone" }, 8);
    gableRoof(ctx, cam, x + 0.2, y + 0.1, 1.6, 0.8, 32, 16, TILE_R, "x", 0.1);
    const d = P3(x + 1.0, y + 0.9, 0, cam); archDoor(ctx, d.x, d.y, 10, 18, "#3a2416", true);
    [0.5, 1.5].forEach(k => { const w = P3(x + k, y + 0.9, 20, cam); windowGlow(ctx, w.x, w.y, 6, 8, t, "#ffcf6a", true); });
    return 56;
  }
  // torre de pedra quadrada (L4) e torre-tesouraria (L5)
  const H = L === 4 ? 66 : 80;
  box3(ctx, cam, x + 0.15, y + 0.12, 1.1, 0.76, 0, 30, { base: STONE, tex: "stone" }, 13);
  box3(ctx, cam, x + 1.0, y + 0.05, 0.9, 0.9, 0, H, { base: "#75706a", tex: "stone" }, 21);
  crenels(ctx, cam, x + 1.0, y + 0.05, 0.9, 0.9, H, "#75706a", 0.15);
  gableRoof(ctx, cam, x + 0.15, y + 0.12, 0.85, 0.76, 30, 14, SLATE, "x", 0.08);
  const d = P3(x + 1.45, y + 0.95, 0, cam); archDoor(ctx, d.x, d.y, 10, 19, "#2a1a10", true);
  [0.3, 0.65].forEach(k => { const w = P3(x + 1.9, y + 0.05 + k * 0.9, H * 0.62, cam); windowGlow(ctx, w.x, w.y, 4, 7, t, "#ffcf6a", true); });
  if (L >= 5) {
    const tp = P3(x + 1.45, y + 0.5, H, cam);
    ctx.fillStyle = "#d8a94a"; ctx.beginPath(); ctx.moveTo(tp.x - 20, tp.y + 2); ctx.lineTo(tp.x, tp.y - 26); ctx.lineTo(tp.x + 20, tp.y + 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.moveTo(tp.x - 18, tp.y + 1); ctx.lineTo(tp.x, tp.y - 24); ctx.lineTo(tp.x - 4, tp.y + 1); ctx.fill();
    banner(ctx, tp.x, tp.y - 26, 16, t, "#6f8cff", true);
    banner(ctx, P3(x + 0.2, y + 0.12, 30, cam).x, P3(x + 0.2, y + 0.12, 30, cam).y, 16, t, "#6f8cff", true);
    // moedas à vista
    [[0.5, 1.05], [0.75, 1.15], [0.35, 1.25]].forEach(([dx, dy], i) => {
      const p = P3(x + dx, y + dy, 0, cam);
      for (let j = 0; j < 4 - i; j++) { ctx.fillStyle = j % 2 ? "#d8a94a" : "#f2d24b"; ctx.beginPath(); ctx.ellipse(p.x, p.y - j * 2, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
      if (Math.sin(t * 3 + i * 2) > 0.92) { ctx.fillStyle = "#fff"; ctx.fillRect(p.x + 2, p.y - 9, 1.5, 1.5); }
    });
    fireGlow(ctx, P3(x + 0.5, y + 1.15, 0, cam).x, P3(x + 0.5, y + 1.15, 0, cam).y - 4, 20, t, "242,210,75");
    return H + 44;
  }
  return H + 16;
}

// ── Mercado (casebre de enxaimel com banca às riscas) ────────────────────────
function drawMercado(ctx, b, L, cam, t) {
  const x = b.tx, y = b.ty;
  box3(ctx, cam, x + 0.1, y + 0.1, 2.8, 1.25, 0, 14, { base: STONE, tex: "stone" }, 31);
  box3(ctx, cam, x + 0.1, y + 0.1, 2.8, 1.25, 14, 40, { base: PLASTER, tex: "timber" });
  gableRoof(ctx, cam, x + 0.1, y + 0.1, 2.8, 1.25, 40, 24, "#5a2a3a", "x", 0.14);
  [0.6, 2.4].forEach(k => { const w = P3(x + k, y + 1.35, 30, cam); windowGlow(ctx, w.x, w.y, 7, 7, t, "#ffcf6a"); });
  const d = P3(x + 1.5, y + 1.35, 0, cam); archDoor(ctx, d.x, d.y, 12, 22, "#4a2a18");
  // banca com toldo às riscas
  const a1 = P3(x + 0.35, y + 1.95, 22, cam), a2 = P3(x + 2.65, y + 1.95, 22, cam), b1 = P3(x + 0.35, y + 1.4, 30, cam), b2 = P3(x + 2.65, y + 1.4, 30, cam);
  ctx.strokeStyle = "#3a2618"; ctx.lineWidth = 2;
  [[0.4, 1.95], [2.6, 1.95]].forEach(([px, py]) => { const g = P3(x + px, y + py, 0, cam), h = P3(x + px, y + py, 22, cam); ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(h.x, h.y); ctx.stroke(); });
  box3(ctx, cam, x + 0.45, y + 1.6, 2.1, 0.3, 0, 10, { base: WOOD, tex: "wood" }, 4);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const k0 = i / n, k1 = (i + 1) / n;
    poly(ctx, [
      { x: lerp(b1.x, b2.x, k0), y: lerp(b1.y, b2.y, k0) }, { x: lerp(b1.x, b2.x, k1), y: lerp(b1.y, b2.y, k1) },
      { x: lerp(a1.x, a2.x, k1), y: lerp(a1.y, a2.y, k1) + Math.sin(t * 2 + i) * 0.6 }, { x: lerp(a1.x, a2.x, k0), y: lerp(a1.y, a2.y, k0) + Math.sin(t * 2 + i - 1) * 0.6 },
    ], i % 2 ? "#e8dcc4" : N.magenta, BINK, 0.8);
  }
  // mercadoria
  [[0.8, "#e0379a"], [1.2, "#2bb3a3"], [1.6, "#f2d24b"], [2.0, "#6f8cff"]].forEach(([k, c]) => {
    const p = P3(x + k, y + 1.75, 10, cam); ctx.fillStyle = c; ctx.fillRect(p.x - 4, p.y - 5, 8, 5); ctx.strokeStyle = BINK; ctx.strokeRect(p.x - 4, p.y - 5, 8, 5);
  });
  crate(ctx, cam, x + 2.85, y + 1.75); barrel(ctx, cam, x + 0.15, y + 1.85, false, t);
  // tabuleta pendurada
  const s = P3(x + 2.9, y + 0.9, 34, cam);
  ctx.strokeStyle = "#3a2618"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 14, s.y - 4); ctx.stroke();
  ctx.save(); ctx.translate(s.x + 11, s.y - 3); ctx.rotate(Math.sin(t * 1.5) * 0.08);
  ctx.fillStyle = "#6a4a2c"; ctx.fillRect(-7, 2, 14, 11); ctx.strokeStyle = BINK; ctx.strokeRect(-7, 2, 14, 11);
  ctx.fillStyle = N.magenta; ctx.beginPath(); ctx.arc(0, 7.5, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  return 80;
}

// ── Portal (arco de pedra rúnico com braseiros) ─────────────────────────────
function drawPortal(ctx, b, L, cam, t) {
  const cx = b.tx + 1, cy = b.ty + 1;
  box3(ctx, cam, b.tx + 0.1, b.ty + 0.1, 1.8, 1.8, 0, 6, { base: "#4a4450", tex: "stone" }, 41);
  box3(ctx, cam, b.tx + 0.35, b.ty + 0.35, 1.3, 1.3, 6, 10, { base: "#57505e" });
  const c = P3(cx, cy, 10, cam);
  // runas no chão
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t * 0.3; ctx.fillStyle = `rgba(185,140,255,${0.4 + Math.sin(t * 3 + i) * 0.3})`; ctx.fillRect(c.x + Math.cos(a) * 26 - 1.5, c.y + Math.sin(a) * 13 - 1.5, 3, 3); }
  // pilares e arco
  [-1, 1].forEach(sd => {
    const g = P3(cx + sd * 0.55, cy - sd * 0.55, 10, cam);
    ctx.fillStyle = "#57505e"; ctx.fillRect(g.x - 6, g.y - 64, 12, 64); ctx.strokeStyle = BINK; ctx.strokeRect(g.x - 6, g.y - 64, 12, 64);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(g.x + 1, g.y - 64, 5, 64);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; for (let z = 8; z < 64; z += 8) { ctx.beginPath(); ctx.moveTo(g.x - 6, g.y - z); ctx.lineTo(g.x + 6, g.y - z); ctx.stroke(); }
    ctx.fillStyle = `rgba(185,140,255,${0.5 + Math.sin(t * 2 + sd) * 0.3})`; ctx.fillRect(g.x - 1.5, g.y - 46, 3, 8);
  });
  const l = P3(cx - 0.55, cy + 0.55, 10, cam), r = P3(cx + 0.55, cy - 0.55, 10, cam);
  ctx.strokeStyle = BINK; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(l.x, l.y - 62); ctx.quadraticCurveTo(c.x, c.y - 112, r.x, r.y - 62); ctx.stroke();
  ctx.strokeStyle = "#57505e"; ctx.lineWidth = 12; ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; for (let k = 0.15; k < 1; k += 0.17) { const px = lerp(lerp(l.x, c.x, k), lerp(c.x, r.x, k), k), py = lerp(lerp(l.y - 62, c.y - 112, k), lerp(c.y - 112, r.y - 62, k), k); ctx.beginPath(); ctx.moveTo(px - 4, py - 5); ctx.lineTo(px + 4, py + 5); ctx.stroke(); }
  // redemoinho
  const sc = { x: c.x, y: c.y - 42 };
  ctx.fillStyle = rgba("#9b5cff", 0.28 + Math.sin(t * 2) * 0.08); ctx.beginPath(); ctx.ellipse(sc.x, sc.y, 22, 34, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = rgba("#c7a4ff", 0.6 - i * 0.12); ctx.lineWidth = 3 - i * 0.5;
    ctx.beginPath(); ctx.ellipse(sc.x, sc.y, 20 - i * 4.5, 31 - i * 7, 0, t * (1.6 + i * 0.4), t * (1.6 + i * 0.4) + Math.PI * 1.4); ctx.stroke();
  }
  fireGlow(ctx, sc.x, sc.y, 50, t, "155,92,255");
  // braseiros
  [[-0.95, 0.45], [0.45, -0.95]].forEach(([dx, dy]) => {
    const p = P3(cx + dx, cy + dy, 6, cam);
    ctx.strokeStyle = "#2a2a2e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x, p.y - 14); ctx.lineTo(p.x + 5, p.y); ctx.stroke();
    ctx.fillStyle = "#2a2a2e"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 15, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    flame(ctx, p.x, p.y - 15, 0.55, t, ["#7a3cff", "#b98cff", "#f0e0ff"]);
    fireGlow(ctx, p.x, p.y - 20, 26, t, "155,92,255");
  });
  return 112;
}

// ── Quadro de quests (com telhadinho e lanterna) ─────────────────────────────
function drawQuests(ctx, b, L, cam, t) {
  const p = P3(b.tx + 0.5, b.ty + 0.6, 0, cam);
  ctx.fillStyle = "#3a2618"; ctx.fillRect(p.x - 17, p.y - 40, 4, 40); ctx.fillRect(p.x + 13, p.y - 40, 4, 40);
  ctx.strokeStyle = BINK; ctx.strokeRect(p.x - 17, p.y - 40, 4, 40); ctx.strokeRect(p.x + 13, p.y - 40, 4, 40);
  ctx.fillStyle = "#6b4a2a"; ctx.fillRect(p.x - 20, p.y - 38, 40, 26); ctx.strokeRect(p.x - 20, p.y - 38, 40, 26);
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(p.x - 20, p.y - 38 + i * 6.5); ctx.lineTo(p.x + 20, p.y - 38 + i * 6.5); ctx.stroke(); }
  [[-16, -35, 11, 14, "#e9dcb8"], [-3, -36, 10, 12, "#d8c8a0"], [9, -34, 9, 15, "#e9dcb8"]].forEach(([dx, dy, w, h, c], i) => {
    ctx.save(); ctx.translate(p.x + dx + w / 2, p.y + dy); ctx.rotate((i - 1) * 0.06);
    ctx.fillStyle = c; ctx.fillRect(-w / 2, 0, w, h);
    ctx.fillStyle = "rgba(60,40,20,0.5)"; for (let j = 0; j < 3; j++) ctx.fillRect(-w / 2 + 2, 4 + j * 3, w - 4, 1);
    ctx.fillStyle = N.blood; ctx.fillRect(-1, 0, 2, 2);
    ctx.restore();
  });
  // telhado
  ctx.fillStyle = "#4a2a20"; ctx.beginPath(); ctx.moveTo(p.x - 25, p.y - 38); ctx.lineTo(p.x, p.y - 54); ctx.lineTo(p.x + 25, p.y - 38); ctx.closePath(); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke();
  // lanterna
  ctx.fillStyle = "#2a2a2e"; ctx.fillRect(p.x + 19, p.y - 34, 7, 9);
  ctx.fillStyle = `rgba(255,214,120,${0.8 + Math.sin(t * 5) * 0.15})`; ctx.fillRect(p.x + 20.5, p.y - 32.5, 4, 6);
  fireGlow(ctx, p.x + 22.5, p.y - 29, 24, t, "255,214,120");
  return 64;
}

// ═════════════════════════════════════════════════════════════════════════════
// A ILHA QUE CRESCE
// ═════════════════════════════════════════════════════════════════════════════

/** Elementos da ilha (com profundidade) para juntar à lista de desenho. */
function islandGrowthItems(ctx, isle, total, cam, t) {
  const st = islandStage(total);
  const items = [];
  // castelo no topo da ilha
  const C = CASTLE_SITE;
  items.push({ d: C.tx + C.ty + (C.w + C.h) / 2, f: () => drawCastle(ctx, C, st, cam, t) });
  return items;
}

function drawCastle(ctx, C, st, cam, t) {
  const { tx: x, ty: y, w, h } = C;
  if (st <= 1) {
    // ruínas: paredes partidas e entulho
    [[0.1, 0.1, 1.2, 0.25, 22], [0.1, 0.35, 0.25, 1.3, 14], [2.2, 0.1, 0.7, 0.25, 10]].forEach(([dx, dy, ww, hh, z], i) => box3(ctx, cam, x + dx, y + dy, ww, hh, 0, z, { base: STONE_D, tex: "stone" }, i * 5));
    for (let i = 0; i < 8; i++) { const p = P3(x + 0.6 + hash2(i, 1) * 2, y + 0.5 + hash2(i, 2) * 1.3, 0, cam); ctx.fillStyle = i % 2 ? "#5a5552" : "#6e6864"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, 4 + hash2(i, 3) * 3, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    // erva por cima
    ctx.fillStyle = "rgba(80,110,60,0.6)"; const g = P3(x + 0.6, y + 0.2, 22, cam); ctx.fillRect(g.x - 8, g.y - 2, 16, 3);
    if (st === 1) {
      // começam as obras: pedras arrumadas, caixotes e um carrinho de mão
      box3(ctx, cam, x + 1.6, y + 1.2, 0.5, 0.35, 0, 8, { base: STONE, tex: "stone" }, 77);
      crate(ctx, cam, x + 2.5, y + 1.6); crate(ctx, cam, x + 2.75, y + 1.35, 0.26);
      const wb = P3(x + 0.8, y + 1.75, 0, cam);
      ctx.fillStyle = "#6a4a2c"; ctx.beginPath(); ctx.moveTo(wb.x - 10, wb.y - 10); ctx.lineTo(wb.x + 6, wb.y - 10); ctx.lineTo(wb.x + 3, wb.y - 3); ctx.lineTo(wb.x - 8, wb.y - 3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = BINK; ctx.stroke();
      ctx.fillStyle = "#2a2a2e"; ctx.beginPath(); ctx.arc(wb.x + 5, wb.y - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#3a2618"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(wb.x - 9, wb.y - 9); ctx.lineTo(wb.x - 16, wb.y - 4); ctx.stroke();
      ctx.fillStyle = "#77706a"; ctx.beginPath(); ctx.ellipse(wb.x - 2, wb.y - 11, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  if (st === 2) {
    // torre em obras com andaimes
    box3(ctx, cam, x + 0.6, y + 0.3, 1.8, 1.4, 0, 40, { base: STONE, tex: "stone" }, 51);
    ctx.strokeStyle = "#7a5a34"; ctx.lineWidth = 2;
    const posts = [[0.45, 1.85], [1.5, 1.85], [2.55, 1.85], [2.55, 0.9], [2.55, 0.15]];
    posts.forEach(([dx, dy]) => { const a = P3(x + dx, y + dy, 0, cam), b = P3(x + dx, y + dy, 58, cam); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
    [20, 40, 56].forEach(z => {
      ctx.beginPath(); posts.forEach(([dx, dy], i) => { const p = P3(x + dx, y + dy, z, cam); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke();
    });
    // grua com balde
    const g = P3(x + 2.55, y + 0.15, 58, cam);
    ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + 26, g.y - 6); ctx.stroke();
    const sw = Math.sin(t * 1.2) * 2;
    ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.x + 24, g.y - 5); ctx.lineTo(g.x + 24 + sw, g.y + 16); ctx.stroke();
    ctx.fillStyle = "#6b6560"; ctx.fillRect(g.x + 20 + sw, g.y + 16, 8, 6);
    crate(ctx, cam, x + 0.3, y + 1.8);
    return;
  }
  // torre de menagem (3+) e castelo (4+)
  const H = st >= 4 ? 78 : 62;
  const base = st >= 5 ? "#8a8278" : "#6e6862";
  box3(ctx, cam, x + 0.6, y + 0.3, 1.8, 1.4, 0, H, { base, tex: "stone" }, 61);
  crenels(ctx, cam, x + 0.6, y + 0.3, 1.8, 1.4, H, base, 0.18);
  const d = P3(x + 1.5, y + 1.7, 0, cam); archDoor(ctx, d.x, d.y, 14, 26, "#2a1a10", true);
  [[1.0, 0.45], [2.0, 0.45]].forEach(([k, zk]) => { const wpt = P3(x + k, y + 1.7, H * 0.6, cam); windowGlow(ctx, wpt.x, wpt.y, 5, 9, t); });
  [[0.3, 0.6], [0.9, 0.6]].forEach(([k]) => { const wpt = P3(x + 2.4, y + 0.3 + k * 1.4, H * 0.6, cam); windowGlow(ctx, wpt.x, wpt.y, 4, 8, t); });
  if (st >= 4) {
    // torres laterais com telhado cónico
    [[0.45, 1.85], [2.6, 0.2]].forEach(([dx, dy], i) => {
      const tw = roundTower(ctx, cam, x + dx, y + dy, 0.36, 0, H + 18, base, { crenel: false });
      const r = coneRoof(ctx, tw, 28, st >= 5 ? "#b8902e" : "#3f4652");
      banner(ctx, r.x, r.y, 16, t + i, st >= 5 ? "#d8a94a" : N.magenta, st >= 5);
    });
    const top = P3(x + 1.5, y + 1.0, H + 7, cam);
    banner(ctx, top.x, top.y, 30, t, st >= 5 ? "#d8a94a" : "#2bb3a3", st >= 5);
  }
}

/** Altura do topo de cada edifício (para pôr a etiqueta do nome por cima). */
function buildingTop(b, L) {
  const tops = {
    forja:  [44, 44, 56, 56, 62, 110],
    farol:  [64, 64, 100, 108, 132, 152],
    altar:  [48, 48, 30, 60, 66, 126],
    cofre:  [34, 34, 52, 56, 82, 124],
  };
  if (tops[b.id]) return tops[b.id][L] || 60;
  return { mercado: 86, portal: 116, quests: 64 }[b.id] || 60;
}
