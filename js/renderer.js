// ─────────────────────────────────────────────────────────────────────────────
// renderer.js
// Todo o desenho em canvas, em vista isométrica (estilo Diablo):
//   • ilha base sobre o peixe gigante, edifícios, árvores
//   • masmorra com paredes, tochas, escuridão e raio de luz
//   • herói, monstros, saque com cores de raridade, números de dano
// Não guarda estado de jogo — recebe tudo do game.js.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ── Projeção isométrica ───────────────────────────────────────────────────────
function iso(x, y, cam) {
  return { x: (x - y) * (TW / 2) + cam.ox, y: (x + y) * (TH / 2) + cam.oy };
}
function screenToWorld(sx, sy, cam) {
  const a = (sx - cam.ox) / (TW / 2), b = (sy - cam.oy) / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

// ── Utilidades de cor ─────────────────────────────────────────────────────────
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Escala do texto: o game.js define 1/zoom para o texto nunca ficar abaixo de 14px reais
let FONT_K = 1;

// ── Primitivas ────────────────────────────────────────────────────────────────
function diamondPath(ctx, x, y, cam, w = 1, h = 1, lift = 0) {
  const a = iso(x, y, cam), b = iso(x + w, y, cam), c = iso(x + w, y + h, cam), d = iso(x, y + h, cam);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - lift); ctx.lineTo(b.x, b.y - lift);
  ctx.lineTo(c.x, c.y - lift); ctx.lineTo(d.x, d.y - lift);
  ctx.closePath();
}

/** Caixa isométrica (edifícios, paredes). Devolve os pontos do topo. */
function isoBox(ctx, x, y, w, h, height, cam, colors, alpha = 1) {
  const b = iso(x + w, y, cam), c = iso(x + w, y + h, cam), d = iso(x, y + h, cam);
  ctx.save();
  ctx.globalAlpha = alpha;
  // face esquerda (virada para sudoeste)
  ctx.fillStyle = colors.left;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x, c.y - height); ctx.lineTo(d.x, d.y - height);
  ctx.closePath(); ctx.fill();
  // face direita (virada para sudeste)
  ctx.fillStyle = colors.right;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - height); ctx.lineTo(c.x, c.y - height);
  ctx.closePath(); ctx.fill();
  // topo
  ctx.fillStyle = colors.top;
  diamondPath(ctx, x, y, cam, w, h, height); ctx.fill();
  ctx.restore();
}

function ellipseShadow(ctx, sx, sy, rx, alpha = 0.45) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2); ctx.fill();
}

function labelBox(ctx, text, sx, sy, color, size = 15, font = "Montserrat") {
  size = Math.round(size * FONT_K);
  ctx.font = `600 ${size}px ${font}, sans-serif`;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(8,6,8,0.82)";
  ctx.fillRect(sx - w / 2 - 7, sy - size - 4, w + 14, size + 10);
  ctx.strokeStyle = rgba(color.startsWith("#") ? color : "#ffffff", 0.35);
  ctx.lineWidth = 1;
  ctx.strokeRect(sx - w / 2 - 7 + 0.5, sy - size - 4 + 0.5, w + 13, size + 9);
  ctx.fillStyle = color;
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(text, sx, sy + 1);
  ctx.textAlign = "left";
}

// ═════════════════════════════════════════════════════════════════════════════
// ILHA
// ═════════════════════════════════════════════════════════════════════════════

function drawSea(ctx, cam, W, H, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  // mar ligeiramente translúcido: deixa ver o fundo do multiverso por baixo
  g.addColorStop(0, "rgba(6,20,29,0.78)"); g.addColorStop(1, "rgba(10,34,48,0.8)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // ondas
  ctx.strokeStyle = "rgba(120,190,220,0.10)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const px = (hash2(i, 3) * W * 1.4 + t * 8) % (W + 120) - 60;
    const py = hash2(i, 9) * H;
    const ph = Math.sin(t * 1.2 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(px, py + ph);
    ctx.quadraticCurveTo(px + 14, py - 5 + ph, px + 28, py + ph);
    ctx.stroke();
  }
}

function drawIslandGround(ctx, isle, cam, W, H) {
  const S = isle.size;
  const isSea = (x, y) => x < 0 || y < 0 || x >= S || y >= S || isle.grid[y][x] === ISLE.SEA;
  const THICK = 26;

  // falésia (espessura da ilha) nas margens viradas para a câmara
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (isSea(x, y)) continue;
    const p = iso(x, y, cam);
    if (p.x < -TW || p.x > W + TW || p.y < -TH * 2 || p.y > H + THICK + TH) continue;
    if (isSea(x, y + 1)) {
      const d = iso(x, y + 1, cam), c = iso(x + 1, y + 1, cam);
      ctx.fillStyle = "#3d2c1f";
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x, c.y + THICK); ctx.lineTo(d.x, d.y + THICK + 6 * hash2(x, y)); ctx.closePath(); ctx.fill();
    }
    if (isSea(x + 1, y)) {
      const b = iso(x + 1, y, cam), c = iso(x + 1, y + 1, cam);
      ctx.fillStyle = "#2c1f16";
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y + THICK + 6 * hash2(y, x)); ctx.lineTo(c.x, c.y + THICK); ctx.closePath(); ctx.fill();
    }
  }

  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const t = isle.grid[y][x];
    if (t === ISLE.SEA) continue;
    const p = iso(x, y, cam);
    if (p.x < -TW || p.x > W + TW || p.y < -TH || p.y > H + TH) continue;
    const v = hash2(x, y);
    let col;
    if (t === ISLE.PATH) col = shade(N.dirt, (v - 0.5) * 0.15);
    else if (t === ISLE.SAND) col = shade("#8a7a55", (v - 0.5) * 0.15);
    else col = (x + y) % 2 ? shade(N.grass, (v - 0.5) * 0.18) : shade(N.grass2, (v - 0.5) * 0.18);
    ctx.fillStyle = col;
    diamondPath(ctx, x, y, cam); ctx.fill();
    // tufos de relva
    if (t === ISLE.GRASS && v > 0.6) {
      const c = iso(x + 0.3 + v * 0.4, y + 0.5, cam);
      ctx.strokeStyle = "rgba(120,160,90,0.45)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - 2, c.y - 6); ctx.moveTo(c.x + 3, c.y); ctx.lineTo(c.x + 4, c.y - 5); ctx.stroke();
    }
  }
}

function drawTree(ctx, p, cam, t) {
  const s = iso(p.x + 0.5, p.y + 0.5, cam);
  ellipseShadow(ctx, s.x, s.y, 18, 0.35);
  ctx.fillStyle = "#3b2a1c";
  ctx.fillRect(s.x - 3, s.y - 22, 6, 22);
  const sway = Math.sin(t * 1.3 + p.seed * 9) * 1.5;
  const greens = ["#1f3320", "#264026", "#2f4d2c"];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = greens[i];
    ctx.beginPath();
    ctx.moveTo(s.x + sway, s.y - 70 + i * 14);
    ctx.lineTo(s.x + 20 - i * 2, s.y - 26 + i * 6);
    ctx.lineTo(s.x - 20 + i * 2, s.y - 26 + i * 6);
    ctx.closePath(); ctx.fill();
  }
}

