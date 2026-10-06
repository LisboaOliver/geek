// ─────────────────────────────────────────────────────────────────────────────
// creatures.js
// Herói e monstros, desenhados com formas abstratas e animação por física
// (corpos em segmentos, pernas que procuram apoio, tentáculos que balançam).
// Tons escuros, sombras suaves e só pequenos pontos de luz (olhos, máscaras).
//
// Cada criatura guarda a sua simulação em `m.sim`, em "píxeis do mundo"
// (a projeção isométrica sem câmara), para que a câmara não a afete.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const W0 = { ox: 0, oy: 0 };
const wp = (x, y) => iso(x, y, W0);                 // tile → píxel do mundo
const sp = (p, cam) => ({ x: p.x + cam.ox, y: p.y + cam.oy }); // píxel do mundo → ecrã
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Sombra de contacto suave (gradiente em vez de elipse dura). */
let _skipShadow = false; // o filtro de pixel art desenha as sombras à parte
function softShadow(ctx, x, y, rx, a = 0.55) {
  if (_skipShadow) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, 0.45);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.6, `rgba(0,0,0,${a * 0.55})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Ponto de luz (olhos, núcleos) com halo. */
function glowDot(ctx, x, y, r, color, intensity = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, rgba(color, 0.55 * intensity));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** Corpo escuro com luz de contorno vinda de cima. */
function darkBody(ctx, cx, cy, r, base, rim, ry = r) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - ry * 0.55, r * 0.1, cx, cy, Math.max(r, ry) * 1.1);
  g.addColorStop(0, rim);
  g.addColorStop(0.35, base);
  g.addColorStop(1, "#050406");
  return g;
}

/** Linha com espessura variável ao longo de uma lista de pontos. */
function taperedStroke(ctx, pts, w0, w1, color) {
  ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = lerp(w0, w1, i / (pts.length - 1));
    ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
  }
}

/** IK de dois ossos: devolve o joelho entre a anca e o pé (joelho para cima). */
function knee(hip, foot, l1, l2) {
  const dx = foot.x - hip.x, dy = foot.y - hip.y;
  const d = clamp(Math.hypot(dx, dy), 1, l1 + l2 - 0.01);
  const a = Math.atan2(dy, dx);
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const k1 = { x: hip.x + Math.cos(a + off) * l1, y: hip.y + Math.sin(a + off) * l1 };
  const k2 = { x: hip.x + Math.cos(a - off) * l1, y: hip.y + Math.sin(a - off) * l1 };
  return k1.y < k2.y ? k1 : k2; // o joelho fica sempre por cima, como um insecto
}

// ═════════════════════════════════════════════════════════════════════════════
// HERÓI — o grafiteiro
// Animado com um esqueleto simples (anca, peito, cabeça, braços e pernas com IK)
// e molas em vez de poses fixas, para não parecer robótico:
//   • os passos avançam com a distância percorrida (os pés não deslizam)
//   • o corpo baixa no apoio, inclina-se com a velocidade e balança a anca
//   • a cabeça vem atrasada em relação ao corpo; braços com inércia
//   • ataque com preparação → jato → recuo; parado, agita a lata de spray
//   • ao virar, o corpo "roda" em vez de se espelhar de repente
// Os olhos dos óculos reagem: h.look (para onde olham) e h.mood.
// ═════════════════════════════════════════════════════════════════════════════
const INK = "#0b0709";
const SPRAY_COLORS = ["#e0379a", "#2bb3a3", "#f2d24b"];
const HERO_K = 1.6; // escala do herói (proporções altas, como no Diablo)

/** Mola amortecida: aproxima obj[key] de target com alguma inércia. */
function spring(obj, key, target, k = 0.25, damp = 0.65) {
  if (obj[key] === undefined) obj[key] = target;
  const v = key + "_v";
  obj[v] = (obj[v] || 0) * damp + (target - obj[key]) * k;
  obj[key] += obj[v];
  return obj[key];
}
function spring2(obj, key, tx, ty, k, damp) {
  return { x: spring(obj, key + "x", tx, k, damp), y: spring(obj, key + "y", ty, k, damp) };
}
const rot = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });

/** Polilinha grossa com contorno de tinta (membros, mangas, ganga). */
function limb(ctx, pts, w, color, inkW = 1.3) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = INK; ctx.lineWidth = w + inkW * 2;
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
}
/** Ponto ao longo de um segmento (0..1). */
const along = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

/** Corrente com física (cordões, ponta da toca) simulada em píxeis do mundo. */
function chainStep(chain, anchor, L, grav, drift, t, wob) {
  chain[0].x = anchor.x; chain[0].y = anchor.y; chain[0].px = anchor.x; chain[0].py = anchor.y;
  for (let i = 1; i < chain.length; i++) {
    const p = chain[i];
    const vx = (p.x - p.px) * 0.84, vy = (p.y - p.py) * 0.84;
    p.px = p.x; p.py = p.y;
    p.x += vx + drift + Math.sin(t * 2.3 + i + wob) * 0.08;
    p.y += vy + grav;
    const q = chain[i - 1], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
    p.x = q.x + dx / d * L; p.y = q.y + dy / d * L;
  }
}

function drawHero(ctx, h, cam, t) {
  const base = wp(h.x, h.y);
  const s = sp(base, cam);
  const K = HERO_K;

  // ── movimento real (para os passos não deslizarem) ──
  const prev = h._prev || base;
  const moved = Math.hypot(base.x - prev.x, base.y - prev.y);
  h._prev = { x: base.x, y: base.y };
  h.phase = (h.phase || 0) + moved * 0.15;
  const run = spring(h, "run", h.moving ? clamp(moved / 2, 0, 1) : 0, 0.12, 0.6);
  const turn = spring(h, "turn", h.facing || 1, 0.2, 0.6);
  const sx = Math.abs(turn) < 0.18 ? 0.18 * (turn < 0 ? -1 : 1) : turn;
  const dirSign = sx < 0 ? -1 : 1;

  const sw = h.swing || 0, u = sw > 0 ? 1 - sw / 14 : 0;     // progresso do ataque 0→1
  const rock = h.rock > 0;
  const shaking = !rock && sw === 0 && run < 0.15 && (t % 7) > 5.6; // agita a lata
  const ph = h.phase;

  // ── esqueleto (coordenadas locais: +x = frente, y negativo = para cima) ──
  const contact = Math.abs(Math.cos(ph));
  const bobY = run * (-contact * 2.4 + 1.2) + (1 - run) * Math.sin(t * 2.1) * 0.45 + (rock ? -Math.abs(Math.sin(t * 9)) * 1.6 : 0);
  const swayX = (1 - run) * Math.sin(t * 1.05) * 0.9;
  const attackLean = u > 0 ? (u < 0.25 ? -0.12 : u < 0.65 ? 0.2 : 0.2 * (1 - u) / 0.35) : 0;
  const lean = spring(h, "lean", run * 0.2 + attackLean + (rock ? -0.12 : 0), 0.18, 0.62);
  const pelvis = { x: swayX, y: -24 + bobY };
  const chest = add(pelvis, rot({ x: 0, y: -15.5 }, lean));
  const neck = add(chest, rot({ x: 0.6, y: -2.4 }, lean));
  const headT = add(neck, rot({ x: 1.2, y: -7.4 }, lean * 0.6));
  const head = spring2(h, "head", headT.x, headT.y + (shaking ? Math.sin(t * 30) * 0.3 : 0), 0.32, 0.55);
  const headTilt = spring(h, "tilt", (h.mood === "alerta" ? -0.08 : 0) + (rock ? -0.15 : 0) + run * 0.06 + (u > 0.25 && u < 0.65 ? 0.08 : 0), 0.2, 0.6);

  // pernas: ciclo de passo + postura aberta quando parado (como no desenho)
  const legs = [0, 1].map(i => {
    const off = i ? Math.PI : 0;
    const c = Math.cos(ph + off), sn = Math.sin(ph + off);
    const stanceX = i ? -5.5 : 6.5;
    const foot = { x: lerp(stanceX, c * 7.5, run), y: -Math.max(0, sn) * 4.5 * run };
    const hip = add(pelvis, { x: i ? -1.8 : 1.8, y: 0.5 });
    const L1 = 12.4, L2 = 12.4;
    const kA = knee(hip, foot, L1, L2); // joelho para cima
    // escolher o joelho virado para a frente (ou para fora na postura aberta)
    const dx = foot.x - hip.x, dy = foot.y - hip.y, d = Math.hypot(dx, dy);
    const mid = { x: hip.x + dx / 2, y: hip.y + dy / 2 };
    const outward = (run > 0.3 || i === 0) ? 1 : -1;
    const bend = Math.sqrt(Math.max(0, L1 * L1 - (d / 2) * (d / 2)));
    const nx = -dy / (d || 1), ny = dx / (d || 1);
    let kn = { x: mid.x + nx * bend, y: mid.y + ny * bend };
    if ((kn.x - mid.x) * outward < 0) kn = { x: mid.x - nx * bend, y: mid.y - ny * bend };
    void kA;
    return { i, hip, knee: kn, foot, lift: Math.max(0, sn) * run, toe: -Math.max(0, sn) * 0.35 * run + (1 - run) * (i ? -0.15 : 0.1) };
  });

  // braços: alvos das mãos → molas (inércia e follow-through)
  const shF = add(chest, rot({ x: 2.6, y: 2.2 }, lean)), shB = add(chest, rot({ x: -2.6, y: 2.2 }, lean));
  const c0 = Math.cos(ph);
  let hF, hB;
  if (rock) {
    hF = { x: shF.x + 9, y: shF.y - 19 + Math.sin(t * 9) * 1.2 };
    hB = { x: shB.x - 9, y: shB.y - 18 + Math.sin(t * 9 + 1) * 1.2 };
  } else {
    hF = { x: shF.x + 4 - c0 * 6 * run, y: shF.y + 16.5 - Math.abs(c0) * run };
    hB = { x: shB.x - 2 + c0 * 6 * run, y: shB.y + 16.5 - Math.abs(c0) * run };
    if (shaking) hF = { x: shF.x + 7, y: shF.y + 8 + Math.sin(t * 38) * 2.4 };
    if (u > 0) {
      if (u < 0.25) hF = { x: shF.x - 1, y: shF.y + 5 };                 // preparação: puxa para trás
      else if (u < 0.65) hF = { x: shF.x + 18, y: shF.y + 1.5 };          // jato: braço esticado
      else hF = { x: lerp(shF.x + 18, shF.x + 4, (u - 0.65) / 0.35), y: lerp(shF.y + 1.5, shF.y + 15, (u - 0.65) / 0.35) };
      hB = { x: shB.x - 4, y: shB.y + 9 };
    }
  }
  const handF = spring2(h, "hf", hF.x, hF.y, u > 0.2 && u < 0.65 ? 0.6 : 0.3, 0.5);
  const handB = spring2(h, "hb", hB.x, hB.y, 0.25, 0.55);
  const arm = (sh, hand, front) => {
    const L = rock ? 11.5 : 10, dx = hand.x - sh.x, dy = hand.y - sh.y, d = Math.min(Math.hypot(dx, dy), 2 * L - 0.1);
    const mid = { x: sh.x + dx / 2, y: sh.y + dy / 2 }, bend = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
    const nx = -dy / (d || 1), ny = dx / (d || 1);
    let el = { x: mid.x + nx * bend, y: mid.y + ny * bend };
    if (el.x > mid.x === !rock) el = { x: mid.x - nx * bend, y: mid.y - ny * bend }; // cotovelo para trás
    return { sh, el, hand, front, rock };
  };
  const armF = arm(shF, handF, true), armB = arm(shB, handB, false);

  // ── física secundária: ponta da toca e cordões do capuz (em píxeis do mundo) ──
  const toWorld = p => ({ x: base.x + p.x * sx * K, y: base.y + p.y * K });
  const toLocal = p => ({ x: (p.x - base.x) / (sx * K), y: (p.y - base.y) / K });
  const hatAnchorL = add(head, rot(h._pxHead ? { x: -6, y: -11.5 } : { x: -3.6, y: -10.8 }, headTilt));
  if (!h.hat) { const a = toWorld(hatAnchorL); h.hat = Array.from({ length: 4 }, (_, i) => ({ x: a.x, y: a.y + i * 6, px: a.x, py: a.y + i * 6 })); }
  chainStep(h.hat, toWorld(hatAnchorL), 5.4 * K, 0.3, -dirSign * 0.3, t, 0);
  const strA = add(chest, rot({ x: 2.2, y: 0.6 }, lean)), strB = add(chest, rot({ x: 4, y: 0.4 }, lean));
  if (!h.strings) h.strings = [strA, strB].map(a0 => { const a = toWorld(a0); return Array.from({ length: 3 }, (_, i) => ({ x: a.x, y: a.y + i * 3, px: a.x, py: a.y + i * 3 })); });
  chainStep(h.strings[0], toWorld(strA), 2.6 * K, 0.5, 0, t, 1);
  chainStep(h.strings[1], toWorld(strB), 2.6 * K, 0.5, 0, t, 2);
  // latas no bolso: saltam com o passo
  const canBob = spring(h, "can", bobY, 0.3, 0.45);

  // ── sombra ──
  softShadow(ctx, s.x, s.y + 1, 28, 0.75);
  softShadow(ctx, s.x + legs[0].foot.x * sx * K, s.y, 8, 0.5);
  softShadow(ctx, s.x + legs[1].foot.x * sx * K, s.y, 8, 0.5);

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(sx * K, K);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const ink = (w = 1.3) => { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.stroke(); };
  const hurt = h.hurt > 0 && Math.floor(h.hurt / 3) % 2 === 0;

  // ── ponta da toca (atrás de tudo) ──
  {
    const pts = h.hat.map(toLocal), n = pts.length, L = [], R = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy) || 1, w = lerp(5.6, 2, i / (n - 1));
      L.push({ x: p.x - dy / d * w, y: p.y + dx / d * w }); R.push({ x: p.x + dy / d * w, y: p.y - dx / d * w });
    });
    ctx.beginPath(); L.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
    ctx.closePath(); ctx.fillStyle = "#0e4743"; ctx.fill(); ink(1.2);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.7;
    for (let i = 1; i < n - 1; i++) { ctx.beginPath(); ctx.moveTo(L[i].x, L[i].y); ctx.lineTo(R[i].x, R[i].y); ctx.stroke(); }
    const tip = pts[n - 1];
    ctx.fillStyle = "#1a6d65"; ctx.beginPath(); ctx.arc(tip.x, tip.y, 2.4, 0, Math.PI * 2); ctx.fill(); ink(1);
  }

  // ── braço de trás ──
  drawSleeve(ctx, armB, "#4e4a4e", false, 0);

  // ── pernas (a de trás primeiro) ──
  [legs[1], legs[0]].forEach(l => drawJeansLeg(ctx, l, l.i === 1));

  // ── moletom ──
  drawHoodie(ctx, pelvis, chest, lean, hurt, canBob, t);

  // cordões do capuz
  h.strings.forEach(ch => {
    const p = ch.map(toLocal);
    ctx.strokeStyle = "#d8d0c8"; ctx.lineWidth = 0.9;
    ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke();
    const e = p[p.length - 1];
    ctx.fillStyle = "#9a9aa2"; ctx.fillRect(e.x - 0.5, e.y - 0.2, 1, 1.6);
  });

  // ── cabeça ──
  if (h._pxHead) {
    // a cabeça é carimbada em pixel art depois do filtro (stampHead); aqui só guardamos onde
    h._headPos = { x: s.x + head.x * sx * K, y: s.y + head.y * K, flip: sx < 0 };
    let lx = 0.7, ly = 0;
    if (h.look) {
      const tg = sp(wp(h.look.x, h.look.y), cam);
      const dx = (tg.x - h._headPos.x) * dirSign, dy = (tg.y - 25) - h._headPos.y, dd = Math.hypot(dx, dy) || 1;
      lx = dx / dd; ly = clamp(dy / dd, -0.8, 0.8);
    } else { lx = 0.4 + Math.cos(t * 0.7) * 0.6; ly = Math.sin(t * 0.5) * 0.4; }
    h._look = { x: lx, y: ly };
  } else {
  ctx.save();
  ctx.translate(head.x - 0.5, head.y + 43.5);
  ctx.translate(0.5, -43.5); ctx.rotate(headTilt); ctx.translate(-0.5, 43.5);
  drawGraffitiHead(ctx, h, t, hurt, u, rock, ink);
  drawGoggleEyes(ctx, h, t, cam, s, dirSign, K, 0);
  ctx.restore();
  }

  // ── braço da frente com a lata ──
  drawSleeve(ctx, armF, "#8a8589", true, u);

  // ── jato de tinta ──
  if (u > 0.22 && u < 0.8) {
    const fa = Math.atan2(armF.hand.y - armF.el.y, armF.hand.x - armF.el.x);
    const noz = add(armF.hand, rot({ x: 9.5, y: 0 }, fa));
    const k = u < 0.65 ? 1 : 1 - (u - 0.65) / 0.15;
    const col = SPRAY_COLORS[h.sprayCol || 0];
    const reach = 42 * k;
    const g = ctx.createRadialGradient(noz.x + reach * 0.45, noz.y, 1, noz.x + reach * 0.45, noz.y, reach * 0.6);
    g.addColorStop(0, rgba(col, 0.7 * k)); g.addColorStop(0.7, rgba(col, 0.35 * k)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(noz.x, noz.y);
    ctx.lineTo(noz.x + reach, noz.y - reach * 0.32 + Math.sin(t * 30) * 2);
    ctx.lineTo(noz.x + reach, noz.y + reach * 0.32); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 30; i++) {
      const r = Math.random(), a = (Math.random() - 0.5) * 0.7;
      ctx.fillStyle = rgba(col, 0.5 + (1 - r) * 0.5);
      ctx.beginPath(); ctx.arc(noz.x + Math.cos(a) * r * reach, noz.y + Math.sin(a) * r * reach, 0.5 + r * 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/** Perna de ganga com bainha dobrada, manchas de tinta e bota. */
function drawJeansLeg(ctx, l, back) {
  const jean = back ? "#152a5a" : "#1f3a78";
  limb(ctx, [l.hip, l.knee, l.foot], 5.6, jean);
  // costura lateral
  ctx.strokeStyle = back ? "rgba(140,170,230,0.18)" : "rgba(160,190,240,0.3)"; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(l.hip.x + 1, l.hip.y); ctx.lineTo(l.knee.x + 1.2, l.knee.y); ctx.lineTo(l.foot.x + 1, l.foot.y - 3); ctx.stroke();
  // desgaste no joelho
  ctx.fillStyle = back ? "#2a4680" : "#3f5ea0";
  ctx.beginPath(); ctx.ellipse(l.knee.x + 0.6, l.knee.y, 1.8, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  // tinta
  ctx.fillStyle = back ? "#a12a6e" : "#e0379a";
  ctx.beginPath(); ctx.arc(l.knee.x - 1.2, l.knee.y + 3, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = back ? "#2f7a2c" : "#46b23f";
  const m = along(l.knee, l.foot, 0.5);
  ctx.beginPath(); ctx.arc(m.x + 1, m.y, 0.8, 0, Math.PI * 2); ctx.arc(m.x - 0.6, m.y + 1.5, 0.5, 0, Math.PI * 2); ctx.fill();
  // bainha dobrada
  const c0 = along(l.knee, l.foot, 0.78), c1 = along(l.knee, l.foot, 0.95);
  limb(ctx, [c0, c1], 6.6, back ? "#24427e" : "#3a5fa8", 0.8);
  // bota
  ctx.save();
  ctx.translate(l.foot.x, l.foot.y); ctx.rotate(l.toe);
  const sole = back ? "#3a3438" : "#56505a";
  ctx.beginPath();
  ctx.moveTo(-4, -4.6); ctx.lineTo(3, -4.6); ctx.quadraticCurveTo(7.6, -3.6, 7.6, -0.8); ctx.lineTo(7.6, 0.6); ctx.lineTo(-4.6, 0.6); ctx.closePath();
  ctx.fillStyle = back ? "#141113" : "#1d191c"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = sole; ctx.fillRect(-4.6, -0.8, 12.2, 1.6);
  ctx.fillStyle = "#0b0709"; for (let x = -3.5; x < 7; x += 2.2) ctx.fillRect(x, 0.2, 1, 0.8); // piso
  ctx.fillStyle = "#c9c1b8"; for (let i = 0; i < 3; i++) ctx.fillRect(-0.5 + i * 1.6, -4 + i * 0.9, 1.1, 0.6); // atacadores
  ctx.restore();
}

/** Manga do moletom com punho canelado; a da frente segura a lata. */
function drawSleeve(ctx, a, color, front, u) {
  limb(ctx, [a.sh, a.el, a.hand], front ? 4.4 : 4, color);
  // vinco no cotovelo
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.arc(a.el.x, a.el.y, 1.6, 0, Math.PI); ctx.stroke();
  // punho canelado
  const c0 = along(a.el, a.hand, 0.72), c1 = along(a.el, a.hand, 0.9);
  limb(ctx, [c0, c1], front ? 4.8 : 4.4, front ? "#5c575b" : "#3a363a", 0.7);
  // mão
  ctx.fillStyle = "#cbc3bd";
  ctx.beginPath(); ctx.arc(a.hand.x, a.hand.y, 2.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  if (!front) return;
  if (a.rock) return;
  const fa = Math.atan2(a.hand.y - a.el.y, a.hand.x - a.el.x);
  ctx.save();
  ctx.translate(a.hand.x, a.hand.y);
  ctx.rotate(u > 0.22 && u < 0.8 ? fa : fa - 1.5);
  // lata de spray
  ctx.fillStyle = "#e0379a"; ctx.fillRect(0.5, -2.7, 8, 5.4);
  ctx.fillStyle = "#f1e6d2"; ctx.fillRect(3, -2.7, 1.8, 5.4);
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(0.5, -2.7, 8, 1);
  ctx.fillStyle = "#2a2a2e"; ctx.fillRect(8.5, -1.8, 1.6, 3.6);
  ctx.fillStyle = "#e9e9ee"; ctx.fillRect(10, -0.8, 1, 1.6);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.strokeRect(0.5, -2.7, 8, 5.4);
  ctx.restore();
}

/** Tronco do moletom: capuz atrás do pescoço, bolso com latas, barra canelada. */
function drawHoodie(ctx, pelvis, chest, lean, hurt, canBob, t) {
  const P = (x, y) => add(pelvis, rot({ x, y }, lean));
  // capuz amarrotado atrás do pescoço
  const hood = add(chest, rot({ x: -3.4, y: -0.5 }, lean));
  ctx.fillStyle = "#4a464a";
  ctx.beginPath(); ctx.ellipse(hood.x, hood.y, 4.2, 3.2, lean - 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.arc(hood.x + 0.6, hood.y + 0.4, 2, 3.4, 5.6); ctx.stroke();

  // corpo
  const pts = [P(-7, -14.2), P(-1, -15.6), P(6.6, -14), P(7.8, -2.4), P(8.6, 1.4), P(-8.2, 1.4), P(-7.6, -2.4)];
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
  const a = P(-6, -15), b = P(6, 0);
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, hurt ? "#ffffff" : "#a5a0a4"); g.addColorStop(0.55, hurt ? "#efe6ea" : "#6e696d"); g.addColorStop(1, "#2e2a2e");
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();

  // pregas
  ctx.strokeStyle = "rgba(0,0,0,0.32)"; ctx.lineWidth = 0.7;
  [[[-5, -9], [-2.5, -7.5], [-3.5, -5]], [[3.5, -11], [5, -9], [4.5, -7.2]]].forEach(seg => {
    ctx.beginPath(); seg.map(([x, y]) => P(x, y)).forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  });
  // manchas de tinta no moletom
  [[-4.5, -12, "#2bb3a3", 0.9], [5.5, -6, "#e0379a", 0.7], [-1, -3.5, "#f2d24b", 0.6]].forEach(([x, y, c, r]) => {
    const p = P(x, y); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(p.x - 0.25, p.y, 0.5, r * 2.2); // escorre
  });

  // latas no bolso (atrás do tecido do bolso)
  [[-3.2, "#2bb3a3", 0], [0.2, "#f2d24b", 0.6], [3.6, "#e0379a", 1.2]].forEach(([x, col, ph], i) => {
    const jig = (canBob + 1.2) * 0.6 + Math.sin(t * 2 + ph) * 0.2;
    const p = P(x, -8.6 - jig * (0.6 + i * 0.25));
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(lean + (i - 1) * 0.12);
    ctx.fillStyle = col; ctx.fillRect(-1.5, -2, 3, 5);
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(-1.5, -2, 0.8, 5);
    ctx.fillStyle = "#1a1719"; ctx.fillRect(-0.9, -3.3, 1.8, 1.4);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.strokeRect(-1.5, -2, 3, 5);
    ctx.restore();
  });
  // bolso canguru
  const pk = [P(-6, -7.4), P(6.2, -7.4), P(7, -2.2), P(-6.8, -2.2)];
  ctx.beginPath(); pk.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
  ctx.fillStyle = "#4f4b4f"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(pk[0].x + 0.5, pk[0].y + 0.8); ctx.lineTo(pk[1].x - 0.5, pk[1].y + 0.8); ctx.stroke();

  // barra canelada
  const h0 = [P(-7.9, -1), P(8.3, -1), P(8.6, 1.4), P(-8.2, 1.4)];
  ctx.beginPath(); h0.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
  ctx.fillStyle = "#3e3a3e"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 0.5;
  for (let x = -6.5; x < 8; x += 1.6) { const p0 = P(x, -0.8), p1 = P(x + 0.1, 1.2); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
}

/** Cabeça: rosto pálido, nariz comprido, toca com aba e malha. */
function drawGraffitiHead(ctx, h, t, hurt, u, rock, ink) {
  // cabelo verde que escapa da toca
  ctx.fillStyle = "#0e5a52";
  ctx.beginPath(); ctx.moveTo(-6.5, -46); ctx.quadraticCurveTo(-9.5, -40, -8, -33.5); ctx.lineTo(-6.6, -35.5); ctx.lineTo(-5.6, -34); ctx.lineTo(-4.4, -36.5); ctx.lineTo(-4, -45); ctx.closePath(); ctx.fill(); ink(1);
  ctx.strokeStyle = "rgba(60,180,160,0.35)"; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(-6.6, -44); ctx.quadraticCurveTo(-8, -40, -7.2, -36); ctx.stroke();
  // rosto
  ctx.beginPath(); ctx.ellipse(0.5, -43.5, 6.2, 6.6, 0, 0, Math.PI * 2);
  const fg = ctx.createRadialGradient(2.5, -46, 0.5, 0, -43, 8);
  fg.addColorStop(0, hurt ? "#ffffff" : "#ddd6cf"); fg.addColorStop(1, "#7f7772");
  ctx.fillStyle = fg; ctx.fill(); ink(1.3);
  // olheira e maçã do rosto
  ctx.fillStyle = "rgba(120,40,60,0.25)";
  ctx.beginPath(); ctx.ellipse(2.4, -43.6, 2.2, 1, 0, 0, Math.PI * 2); ctx.fill();
  // nariz comprido (com um ligeiro balanço)
  const nb = Math.sin(t * 3) * 0.15;
  ctx.beginPath();
  ctx.moveTo(4.4, -45.6); ctx.quadraticCurveTo(12.5, -45 + nb, 15.6, -42.2 + nb); ctx.quadraticCurveTo(12, -41.4, 4.8, -41.8);
  ctx.closePath();
  const ng = ctx.createLinearGradient(5, -46, 12, -41);
  ng.addColorStop(0, "#d5cdc6"); ng.addColorStop(1, "#8c837e");
  ctx.fillStyle = ng; ctx.fill(); ink(1.1);
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(7, -44.6, 4, 0.5);
  // olho branco do rosto
  const blink = Math.sin(t * 0.9 + 1.3) > 0.985;
  ctx.fillStyle = "#f6f2ee";
  ctx.beginPath(); ctx.ellipse(2.6, -45.3, 1.9, blink ? 0.3 : 1.35, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#b3202c"; ctx.lineWidth = 0.7; ctx.stroke();
  // boca
  if ((u > 0.2 && u < 0.7) || rock || h.mood === "ai") {
    ctx.fillStyle = "#2a0a10";
    ctx.beginPath(); ctx.ellipse(2.6, -39.2, 2.5, 2, 0.2, 0, Math.PI * 2); ctx.fill(); ink(0.8);
    ctx.fillStyle = "#f1e6d2"; ctx.fillRect(1.2, -40.8, 2.8, 0.8);
    ctx.fillStyle = "#9b2a3c"; ctx.beginPath(); ctx.ellipse(2.8, -38.2, 1.2, 0.6, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0.6, -39.4); ctx.quadraticCurveTo(2.8, h.mood === "medo" ? -40.4 : -38.4, 4.6, -39.8); ctx.stroke();
  }
  // toca comprida (tapa as orelhas)
  ctx.beginPath();
  ctx.moveTo(-7.6, -40.2);
  ctx.quadraticCurveTo(-9.4, -52.5, -2, -57.4);
  ctx.quadraticCurveTo(6.4, -59.2, 7.6, -50);
  ctx.lineTo(6.8, -47.5);
  ctx.quadraticCurveTo(0, -49.6, -4.2, -46.4);
  ctx.lineTo(-4, -39.6);
  ctx.closePath();
  const bg = ctx.createLinearGradient(-8, -58, 6, -42);
  bg.addColorStop(0, "#24877e"); bg.addColorStop(1, "#0b3a36");
  ctx.fillStyle = bg; ctx.fill(); ink(1.4);
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 0.6;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-7 + i * 2.8, -55.5 + Math.abs(i - 2) * 0.6); ctx.lineTo(-6.6 + i * 2.6, -46.5); ctx.stroke(); }
  // aba virada
  ctx.beginPath(); ctx.moveTo(-4.4, -46.6); ctx.quadraticCurveTo(0.5, -50.2, 7, -47.6); ctx.lineTo(7.3, -50); ctx.quadraticCurveTo(0, -52.8, -5.1, -49); ctx.closePath();
  ctx.fillStyle = "#145e57"; ctx.fill(); ink(1);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.5;
  for (let x = -3.5; x < 7; x += 1.5) { ctx.beginPath(); ctx.moveTo(x, -48.6 + (x * x) * 0.02); ctx.lineTo(x + 0.2, -50.6 + (x * x) * 0.02); ctx.stroke(); }
  // alça dos óculos
  ctx.fillStyle = "#1a1316"; ctx.fillRect(-8, -55.8, 2.2, 2.4);
}

/** Os dois olhos grandes nos óculos da toca: seguem h.look e mudam com h.mood. */
function drawGoggleEyes(ctx, h, t, cam, s, face, K, bob) {
  const mood = h.mood || "calmo";
  const eyes = [{ x: -2.8, y: -55.5 }, { x: 3.2, y: -55.8 }];
  // direção do olhar (em coordenadas locais do herói)
  let lx = 0.6, ly = 0;
  if (h.look) {
    const target = sp(wp(h.look.x, h.look.y), cam);
    const dx = (target.x - s.x) * face, dy = (target.y - 30) - (s.y - 60);
    const d = Math.hypot(dx, dy) || 1;
    lx = dx / d; ly = clamp(dy / d, -0.8, 0.8);
  } else {
    lx = Math.cos(t * 0.7) * 0.6; ly = Math.sin(t * 0.5) * 0.3;
  }
  const blink = mood === "calmo" && (Math.sin(t * 1.1) > 0.97);
  const size = mood === "alerta" || mood === "medo" ? 3.6 : mood === "foco" ? 3.0 : 3.2;
  const shake = mood === "medo" ? Math.sin(t * 40) * 0.4 : 0;

  // armação dos óculos
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-7.8, -54.5); ctx.lineTo(8, -55); ctx.stroke();
  eyes.forEach((e, i) => {
    const ex = e.x + shake, ey = e.y;
    // lente: aro escuro + branco do olho
    ctx.fillStyle = "#1f2a2c";
    ctx.beginPath(); ctx.arc(ex, ey, size + 1.3, 0, Math.PI * 2); ctx.fill();
    if (blink) {
      ctx.strokeStyle = "#f3efe9"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ex - size + 0.6, ey); ctx.lineTo(ex + size - 0.6, ey); ctx.stroke();
      return;
    }
    ctx.fillStyle = "#f3efe9";
    ctx.beginPath(); ctx.arc(ex, ey, size, 0, Math.PI * 2); ctx.fill();
    if (mood === "ai") {
      // espiral de atordoado
      ctx.strokeStyle = "#b3202c"; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) {
        const r = (a / (Math.PI * 4)) * (size - 0.6);
        const xx = ex + Math.cos(a + t * 10) * r, yy = ey + Math.sin(a + t * 10) * r;
        a ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
      return;
    }
    const pr = mood === "alerta" || mood === "medo" ? 1.1 : mood === "feliz" ? 1.6 : 1.4;
    const px = ex + lx * (size - pr - 0.3), py = ey + ly * (size - pr - 0.3);
    ctx.fillStyle = mood === "foco" ? "#b3202c" : "#c4243a";
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#120a0c";
    ctx.beginPath(); ctx.arc(px, py, pr * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.arc(ex - size * 0.35, ey - size * 0.4, 0.7, 0, Math.PI * 2); ctx.fill();
    // pálpebras: semicerradas no foco, curvas de felicidade
    if (mood === "foco") {
      ctx.fillStyle = "#145e57";
      ctx.beginPath(); ctx.moveTo(ex - size - 0.5, ey - size * 0.15 + (i ? -0.6 : 0.6)); ctx.lineTo(ex + size + 0.5, ey - size * 0.15 + (i ? 0.6 : -0.6)); ctx.lineTo(ex + size + 0.5, ey - size - 1); ctx.lineTo(ex - size - 0.5, ey - size - 1); ctx.closePath(); ctx.fill();
    } else if (mood === "feliz") {
      ctx.fillStyle = "#1f2a2c";
      ctx.beginPath(); ctx.ellipse(ex, ey + size * 0.9, size + 0.4, size * 0.55, 0, 0, Math.PI, true); ctx.fill();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(ex, ey, size, 0, Math.PI * 2); ctx.stroke();
  });
  // "!" de surpresa quando um monstro aparece
  if (h.surprise > 0) {
    const a = Math.min(1, h.surprise / 10);
    ctx.fillStyle = `rgba(242,210,75,${a})`;
    ctx.font = "bold 9px Montserrat, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("!", 1, -64 - (1 - a) * 4);
    ctx.textAlign = "left";
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MONSTROS
// ═════════════════════════════════════════════════════════════════════════════

/** Posição visual do corpo, com investida quando ataca. */
function bodyPos(m) {
  let x = m.x, y = m.y;
  if (m.lunge > 0) {
    const k = Math.sin((m.lunge / 12) * Math.PI) * 0.35;
    x += m.ldx * k; y += m.ldy * k;
  }
  return { x, y };
}

/** Corpo da criatura (vai para o filtro de pixel art). */
function drawMonsterBody(ctx, m, cam, t) {
  if (!m.sim) m.sim = {};
  const b = bodyPos(m);
  const flash = m.hit > 0 ? m.hit / 7 : 0;
  if (m.type === "glitch") drawWisp(ctx, m, b, cam, t, flash);
  else if (m.type === "skeleton") drawWalker(ctx, m, b, cam, t, flash);
  else if (m.type === "boss") drawBoss(ctx, m, b, cam, t, flash);
  else drawMass(ctx, m, b, cam, t, flash, false);
}

/** Interface por cima (fora do filtro): anel de alvo e barra de vida. */
function drawMonsterUI(ctx, m, cam, t, hovered) {
  if (m.lunge > 0) m.lunge--;
  const s = sp(wp(m.x, m.y), cam);
  const k = m.def.size * (typeof PIXEL !== "undefined" ? PIXEL.scale : 1);
  if (hovered) {
    ctx.save();
    ctx.strokeStyle = "rgba(200,30,45,0.8)"; ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 22 * k, 11 * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (m.hp < m.maxHp || m.type === "boss") {
    const w = 36 * Math.max(1, k * 0.8);
    const top = s.y - (m.type === "boss" ? 150 : m.type === "skeleton" ? 76 : 62) * (typeof PIXEL !== "undefined" ? PIXEL.scale : 1) * Math.min(m.def.size, 1.2);
    ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(s.x - w / 2 - 1, top - 1, w + 2, 6);
    ctx.fillStyle = "#8a1420"; ctx.fillRect(s.x - w / 2, top, w * Math.max(0, m.hp / m.maxHp), 4);
  }
}

/** Compatibilidade: corpo + interface sem filtro. */
function drawMonster(ctx, m, cam, t, hovered) { drawMonsterBody(ctx, m, cam, t); drawMonsterUI(ctx, m, cam, t, hovered); }

/** Área (em px) que cada criatura ocupa, para o filtro de pixel art. */
const SPRITE_BOX = {
  hero:     { w: 270, h: 230, pad: 26 },
  glitch:   { w: 230, h: 130, pad: 26 },
  skeleton: { w: 170, h: 150, pad: 30 },
  demon:    { w: 190, h: 150, pad: 30 },
  boss:     { w: 400, h: 330, pad: 60 },
};

// ── Fio Errante: enguia flutuante de segmentos, máscara pálida ───────────────
function drawWisp(ctx, m, b, cam, t, flash) {
  const S = m.sim;
  const N = 14, L = 6.5;
  const hover = 30 + Math.sin(t * 2.4 + m.wobble) * 6;
  const head = wp(b.x, b.y); head.y -= hover;
  head.x += Math.sin(t * 3.1 + m.wobble) * 4;
  if (!S.seg) S.seg = Array.from({ length: N }, (_, i) => ({ x: head.x - i * L, y: head.y }));
  S.seg[0].x = head.x; S.seg[0].y = head.y;
  for (let i = 1; i < N; i++) {
    const p = S.seg[i], q = S.seg[i - 1];
    p.y += 0.06 + Math.sin(t * 4 + i * 0.7 + m.wobble) * 0.7; // ondula a flutuar
    p.x += Math.cos(t * 2.6 + i * 0.5 + m.wobble) * 0.35;
    const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
    p.x = q.x + dx / d * L; p.y = q.y + dy / d * L;
  }
  const pts = S.seg.map(p => sp(p, cam));
  const ground = sp(wp(b.x, b.y), cam);
  softShadow(ctx, ground.x, ground.y, 20, 0.45);

  // corpo: do mais grosso (cabeça) ao fio (cauda)
  for (let i = N - 1; i >= 1; i--) {
    const w = lerp(9, 1, i / (N - 1));
    ctx.strokeStyle = i % 3 === 0 ? "#1d2a30" : "#11181c";
    ctx.lineWidth = w; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i - 1].x, pts[i - 1].y); ctx.stroke();
  }
  // filamentos de luz ao longo do dorso
  for (let i = 2; i < N - 2; i += 3) {
    ctx.fillStyle = rgba("#7fd8e8", 0.25 + 0.2 * Math.sin(t * 6 + i));
    ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y - 2, 1.4, 0, Math.PI * 2); ctx.fill();
  }

  // máscara: forma de semente, osso pálido, uma fenda que brilha
  const hp = pts[0], dir = Math.atan2(pts[0].y - pts[2].y, pts[0].x - pts[2].x);
  ctx.save();
  ctx.translate(hp.x, hp.y); ctx.rotate(dir);
  const mg = ctx.createLinearGradient(-6, -7, 8, 7);
  mg.addColorStop(0, flash ? "#ffffff" : "#d9d3c4"); mg.addColorStop(1, "#5c574e");
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.moveTo(11, 0); ctx.quadraticCurveTo(2, -9, -7, -4); ctx.quadraticCurveTo(-9, 0, -7, 4); ctx.quadraticCurveTo(2, 9, 11, 0); ctx.fill();
  ctx.fillStyle = "#050406";
  ctx.beginPath(); ctx.ellipse(3, 0, 4.5, 1.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  glowDot(ctx, hp.x + Math.cos(dir) * 3, hp.y + Math.sin(dir) * 3, 1.3, "#9ff4ff", 1 + flash);
}

// ── Andarilho: tronco suspenso em quatro pernas finas que procuram chão ─────
function drawWalker(ctx, m, b, cam, t, flash) {
  const S = m.sim;
  const legs = 4;
  const facing = m.facing || 1;
  if (!S.feet) {
    S.feet = Array.from({ length: legs }, (_, i) => {
      const a = (i / legs) * Math.PI * 2 + 0.6;
      return { x: b.x + Math.cos(a) * 0.55, y: b.y + Math.sin(a) * 0.55, fx: 0, fy: 0, tx: 0, ty: 0, k: 1 };
    });
  }
  // escolher onde pisar: um pé de cada vez, como um insecto pesado
  const stepping = S.feet.some(f => f.k < 1);
  S.feet.forEach((f, i) => {
    const a = (i / legs) * Math.PI * 2 + 0.6;
    const rx = b.x + Math.cos(a) * 0.55, ry = b.y + Math.sin(a) * 0.55;
    if (f.k >= 1 && !stepping && Math.hypot(f.x - rx, f.y - ry) > 0.42) {
      f.fx = f.x; f.fy = f.y;
      // pisa um pouco à frente do movimento
      f.tx = rx + (rx - f.x) * 0.35; f.ty = ry + (ry - f.y) * 0.35;
      f.k = 0;
    }
    if (f.k < 1) {
      f.k = Math.min(1, f.k + 0.14);
      f.x = lerp(f.fx, f.tx, f.k); f.y = lerp(f.fy, f.ty, f.k);
    }
  });

  const breathe = Math.sin(t * 2 + m.wobble) * 2;
  const bodyW = wp(b.x, b.y); bodyW.y -= 40 + breathe;
  const body = sp(bodyW, cam);
  const ground = sp(wp(b.x, b.y), cam);
  softShadow(ctx, ground.x, ground.y, 30, 0.5);

  // pernas de trás primeiro (as de cima no ecrã)
  const feet = S.feet.map((f, i) => {
    const g = sp(wp(f.x, f.y), cam);
    const lift = f.k < 1 ? Math.sin(f.k * Math.PI) * 10 : 0;
    return { i, x: g.x, y: g.y - lift, depth: f.x + f.y };
  }).sort((a, c) => a.depth - c.depth);

  const hipFor = i => ({ x: body.x + (S.feet[i].x - S.feet[i].y - (b.x - b.y)) * 10, y: body.y + 4 });
  const drawLeg = f => {
    const hip = hipFor(f.i);
    const kn = knee(hip, f, 30, 34);
    taperedStroke(ctx, [hip, kn, f], 4.5, 1.2, "#16110f");
    ctx.fillStyle = "#2b2420";
    ctx.beginPath(); ctx.arc(kn.x, kn.y, 2.2, 0, Math.PI * 2); ctx.fill();
  };
  feet.slice(0, 2).forEach(drawLeg);

  // tronco: gota escura alongada
  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.rotate(-0.25 * facing);
  ctx.fillStyle = darkBody(ctx, 0, 0, 12, "#1c1714", "#5a4c40", 20);
  ctx.beginPath();
  ctx.moveTo(0, -22); ctx.bezierCurveTo(13, -16, 12, 10, 0, 16); ctx.bezierCurveTo(-12, 10, -13, -16, 0, -22);
  ctx.fill();
  // costelas sugeridas
  ctx.strokeStyle = "rgba(160,140,115,0.18)"; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-8, -8 + i * 5); ctx.quadraticCurveTo(0, -5 + i * 5, 8, -8 + i * 5); ctx.stroke(); }
  ctx.restore();

  // máscara em meia-lua na frente do tronco
  const mx = body.x + facing * 6, my = body.y - 20;
  ctx.save();
  ctx.translate(mx, my); ctx.scale(facing, 1);
  const mg = ctx.createLinearGradient(0, -10, 0, 10);
  mg.addColorStop(0, flash ? "#ffffff" : "#e2d8c2"); mg.addColorStop(1, "#6d6250");
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(0, 0, 10, -1.9, 1.9); ctx.quadraticCurveTo(-2, 0, Math.cos(-1.9) * 10, Math.sin(-1.9) * 10); ctx.fill();
  ctx.fillStyle = "#050406";
  ctx.beginPath(); ctx.ellipse(5, -3, 2.2, 1.2, 0.3, 0, Math.PI * 2); ctx.ellipse(5, 3, 2.2, 1.2, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  glowDot(ctx, mx + facing * 5, my - 3, 0.9, "#ffd9a0", 0.8 + flash);

  feet.slice(2).forEach(drawLeg);
}

// ── Massa Sussurrante / Senhor do Lag: núcleo escuro com tentáculos ──────────
function drawMass(ctx, m, b, cam, t, flash, boss) {
  const S = m.sim;
  const k = m.def.size;
  const n = boss ? 11 : 7, segs = boss ? 9 : 6, L = boss ? 9 : 6.5;
  const lift = (boss ? 46 : 26) + Math.sin(t * 1.6 + m.wobble) * 3;
  const coreW = wp(b.x, b.y); coreW.y -= lift;
  if (!S.ten) {
    S.ten = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return Array.from({ length: segs }, (_, j) => ({ x: coreW.x + Math.cos(a) * j * L, y: coreW.y + j * L * 0.6, px: coreW.x + Math.cos(a) * j * L, py: coreW.y + j * L * 0.6 }));
    });
  }
  // física dos tentáculos (verlet): presos ao núcleo, caem e ondulam
  S.ten.forEach((chain, i) => {
    const a = (i / n) * Math.PI * 2 + Math.sin(t * 0.7 + i) * 0.3;
    const r0 = (boss ? 22 : 11) * (boss ? 1 : k);
    chain[0].x = coreW.x + Math.cos(a) * r0; chain[0].y = coreW.y + Math.sin(a) * r0 * 0.55 + 4;
    for (let j = 1; j < chain.length; j++) {
      const p = chain[j];
      const vx = (p.x - p.px) * 0.9, vy = (p.y - p.py) * 0.9;
      p.px = p.x; p.py = p.y;
      p.x += vx + Math.cos(a) * 0.35 + Math.sin(t * 2.5 + i * 1.7 + j * 0.6) * 0.45;
      p.y += vy + 0.45;
    }
    for (let it = 0; it < 2; it++) for (let j = 1; j < chain.length; j++) {
      const p = chain[j], q = chain[j - 1];
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
      p.x = q.x + dx / d * L; p.y = q.y + dy / d * L;
    }
    // não atravessam o chão (o chão está à altura dos pés)
    const groundY = coreW.y + lift + 6;
    chain.forEach(p => { if (p.y > groundY) p.y = groundY; });
  });

  const ground = sp(wp(b.x, b.y), cam);
  softShadow(ctx, ground.x, ground.y, (boss ? 60 : 30), 0.6);

  const core = sp(coreW, cam);
  const drawTentacles = back => S.ten.forEach((chain, i) => {
    const a = (i / n) * Math.PI * 2;
    const isBack = Math.sin(a + Math.sin(t * 0.7 + i) * 0.3) < 0;
    if (isBack !== back) return;
    const pts = chain.map(p => sp(p, cam));
    taperedStroke(ctx, pts, boss ? 7 : 4.5, 0.8, back ? "#0b080c" : "#150f16");
    if (!back) {
      ctx.fillStyle = rgba(boss ? "#ff3048" : "#e0379a", 0.25);
      ctx.beginPath(); ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  });
  drawTentacles(true);

  // núcleo: forma que respira, contorno irregular
  const R = (boss ? 30 : 15) * (boss ? 1 : k);
  ctx.fillStyle = darkBody(ctx, core.x, core.y, R, boss ? "#1c0a10" : "#1a0d16", flash ? "#ffffff" : (boss ? "#6a1a26" : "#5a2346"), R * 0.9);
  ctx.beginPath();
  const pts = 18;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = R * (1 + Math.sin(a * 3 + t * 2 + m.wobble) * 0.07 + Math.sin(a * 5 - t * 3) * 0.05);
    const x = core.x + Math.cos(a) * r, y = core.y + Math.sin(a) * r * 0.9;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill();

  if (boss) {
    // coroa de espinhos pálidos
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32;
      const bx = core.x + Math.cos(a) * R * 0.85, by = core.y + Math.sin(a) * R * 0.8;
      const len = 16 + (i === 3 ? 10 : (3 - Math.abs(i - 3)) * 3);
      const g = ctx.createLinearGradient(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len);
      g.addColorStop(0, "#3a3028"); g.addColorStop(1, "#e2d8c2");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a + 1.57) * 3, by + Math.sin(a + 1.57) * 3);
      ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
      ctx.lineTo(bx + Math.cos(a - 1.57) * 3, by + Math.sin(a - 1.57) * 3);
      ctx.closePath(); ctx.fill();
    }
    // coração que pulsa
    const beat = Math.pow(Math.max(0, Math.sin(t * 3.2)), 6);
    glowDot(ctx, core.x, core.y + 4, 4 + beat * 3, "#ff3048", 1.2 + beat + flash);
  }

  // olhos: vários pontos que piscam cada um no seu tempo
  const eyes = boss ? 7 : 4;
  for (let i = 0; i < eyes; i++) {
    const seed = hash2(i, m.wobble * 10);
    const open = Math.sin(t * (0.8 + seed) + seed * 20) > -0.75;
    if (!open) continue;
    const ex = core.x + (seed - 0.5) * R * 1.2, ey = core.y - R * 0.25 + (hash2(m.wobble, i) - 0.5) * R * 0.8;
    glowDot(ctx, ex, ey, boss ? 1.8 : 1.3, boss ? "#ffb347" : "#ff5fb4", 0.9 + flash);
  }

  drawTentacles(false);
}

// ── Senhor do Lag: núcleo com costelas de osso, máscara, farrapos e tentáculos ─
// Ao atacar: ergue-se (preparação), depois cai e estica os tentáculos para o herói.
function drawBoss(ctx, m, b, cam, t, flash) {
  const S = m.sim;
  const n = 10, segs = 10, L = 9;
  // fase do ataque a partir da investida (12 → 0)
  const la = m.lunge > 0 ? 1 - m.lunge / 12 : 0;
  const rear = la > 0 ? (la < 0.4 ? la / 0.4 : 1 - (la - 0.4) / 0.6) : 0;
  const slam = la > 0.4 ? Math.sin(((la - 0.4) / 0.6) * Math.PI) : 0;
  const breathe = Math.sin(t * 1.4 + m.wobble);
  const lift = 52 + breathe * 3 + rear * 16 - slam * 10;
  const coreW = wp(b.x, b.y); coreW.y -= lift;
  const toHero = { x: m.ldx || 0, y: m.ldy || 0 };
  const reachDir = wp(toHero.x, toHero.y); // direção no ecrã

  if (!S.ten) {
    S.ten = Array.from({ length: n }, (_, i) => Array.from({ length: segs }, (_, j) => ({ x: coreW.x, y: coreW.y + j * L, px: coreW.x, py: coreW.y + j * L })));
    S.rags = Array.from({ length: 9 }, () => Array.from({ length: 6 }, (_, j) => ({ x: coreW.x, y: coreW.y + j * 5, px: coreW.x, py: coreW.y + j * 5 })));
    S.embers = [];
  }
  const groundY = coreW.y + lift + 4;

  // tentáculos (verlet): ancorados à volta do núcleo, apoiam-se no chão
  S.ten.forEach((chain, i) => {
    const a = (i / n) * Math.PI * 2 + Math.sin(t * 0.6 + i * 1.3) * 0.25;
    chain[0].x = coreW.x + Math.cos(a) * 24; chain[0].y = coreW.y + Math.sin(a) * 13 + 10;
    const facingHero = (Math.cos(a) * reachDir.x + Math.sin(a) * reachDir.y) > 0;
    for (let j = 1; j < chain.length; j++) {
      const p = chain[j];
      const vx = (p.x - p.px) * 0.9, vy = (p.y - p.py) * 0.9;
      p.px = p.x; p.py = p.y;
      let fx = Math.cos(a) * 0.55 + Math.sin(t * 1.8 + i * 1.7 + j * 0.5) * 0.35;
      let fy = 0.5;
      if (slam > 0 && facingHero) { fx += reachDir.x * 0.06 * slam * j; fy += reachDir.y * 0.06 * slam * j; }
      p.x += vx + fx; p.y += vy + fy;
    }
    for (let it = 0; it < 3; it++) for (let j = 1; j < chain.length; j++) {
      const p = chain[j], q = chain[j - 1], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
      p.x = q.x + dx / d * L; p.y = q.y + dy / d * L;
    }
    chain.forEach(p => { if (p.y > groundY) { p.y = groundY; p.px = lerp(p.px, p.x, 0.5); } });
  });

  // farrapos que pendem da coroa
  S.rags.forEach((r, i) => {
    const a = Math.PI + (i / (S.rags.length - 1)) * Math.PI; // metade de cima
    const anchor = { x: coreW.x + Math.cos(a) * 26, y: coreW.y + Math.sin(a) * 20 + 4 };
    chainStep(r, anchor, 5.2, 0.45, Math.sin(t * 0.9 + i) * 0.05, t, i);
  });

  const ground = sp(wp(b.x, b.y), cam);
  softShadow(ctx, ground.x, ground.y, 78, 0.75);
  softShadow(ctx, ground.x, ground.y, 36, 0.55);
  const core = sp(coreW, cam);

  const drawTen = back => S.ten.forEach((chain, i) => {
    const a = (i / n) * Math.PI * 2 + Math.sin(t * 0.6 + i * 1.3) * 0.25;
    if ((Math.sin(a) < 0) !== back) return;
    const pts = chain.map(p => sp(p, cam));
    taperedStroke(ctx, pts, 9, 1.2, INK);
    taperedStroke(ctx, pts, 6.5, 0.6, back ? "#1e1219" : "#36202c");
    // ventosas e espinhos
    if (!back) for (let j = 2; j < pts.length - 1; j += 2) {
      ctx.fillStyle = rgba("#ff3048", 0.35 + 0.25 * Math.sin(t * 3 + j + i));
      ctx.beginPath(); ctx.arc(pts[j].x, pts[j].y + 1.5, 1.1, 0, Math.PI * 2); ctx.fill();
    }
    const e = pts[pts.length - 1], q = pts[pts.length - 2];
    ctx.strokeStyle = "#cfc4ae"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + (e.x - q.x) * 0.6, e.y + (e.y - q.y) * 0.6); ctx.stroke();
  });
  const drawRags = () => S.rags.forEach((r, i) => {
    const p = r.map(q => sp(q, cam)), w0 = 4.5 - (i % 3);
    const Lp = [], Rp = [];
    p.forEach((pt, j) => {
      const o = p[Math.max(0, j - 1)], nx = p[Math.min(p.length - 1, j + 1)];
      const dx = nx.x - o.x, dy = nx.y - o.y, d = Math.hypot(dx, dy) || 1, w = lerp(w0, 1.2, j / (p.length - 1));
      Lp.push({ x: pt.x - dy / d * w, y: pt.y + dx / d * w }); Rp.push({ x: pt.x + dy / d * w, y: pt.y - dx / d * w });
    });
    ctx.beginPath(); Lp.forEach((q, j) => j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
    // ponta rasgada
    const e = p[p.length - 1]; ctx.lineTo(e.x + 2, e.y + 3); ctx.lineTo(e.x - 1, e.y + 1); ctx.lineTo(e.x - 2, e.y + 4);
    for (let j = Rp.length - 1; j >= 0; j--) ctx.lineTo(Rp[j].x, Rp[j].y);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? "#2a1a1e" : "#1d1216"; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  });

  drawTen(true);
  drawRags();

  // núcleo: massa escura que respira
  const R = 30 + breathe * 1.2 + rear * 2;
  ctx.beginPath();
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = R * (1 + Math.sin(a * 3 + t * 1.6 + m.wobble) * 0.06 + Math.sin(a * 7 - t * 2.4) * 0.03);
    const x = core.x + Math.cos(a) * r, y = core.y + Math.sin(a) * r * 0.92;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = darkBody(ctx, core.x, core.y, R, "#1c0a10", flash ? "#ffffff" : "#5e1a26", R * 0.9);
  ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();

  // coração que pulsa por dentro
  const beat = Math.pow(Math.max(0, Math.sin(t * 3.2)), 6) + slam * 0.8;
  const hg = ctx.createRadialGradient(core.x, core.y + 6, 1, core.x, core.y + 6, 18 + beat * 6);
  hg.addColorStop(0, "#ffd0a0"); hg.addColorStop(0.25, "#ff3048"); hg.addColorStop(0.7, "rgba(120,10,30,0.6)"); hg.addColorStop(1, "rgba(60,0,10,0)");
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.ellipse(core.x, core.y + 6, 18 + beat * 6, 16 + beat * 5, 0, 0, Math.PI * 2); ctx.fill();
  // veias
  ctx.strokeStyle = rgba("#ff3048", 0.35 + beat * 0.3); ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.3;
    ctx.beginPath(); ctx.moveTo(core.x, core.y + 6);
    ctx.quadraticCurveTo(core.x + Math.cos(a) * 12, core.y + 6 + Math.sin(a) * 6 + 4, core.x + Math.cos(a) * 24, core.y + 6 + Math.sin(a) * 18);
    ctx.stroke();
  }

  // caixa torácica de osso à volta do coração
  for (let i = 0; i < 4; i++) {
    const yy = core.y - 6 + i * 6.5, w = 22 - Math.abs(i - 1.5) * 3;
    [-1, 1].forEach(sd => {
      ctx.beginPath();
      ctx.moveTo(core.x + sd * 2, yy - 2);
      ctx.quadraticCurveTo(core.x + sd * w, yy - 6, core.x + sd * (w - 4), yy + 8);
      ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.stroke();
      ctx.strokeStyle = i % 2 ? "#b9ad96" : "#d8ccb2"; ctx.lineWidth = 2.4; ctx.stroke();
    });
  }
  // esterno
  ctx.fillStyle = "#d8ccb2"; ctx.fillRect(core.x - 1.6, core.y - 9, 3.2, 28); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(core.x - 1.6, core.y - 9, 3.2, 28);

  // coroa de espinhos irregulares
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.27;
    const bx = core.x + Math.cos(a) * R * 0.86, by = core.y + Math.sin(a) * R * 0.8;
    const len = 14 + hash2(i, 7) * 14 + (i === 4 ? 10 : 0);
    const bend = (hash2(i, 3) - 0.5) * 0.35;
    const tip = { x: bx + Math.cos(a + bend) * len, y: by + Math.sin(a + bend) * len };
    const g = ctx.createLinearGradient(bx, by, tip.x, tip.y);
    g.addColorStop(0, "#3a3028"); g.addColorStop(1, "#ece2cc");
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(a + 1.57) * 3.4, by + Math.sin(a + 1.57) * 3.4);
    ctx.quadraticCurveTo(bx + Math.cos(a + bend * 2) * len * 0.6, by + Math.sin(a + bend * 2) * len * 0.6, tip.x, tip.y);
    ctx.lineTo(bx + Math.cos(a - 1.57) * 3.4, by + Math.sin(a - 1.57) * 3.4);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
  }

  // máscara: osso pálido rachado, olhos em fenda
  const mx = core.x, my = core.y - 16 - rear * 2;
  ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.sin(t * 0.8) * 0.05 + (m.facing || 1) * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.bezierCurveTo(11, -12, 12, 2, 6, 10); ctx.lineTo(0, 13); ctx.lineTo(-6, 10); ctx.bezierCurveTo(-12, 2, -11, -12, 0, -12);
  const mg = ctx.createLinearGradient(-8, -12, 8, 12);
  mg.addColorStop(0, flash ? "#ffffff" : "#ece2cc"); mg.addColorStop(1, "#8a7f6c");
  ctx.fillStyle = mg; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  // racha
  ctx.strokeStyle = "#3a3028"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(3, -12); ctx.lineTo(1.5, -6); ctx.lineTo(4, -3); ctx.lineTo(2.5, 2); ctx.stroke();
  // olhos em fenda
  [-1, 1].forEach(sd => {
    ctx.fillStyle = "#050406";
    ctx.beginPath(); ctx.moveTo(sd * 1.5, -3); ctx.lineTo(sd * 8, -6.5); ctx.lineTo(sd * 7, -1.5); ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = "#050406"; ctx.fillRect(-3, 5, 6, 1.4); ctx.fillRect(-2, 7.4, 4, 1);
  ctx.restore();
  [-1, 1].forEach(sd => glowDot(ctx, mx + sd * 5, my - 3.5 - rear * 2, 1.2 + slam * 0.6, "#ff3048", 0.5 + flash + slam * 0.6));

  // brasas que sobem do coração
  if (Math.random() < 0.25) S.embers.push({ x: core.x + (Math.random() - 0.5) * 20, y: core.y + 6, life: 1 });
  S.embers = S.embers.filter(e => { e.y -= 0.6; e.x += Math.sin(t * 4 + e.y) * 0.3; e.life -= 0.012; return e.life > 0; });
  S.embers.forEach(e => { ctx.fillStyle = rgba("#ff7a3a", e.life * 0.9); ctx.fillRect(e.x, e.y, 1.6, 1.6); });

  drawTen(false);
}

// ═════════════════════════════════════════════════════════════════════════════
// CABEÇA EM PIXEL ART (desenhada à mão, pixel a pixel)
// Vista a 3/4, virada para a direita (espelha-se para a esquerda).
// Os óculos e a boca são desenhados por código para reagirem ao que se passa.
// ═════════════════════════════════════════════════════════════════════════════
const HEAD_MAP = [
  ".......KKKKK.......",
  ".....KKtllllKK.....",
  "....KtlllllllltK...",
  "...KTtllllllllltK..",
  "..KTtlllllllllltK..",
  "..KTtlllllllllltK..",
  "..KTtlllllllllltK..",
  "..KTtlllllllllltK..",
  "..KTTttttttttttTK..",
  ".KTtTtTtTtTtTtTtK..",
  ".KHKKKKKKKKKKKKKK..",
  ".KHHKSSSSSSSSSdK...",
  ".KHHKSSSSSSeeSNNK..",
  ".KHHdSSSSSSSSNNNNNK",
  ".KHKdsSSSSSSsKKKKK.",
  "..KHKdsSSSmmsdK....",
  "..KHKKdsssssdK.....",
  "...KK.KKddddKK.....",
  "........KKKK.......",
];
const HEAD_PAL = {
  K: [11, 7, 9], T: [14, 71, 67], t: [26, 109, 101], l: [42, 148, 136], H: [14, 90, 82],
  S: [214, 206, 198], s: [158, 149, 142], d: [104, 96, 92], N: [196, 188, 179],
  G: [31, 42, 44], W: [243, 239, 233], R: [196, 36, 58], B: [18, 10, 12], M: [42, 10, 16], Y: [242, 210, 75],
};
const HEAD_FACE = { x: 9, y: 13 };          // centro do rosto no desenho
const GOGGLES = [{ x: 7, y: 5 }, { x: 12, y: 5 }];

/**
 * Carimba a cabeça diretamente nos píxeis do sprite (depois do filtro).
 * d: dados RGBA · cw,ch: tamanho · ox,oy: onde fica o centro do rosto · flip: virado à esquerda
 */
function stampHead(d, cw, ch, ox, oy, flip, h, t, lx, ly) {
  const put = (x, y, c) => {
    const px = flip ? ox - (x - HEAD_FACE.x) : ox + (x - HEAD_FACE.x), py = oy + (y - HEAD_FACE.y);
    if (px < 0 || py < 0 || px >= cw || py >= ch || !c) return;
    const j = (py * cw + px) * 4; d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
  };
  const hurt = h.hurt > 0 && Math.floor(h.hurt / 3) % 2 === 0;
  const mood = h.mood || "calmo";
  const sw = h.swing || 0, u = sw > 0 ? 1 - sw / 14 : 0;
  const openMouth = (u > 0.2 && u < 0.7) || h.rock > 0 || mood === "ai";
  const faceBlink = Math.sin(t * 0.9 + 1.3) > 0.985;

  HEAD_MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch0 = row[x];
      if (ch0 === ".") continue;
      if (ch0 === "e") { put(x, y, faceBlink ? HEAD_PAL.s : (x === 11 ? HEAD_PAL.R : HEAD_PAL.W)); continue; }
      if (ch0 === "m") { put(x, y, openMouth ? HEAD_PAL.M : HEAD_PAL.S); continue; }
      let c = HEAD_PAL[ch0];
      if (hurt && (ch0 === "S" || ch0 === "s")) c = [255, 255, 255];
      put(x, y, c);
    }
  });
  // boca
  if (openMouth) { put(10, 16, HEAD_PAL.M); put(11, 16, HEAD_PAL.M); put(10, 15, HEAD_PAL.W); }
  else { put(10, 15, HEAD_PAL.K); put(11, 15, HEAD_PAL.K); put(12, 14, HEAD_PAL.K); }
  if (mood === "medo") put(12, 15, HEAD_PAL.K);

  // alça dos óculos
  put(3, 5, HEAD_PAL.G); put(4, 5, HEAD_PAL.G);

  // óculos com olhos vivos
  const blink = mood === "calmo" && Math.sin(t * 1.1) > 0.97;
  const shake = mood === "medo" ? (Math.floor(t * 20) % 2 ? 1 : 0) : 0;
  const pdx = Math.round(clamp(lx, -1, 1) * 1.2), pdy = Math.round(clamp(ly, -1, 1) * 1.2);
  GOGGLES.forEach((g, i) => {
    const cx = g.x + shake, cy = g.y;
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) {
      const dd = (x - cx) ** 2 + (y - cy) ** 2;
      if (dd <= 10) put(x, y, HEAD_PAL.G);
      if (dd <= 5) put(x, y, HEAD_PAL.W);
    }
    if (blink) { for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) if (y !== cy && (x - cx) ** 2 + (y - cy) ** 2 <= 5) put(x, y, HEAD_PAL.G); return; }
    if (mood === "ai") {
      // olhos em espiral: um ponto vermelho que roda
      const f = Math.floor(t * 12 + i * 2) % 4;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([ax, ay], k) => put(cx + ax, cy + ay, k === f ? HEAD_PAL.R : HEAD_PAL.B));
      put(cx, cy, HEAD_PAL.R);
      return;
    }
    const small = mood === "alerta" || mood === "medo";
    const px = cx + pdx, py = cy + pdy;
    if (small) put(px, py, HEAD_PAL.B);
    else { put(px, py, HEAD_PAL.B); put(px, py + 1, HEAD_PAL.R); put(px + (pdx >= 0 ? -1 : 1), py + 1, HEAD_PAL.R); }
    put(cx - 1, cy - 1, [255, 255, 255]);
    if (mood === "foco") { for (let x = cx - 2; x <= cx + 2; x++) { put(x, cy - 2, HEAD_PAL.t); put(x, cy - 1, i ? (x > cx ? HEAD_PAL.t : HEAD_PAL.W) : (x < cx ? HEAD_PAL.t : HEAD_PAL.W)); } }
    if (mood === "feliz") { for (let x = cx - 2; x <= cx + 2; x++) put(x, cy + 2, HEAD_PAL.G); put(cx - 1, cy + 1, HEAD_PAL.G); put(cx + 1, cy + 1, HEAD_PAL.G); }
  });
  // "!" de surpresa
  if (h.surprise > 0 && Math.floor(h.surprise / 4) % 2 === 0) {
    [-5, -4, -3, -1].forEach(y => put(10, y, HEAD_PAL.Y));
  }
}
