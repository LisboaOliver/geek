// ─────────────────────────────────────────────────────────────────────────────
// renderer.js
// Responsável por TODA a renderização canvas:
//   • Tiles (com fallback canvas quando não há PNG)
//   • Avatar do jogador
//   • NPCs
//   • Efeitos pós-processo (scanlines, vignette)
//
// ── Como usar PNGs ────────────────────────────────────────────────────────────
// 1. Coloque seus arquivos em assets/tiles/ e assets/sprites/
// 2. Chame SpriteCache.load() antes do primeiro frame (veja loader.js).
// 3. O renderer já tenta drawImage antes de cair no fallback canvas.
//
// Nomes esperados (todos 48×48 px, pode ser 96×96 com @2x):
//   assets/tiles/outside.png   assets/tiles/floor.png
//   assets/tiles/wall_n.png    assets/tiles/wall_s.png
//   assets/tiles/wall_e.png    assets/tiles/wall_w.png
//   assets/tiles/door_n.png    assets/tiles/door_s.png
//   assets/tiles/counter.png   assets/tiles/shelf.png
//   assets/tiles/pillar.png    assets/tiles/rug.png
//   assets/tiles/screen.png    assets/tiles/chest.png
//   assets/tiles/neon.png      assets/tiles/plant.png
//   assets/tiles/arcade.png    assets/tiles/lamp.png
//   assets/tiles/path.png      assets/tiles/floor2.png
//
//   assets/sprites/avatar_down.png   (48×48, frame único ou spritesheet 4×1)
//   assets/sprites/avatar_up.png
//   assets/sprites/avatar_left.png
//   assets/sprites/avatar_right.png
//   assets/sprites/npc_cyan.png      (um por cor, ou um genérico npc.png)
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ── Cache de sprites ──────────────────────────────────────────────────────────
const SpriteCache = (() => {
  const _cache = {};

  /**
   * Pré-carrega uma lista de imagens.
   * @param {string[]} paths - caminhos relativos ao HTML
   * @returns {Promise<void>}
   */
  function load(paths) {
    const promises = paths.map(src => new Promise(resolve => {
      if (_cache[src]) { resolve(); return; }
      const img = new Image();
      img.onload  = () => { _cache[src] = img; resolve(); };
      img.onerror = () => { _cache[src] = null;  resolve(); }; // fallback canvas
      img.src = src;
    }));
    return Promise.all(promises);
  }

  /** Retorna a imagem ou null se não carregou. */
  function get(src) { return _cache[src] || null; }

  return { load, get };
})();

// ── Helpers internos de desenho ───────────────────────────────────────────────

/**
 * Tenta desenhar um PNG do cache; se não houver, executa fallbackFn().
 * @param {CanvasRenderingContext2D} ctx
 * @param {string}   src        - chave do cache
 * @param {number}   px         - pixel X destino
 * @param {number}   py         - pixel Y destino
 * @param {Function} fallbackFn - função () que usa ctx para desenhar
 */
function _sprite(ctx, src, px, py, fallbackFn) {
  const img = SpriteCache.get(src);
  if (img) {
    ctx.drawImage(img, px, py, TILE, TILE);
  } else {
    fallbackFn();
  }
}

// Atalhos internos de desenho (usam px, py via closure dentro de drawTile)
function _mkHelpers(ctx, px, py) {
  const f = (col, ox = 0, oy = 0, w = TILE, h = TILE) => {
    ctx.fillStyle = col;
    ctx.fillRect(px + ox, py + oy, w, h);
  };
  return f;
}

// ── drawTile ──────────────────────────────────────────────────────────────────
/**
 * Desenha um único tile no canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} type  - ID do tile (T.*)
 * @param {number} px    - pixel X na tela
 * @param {number} py    - pixel Y na tela
 * @param {number} frame - frame atual (para animações)
 * @param {number} tx    - tile X no mapa (para variação visual)
 * @param {number} ty    - tile Y no mapa
 */
