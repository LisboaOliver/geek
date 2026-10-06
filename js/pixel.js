// ─────────────────────────────────────────────────────────────────────────────
// pixel.js
// Filtro de pixel art para as personagens, para combinarem com a ilha:
// desenha cada criatura numa grelha pequena, reduz a paleta com dithering
// (matriz de Bayer), põe um contorno escuro de 1 pixel e reamplia sem suavizar.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const PIXEL = {
  size: 2,      // píxeis lógicos por pixel de arte (2 = fino, 3 = mais grosso)
  levels: 11,   // tons por canal de cor
  dither: 0.55, // força do dithering nas cores (0 = bandas, 1 = máximo)
  outline: null,   // [r,g,b] para contorno de 1 pixel; null = sem contorno (como no Diablo)
  desat: 0.15,     // tira um pouco de saturação para tons mais terrosos
  scale: 0.72,     // tamanho final das personagens em relação à ilha (1 = original)
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
let _pxCanvas = null, _pxCtx = null, _pxSolid = null;

/**
 * Desenha uma personagem em pixel art.
 * @param ctx   contexto de destino (coordenadas lógicas)
 * @param ax,ay ponto dos pés no ecrã
 * @param ex,ey posição da personagem no mundo (tiles)
 * @param box   { w, h, pad } área em px lógicos à volta dos pés
 * @param draw  (ctx, cam) => desenha a personagem com essa câmara
 * @param opts  { post(data, cw, ch, P) — mexe nos píxeis já filtrados (ex.: cabeça desenhada à mão),
 *                shadow: { sx, sy, a } — sombra projetada no chão (inclinação e opacidade) }
 */
let _shCanvas = null;
function drawPixelSprite(ctx, ax, ay, ex, ey, box, draw, opts = {}) {
  const P = PIXEL.size;
  const cw = Math.ceil(box.w / P), ch = Math.ceil(box.h / P);
  if (!_pxCanvas) {
    _pxCanvas = document.createElement("canvas");
    _pxCtx = _pxCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (_pxCanvas.width < cw || _pxCanvas.height < ch) {
    _pxCanvas.width = Math.max(_pxCanvas.width, cw);
    _pxCanvas.height = Math.max(_pxCanvas.height, ch);
  }
  const o = _pxCtx;
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = "source-over"; o.globalAlpha = 1;
  o.clearRect(0, 0, cw, ch);

  // canto do sprite alinhado à grelha do ecrã; a fração fica dentro do buffer
  const left = ax - box.w / 2, top = ay - (box.h - box.pad);
  const x0 = Math.floor(left / P) * P, y0 = Math.floor(top / P) * P;
  const fx = left - x0, fy = top - y0;
  const cam = { ox: box.w / 2 + fx - (ex - ey) * (TW / 2), oy: box.h - box.pad + fy - (ex + ey) * (TH / 2) };
  o.setTransform(1 / P, 0, 0, 1 / P, 0, 0);
  draw(o, cam);
  o.setTransform(1, 0, 0, 1, 0, 0);

  // paleta reduzida + transparência com dithering + contorno
  const im = o.getImageData(0, 0, cw, ch), d = im.data;
  const N = cw * ch;
  if (!_pxSolid || _pxSolid.length < N) _pxSolid = new Uint8Array(N * 2);
  const solid = _pxSolid;
  const L = PIXEL.levels - 1;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x, j = i * 4, th = BAYER4[(y & 3) * 4 + (x & 3)];
    const a = d[j + 3] / 255;
    solid[i] = a > 0.45 ? 1 : 0;
    // bordas antialiasing → sólidas; só os brilhos ténues (alpha baixo) ficam pontilhados
    if (a < 0.05 || (a < 0.4 && a * 2.2 < th)) { d[j + 3] = 0; continue; }
    const dth = 0.5 + (th - 0.5) * PIXEL.dither;
    if (PIXEL.desat) {
      const lum = d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11;
      for (let k = 0; k < 3; k++) d[j + k] = d[j + k] + (lum - d[j + k]) * PIXEL.desat;
    }
    for (let k = 0; k < 3; k++) {
      const v = (d[j + k] / 255) * L, f = Math.floor(v);
      d[j + k] = Math.round(((v - f) > dth ? f + 1 : f) / L * 255);
    }
    d[j + 3] = 255;
  }
  if (PIXEL.outline) {
  const [r, g, b] = PIXEL.outline;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x;
    if (solid[i] || d[i * 4 + 3]) continue;
    if ((x > 0 && solid[i - 1]) || (x < cw - 1 && solid[i + 1]) || (y > 0 && solid[i - cw]) || (y < ch - 1 && solid[i + cw])) {
      const j = i * 4; d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
    }
  }
  }
  if (opts.post) opts.post(d, cw, ch, P);
  o.putImageData(im, 0, 0);

  // sombra projetada: a silhueta do sprite, escurecida e deitada no chão
  if (opts.shadow) {
    if (!_shCanvas) _shCanvas = document.createElement("canvas");
    if (_shCanvas.width < cw || _shCanvas.height < ch) { _shCanvas.width = Math.max(_shCanvas.width, cw); _shCanvas.height = Math.max(_shCanvas.height, ch); }
    const sc = _shCanvas.getContext("2d");
    sc.globalCompositeOperation = "source-over";
    sc.clearRect(0, 0, _shCanvas.width, _shCanvas.height);
    sc.drawImage(_pxCanvas, 0, 0, cw, ch, 0, 0, cw, ch);
    sc.globalCompositeOperation = "source-in";
    sc.fillStyle = "#050306"; sc.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.globalAlpha = opts.shadow.a ?? 0.45;
    ctx.translate(ax, ay);
    ctx.transform(1, 0, opts.shadow.sx, opts.shadow.sy, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sc0 = PIXEL.scale;
    ctx.drawImage(_shCanvas, 0, 0, cw, ch, (x0 - ax) * sc0, (y0 - ay) * sc0, cw * P * sc0, ch * P * sc0);
    ctx.restore();
  }

  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  const sc = PIXEL.scale;
  ctx.drawImage(_pxCanvas, 0, 0, cw, ch, ax + (x0 - ax) * sc, ay + (y0 - ay) * sc, cw * P * sc, ch * P * sc);
  ctx.imageSmoothingEnabled = smooth;
}
