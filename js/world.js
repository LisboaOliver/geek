// ─────────────────────────────────────────────────────────────────────────────
// world.js
// Gera os mapas: a ilha base (fixa) e as masmorras (aleatórias a cada andar).
// Inclui o pathfinding (A*) usado pelo clique para andar e pelos monstros.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ── Números aleatórios com semente (masmorras reproduzíveis por andar) ───────
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}
const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

// ── Ilha ──────────────────────────────────────────────────────────────────────
const ISLE = { SEA: 0, GRASS: 1, PATH: 2, SAND: 3, BUILDING: 4 };

function buildIsland() {
  const S = ISLAND_SIZE;
  const grid = [];
  const cx = S / 2, cy = S / 2;
  for (let y = 0; y < S; y++) {
    const row = [];
    for (let x = 0; x < S; x++) {
      // elipse ligeiramente ondulada — o dorso do peixe
      const dx = (x + 0.5 - cx) / (S * 0.47), dy = (y + 0.5 - cy) / (S * 0.43);
      const wob = Math.sin(x * 0.9) * 0.04 + Math.cos(y * 1.3) * 0.04;
      const d = dx * dx + dy * dy + wob;
      row.push(d < 0.78 ? ISLE.GRASS : d < 1 ? ISLE.SAND : ISLE.SEA);
    }
    grid.push(row);
  }

  // caminhos de terra do centro até à porta de cada edifício
  // (da porta desce/sobe até à linha do centro e depois segue na horizontal)
  const hub = ISLAND_HUB;
  const carve = (x, y) => { if (grid[y] && grid[y][x] !== ISLE.SEA) grid[y][x] = ISLE.PATH; };
  BUILDINGS.forEach(b => {
    const door = buildingDoor(b);
    let x = Math.floor(door.x), y = Math.floor(door.y);
    while (y !== hub.y) { carve(x, y); y += Math.sign(hub.y - y); }
    while (x !== hub.x) { carve(x, y); x += Math.sign(hub.x - x); }
    carve(x, y);
  });
  for (let x = hub.x - 1; x <= hub.x + 1; x++) for (let y = hub.y - 1; y <= hub.y + 1; y++) carve(x, y);

  // pegada dos edifícios (não se pode andar por cima)
  BUILDINGS.forEach(b => {
    for (let y = b.ty; y < b.ty + b.h; y++)
      for (let x = b.tx; x < b.tx + b.w; x++) grid[y][x] = ISLE.BUILDING;
  });

  // terreno do castelo da ilha (começa em ruínas e cresce com os níveis)
  const C = CASTLE_SITE;
  for (let y = C.ty; y < C.ty + C.h; y++) for (let x = C.tx; x < C.tx + C.w; x++) grid[y][x] = ISLE.BUILDING;

  // decoração: árvores e pedras em relva livre
  const rng = makeRng(77);
  const props = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (grid[y][x] !== ISLE.GRASS) continue;
    if (Math.abs(x - hub.x) + Math.abs(y - hub.y) < 3) continue;
    const nearB = BUILDINGS.some(b => x >= b.tx - 1 && x <= b.tx + b.w && y >= b.ty - 1 && y <= b.ty + b.h);
    if (nearB) continue;
    if (x >= C.tx - 1 && x <= C.tx + C.w && y >= C.ty - 1 && y <= C.ty + C.h) continue;
    const r = rng();
    if (r < 0.10) props.push({ x, y, kind: "tree", seed: rng() });
    else if (r < 0.14) props.push({ x, y, kind: "rock", seed: rng() });
  }
  props.forEach(p => { if (p.kind === "tree") grid[p.y][p.x] = ISLE.BUILDING; });

  return { grid, props, size: S };
}

/** Ponto de interação (em frente) de um edifício, em coordenadas de tile. */
function buildingDoor(b) {
  return { x: b.tx + b.w / 2, y: b.ty + b.h + 0.6 };
}

function islandWalkable(isle, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= isle.size || ty >= isle.size) return false;
  const t = isle.grid[ty][tx];
  return t === ISLE.GRASS || t === ISLE.PATH || t === ISLE.SAND;
}

// ── Masmorra ──────────────────────────────────────────────────────────────────
const DG = { ROCK: 0, FLOOR: 1, WALL: 2 };