function drawTile(ctx, type, px, py, frame, tx, ty) {
  const S   = TILE;
  const sin = Math.sin;
  const f   = _mkHelpers(ctx, px, py);

  // Helper: tenta PNG, cai no fallback
  const spr = (key, fb) => _sprite(ctx, `assets/tiles/${key}.png`, px, py, fb);

  switch (type) {

    // ── VOID (fora do mapa) ───────────────────────────────────────────────────
    case T.VOID:
      f(N.bg);
      break;

    // ── OUTSIDE (calçada/exterior) ────────────────────────────────────────────
    case T.OUTSIDE:
      spr("outside", () => {
        f((tx + ty) % 2 === 0 ? "#0a0a1c" : "#07071a");
        ctx.strokeStyle = "#0d0d26"; ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, S, S);
        // crack neon ocasional
        if ((tx * 7 + ty * 13) % 9 === 0) {
          const g = ctx.createLinearGradient(px, py, px + S, py + S);
          g.addColorStop(0, N.magenta + "00");
          g.addColorStop(0.5, N.magenta + "1a");
          g.addColorStop(1, N.magenta + "00");
          ctx.fillStyle = g;
          ctx.fillRect(px, py + S / 2 - 1, S, 2);
        }
      });
      break;

    // ── PATH (corredor interno) ───────────────────────────────────────────────
    case T.PATH:
      spr("path", () => {
        f("#090916");
        f(N.yellow + "3a", 0, S / 2 - 1, S, 2);
        f(N.yellow + "15", 0, 0, S, 2);
        f(N.yellow + "15", 0, S - 2, S, 2);
      });
      break;

    // ── FLOOR ─────────────────────────────────────────────────────────────────
    case T.FLOOR:
      spr("floor", () => {
        f("#06061a");
        ctx.strokeStyle = "#0d0d28"; ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, S - 2, S - 2);
      });
      break;

    // ── FLOOR2 (listras neon) ─────────────────────────────────────────────────
    case T.FLOOR2:
      spr("floor2", () => {
        f("#08082a");
        for (let i = 0; i < S; i += 8) f(N.magenta + "07", 0, i, S, 1);
      });
      break;

    // ── WALL_N ────────────────────────────────────────────────────────────────
    case T.WALL_N:
      spr("wall_n", () => {
        f("#08081a"); f("#10103a", 0, 0, S, 10);
        f(N.magenta + "66", 0, 0, S, 2); f(N.magenta + "22", 0, 2, S, 3);
        const bo = (tx % 2) * 12;
        for (let bx = bo - 12; bx < S; bx += 24) {
          ctx.strokeStyle = "#0a0a20"; ctx.lineWidth = 1;
          ctx.strokeRect(px + bx + 1, py + 10, 22, 18);
          ctx.strokeRect(px + bx + 13, py + 28, 22, 18);
        }
      });
      break;

    // ── WALL_S ────────────────────────────────────────────────────────────────
    case T.WALL_S:
      spr("wall_s", () => {
        f("#08081a");
        f(N.cyan + "44", 0, S - 4, S, 4);
        f(N.cyan + "22", 0, S - 8, S, 4);
        const bo = (tx % 2) * 12;
        for (let bx = bo - 12; bx < S; bx += 24) {
          ctx.strokeStyle = "#0c0c22"; ctx.lineWidth = 1;
          ctx.strokeRect(px + bx + 1, py + 2, 22, 18);
          ctx.strokeRect(px + bx + 13, py + 20, 22, 18);
        }
      });
      break;

    // ── WALL_E ────────────────────────────────────────────────────────────────
    case T.WALL_E:
      spr("wall_e", () => {
        f("#08081a");
        f(N.magenta + "33", S - 4, 0, 4, S);
        f(N.magenta + "15", S - 10, 0, 6, S);
        for (let by = 0; by < S; by += 16) f("#0c0c22", 2, by + 1, S - 8, 13);
      });
      break;

    // ── WALL_W ────────────────────────────────────────────────────────────────
    case T.WALL_W:
      spr("wall_w", () => {
        f("#08081a");
        f(N.cyan + "33", 0, 0, 4, S);
        f(N.cyan + "15", 4, 0, 6, S);
        for (let by = 0; by < S; by += 16) f("#0c0c22", 10, by + 1, S - 12, 13);
      });
      break;

    // ── CORNERS ───────────────────────────────────────────────────────────────
    case T.CNR_NE: case T.CNR_NW: case T.CNR_SE: case T.CNR_SW: {
      f("#06060e");
      const gc = (type === T.CNR_NE || type === T.CNR_NW) ? N.magenta : N.cyan;
      const ox = (type === T.CNR_NW || type === T.CNR_SW) ? 0 : S - 4;
      const oy = (type === T.CNR_NE || type === T.CNR_NW) ? 0 : S - 4;
      f(gc + "66", ox, oy, 4, 4);
      break;
    }

    // ── DOORS ─────────────────────────────────────────────────────────────────
    case T.DOOR_N: case T.DOOR_S: {
      const key = type === T.DOOR_N ? "door_n" : "door_s";
      const dc  = type === T.DOOR_N ? N.magenta : N.green;
      spr(key, () => {
        f("#04040a");
        f(dc + "28", 8, 0, S - 16, S);
        f(dc + "77", 8, 0, 4, S);
        f(dc + "77", S - 12, 0, 4, S);
        f(dc + "88", 10, 4, S - 20, 4);
        const alpha = Math.round((sin(frame * 0.08) * 0.4 + 0.6) * 80).toString(16).padStart(2, "0");
        f(dc + alpha, 12, S / 2 - 3, S - 24, 6);
      });
      break;
    }

    // ── COUNTER ───────────────────────────────────────────────────────────────
    case T.COUNTER:
      spr("counter", () => {
        f("#0a0624", 0, 8, S, S - 8); f("#120a38", 0, 8, S, 6);
        const cg = ctx.createLinearGradient(px, py + 8, px, py + 18);
        cg.addColorStop(0, N.magenta + "44"); cg.addColorStop(1, "transparent");
        ctx.fillStyle = cg; ctx.fillRect(px, py + 8, S, 10);
        f(N.pink + "dd", 6, 2, 8, 8);
        f(N.cyan + "dd", 22, 4, 6, 6);
        f(N.green + "dd", 34, 3, 7, 7);
        f(N.magenta + "77", 0, 6, S, 2);
      });
      break;

    // ── SHELF ─────────────────────────────────────────────────────────────────
    case T.SHELF:
      spr("shelf", () => {
        f("#08061a");
        for (let sy = 0; sy < S; sy += 16) {
          f("#100e28", 0, sy, S, 14);
          f("#1a1640", 0, sy, S, 3);
          f(N.purple + "33", 0, sy + 3, S, 1);
        }
        const sc = [N.cyan, N.magenta, N.green, N.yellow, N.orange];
        for (let si = 0; si < 3; si++) {
          const iy = si * 16 + 4;
          for (let sj = 0; sj < 4; sj++) {
            const c = sc[(tx + ty + si + sj) % sc.length];
            f(c + "cc", sj * 11 + 2, iy, 8, 8);
            f(c + "44", sj * 11 + 2, iy + 8, 8, 2);
          }
        }
      });
      break;

    // ── PILLAR ────────────────────────────────────────────────────────────────
    case T.PILLAR:
      spr("pillar", () => {
        f("#070718"); f("#0e0e30", 16, 0, 16, S); f("#181848", 18, 0, 12, S);
        const glow = Math.round((sin(frame * 0.06 + tx) * 0.5 + 0.5) * 150 + 50).toString(16).padStart(2, "0");
        f(`${N.magenta}${glow}`, 22, 0, 4, S);
        f(N.magenta + "22", 16, 0, 16, 4);
        f(N.magenta + "22", 16, S - 4, 16, 4);
      });
      break;

    // ── RUG ───────────────────────────────────────────────────────────────────
    case T.RUG:
      spr("rug", () => {
        f("#0c0628");
        f(N.purple + "22", 4, 4, S - 8, S - 8);
        f(N.magenta + "18", 8, 8, S - 16, S - 16);
        ctx.strokeStyle = N.purple + "66"; ctx.lineWidth = 1;
        ctx.strokeRect(px + 4, py + 4, S - 8, S - 8);
        ctx.strokeStyle = N.magenta + "44";
        ctx.strokeRect(px + 8, py + 8, S - 16, S - 16);
        ctx.strokeStyle = N.pink + "33";
        ctx.beginPath();
        ctx.moveTo(px + S / 2, py + 8); ctx.lineTo(px + S - 8, py + S / 2);
        ctx.lineTo(px + S / 2, py + S - 8); ctx.lineTo(px + 8, py + S / 2);
        ctx.closePath(); ctx.stroke();
      });
      break;

    // ── SCREEN ────────────────────────────────────────────────────────────────
    case T.SCREEN:
      spr("screen", () => {
        f("#040412"); f("#0a0a24", 2, 2, S - 4, S - 4);
        const sc2 = [[N.magenta, N.cyan], [N.green, N.yellow], [N.orange, N.purple]];
        const pair = sc2[Math.floor((sin(frame * 0.05 + tx * 0.3) * 0.5 + 0.5) * 3)];
        const sg = ctx.createLinearGradient(px + 2, py + 2, px + S - 2, py + S - 2);
        sg.addColorStop(0, pair[0] + "66"); sg.addColorStop(1, pair[1] + "44");
        ctx.fillStyle = sg; ctx.fillRect(px + 2, py + 2, S - 4, S - 4);
        f(`${pair[0]}44`, 2, (frame * 2) % S, S - 4, 2);
        for (let ti = 0; ti < 3; ti++) f(pair[1] + "88", 6, 8 + ti * 12, S - 12, 3);
        f(N.magenta + "88", 0, 0, S, 2); f(N.magenta + "88", 0, S - 2, S, 2);
        f(N.magenta + "88", 0, 0, 2, S); f(N.magenta + "88", S - 2, 0, 2, S);
      });
      break;

    // ── CHEST ─────────────────────────────────────────────────────────────────
    case T.CHEST:
      spr("chest", () => {
        f("#08061a", 0, 8, S, S - 8);
        f("#140a2e", 6, 14, S - 12, S - 18);
        f("#1e0e40", 8, 16, S - 16, S - 22);
        f("#0c0828", 4, 8, S - 8, 8);
        f(N.yellow + "cc", S / 2 - 4, 18, 8, 7);
        f("#000", S / 2 - 2, 21, 4, 4);
        f(N.yellow + "88", 4, 8, S - 8, 3);
        f(N.yellow + "55", 4, 22, S - 8, 2);
        const glow = (sin(frame * 0.1) * 0.4 + 0.6) * 0.25;
        ctx.fillStyle = `rgba(255,220,0,${glow})`;
        ctx.fillRect(px + 4, py + 8, S - 8, S - 12);
      });
      break;

    // ── NEON SIGN ─────────────────────────────────────────────────────────────
    case T.NEON:
      spr("neon", () => {
        f("#060616"); f("#0a0a24", 4, 8, S - 8, S - 12);
        const nc = [N.magenta, N.cyan, N.green, N.yellow][(tx + ty) % 4];
        const alpha = Math.round((sin(frame * 0.07 + tx) * 0.3 + 0.7) * 180).toString(16).padStart(2, "0");
        ctx.fillStyle = `${nc}${alpha}`;
        ctx.fillRect(px + 6, py + 10, S - 12, S - 16);
        f("#000a", 8, 14, S - 16, 4); f("#000a", 8, 22, S - 16, 4);
        f(nc + "ff", 10, 15, S - 20, 2); f(nc + "cc", 10, 23, S - 24, 2);
        ctx.shadowBlur = 12; ctx.shadowColor = nc;
        ctx.strokeStyle = nc + "cc"; ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 4, py + 8, S - 8, S - 12);
        ctx.shadowBlur = 0;
      });
      break;

    // ── PLANT ─────────────────────────────────────────────────────────────────
    case T.PLANT:
      spr("plant", () => {
        f("#06060e");
        f("#1a0e30", 16, 34, 16, 12); f("#2a1848", 14, 32, 20, 4);
        f(N.green + "99", 22, 16, 4, 18);
        const lp = sin(frame * 0.06) * 2;
        f(N.green + "dd", 8, 10 + lp, 14, 10);
        f(N.green + "dd", 26, 8 + lp, 14, 10);
        f(N.green + "cc", 14, 4 + lp, 20, 10);
        ctx.fillStyle = N.green + "22";
        ctx.beginPath(); ctx.arc(px + 24, py + 12 + lp, 16, 0, Math.PI * 2); ctx.fill();
      });
      break;

    // ── ARCADE ────────────────────────────────────────────────────────────────
    case T.ARCADE:
      spr("arcade", () => {
        f("#0a0618"); f("#0f0a24", 4, 4, S - 8, S - 4); f("#1a1240", 6, 6, S - 12, S - 8);
        const ac = [N.magenta, N.cyan, N.green][(Math.floor(frame / 30) + tx) % 3];
        f(ac + "55", 10, 8, S - 20, 18); f(ac + "88", 12, 10, S - 24, 14);
        f(ac + "aa", 10, (frame * 1.5) % 18 + 8, S - 20, 2);
        f("#000", 10, 28, S - 20, 14);
        f(N.red + "ff", 14, 30, 6, 6); f(N.cyan + "ff", 26, 30, 6, 6);
        f("#555", 18, 34, S - 28, 4);
        f(ac + "99", 4, 4, S - 8, 3);
      });
      break;

    // ── LAMP ──────────────────────────────────────────────────────────────────
    case T.LAMP:
      spr("lamp", () => {
        f("#04040a");
        f("#1a1838", 20, 10, 8, S - 10); f("#2a2858", 22, 10, 4, S - 10);
        f("#1a1838", 12, 6, 24, 10);
        const lm = sin(frame * 0.05) * 0.3 + 0.7;
        const lg = ctx.createRadialGradient(px + 24, py + 8, 0, px + 24, py + 8, 22);
        lg.addColorStop(0, `rgba(255,0,204,${lm * 0.7})`);
        lg.addColorStop(1, "rgba(255,0,204,0)");
        ctx.fillStyle = lg; ctx.fillRect(px + 4, py, 40, 26);
        f(N.magenta + "ff", 18, 4, 12, 8);
      });
      break;

    default:
      f("#04040a");
  }
}

