// ─────────────────────────────────────────────────────────────────────────────
// particles.js
// Sistema de partículas. Completamente isolado — sem dependências externas.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

let _parts = [];

/**
 * Emite partículas em uma posição do mundo.
 * @param {number} wx   - X no mundo (pixels)
 * @param {number} wy   - Y no mundo (pixels)
 * @param {string} col  - cor hex (#rrggbb)
 * @param {number} n    - quantidade de partículas
 */
function spawnParticles(wx, wy, col, n = 14) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    _parts.push({
      x:     wx,
      y:     wy,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed - 2.5,
      life:  1,
      decay: 0.018 + Math.random() * 0.025,
      col,
      sz:    2 + Math.random() * 5,
    });
  }
}

/**
 * Atualiza e desenha todas as partículas vivas.
 * Deve ser chamado a cada frame APÓS os tiles e ANTES do HUD.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} camPx - offset X da câmera em pixels
 * @param {number} camPy - offset Y da câmera em pixels
 */
function tickParticles(ctx, camPx, camPy) {
  _parts = _parts.filter(p => {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.12;      // gravidade leve
    p.life -= p.decay;
    if (p.life <= 0) return false;

    const alpha = Math.round(p.life * 255).toString(16).padStart(2, "0");
    ctx.fillStyle = p.col + alpha;
    ctx.fillRect(p.x - camPx, p.y - camPy, p.sz, p.sz);
    return true;
  });
}

/** Remove todas as partículas (útil ao fechar modais). */
function clearParticles() {
  _parts = [];
}
