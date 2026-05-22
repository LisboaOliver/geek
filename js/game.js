// ─────────────────────────────────────────────────────────────────────────────
// game.js
// Loop principal do jogo: input, física, câmera, detecção de zona.
// Não tem dependência de React — só canvas puro.
// Expõe GameEngine que a UI React consome via callbacks.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

/**
 * Cria e controla o engine do jogo.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} callbacks
 *   callbacks.onZoneChange(zone|null)  — chamado quando jogador entra/sai de zona
 *   callbacks.onPlayerMove({x,y})      — chamado quando posição muda
 * @returns {object} API pública do engine
 */
function createGameEngine(canvas, callbacks) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // ── Estado interno ─────────────────────────────────────────────────────────
  let frame     = 0;
  let rafId     = null;
  let paused    = false;  // true quando modal está aberto

  const player  = { ...PLAYER_START };
  const dir     = { current: "down" };
  const keys    = {};
  let   moveTimer = 0;
  let   prevZoneId = null;

  // ── Input ──────────────────────────────────────────────────────────────────
  const MOVE_KEYS = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d"];

  function onKeyDown(e) {
    keys[e.key] = true;
    if (MOVE_KEYS.includes(e.key)) e.preventDefault();
  }
  function onKeyUp(e) {
    delete keys[e.key];
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup",   onKeyUp);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function canWalk(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return false;
    return WALK.has(MAP[ty][tx]);
  }

  function getActiveZone() {
    for (const z of ZONES) {
      if (Math.abs(player.x - z.x) <= z.r && Math.abs(player.y - z.y) <= z.r) return z;
    }
    return null;
  }

  // ── Move via D-Pad (mobile) ────────────────────────────────────────────────
  function moveBy(dx, dy) {
    if (paused) return;
    const nd = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
    dir.current = nd;
    const nx = player.x + dx, ny = player.y + dy;
    if (canWalk(nx, ny)) {
      player.x = nx; player.y = ny;
      callbacks.onPlayerMove({ ...player });
    }
  }

  // ── Câmera ─────────────────────────────────────────────────────────────────
  function getCamera() {
    return {
      tx: Math.max(0, Math.min(MAP_COLS - VIEW_COLS, player.x - Math.floor(VIEW_COLS / 2))),
      ty: Math.max(0, Math.min(MAP_ROWS - VIEW_ROWS, player.y - Math.floor(VIEW_ROWS / 2))),
    };
  }

  // ── Loop principal ─────────────────────────────────────────────────────────
  function loop() {
    frame++;
    const W = VIEW_COLS * TILE, H = VIEW_ROWS * TILE;

    // Movimento por teclado
    moveTimer++;
    if (moveTimer >= 7 && !paused) {
      moveTimer = 0;
      let nx = player.x, ny = player.y, nd = dir.current, moved = false;
      if      (keys["ArrowUp"]    || keys["w"]) { ny--; nd = "up";    moved = true; }
      else if (keys["ArrowDown"]  || keys["s"]) { ny++; nd = "down";  moved = true; }
      else if (keys["ArrowLeft"]  || keys["a"]) { nx--; nd = "left";  moved = true; }
      else if (keys["ArrowRight"] || keys["d"]) { nx++; nd = "right"; moved = true; }

      if (moved && canWalk(nx, ny)) {
        player.x = nx; player.y = ny;
        dir.current = nd;
        callbacks.onPlayerMove({ ...player });
      }
    }

    // Detecção de zona
    const zone = getActiveZone();
    const zid  = zone ? zone.id : null;
    if (zid !== prevZoneId) {
      prevZoneId = zid;
      callbacks.onZoneChange(zone);
      if (zone) {
        // partículas ao entrar na zona
        spawnParticles(
          (player.x + 0.5) * TILE,
          (player.y + 0.5) * TILE,
          zone.color, 18
        );
      }
    }

    // ── Render ──────────────────────────────────────────────────────────────
    ctx.fillStyle = N.bg;
    ctx.fillRect(0, 0, W, H);

    const cam = getCamera();

    // Tiles
    for (let ty = cam.ty; ty < cam.ty + VIEW_ROWS + 1 && ty < MAP_ROWS; ty++) {
      for (let tx = cam.tx; tx < cam.tx + VIEW_COLS + 1 && tx < MAP_COLS; tx++) {
        drawTile(ctx, MAP[ty][tx], (tx - cam.tx) * TILE, (ty - cam.ty) * TILE, frame, tx, ty);
      }
    }

    // Glows de zona
    ZONES.forEach(z => {
      const zsx  = (z.x - cam.tx) * TILE + TILE / 2;
      const zsy  = (z.y - cam.ty) * TILE + TILE / 2;
      const pulse = Math.sin(frame * 0.05) * 0.2 + 0.8;
      const rad   = (z.r + 1) * TILE;
      const g = ctx.createRadialGradient(zsx, zsy, 0, zsx, zsy, rad * 1.4);
      g.addColorStop(0, `${z.color}${Math.round(pulse * 45 + 8).toString(16).padStart(2, "0")}`);
      g.addColorStop(1, `${z.color}00`);
      ctx.fillStyle = g;
      ctx.fillRect(zsx - rad * 1.5, zsy - rad * 1.5, rad * 3, rad * 3);

      // label no chão
      ctx.font = "bold 8px 'Courier New'";
      ctx.textAlign = "center";
      ctx.fillStyle = `${z.color}77`;
      ctx.fillText(z.name, zsx, (z.y - cam.ty + 1.5) * TILE);
      ctx.textAlign = "left";
    });

    // NPCs
    NPCS.forEach(npc => {
      const sx = (npc.tx - cam.tx) * TILE;
      const sy = (npc.ty - cam.ty) * TILE;
      if (sx > -TILE && sx < W && sy > -TILE && sy < H) {
        drawNPC(ctx, sx, sy, npc.color, frame);
      }
    });

    // Partículas
    tickParticles(ctx, cam.tx * TILE, cam.ty * TILE);

    // Avatar
    const psx = (player.x - cam.tx) * TILE;
    const psy = (player.y - cam.ty) * TILE;
    drawAvatar(ctx, psx, psy, dir.current, frame, zone ? zone.color : null);

    // Indicador de interação
    if (zone && !paused) {
      const pulse = Math.sin(frame * 0.15) * 0.5 + 0.5;
      ctx.strokeStyle = `${zone.color}${Math.round(pulse * 220 + 35).toString(16).padStart(2, "0")}`;
      ctx.lineWidth = 2;
      ctx.strokeRect(psx - 6, psy - 6, TILE + 12, TILE + 12);

      ctx.font = "bold 9px 'Courier New'";
      ctx.textAlign = "center";
      const lbl = `[E] ${zone.glyph} ABRIR`;
      const tw  = ctx.measureText(lbl).width;
      ctx.fillStyle = "rgba(4,4,10,0.92)";
      ctx.fillRect(psx + TILE / 2 - tw / 2 - 6, psy - 23, tw + 12, 16);
      ctx.strokeStyle = zone.color + "88"; ctx.lineWidth = 1;
      ctx.strokeRect(psx + TILE / 2 - tw / 2 - 6, psy - 23, tw + 12, 16);
      ctx.fillStyle = zone.color;
      ctx.fillText(lbl, psx + TILE / 2, psy - 11);
      ctx.textAlign = "left";
    }

    // Minimapa
    drawMinimap(ctx, W, player.x, player.y, cam.tx, cam.ty, frame);

    // Pós-processamento
    postProcess(ctx, W, H);

    rafId = requestAnimationFrame(loop);
  }

  // ── API pública ────────────────────────────────────────────────────────────
  return {
    start() {
      if (!rafId) rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    },
    setPaused(v) { paused = v; },
    moveBy,
    getPlayer() { return { ...player }; },
    destroy() {
      this.stop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
    },
  };
}