// ── drawAvatar ────────────────────────────────────────────────────────────────
/**
 * Desenha o avatar do jogador.
 * Se existir assets/sprites/avatar_{dir}.png, usa o PNG.
 * O PNG deve ser 48×48 (frame único) ou 192×48 (spritesheet 4 frames).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} px
 * @param {number} py
 * @param {string} dir   - "up" | "down" | "left" | "right"
 * @param {number} frame
 * @param {string|null} zoneColor - cor hex da zona ativa (para aura)
 */
function drawAvatar(ctx, px, py, dir, frame, zoneColor) {
  const S    = TILE;
  const r    = (col, rx, ry, rw, rh) => { ctx.fillStyle = col; ctx.fillRect(px + rx, py + ry, rw, rh); };
  const step = Math.floor(frame / 6) % 4;
  const bob  = (step === 1 || step === 3) ? -2 : 0;
  const lL   = step === 1 ? 3 : step === 3 ? -3 : 0;
  const lR   = -lL;
  const aL   = step === 1 ? -3 : step === 3 ? 3 : 0;
  const aR   = -aL;
  const b    = bob;

  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(px + S / 2, py + S - 5, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // aura de zona
  if (zoneColor) {
    const ag = ctx.createRadialGradient(px + S / 2, py + S / 2, 4, px + S / 2, py + S / 2, S * 0.75);
    ag.addColorStop(0, `${zoneColor}44`);
    ag.addColorStop(1, `${zoneColor}00`);
    ctx.fillStyle = ag;
    ctx.fillRect(px - 4, py - 4, S + 8, S + 8);
  }

  // tenta spritesheet PNG (4 frames lado a lado)
  const spriteSrc = `assets/sprites/avatar_${dir}.png`;
  const img = SpriteCache.get(spriteSrc);
  if (img) {
    const frameW = img.naturalWidth / 4; // spritesheet 4 frames
    ctx.drawImage(img, step * frameW, 0, frameW, img.naturalHeight, px, py + b, S, S);
    return;
  }

  // fallback canvas (pixel art procedural)
  r("#1a0e08", 13, 38 + b, 9, 7); r("#1a0e08", 26, 38 + b, 9, 7);
  r("#2a1810", 14 + lL, 36 + b, 7, 4); r("#2a1810", 27 + lR, 36 + b, 7, 4);
  r("#0e1230", 14 + lL, 26 + b, 7, 12); r("#0e1230", 27 + lR, 26 + b, 7, 12);
  r("#141840", 15 + lL, 26 + b, 5, 10);
  r("#2a0040", 10, 14 + b, 28, 22); r(N.magenta + "99", 10, 14 + b, 28, 3);
  if (step === 1 || step === 3) r("#2a0040", dir === "left" ? 6 : 12, 20 + b, 6, 14);
  r("#0a0a2a", 12, 14 + b, 24, 20); r("#12124a", 14, 14 + b, 20, 18);
  r(N.magenta + "dd", 14, 14 + b, 20, 4); r(N.magenta + "88", 16, 18 + b, 16, 3);
  r(N.cyan + "ff", 22, 17 + b, 4, 4);
  r("#2a2040", 12, 30 + b, 24, 4); r(N.yellow + "cc", 21, 31 + b, 6, 2);
  r("#0c0c28", 4 + aL, 16 + b, 8, 14); r("#0c0c28", 36 + aR, 16 + b, 8, 14);
  r(N.magenta + "cc", 4 + aL, 14 + b, 10, 5); r(N.magenta + "cc", 34 + aR, 14 + b, 10, 5);
  r("#c89050", 5 + aL, 28 + b, 6, 6); r("#c89050", 37 + aR, 28 + b, 6, 6);
  if (dir !== "left") { r("#aaaaaa", 40 + aR, 12 + b, 3, 22); r(N.magenta + "ee", 40 + aR, 10 + b, 3, 6); }
  r("#c8a060", 14, 2 + b, 20, 16);
  r("#0c0c2a", 12, 0 + b, 24, 10); r("#14144a", 14, 0 + b, 20, 8);
  r(N.magenta + "bb", 14, 6 + b, 20, 5);
  r(N.cyan + "dd", 21, -4 + b, 6, 6);
  r("#b89050", 12, 6 + b, 3, 8); r("#b89050", 33, 6 + b, 3, 8);
  if (dir === "left")       { r(N.magenta + "ff", 15, 9 + b, 5, 4); r("#000", 15, 9 + b, 2, 4); }
  else if (dir === "right") { r(N.magenta + "ff", 28, 9 + b, 5, 4); r("#000", 31, 9 + b, 2, 4); }
  else {
    r(N.magenta + "ff", 16, 9 + b, 4, 4); r(N.magenta + "ff", 28, 9 + b, 4, 4);
    r("#000", 17, 10 + b, 2, 2); r("#000", 29, 10 + b, 2, 2);
  }
  const vg = Math.sin(frame * 0.1) * 0.3 + 0.7;
  ctx.fillStyle = `${N.magenta}${Math.round(vg * 80).toString(16).padStart(2, "0")}`;
  ctx.fillRect(px + 14, py + 6 + b, 20, 5);
}

// ── drawNPC ───────────────────────────────────────────────────────────────────
/**
 * Desenha um NPC animado com balão de fala.
 * Tenta assets/sprites/npc_{color_sem_#}.png (ex: npc_ff00cc.png)
 * ou assets/sprites/npc.png como genérico.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} px
 * @param {number} py
 * @param {string} color - cor hex completa (#rrggbb)
 * @param {number} frame
 */
function drawNPC(ctx, px, py, color, frame) {
  const S   = TILE;
  const r   = (col, rx, ry, rw, rh) => { ctx.fillStyle = col; ctx.fillRect(px + rx, py + ry, rw, rh); };
  const bob = Math.sin(frame * 0.08) * 2;
  const bp  = Math.sin(frame * 0.12) * 0.5 + 0.5;

  const colorKey = color.replace("#", "");
  const img = SpriteCache.get(`assets/sprites/npc_${colorKey}.png`)
           || SpriteCache.get("assets/sprites/npc.png");

  if (img) {
    ctx.drawImage(img, px, py + bob, S, S);
  } else {
    // fallback canvas
    r("#0a0820", 10, 24 + bob, 28, 20); r("#141038", 12, 24 + bob, 24, 18);
    r(color + "cc", 10, 24 + bob, 28, 5);
    r("#c89050", 14, 8 + bob, 20, 16); r("#0a0820", 14, 8 + bob, 20, 6);
    r(color + "88", 14, 12 + bob, 20, 3);
    r("#fff", 16, 16 + bob, 4, 3); r("#fff", 28, 16 + bob, 4, 3);
    r(color, 17, 17 + bob, 2, 2); r(color, 29, 17 + bob, 2, 2);
  }

  // balão de fala (sempre desenhado)
  ctx.fillStyle = `rgba(255,255,255,${bp * 0.12 + 0.08})`;
  ctx.fillRect(px + 14, py - 16 + bob, 20, 12);
  ctx.strokeStyle = `${color}${Math.round(bp * 200 + 55).toString(16).padStart(2, "0")}`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 14, py - 16 + bob, 20, 12);
  ctx.fillStyle = color;
  ctx.font = "bold 7px monospace";
  ctx.textAlign = "center";
  ctx.fillText("!", px + 24, py - 7 + bob);
  ctx.textAlign = "left";
}