function drawRock(ctx, p, cam) {
  const s = iso(p.x + 0.5, p.y + 0.5, cam);
  ctx.fillStyle = "#4a4643";
  ctx.beginPath(); ctx.ellipse(s.x, s.y - 4, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5e5955";
  ctx.beginPath(); ctx.ellipse(s.x - 2, s.y - 6, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
}

/** Edifício genérico + detalhes próprios de cada um. */
function drawBuilding(ctx, b, level, cam, t, highlight) {
  const base = b.color;
  const H = { mercado: 46, quests: 0, forja: 42, altar: 30, farol: 96, cofre: 34, portal: 0 }[b.id] ?? 40;
  const door = iso(b.tx + b.w / 2, b.ty + b.h, cam);

  if (highlight) {
    ctx.save();
    ctx.strokeStyle = rgba(base, 0.9); ctx.lineWidth = 2.5;
    ctx.shadowColor = base; ctx.shadowBlur = 14;
    diamondPath(ctx, b.tx - 0.15, b.ty - 0.15, cam, b.w + 0.3, b.h + 0.3); ctx.stroke();
    ctx.restore();
  }

  if (b.id === "portal") {
    // arco de pedra com redemoinho
    const c = iso(b.tx + 1, b.ty + 1, cam);
    ctx.fillStyle = "#2a2430";
    diamondPath(ctx, b.tx, b.ty, cam, b.w, b.h); ctx.fill();
    ctx.fillStyle = "#3a3340";
    diamondPath(ctx, b.tx + 0.2, b.ty + 0.2, cam, b.w - 0.4, b.h - 0.4, 6); ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = rgba("#9b5cff", 0.5 - i * 0.12);
      ctx.lineWidth = 4 - i;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y - 30, 26 - i * 6, 34 - i * 7, 0, t * (1.5 + i) , t * (1.5 + i) + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = rgba("#9b5cff", 0.25 + Math.sin(t * 2) * 0.08);
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 30, 22, 30, 0, 0, Math.PI * 2); ctx.fill();
    // pilares
    [[-30, 0], [30, 0]].forEach(([dx]) => {
      ctx.fillStyle = "#4b4450"; ctx.fillRect(c.x + dx - 5, c.y - 70, 10, 64);
      ctx.fillStyle = "#5e5664"; ctx.fillRect(c.x + dx - 5, c.y - 70, 10, 6);
    });
    ctx.fillStyle = "#4b4450"; ctx.fillRect(c.x - 36, c.y - 76, 72, 9);
    return;
  }

  if (b.id === "quests") {
    const c = iso(b.tx + 0.5, b.ty + 0.5, cam);
    ellipseShadow(ctx, c.x, c.y, 18, 0.35);
    ctx.fillStyle = "#3b2a1c";
    ctx.fillRect(c.x - 16, c.y - 30, 4, 30); ctx.fillRect(c.x + 12, c.y - 30, 4, 30);
    ctx.fillStyle = "#6b4a2a"; ctx.fillRect(c.x - 20, c.y - 58, 40, 30);
    ctx.strokeStyle = "#3b2a1c"; ctx.lineWidth = 2; ctx.strokeRect(c.x - 20, c.y - 58, 40, 30);
    ctx.fillStyle = "#e9dcb8";
    ctx.fillRect(c.x - 15, c.y - 54, 13, 16); ctx.fillRect(c.x + 1, c.y - 52, 13, 18);
    ctx.fillStyle = N.blood; ctx.fillRect(c.x - 10, c.y - 54, 3, 3); ctx.fillRect(c.x + 6, c.y - 52, 3, 3);
    return;
  }

  ellipseShadow(ctx, door.x, door.y - 4, 10 + b.w * 14, 0.25);
  const wallCol = b.id === "farol" ? "#cfc6b8" : "#6a5a4a";
  isoBox(ctx, b.tx, b.ty, b.w, b.h, H, cam, { left: shade(wallCol, -0.2), right: shade(wallCol, -0.45), top: shade(wallCol, -0.1) });

  // faixas de cor do edifício
  const d = iso(b.tx, b.ty + b.h, cam), c = iso(b.tx + b.w, b.ty + b.h, cam), r = iso(b.tx + b.w, b.ty, cam);
  ctx.fillStyle = rgba(base, 0.75);
  ctx.beginPath(); ctx.moveTo(d.x, d.y - H + 8); ctx.lineTo(c.x, c.y - H + 8); ctx.lineTo(c.x, c.y - H + 2); ctx.lineTo(d.x, d.y - H + 2); ctx.fill();
  ctx.fillStyle = rgba(base, 0.5);
  ctx.beginPath(); ctx.moveTo(c.x, c.y - H + 8); ctx.lineTo(r.x, r.y - H + 8); ctx.lineTo(r.x, r.y - H + 2); ctx.lineTo(c.x, c.y - H + 2); ctx.fill();

  // porta
  const dm = iso(b.tx + b.w / 2, b.ty + b.h, cam);
  ctx.fillStyle = "#1a120e";
  ctx.beginPath();
  ctx.moveTo(dm.x - 9, dm.y - 2); ctx.lineTo(dm.x - 9, dm.y - 22); ctx.quadraticCurveTo(dm.x, dm.y - 32, dm.x + 9, dm.y - 26); ctx.lineTo(dm.x + 9, dm.y - 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(base, 0.35 + Math.sin(t * 2 + b.tx) * 0.1);
  ctx.fill();

  // telhado em pirâmide
  const top = [iso(b.tx, b.ty, cam), iso(b.tx + b.w, b.ty, cam), iso(b.tx + b.w, b.ty + b.h, cam), iso(b.tx, b.ty + b.h, cam)];
  const apex = iso(b.tx + b.w / 2, b.ty + b.h / 2, cam);
  const roofH = b.id === "farol" ? 26 : 22 + b.w * 6;
  const ay = apex.y - H - roofH;
  const faces = [[0, 1, -0.05], [1, 2, -0.35], [2, 3, -0.15], [3, 0, 0.05]];
  faces.forEach(([i, j, f]) => {
    ctx.fillStyle = shade(b.roof, f);
    ctx.beginPath();
    ctx.moveTo(top[i].x, top[i].y - H); ctx.lineTo(top[j].x, top[j].y - H); ctx.lineTo(apex.x, ay); ctx.closePath(); ctx.fill();
  });

  // detalhes por edifício
  if (b.id === "farol") {
    const ang = t * 1.2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const gx = apex.x, gy = ay + 10;
    const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, 160);
    g.addColorStop(0, "rgba(255,230,140,0.55)"); g.addColorStop(1, "rgba(255,230,140,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(gx, gy);
    ctx.arc(gx, gy, 160, ang - 0.18, ang + 0.18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,230,140,0.9)";
    ctx.beginPath(); ctx.arc(gx, gy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (b.id === "forja") {
    const ch = iso(b.tx + 0.4, b.ty + 0.4, cam);
    ctx.fillStyle = "#3a302a"; ctx.fillRect(ch.x - 6, ch.y - H - 40, 12, 30);
    const glow = 0.4 + Math.sin(t * 6) * 0.15;
    ctx.fillStyle = `rgba(255,120,40,${glow})`;
    ctx.beginPath(); ctx.arc(dm.x, dm.y - 14, 10, 0, Math.PI * 2); ctx.fill();
  }
  if (b.id === "altar") {
    ctx.fillStyle = `rgba(200,20,40,${0.35 + Math.sin(t * 3) * 0.15})`;
    ctx.beginPath(); ctx.arc(apex.x, ay - 8, 7, 0, Math.PI * 2); ctx.fill();
  }
  if (b.id === "mercado") {
    // toldo às riscas
    const a1 = iso(b.tx, b.ty + b.h, cam), a2 = iso(b.tx + b.w, b.ty + b.h, cam);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = (i + 1) / n;
      ctx.fillStyle = i % 2 ? "#f1e6d2" : N.magenta;
      ctx.beginPath();
      ctx.moveTo(a1.x + (a2.x - a1.x) * f0, a1.y + (a2.y - a1.y) * f0 - H + 10);
      ctx.lineTo(a1.x + (a2.x - a1.x) * f1, a1.y + (a2.y - a1.y) * f1 - H + 10);
      ctx.lineTo(a1.x + (a2.x - a1.x) * f1 + 4, a1.y + (a2.y - a1.y) * f1 - H + 26);
      ctx.lineTo(a1.x + (a2.x - a1.x) * f0 + 4, a1.y + (a2.y - a1.y) * f0 - H + 26);
      ctx.closePath(); ctx.fill();
    }
  }
}

function buildingLabelPos(b, cam) {
  const tall = buildingTop(b, BUILD_LEVELS[b.id] || 0) + 24;
  const c = iso(b.tx + b.w / 2, b.ty + b.h / 2, cam);
  return { x: c.x, y: c.y - tall };
}

// ═════════════════════════════════════════════════════════════════════════════
// MASMORRA
// ═════════════════════════════════════════════════════════════════════════════

function drawDungeonFloor(ctx, dg, cam, W, H) {
  for (let y = 0; y < dg.H; y++) for (let x = 0; x < dg.W; x++) {
    if (dg.grid[y][x] !== DG.FLOOR || !dg.explored[y][x]) continue;
    const p = iso(x, y, cam);
    if (p.x < -TW || p.x > W + TW || p.y < -TH || p.y > H + TH) continue;
    const v = hash2(x, y);
    ctx.fillStyle = (x + y) % 2 ? shade(N.stone, (v - 0.5) * 0.2) : shade(N.stone2, (v - 0.5) * 0.2);
    diamondPath(ctx, x, y, cam); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    if (v > 0.86) { // rachas e ossos
      const c = iso(x + 0.5, y + 0.5, cam);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath(); ctx.moveTo(c.x - 8, c.y - 2); ctx.lineTo(c.x, c.y + 1); ctx.lineTo(c.x + 6, c.y - 3); ctx.stroke();
    } else if (v < 0.04) {
      const c = iso(x + 0.5, y + 0.5, cam);
      ctx.fillStyle = "#b9b09a"; ctx.fillRect(c.x - 6, c.y - 1, 12, 3); ctx.fillRect(c.x - 7, c.y - 3, 3, 7); ctx.fillRect(c.x + 4, c.y - 3, 3, 7);
    }
  }
}

/** Manchas de tinta que o herói deixa no chão. */
function drawDecals(ctx, dg, cam) {
  if (!dg.decals) return;
  dg.decals.forEach(d => {
    const c = iso(d.x, d.y, cam);
    ctx.save();
    ctx.translate(c.x, c.y); ctx.scale(1, 0.5);
    ctx.fillStyle = rgba(d.c, 0.42);
    for (let i = 0; i < 6; i++) {
      const a = hash2(d.seed, i) * Math.PI * 2, r = hash2(i, d.seed) * 14 * d.r;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, (3 + hash2(d.seed + i, 3) * 7) * d.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = rgba(d.c, 0.6);
    for (let i = 0; i < 5; i++) {
      const a = hash2(d.seed, i + 9) * Math.PI * 2, r = 16 + hash2(i + 9, d.seed) * 10;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * d.r, Math.sin(a) * r * d.r, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
}

function drawWall(ctx, x, y, cam, alpha) {
  const v = hash2(x, y);
  isoBox(ctx, x, y, 1, 1, WALL_H, cam, {
    left:  shade(N.wall, -0.15 + (v - 0.5) * 0.1),
    right: shade(N.wall, -0.4 + (v - 0.5) * 0.1),
    top:   shade(N.wallTop, (v - 0.5) * 0.1),
  }, alpha);
  if (alpha > 0.5) {
    // juntas de pedra
    const d = iso(x, y + 1, cam), c = iso(x + 1, y + 1, cam);
    ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 1;
    for (let k = 1; k < 3; k++) {
      ctx.beginPath(); ctx.moveTo(d.x, d.y - k * 14); ctx.lineTo(c.x, c.y - k * 14); ctx.stroke();
    }
  }
}

function drawTorch(ctx, tc, cam, t) {
  // pendurada na face visível
  const p = iso(tc.x + 0.5, tc.y + 1, cam);
  const fl = Math.sin(t * 13 + tc.x) * 1.5 + Math.sin(t * 7 + tc.y) * 1;
  ctx.fillStyle = "#3a2a1a"; ctx.fillRect(p.x - 2, p.y - 26, 4, 10);
  ctx.fillStyle = "#ffb347";
  ctx.beginPath(); ctx.ellipse(p.x, p.y - 31 + fl * 0.3, 4, 7 + fl * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff1b0";
  ctx.beginPath(); ctx.ellipse(p.x, p.y - 29, 2, 3.5, 0, 0, Math.PI * 2); ctx.fill();
}

function drawStairs(ctx, s, cam, t) {
  const tx = Math.floor(s.x), ty = Math.floor(s.y);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = shade("#1a1616", -i * 0.15);
    diamondPath(ctx, tx + i * 0.12, ty + i * 0.12, cam, 1 - i * 0.24, 1 - i * 0.24, -i * 5);
    ctx.fill();
  }
  const c = iso(s.x, s.y, cam);
  ctx.fillStyle = `rgba(216,169,74,${0.25 + Math.sin(t * 3) * 0.1})`;
  ctx.beginPath(); ctx.ellipse(c.x, c.y, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
}

function drawDungeonPortal(ctx, s, cam, t) {
  const c = iso(s.x, s.y, cam);
  ctx.fillStyle = rgba("#9b5cff", 0.18);
  ctx.beginPath(); ctx.ellipse(c.x, c.y, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = rgba("#b98cff", 0.65 - i * 0.18); ctx.lineWidth = 3 - i * 0.6;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 32, 14 - i * 3, 26 - i * 5, 0, t * (2 + i), t * (2 + i) + Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.fillStyle = rgba("#9b5cff", 0.3);
  ctx.beginPath(); ctx.ellipse(c.x, c.y - 32, 12, 24, 0, 0, Math.PI * 2); ctx.fill();
}

/** Canvas auxiliar da escuridão (usado pelo game.js). */
let _darkCanvas = null;

// ═════════════════════════════════════════════════════════════════════════════
// PERSONAGENS
// ═════════════════════════════════════════════════════════════════════════════

// (o herói e os monstros estão em creatures.js)

function drawLoot(ctx, l, cam, t, showLabel) {
  const s = iso(l.x, l.y, cam);
  const r = l.rarity;
  const bob = Math.sin(t * 3 + l.x) * 1.5;
  if (l.kind === "orb") {
    const g = ctx.createRadialGradient(s.x, s.y - 10 + bob, 1, s.x, s.y - 10 + bob, 9);
    g.addColorStop(0, "#ff8080"); g.addColorStop(1, "#8a0d18");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y - 10 + bob, 7, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ellipseShadow(ctx, s.x, s.y, 8, 0.3);
  if (r.id === "comum" || r.id === "magico") {
    ctx.fillStyle = r.id === "comum" ? N.gold : "#5a4fb0";
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(s.x - 4 + i * 4, s.y - 3 - (i % 2) * 3 + bob * 0.3, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.fillStyle = r.color;
    ctx.beginPath(); ctx.moveTo(s.x, s.y - 18 + bob); ctx.lineTo(s.x + 6, s.y - 9 + bob); ctx.lineTo(s.x, s.y + bob); ctx.lineTo(s.x - 6, s.y - 9 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath(); ctx.moveTo(s.x, s.y - 18 + bob); ctx.lineTo(s.x + 2, s.y - 10 + bob); ctx.lineTo(s.x - 3, s.y - 9 + bob); ctx.closePath(); ctx.fill();
  }
  if (showLabel) labelBox(ctx, r.label, s.x, s.y - 24, r.color, 14);
}

function drawFloaters(ctx, floaters, cam) {
  floaters.forEach(f => {
    const s = iso(f.x, f.y, cam);
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.font = `700 ${Math.round((f.size || 16) * FONT_K)}px Montserrat, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(f.text, s.x, s.y - 40 - (1 - f.life) * 30);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, s.x, s.y - 40 - (1 - f.life) * 30);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });
}

function drawClickMarker(ctx, mk, cam) {
  if (!mk || mk.life <= 0) return;
  const s = iso(mk.x, mk.y, cam);
  ctx.strokeStyle = `rgba(216,169,74,${mk.life})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(s.x, s.y, 14 * (1.4 - mk.life * 0.4), 7 * (1.4 - mk.life * 0.4), 0, 0, Math.PI * 2); ctx.stroke();
}

/** Vinheta e grão leve para o ar sombrio. */
function postProcess(ctx, W, H, strength = 0.75) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ═════════════════════════════════════════════════════════════════════════════
// A FENDA NO MULTIVERSO
// A cena do jogo é vista através de uma fenda rasgada no fundo do site:
// fora dela o canvas fica transparente (vê-se o fundo neon da página).
// ═════════════════════════════════════════════════════════════════════════════
const RIFT = { shards: [], sparks: [], glitch: 0, glitchY: 0 };

/** Contorno da fenda: superelipse com rasgões e rachas que "respiram". */
function riftPath(W, H, t) {
  const cx = W / 2, cy = H / 2;
  const rx = W / 2 - Math.min(40, W * 0.04), ry = H / 2 - Math.min(26, H * 0.05);
  const n = 110, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    // superelipse (mais "quadrada" que uma elipse, aproveita melhor o ecrã)
    const e = 2 / 3.2;
    let x = Math.sign(c) * Math.pow(Math.abs(c), e), y = Math.sign(s) * Math.pow(Math.abs(s), e);
    // rasgões: ondas lentas + dentes irregulares + algumas rachas fundas
    let k = 1
      - 0.025 * (Math.sin(a * 5 + t * 0.35) + 1)
      - 0.018 * (Math.sin(a * 13 - t * 0.6) + 1)
      - 0.03 * hash2(i, 7);
    const crack = hash2(Math.floor(i / 3), 19);
    if (crack > 0.93 && i % 3 === 1) k -= 0.045 + 0.015 * Math.sin(t * 1.3 + i);
    pts.push({ x: cx + x * rx * k, y: cy + y * ry * k });
  }
  return pts;
}

function tracePath(ctx, pts, dx = 0, dy = 0) {
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy));
  ctx.closePath();
}

/**
 * Recorta a cena pela fenda e desenha a borda energética.
 * ctx já está em coordenadas lógicas (W×H); `canvas` é o próprio canvas (para os glitches).
 */
function applyRift(ctx, canvas, W, H, t, scene) {
  const pts = riftPath(W, H, t);

  // 1) glitch: de vez em quando, uma faixa junto à borda da fenda desloca-se
  //    (só na margem, sobre o mar — nunca por cima da jogabilidade)
  if (RIFT.glitch <= 0 && Math.random() < 0.012) { RIFT.glitch = 6 + Math.random() * 8; RIFT.glitchY = Math.random(); RIFT.glitchSide = Math.random() < 0.5 ? 0 : 1; }
  if (RIFT.glitch > 0) {
    RIFT.glitch--;
    const sx = canvas.width / W;
    const band = Math.min(110, W * 0.1);
    const hh = 6 + Math.random() * 14, yy = (0.2 + RIFT.glitchY * 0.6) * (H - hh);
    const off = (Math.random() - 0.5) * 22;
    const bx = RIFT.glitchSide ? W - band : 0;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath(); ctx.rect(bx * sx, yy * sx, band * sx, hh * sx); ctx.clip();
    ctx.drawImage(canvas, bx * sx, yy * sx, band * sx, hh * sx, (bx + off) * sx, yy * sx, band * sx, hh * sx);
    ctx.restore();
  }

  // 2) sombra interior junto à borda (profundidade)
  ctx.save();
  tracePath(ctx, pts); ctx.clip();
  // (sem shadowBlur, que é muito pesado: várias linhas largas e translúcidas)
  [[44, 0.12], [28, 0.16], [14, 0.22]].forEach(([w, a]) => { ctx.strokeStyle = `rgba(6,2,10,${a})`; ctx.lineWidth = w; tracePath(ctx, pts); ctx.stroke(); });
  ctx.restore();

  // 3) recorte: tudo o que está fora da fenda fica transparente
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = "#000";
  tracePath(ctx, pts); ctx.fill();
  ctx.restore();

  // 4) borda de energia com aberração cromática
  const flick = 0.75 + Math.sin(t * 7) * 0.1 + (Math.random() < 0.05 ? 0.25 : 0);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";
  // halo largo e difuso por fora
  ctx.strokeStyle = `rgba(160,40,200,${0.08 * flick})`; ctx.lineWidth = 26;
  tracePath(ctx, pts); ctx.stroke();
  ctx.strokeStyle = `rgba(160,40,200,${0.12 * flick})`; ctx.lineWidth = 16;
  tracePath(ctx, pts); ctx.stroke();
  ctx.strokeStyle = `rgba(224,55,154,${0.16 * flick})`; ctx.lineWidth = 7;
  tracePath(ctx, pts); ctx.stroke();
  ctx.strokeStyle = `rgba(224,55,154,${0.8 * flick})`; ctx.lineWidth = 2.6;
  tracePath(ctx, pts, -1.5, 0); ctx.stroke();
  ctx.strokeStyle = `rgba(43,220,200,${0.65 * flick})`; ctx.lineWidth = 1.8;
  tracePath(ctx, pts, 1.5, 0.5); ctx.stroke();
  ctx.strokeStyle = `rgba(255,235,250,${0.55 * flick})`; ctx.lineWidth = 0.8;
  tracePath(ctx, pts); ctx.stroke();
  ctx.restore();

  // 5) fragmentos que escapam da fenda (água no ar livre) e faíscas
  const seaCol = scene === "island" ? ["#0b2a3a", "#14465c", "#1d5a70"] : ["#1a1416", "#2a2224", "#3a2c2a"];
  if (RIFT.shards.length < 26 && Math.random() < 0.18) {
    const p = pts[Math.floor(Math.random() * pts.length)];
    const dx = p.x - W / 2, dy = p.y - H / 2, d = Math.hypot(dx, dy) || 1;
    RIFT.shards.push({ x: p.x, y: p.y, vx: dx / d * (0.15 + Math.random() * 0.35), vy: dy / d * (0.15 + Math.random() * 0.35) - 0.05,
      s: 2 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.05, life: 1, c: seaCol[Math.floor(Math.random() * 3)] });
  }
  if (RIFT.sparks.length < 40 && Math.random() < 0.5) {
    const p = pts[Math.floor(Math.random() * pts.length)];
    const dx = p.x - W / 2, dy = p.y - H / 2, d = Math.hypot(dx, dy) || 1;
    RIFT.sparks.push({ x: p.x, y: p.y, vx: dx / d * (0.3 + Math.random() * 0.8), vy: dy / d * (0.3 + Math.random() * 0.8), life: 1, c: Math.random() < 0.5 ? "#e0379a" : "#2bdcc8" });
  }
  ctx.save();
  RIFT.shards = RIFT.shards.filter(s => {
    s.x += s.vx; s.y += s.vy; s.r += s.vr; s.life -= 0.006;
    if (s.life <= 0) return false;
    ctx.globalAlpha = Math.min(1, s.life * 1.5);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.r);
    ctx.fillStyle = s.c;
    ctx.beginPath(); ctx.moveTo(-s.s, -s.s * 0.4); ctx.lineTo(s.s * 0.7, -s.s * 0.7); ctx.lineTo(s.s, s.s * 0.5); ctx.lineTo(-s.s * 0.3, s.s * 0.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(224,55,154,0.6)"; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
    return true;
  });
  ctx.globalCompositeOperation = "lighter";
  RIFT.sparks = RIFT.sparks.filter(p => {
    p.x += p.vx; p.y += p.vy; p.life -= 0.02;
    if (p.life <= 0) return false;
    ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 1.6, 1.6);
    return true;
  });
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════════════
// O ELEFANTE COLOSSAL que carrega a ilha — em blocos (voxel), alinhado à grelha
// Feito de colunas isométricas como os tiles da ilha, virado para noroeste (-x).
// Tudo é desenhado com a mesma projeção da ilha e depois passa pelo filtro de
// pixel art. Os frames do passo são pré-calculados.
const VOX = { frames: null, N: 24, P: 2, OX: 720, OY: 440, W: 1380, H: 1140, period: 6.5 };
const VSEA = [10, 34, 48];
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const shadeA = (c, f) => f < 0 ? c.map(v => v * (1 + f)) : c.map(v => v + (255 - v) * f);
const mixA = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const cssA = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

function voxFace(ctx, cam, a, b, z0, z1, col, zw) {
  const A0 = P3(a.x, a.y, z0, cam), B0 = P3(b.x, b.y, z0, cam), B1 = P3(b.x, b.y, z1, cam), A1 = P3(a.x, a.y, z1, cam);
  const fog = z => clamp((zw + 95 - z) / 95, 0, 1) * 0.88;
  const top = mixA(col, VSEA, fog(z1)), bot = mixA(shadeA(col, -0.18), VSEA, fog(z0));
  const g = ctx.createLinearGradient(0, A1.y, 0, A0.y);
  g.addColorStop(0, cssA(top)); g.addColorStop(1, cssA(bot));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(A0.x, A0.y); ctx.lineTo(B0.x, B0.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(A1.x, A1.y); ctx.closePath(); ctx.fill();
  return { A0, B0, B1, A1 };
}

/** Uma coluna (voxel) — c: {x,y,w,h,z0,z1,col,top,tex,seed} */
function voxCol(ctx, cam, c, zw, t) {
  const n = (hash2(c.x * 3.1, c.y * 7.7) - 0.5) * 0.07;
  const a = { x: c.x, y: c.y + c.h }, b = { x: c.x + c.w, y: c.y + c.h }, d = { x: c.x + c.w, y: c.y };
  const L = voxFace(ctx, cam, a, b, c.z0, c.z1, shadeA(c.col, -0.06 + n), zw);
  const R = voxFace(ctx, cam, b, d, c.z0, c.z1, shadeA(c.col, -0.34 + n), zw);
  const T = [P3(c.x, c.y, c.z1, cam), P3(c.x + c.w, c.y, c.z1, cam), P3(c.x + c.w, c.y + c.h, c.z1, cam), P3(c.x, c.y + c.h, c.z1, cam)];
  ctx.fillStyle = cssA(c.top || shadeA(c.col, 0.1 + n));
  ctx.beginPath(); T.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill();
  const hgt = c.z1 - c.z0;
  if (c.tex === "skin" && hgt > 24) {
    // rugas horizontais e uma prega vertical de vez em quando
    ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 1.2;
    const k = Math.floor(hgt / 22);
    for (let i = 1; i <= k; i++) {
      const z = c.z0 + hgt * (i / (k + 1)) + (hash2(c.x + i, c.y) - 0.5) * 8;
      [[a, b], [b, d]].forEach(([p, q]) => {
        const u = P3(p.x, p.y, z, cam), v = P3(q.x, q.y, z + (hash2(c.y, i) - 0.5) * 6, cam);
        ctx.beginPath(); ctx.moveTo(lerp(u.x, v.x, 0.12), lerp(u.y, v.y, 0.12)); ctx.lineTo(lerp(u.x, v.x, 0.88), lerp(u.y, v.y, 0.88)); ctx.stroke();
      });
    }
  }
  if (c.tex === "moss") {
    // musgo e raízes a pender do dorso
    for (let i = 0; i < 3; i++) {
      const k = hash2(c.x * 5 + i, c.y * 3), len = 8 + hash2(i, c.x) * 26;
      const p = P3(lerp(a.x, b.x, k), lerp(a.y, b.y, k), c.z1, cam);
      ctx.strokeStyle = i === 2 ? "rgba(92,70,48,0.9)" : "rgba(64,96,56,0.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.sin(t * 2 + i + c.x) * 1.5, p.y + len); ctx.stroke();
    }
  }
  return { L, R, T };
}

function voxBuild(ph) {
  const A = ph * Math.PI * 2;
  const cells = [];
  const SKIN = hexRgb("#4a4552"), SKIN_D = hexRgb("#3a3541"), EAR = hexRgb("#433d4a"), IVORY = hexRgb("#e6dccb"), NAIL = hexRgb("#bfb3a0"), TUFT = hexRgb("#211d24");
  const GRASS = [hexRgb("#33452a"), hexRgb("#2c3c24")];
  const ZW = -300;                                  // superfície do mar
  const CX = 11, CY = 10, RX = 10.8, RY = 9.8;      // corpo (alinhado com a ilha, mais largo que ela nos lados)

  // ── corpo: colunas por baixo da ilha, barriga em degraus ──
  const bodyBottom = (x, y) => {
    const d2 = ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2;
    return -26 - (90 + 92 * Math.sqrt(Math.max(0, 1 - d2)));
  };
  const MOSS = [hexRgb("#3d5233"), hexRgb("#4a4a3a")];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 22; x++) {
    const d2 = ((x + 0.5 - CX) / RX) ** 2 + ((y + 0.5 - CY) / RY) ** 2;
    if (d2 > 1) continue;
    const top = -26 - Math.round(Math.pow(d2, 3) * 3) * 12;        // ombros arredondados em degraus
    const edge = d2 > 0.62;
    // no dorso que fica de fora da ilha crescem manchas de musgo
    const mossy = edge && hash2(x * 1.7, y * 2.3) > 0.55;
    cells.push({ x, y, w: 1, h: 1, z0: Math.round(bodyBottom(x + 0.5, y + 0.5) / 8) * 8, z1: top, col: SKIN, tex: edge ? "moss" : "skin", top: mossy ? MOSS[(x + y) % 2] : null });
  }

  // ── patas: colunas quadradas que entram no mar (passo em diagonal) ──
  const LS = 0.9; // tamanho de cada bloco da pata (2×2 blocos)
  const legs = [
    { x: 3.0, y: 14.0, ph: 0 }, { x: 3.0, y: 4.2, ph: Math.PI },
    { x: 16.6, y: 14.0, ph: Math.PI }, { x: 16.6, y: 4.2, ph: 0 },
  ];
  const feet = [];
  legs.forEach((l, li) => {
    const s = Math.sin(A + l.ph), lift = Math.max(0, s) * 22, dx = -s * 0.45;
    const lx = l.x + dx;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const cx = lx + i * LS, cy = l.y + j * LS;
      cells.push({ x: cx, y: cy, w: LS, h: LS, z0: ZW + lift, z1: bodyBottom(cx + LS / 2, cy + LS / 2) + 6, col: SKIN_D, tex: "skin" });
    }
    // unhas nas faces visíveis
    const E = LS * 2;
    [[lx + 0.2, l.y + E], [lx + 0.78, l.y + E], [lx + 1.36, l.y + E]].forEach(([nx, ny]) => cells.push({ x: nx, y: ny - 0.04, w: 0.3, h: 0.08, z0: ZW + lift, z1: ZW + lift + 10, col: NAIL }));
    [[lx + E, l.y + 0.25], [lx + E, l.y + 0.83], [lx + E, l.y + 1.41]].forEach(([nx, ny]) => cells.push({ x: nx - 0.04, y: ny, w: 0.08, h: 0.3, z0: ZW + lift, z1: ZW + lift + 10, col: NAIL }));
    feet.push({ x: lx + LS, y: l.y + LS, lift });
  });

  // ── cabeça: colunas de meio tile, testa em duas cúpulas ──
  const head = [];
  for (let y = 7.0; y < 13.0; y += 0.5) for (let x = -3.5; x < 1.0; x += 0.5) {
    const fx = x + 0.25, fy = y + 0.25;
    const dome = 12 * Math.exp(-((fy - 8.9) ** 2) / 0.7) + 12 * Math.exp(-((fy - 11.1) ** 2) / 0.7);
    let z1 = 52 + dome - ((fx + 0.8) ** 2) * 6 - Math.max(0, Math.abs(fy - 10) - 2.2) * 30;
    let z0 = -150 + ((fx + 1.2) ** 2) * 3 + Math.max(0, Math.abs(fy - 10) - 1.8) * 40;
    if (z1 - z0 < 30) continue;
    z1 = Math.round(z1 / 8) * 8; z0 = Math.round(z0 / 8) * 8;
    const grass = z1 >= 56 && fx > -2.4;   // tufos de erva da ilha no alto da cabeça
    head.push({ x, y, w: 0.5, h: 0.5, z0, z1, col: SKIN, tex: "skin", top: grass ? GRASS[((x * 2 + y * 2) | 0) % 2] : null });
  }
  cells.push(...head);

  // ── orelhas: placas finas, abertas para os lados (eixo y), a abanar ──
  // bem abertas para os lados, em degraus
  const earTop = [30, 48, 58, 62, 60, 52, 38, 14];
  const earBot = [-110, -140, -162, -172, -172, -160, -140, -104];
  [[1, 12.7], [-1, 7.3]].forEach(([sd, y0]) => {
    for (let i = 0; i < earTop.length; i++) {
      const flap = Math.sin(A * 2 + (sd > 0 ? 0 : 0.8)) * 0.1 * i;
      const y = sd > 0 ? y0 + i * 0.85 : y0 - (i + 1) * 0.85;
      cells.push({ x: 0.1 + i * 0.12 + flap, y, w: 0.34, h: 0.85, z0: earBot[i], z1: earTop[i] + Math.round(flap * 20), col: EAR, tex: "ear", earI: i, earSd: sd });
    }
  });

  // ── presas: degraus de marfim a subir para a frente ──
  [8.45, 11.2].forEach(ty => {
    [[-3.8, -100], [-4.25, -92], [-4.7, -78], [-5.1, -60], [-5.45, -40], [-5.7, -18]].forEach(([tx, z], i) => {
      cells.push({ x: tx, y: ty, w: 0.45, h: 0.4, z0: z, z1: z + 18, col: i === 5 ? hexRgb("#ff9ad2") : IVORY, glow: i === 5 });
    });
  });

  // ── tromba erguida em S, à frente da cabeça (fica à vista por cima das orelhas) ──
  let trunkTip = null;
  const ctl = [[-3.9, -50], [-4.7, -95], [-5.8, -62], [-6.4, 18], [-6.1, 84], [-5.55, 104]];
  const cr = (p0, p1, p2, p3, u) => 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  const trunkAt = u => {
    const n = ctl.length - 1, f = Math.min(n - 1e-6, u * n), i = Math.floor(f), k = f - i;
    const P = j => ctl[Math.max(0, Math.min(n, j))];
    return { x: cr(P(i - 1)[0], P(i)[0], P(i + 1)[0], P(i + 2)[0], k), z: cr(P(i - 1)[1], P(i)[1], P(i + 1)[1], P(i + 2)[1], k) };
  };
  const segs = 22;
  for (let k = 0; k < segs; k++) {
    const u = k / (segs - 1), p = trunkAt(u);
    const w = lerp(0.95, 0.42, u);
    const ty = 9.85 - w / 2 + Math.sin(A + u * 2.2) * 0.32 * u;
    const tx = p.x + Math.sin(A * 2 + u * 3) * 0.12 * u;
    cells.push({ x: tx - w / 2, y: ty, w, h: w, z0: Math.round(p.z) - 16, z1: Math.round(p.z) + 6, col: k % 2 ? SKIN : SKIN_D, tex: "trunk" });
    trunkTip = { x: tx, y: ty + w / 2, z: p.z + 6 };
  }

  // ── cauda com tufo ──
  for (let k = 0; k < 8; k++) {
    const u = k / 7, ty = 9.85 + Math.sin(A * 2 + u * 2) * 0.5 * u;
    cells.push({ x: 21.8 + u * 0.15, y: ty, w: 0.3, h: 0.3, z0: -60 - k * 14 - 14, z1: -60 - k * 14, col: SKIN_D });
  }
  const tty = 9.85 + Math.sin(A * 2 + 2) * 0.5;
  cells.push({ x: 21.85, y: tty - 0.08, w: 0.48, h: 0.48, z0: -200, z1: -172, col: TUFT });

  return { cells, ZW, feet, trunkTip, head };
}

function voxDraw(ctx, cam, ph, t) {
  const { cells, ZW, feet, trunkTip, head } = voxBuild(ph);
  // sombra do elefante no mar
  ctx.fillStyle = "rgb(0,25,51)"; // cor exata da paleta (sem pontilhado)
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, p = P3(11 + Math.cos(a) * 11.5, 10 + Math.sin(a) * 10.3, ZW, cam); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
  ctx.closePath(); ctx.fill();
  // ondas à volta dos pés e da tromba
  const ripple = (x, y, r, k0) => {
    for (let i = 0; i < 2; i++) {
      const k = (k0 + i * 0.5) % 1, R = r * (1 + k * 1.2);
      ctx.strokeStyle = `rgba(170,225,245,${0.5 * (1 - k)})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let j = 0; j <= 24; j++) { const a = (j / 24) * Math.PI * 2, p = P3(x + Math.cos(a) * R, y + Math.sin(a) * R, ZW, cam); j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
      ctx.stroke();
    }
  };
  feet.forEach((f, i) => ripple(f.x, f.y, 1.3, (ph * 2 + i * 0.25) % 1));

  // pintor: do mais longe (x+y menor) para o mais perto
  cells.sort((a, b) => (a.x + a.w / 2 + a.y + a.h / 2) - (b.x + b.w / 2 + b.y + b.h / 2) || a.z0 - b.z0);
  cells.forEach(c => {
    const f = voxCol(ctx, cam, c, ZW, t);
    if (c.tex === "ear") {
      // veias rosa nas costas da orelha (face virada para nós)
      const R = f.R;
      ctx.strokeStyle = "rgba(224,55,154,0.55)"; ctx.lineWidth = 1.6;
      for (let v = 0; v < 4; v++) {
        const k0 = 0.2 + v * 0.2 + Math.sin(c.earI + v) * 0.04, k1 = k0 + (c.earSd > 0 ? 0.05 : -0.05);
        const p = { x: lerp(R.B1.x, R.B0.x, k0), y: lerp(R.B1.y, R.B0.y, k0) }, q = { x: lerp(R.A1.x, R.A0.x, k1), y: lerp(R.A1.y, R.A0.y, k1) };
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      if (c.earI === 6 && c.earSd > 0) { // rasgão na borda
        ctx.fillStyle = "rgb(10,34,48)"; const p = P3(c.x + c.w, c.y + 0.4, -120, cam);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 8, p.y + 10); ctx.lineTo(p.x + 4, p.y + 14); ctx.closePath(); ctx.fill();
      }
    }
    if (c.glow) fireGlow(ctx, P3(c.x + 0.2, c.y + 0.2, c.z1, cam).x, P3(c.x + 0.2, c.y + 0.2, c.z1, cam).y, 16, t, "255,122,200");
  });

  // olho, na face lateral da cabeça (lado +y), com pálpebra pesada
  const eye = P3(-2.6, 13.0, 14, cam);
  ctx.fillStyle = "#120d14"; ctx.beginPath(); ctx.ellipse(eye.x, eye.y, 10, 6, 0.45, 0, Math.PI * 2); ctx.fill();
  const blink = ((ph * 3) % 1) > 0.94;
  if (!blink) {
    ctx.fillStyle = "#e3c06a"; ctx.beginPath(); ctx.arc(eye.x - 1, eye.y, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#120a0c"; ctx.fillRect(eye.x - 1.6, eye.y - 2.6, 1.6, 5);
  }
  ctx.strokeStyle = "#2c2832"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(eye.x, eye.y - 2, 10, 5, 0.45, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(eye.x - 12 + i * 3, eye.y + 8 + i * 3); ctx.lineTo(eye.x + 10 + i * 3, eye.y + 13 + i * 3); ctx.stroke(); }

  // jato de água de vez em quando, a sair da ponta da tromba erguida
  const sp = (ph * 2) % 1;
  if (sp < 0.24) {
    const k = sp / 0.24, base = P3(trunkTip.x, trunkTip.y, trunkTip.z + 10, cam);
    for (let i = 0; i < 40; i++) {
      const a = -Math.PI / 2 - 0.9 + hash2(i, 1) * 1.1, r = k * 150 * (0.45 + hash2(i, 2) * 0.55);
      ctx.fillStyle = `rgba(185,238,255,${0.9 * (1 - k)})`;
      ctx.fillRect(base.x + Math.cos(a) * r * 0.8, base.y + Math.sin(a) * r + k * k * 140, 4, 4);
    }
  }
}

function voxPixelFrame(ph) {
  const { W, H, P, OX, OY } = VOX;
  const cw = Math.ceil(W / P), ch = Math.ceil(H / P);
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const o = c.getContext("2d", { willReadFrequently: true });
  o.setTransform(1 / P, 0, 0, 1 / P, 0, 0);
  // câmara local: o centro da ilha (10,10) fica em (OX, OY)
  const cam = { ox: OX - 0, oy: OY - 320 };
  voxDraw(o, cam, ph, ph * VOX.period);
  o.setTransform(1, 0, 0, 1, 0, 0);
  const im = o.getImageData(0, 0, cw, ch), d = im.data, L = PIXEL.levels - 1;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const j = (y * cw + x) * 4, th = BAYER4[(y & 3) * 4 + (x & 3)], a = d[j + 3] / 255;
    if (a < 0.05 || (a < 0.4 && a * 2.2 < th)) { d[j + 3] = 0; continue; }
    const dth = 0.5 + (th - 0.5) * PIXEL.dither;
    for (let k = 0; k < 3; k++) {
      const v = (d[j + k] / 255) * L, f = Math.floor(v);
      d[j + k] = Math.round(((v - f) > dth ? f + 1 : f) / L * 255);
    }
    d[j + 3] = 255;
  }
  o.putImageData(im, 0, 0);
  // copia para um canvas normal (acelerado pela placa gráfica) — o de trabalho
  // usa willReadFrequently e seria lento de desenhar a cada frame
  const out = document.createElement("canvas"); out.width = cw; out.height = ch;
  out.getContext("2d").drawImage(c, 0, 0);
  return out;
}

function drawElephantVoxel(ctx, isle, cam, t) {
  if (!VOX.frames) {
    if (window.innerWidth < 700) VOX.N = 12;   // telemóvel: menos frames, menos memória
    VOX.frames = new Array(VOX.N).fill(null);
  }
  // gera 1 frame por desenho até ter todos (o arranque fica leve)
  const missing = VOX.frames.indexOf(null);
  if (missing >= 0) VOX.frames[missing] = voxPixelFrame(missing / VOX.N);
  const S = isle.size, c = iso(S / 2, S / 2, cam);
  let idx = Math.floor(((((t / VOX.period) % 1) + 1) % 1) * VOX.N) % VOX.N;
  while (!VOX.frames[idx]) idx = (idx + VOX.N - 1) % VOX.N;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(VOX.frames[idx], c.x - VOX.OX, c.y - VOX.OY, VOX.W, VOX.H);
  ctx.imageSmoothingEnabled = smooth;
}

// ═════════════════════════════════════════════════════════════════════════════
// TEXTURA ÚNICA em todo o jogo (pixel art), musgo, sujidade e morcegos
// ═════════════════════════════════════════════════════════════════════════════

/** Musgo e sujidade por cima do chão da ilha (determinístico por tile). */
function drawGrime(ctx, isle, cam) {
  const S = isle.size;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const t0 = isle.grid[y][x];
    if (t0 === ISLE.SEA) continue;
    const h = hash2(x * 1.3, y * 2.7), h2 = hash2(y * 3.1, x * 0.7);
    if (t0 === ISLE.PATH) {
      // lama e pegadas nos caminhos
      if (h > 0.55) { const p = iso(x + 0.3 + h2 * 0.4, y + 0.5, cam); ctx.fillStyle = "rgba(40,28,18,0.55)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 10 + h * 6, 4, 0, 0, Math.PI * 2); ctx.fill(); }
      if (h2 > 0.7) { for (let k = 0; k < 3; k++) { const p = iso(x + 0.2 + k * 0.25, y + 0.35 + (k % 2) * 0.2, cam); ctx.fillStyle = "rgba(30,20,12,0.5)"; ctx.fillRect(p.x - 1.5, p.y - 1, 3, 2); } }
    } else if (t0 === ISLE.GRASS || t0 === ISLE.BUILDING) {
      // tufos de musgo escuro e manchas de terra
      if (h > 0.6) { const p = iso(x + h2, y + h, cam); ctx.fillStyle = "rgba(24,40,20,0.6)"; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(p.x + (hash2(k, x) - 0.5) * 14, p.y + (hash2(y, k) - 0.5) * 6, 2 + hash2(k, y) * 3, 0, Math.PI * 2); ctx.fill(); } }
      if (h2 > 0.82) { const p = iso(x + 0.5, y + 0.5, cam); ctx.fillStyle = "rgba(70,52,32,0.45)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
      if (h > 0.93) { const p = iso(x + 0.5, y + 0.4, cam); ctx.fillStyle = "#8a6aa8"; ctx.fillRect(p.x, p.y - 3, 2, 2); ctx.fillStyle = "#c9b45a"; ctx.fillRect(p.x + 4, p.y - 1, 2, 2); }
    } else if (t0 === ISLE.SAND) {
      if (h > 0.7) { const p = iso(x + h2, y + 0.5, cam); ctx.fillStyle = "rgba(60,80,50,0.5)"; ctx.fillRect(p.x - 4, p.y - 1, 8, 2); }
    }
  }
}

/** Musgo nas faces de pedra dos edifícios: manchas a subir a partir do chão. */
function drawBuildingMoss(ctx, b, cam) {
  for (let i = 0; i < 6; i++) {
    const k = hash2(b.tx + i, b.ty), along = hash2(i, b.tx * 3);
    const side = i % 2;
    const px = side ? b.tx + b.w : b.tx + along * b.w, py = side ? b.ty + along * b.h : b.ty + b.h;
    const p = iso(px, py, cam);
    const h = 6 + k * 14;
    ctx.fillStyle = `rgba(40,64,30,${0.55 + k * 0.25})`;
    for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(p.x + (hash2(j, i) - 0.5) * 10, p.y - hash2(i, j) * h, 2 + hash2(j + i, 1) * 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = "rgba(50,80,40,0.7)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - h); ctx.lineTo(p.x + 1, p.y - h - 6); ctx.stroke();
  }
}

/** Morcegos: voam em bandos com trajetórias em laço; asas a bater. */
const BATS = [];
function drawBats(ctx, W, H, cam, t, scene, hero) {
  const want = scene === "island" ? 7 : 5;
  while (BATS.length < want) BATS.push({ ph: Math.random() * 100, sp: 0.4 + Math.random() * 0.5, r: 60 + Math.random() * 120, cx: Math.random(), cy: Math.random() * 0.5, s: 0.8 + Math.random() * 0.6, perch: scene === "dungeon" && Math.random() < 0.4 });
  BATS.forEach((b, i) => {
    let x, y;
    if (scene === "island") {
      const a = t * b.sp + b.ph;
      x = W * (0.15 + b.cx * 0.7) + Math.cos(a) * b.r + Math.sin(a * 2.3) * 20;
      y = H * (0.12 + b.cy * 0.35) + Math.sin(a * 1.4) * b.r * 0.35;
    } else {
      // na masmorra rodeiam a luz do herói
      const hs = iso(hero.x, hero.y, cam), a = t * b.sp * 1.6 + b.ph;
      x = hs.x + Math.cos(a) * (b.r + 40); y = hs.y - 90 + Math.sin(a * 1.3) * 40;
    }
    const flap = Math.sin(t * 22 * b.sp + b.ph), s = b.s * 2.2;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = "#0e0a12";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -4 * flap - 1); ctx.lineTo(-11, -2 * flap + 1); ctx.lineTo(-8, 1); ctx.lineTo(-5, 0.5); ctx.lineTo(-3, 2);
    ctx.lineTo(0, 1.5);
    ctx.lineTo(3, 2); ctx.lineTo(5, 0.5); ctx.lineTo(8, 1); ctx.lineTo(11, -2 * flap + 1); ctx.lineTo(7, -4 * flap - 1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0.5, 2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff3048"; ctx.fillRect(-1.2, -0.5, 0.9, 0.9); ctx.fillRect(0.4, -0.5, 0.9, 0.9);
    ctx.restore();
  });
}

/** Morcegos pendurados nas paredes da masmorra (perto de tochas). */
function drawHangingBats(ctx, dg, cam, t) {
  dg.torches.forEach((tc, i) => {
    if (!dg.explored[tc.y][tc.x] || hash2(tc.x, tc.y) < 0.4) return;
    const p = iso(tc.x + 0.8, tc.y + 1, cam);
    const sw = Math.sin(t * 1.5 + i) * 1;
    ctx.save(); ctx.translate(p.x + sw, p.y - WALL_H + 4);
    ctx.fillStyle = "#0e0a12";
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-5, 7, 0, 10); ctx.quadraticCurveTo(5, 7, 3, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff3048"; ctx.fillRect(-1.5, 6.5, 1, 1); ctx.fillRect(0.6, 6.5, 1, 1);
    ctx.restore();
  });
}

/** Teias e manchas de humidade no chão da masmorra. */
function drawDungeonGrime(ctx, dg, cam) {
  for (let y = 0; y < dg.H; y++) for (let x = 0; x < dg.W; x++) {
    if (dg.grid[y][x] !== DG.FLOOR || !dg.explored[y][x]) continue;
    const h = hash2(x * 2.1, y * 1.7);
    if (h > 0.8) { const p = iso(x + 0.5, y + 0.5, cam); ctx.fillStyle = "rgba(30,50,26,0.55)"; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(p.x + (hash2(k, x) - 0.5) * 18, p.y + (hash2(y, k) - 0.5) * 7, 2 + hash2(k, y) * 3, 0, Math.PI * 2); ctx.fill(); } }
    else if (h < 0.1) { const p = iso(x + 0.5, y + 0.5, cam); ctx.fillStyle = "rgba(10,20,30,0.45)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 12, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    // teia nos cantos junto às paredes
    if (h > 0.6 && h < 0.66 && dg.grid[y - 1] && dg.grid[y - 1][x] === DG.WALL) {
      const p = iso(x, y, cam); ctx.strokeStyle = "rgba(200,200,210,0.35)"; ctx.lineWidth = 0.8;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(p.x, p.y - 20); ctx.lineTo(p.x + 4 + k * 4, p.y - 20 + 10 - k * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(p.x, p.y - 20, 8, 0.1, 1.3); ctx.stroke(); ctx.beginPath(); ctx.arc(p.x, p.y - 20, 13, 0.1, 1.3); ctx.stroke();
    }
  }
}

/** Filtro de pixel art aplicado à cena inteira (mesma textura das personagens). */
let _scnSmall = null, _scnLUT = null;
function pixelizeScene(ctx, canvas, P) {
  const cw = Math.ceil(canvas.width / P), ch = Math.ceil(canvas.height / P);
  if (!_scnSmall) _scnSmall = document.createElement("canvas");
  if (_scnSmall.width !== cw || _scnSmall.height !== ch) { _scnSmall.width = cw; _scnSmall.height = ch; }
  // tabela pré-calculada: [limiar de Bayer 0..15][valor 0..255] → valor quantizado
  if (!_scnLUT) {
    const L = PIXEL.levels - 1;
    _scnLUT = new Uint8Array(16 * 256);
    for (let b = 0; b < 16; b++) {
      const dth = 0.5 + (BAYER4[b] - 0.5) * 0.3;
      for (let v = 0; v < 256; v++) { const q = (v / 255) * L, f = Math.floor(q); _scnLUT[b * 256 + v] = Math.round(((q - f) > dth ? f + 1 : f) / L * 255); }
    }
  }
  const sx = _scnSmall.getContext("2d", { willReadFrequently: true });
  sx.imageSmoothingEnabled = true; sx.clearRect(0, 0, cw, ch);
  sx.drawImage(canvas, 0, 0, cw, ch);
  const im = sx.getImageData(0, 0, cw, ch), d = im.data, LUT = _scnLUT;
  const ds = PIXEL.desat;
  for (let y = 0; y < ch; y++) {
    const row = (y & 3) * 4;
    for (let x = 0, j = y * cw * 4; x < cw; x++, j += 4) {
      if (d[j + 3] < 8) continue;
      const base = (row + (x & 3)) << 8;
      const r = d[j], g = d[j + 1], b = d[j + 2];
      const lum = (r * 77 + g * 151 + b * 28) >> 8;
      d[j] = LUT[base + ((r + (lum - r) * ds) | 0)];
      d[j + 1] = LUT[base + ((g + (lum - g) * ds) | 0)];
      d[j + 2] = LUT[base + ((b + (lum - b) * ds) | 0)];
    }
  }
  sx.putImageData(im, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(_scnSmall, 0, 0, cw * P, ch * P);
  ctx.restore();
}