function buildDungeon(floor, seed) {
  const rng = makeRng(seed + floor * 7919);
  const W = 46, H = 46;
  const grid = Array.from({ length: H }, () => new Array(W).fill(DG.ROCK));
  const rooms = [];
  const wantRooms = Math.min(6 + floor, 12);

  for (let tries = 0; tries < 300 && rooms.length < wantRooms; tries++) {
    const w = randInt(rng, 4, 8), h = randInt(rng, 4, 8);
    const x = randInt(rng, 2, W - w - 3), y = randInt(rng, 2, H - h - 3);
    const overlaps = rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y);
    if (overlaps) continue;
    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
  }

  rooms.forEach(r => {
    for (let yy = r.y; yy < r.y + r.h; yy++)
      for (let xx = r.x; xx < r.x + r.w; xx++) grid[yy][xx] = DG.FLOOR;
  });

  // corredores: liga cada sala à sala mais próxima já ligada
  // corredores com 2 tiles de largura (mais fácil de ler e de andar)
  const carve = (x, y) => { grid[y][x] = DG.FLOOR; grid[y + 1][x] = DG.FLOOR; grid[y][x + 1] = DG.FLOOR; };
  const linked = [rooms[0]];
  rooms.slice(1).forEach(r => {
    let best = linked[0], bd = Infinity;
    linked.forEach(l => { const d = Math.abs(l.cx - r.cx) + Math.abs(l.cy - r.cy); if (d < bd) { bd = d; best = l; } });
    let x = r.cx, y = r.cy;
    const horizFirst = rng() < 0.5;
    if (horizFirst) {
      while (x !== best.cx) { carve(x, y); x += Math.sign(best.cx - x); }
      while (y !== best.cy) { carve(x, y); y += Math.sign(best.cy - y); }
    } else {
      while (y !== best.cy) { carve(x, y); y += Math.sign(best.cy - y); }
      while (x !== best.cx) { carve(x, y); x += Math.sign(best.cx - x); }
    }
    linked.push(r);
  });

  // paredes: rocha encostada a chão
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y][x] !== DG.ROCK) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (grid[y + dy] && grid[y + dy][x + dx] === DG.FLOOR) grid[y][x] = DG.WALL;
    }
  }

  // escadas na sala mais distante (caminho real) da sala inicial
  const start = rooms[0];
  const dist = bfsDistances(grid, start.cx, start.cy);
  let far = rooms[rooms.length - 1], fd = -1;
  rooms.forEach(r => { const d = dist[r.cy][r.cx]; if (d > fd) { fd = d; far = r; } });

  // tochas nas paredes viradas para a câmara
  const torches = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (grid[y][x] !== DG.WALL) continue;
    const facesFloor = grid[y + 1][x] === DG.FLOOR || grid[y][x + 1] === DG.FLOOR;
    if (facesFloor && rng() < 0.05) torches.push({ x, y });
  }

  // monstros
  const monsters = [];
  const isBossFloor = floor % BOSS_EVERY === 0;
  rooms.forEach((r, i) => {
    if (i === 0) return;
    const n = randInt(rng, 1, 2 + Math.floor(floor / 2));
    for (let k = 0; k < Math.min(n, 6); k++) {
      const roll = rng();
      const type = roll < 0.45 ? "glitch" : roll < 0.85 - Math.min(floor * 0.02, 0.2) ? "skeleton" : "demon";
      monsters.push(spawnMonster(type, floor, r.x + 0.5 + rng() * (r.w - 1), r.y + 0.5 + rng() * (r.h - 1)));
    }
  });
  if (isBossFloor) monsters.push(spawnMonster("boss", floor, far.cx + 0.5, far.cy - 0.5));

  return {
    grid, W, H, rooms, torches, monsters,
    floor,
    portal: { x: start.cx + 0.5, y: start.cy + 0.5 },
    stairs: { x: far.cx + 0.5, y: far.cy + 0.5 },
    explored: Array.from({ length: H }, () => new Uint8Array(W)),
    isBossFloor,
  };
}

function spawnMonster(type, floor, x, y) {
  const def = MONSTERS[type];
  const scale = 1 + (floor - 1) * 0.22;
  return {
    type, def, x, y,
    hp: Math.round(def.hp * scale), maxHp: Math.round(def.hp * scale),
    dmg: Math.round(def.dmg * (1 + (floor - 1) * 0.15)),
    cd: 0, path: null, repath: 0, hit: 0, dead: false, aggro: false,
    wobble: Math.random() * 6,
  };
}

function bfsDistances(grid, sx, sy) {
  const H = grid.length, W = grid[0].length;
  const dist = Array.from({ length: H }, () => new Array(W).fill(-1));
  const q = [[sx, sy]]; dist[sy][sx] = 0;
  while (q.length) {
    const [x, y] = q.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      if (grid[ny] && grid[ny][nx] === DG.FLOOR && dist[ny][nx] < 0) {
        dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]);
      }
    });
  }
  return dist;
}

function dungeonWalkable(dg, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= dg.W || ty >= dg.H) return false;
  return dg.grid[ty][tx] === DG.FLOOR;
}

// ── A* em grelha (8 direções, sem cortar cantos) ──────────────────────────────
function findPath(walk, sx, sy, gx, gy, maxNodes = 2500) {
  sx = Math.floor(sx); sy = Math.floor(sy); gx = Math.floor(gx); gy = Math.floor(gy);
  if (!walk(gx + 0.5, gy + 0.5)) return null;
  const key = (x, y) => y * 1000 + x;
  const open = [{ x: sx, y: sy, g: 0, f: 0 }];
  const came = new Map(), gScore = new Map([[key(sx, sy), 0]]);
  const closed = new Set();
  const h = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  let n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.x === gx && cur.y === gy) {
      const path = [];
      let k = ck;
      while (came.has(k)) { path.unshift({ x: (k % 1000) + 0.5, y: Math.floor(k / 1000) + 0.5 }); k = came.get(k); }
      return path;
    }
    if (closed.has(ck)) continue;
    closed.add(ck);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!walk(nx + 0.5, ny + 0.5)) continue;
      if (dx && dy && (!walk(cur.x + dx + 0.5, cur.y + 0.5) || !walk(cur.x + 0.5, cur.y + dy + 0.5))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const g = cur.g + (dx && dy ? 1.414 : 1);
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g); came.set(nk, ck);
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}