// ── postProcess ───────────────────────────────────────────────────────────────
/**
 * Aplica efeitos de pós-processamento CRT.
 * Chame como ÚLTIMA etapa de cada frame.
 */
function postProcess(ctx, W, H) {
  // scanlines
  for (let sl = 0; sl < H; sl += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, sl, W, 2);
  }
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, "rgba(0,0,10,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// ── drawMinimap ───────────────────────────────────────────────────────────────
/**
 * Desenha o minimapa no canto superior direito do canvas.
 */
function drawMinimap(ctx, W, px, py, camTX, camTY, frame) {
  const mW = 130, mH = 84, mX = W - 138, mY = 8;

  ctx.fillStyle = "rgba(4,4,16,0.94)";
  ctx.fillRect(mX - 3, mY - 3, mW + 6, mH + 6);
  ctx.strokeStyle = N.magenta + "44"; ctx.lineWidth = 1;
  ctx.strokeRect(mX - 3, mY - 3, mW + 6, mH + 6);

  const sx = mW / MAP_COLS, sy = mH / MAP_ROWS;
  for (let ty = 0; ty < MAP_ROWS; ty++) {
    for (let tx = 0; tx < MAP_COLS; tx++) {
      const t = MAP[ty][tx];
      ctx.fillStyle = WALK.has(t)
        ? (t === T.OUTSIDE ? "#0c0c22" : t === T.PATH ? "#141406" : "#0e0e28")
        : "#060618";
      ctx.fillRect(mX + tx * sx, mY + ty * sy, sx + 0.5, sy + 0.5);
    }
  }

  // zona dots
  ZONES.forEach(z => {
    const pulse = Math.sin(frame * 0.07) * 0.5 + 0.5;
    ctx.fillStyle = `${z.color}${Math.round(pulse * 200 + 55).toString(16).padStart(2, "0")}`;
    ctx.fillRect(mX + z.x * sx - 2, mY + z.y * sy - 2, 6, 6);
  });

  // player dot
  ctx.fillStyle = N.magenta;
  ctx.fillRect(mX + px * sx - 2, mY + py * sy - 2, 5, 5);

  // viewport rect
  ctx.strokeStyle = N.magenta + "33"; ctx.lineWidth = 0.5;
  ctx.strokeRect(mX + camTX * sx, mY + camTY * sy, VIEW_COLS * sx, VIEW_ROWS * sy);

  ctx.fillStyle = N.magenta + "77";
  ctx.font = "7px 'Courier New'";
  ctx.fillText("MAPA", mX + 2, mY + mH + 11);
}
