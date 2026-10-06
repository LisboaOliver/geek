// ─────────────────────────────────────────────────────────────────────────────
// game.js
// Motor do jogo: input (rato/toque/teclado), movimento, combate, saque,
// câmara, cenas (ilha ↔ masmorra) e gravação local.
// Sem React — a UI recebe o estado por callbacks.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ── Gravação (só neste navegador; recursos da masmorra não valem dinheiro) ───
function loadSave() {
  const fresh = {
    gold: 0, crystals: 0,
    levels: Object.fromEntries(BUILDINGS.filter(b => b.upgrade).map(b => [b.id, 0])),
    bestFloor: 0, kills: 0, bosses: 0, upgrades: 0, seed: Math.floor(Math.random() * 1e9),
  };
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return fresh;
    const s = JSON.parse(raw);
    return { ...fresh, ...s, levels: { ...fresh.levels, ...(s.levels || {}) } };
  } catch (_) { return fresh; }
}
function writeSave(save) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) { /* sem armazenamento: segue em memória */ }
}

function heroStats(save) {
  const L = save.levels;
  return {
    maxHp: HERO.baseHp + L.altar * 15,
    dmg: [HERO.baseDmg[0] + L.forja * 3, HERO.baseDmg[1] + L.forja * 3],
    light: HERO.baseLight + L.farol * 0.8,
    goldBonus: L.cofre * 0.10,
    deathLoss: Math.max(0.1, 0.5 - L.cofre * 0.08),
  };
}

function createGameEngine(canvas, cb) {
  const ctx = canvas.getContext("2d");
  let W = 800, H = 600, dpr = 1, zoom = 1, baseZoom = 1;
  let rafId = null, paused = false, last = performance.now(), t = 0, frame = 0;

  const save = loadSave();
  const isle = buildIsland();
  const hero = {
    x: ISLAND_START.x, y: ISLAND_START.y, hp: heroStats(save).maxHp,
    path: [], target: null, pendingBuilding: null, moving: false,
    facing: 1, swing: 0, hurt: 0, atkCd: 0, regen: 0,
  };
  let scene = "island";
  let dungeon = null;
  let run = { gold: 0, crystals: 0, floor: 0, kills: 0 };
  let loot = [], floaters = [], marker = null;
  let dead = false;
  const cam = { ox: 0, oy: 0 };
  const keys = {};
  const mouse = { x: -999, y: -999, down: false, holdT: 0 };
  let hoverMonster = null, hoverBuilding = null, nearSpot = null;
  let lastSnap = "";

  // ── Tamanho / DPR ──────────────────────────────────────────────────────────
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    baseZoom = r.width < 640 ? 0.78 : r.width < 1000 ? 0.9 : 1;
    // no telemóvel a câmara aproxima-se da ilha (o elefante fica só à volta)
    zoom = baseZoom * (scene === "island" ? (r.width < 700 ? 1.05 : 0.8) : 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    W = r.width / zoom; H = r.height / zoom;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ── Helpers ────────────────────────────────────────────────────────────────
  const walk = (x, y) => scene === "island" ? islandWalkable(isle, x, y) : dungeonWalkable(dungeon, x, y);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));

  function floater(x, y, text, color, size) { floaters.push({ x, y, text, color, size, life: 1 }); }
  function burst(x, y, color, n) { const p = iso(x, y, { ox: 0, oy: 0 }); spawnParticles(p.x, p.y - 18, color, n); }

  function canMoveTo(x, y) {
    const r = 0.22;
    return walk(x - r, y - r) && walk(x + r, y - r) && walk(x - r, y + r) && walk(x + r, y + r);
  }
  function stepToward(ent, tx, ty, speed, dt) {
    const dx = tx - ent.x, dy = ty - ent.y, d = Math.hypot(dx, dy);
    if (d < 0.001) return true;
    const s = Math.min(d, speed * dt);
    const nx = ent.x + dx / d * s, ny = ent.y + dy / d * s;
    if (canMoveTo(nx, ent.y)) ent.x = nx;
    if (canMoveTo(ent.x, ny)) ent.y = ny;
    // virar para a esquerda/direita no ecrã
    const sxDir = dx - dy;
    if (Math.abs(sxDir) > 0.05) ent.facing = sxDir > 0 ? 1 : -1;
    return d <= speed * dt + 0.01;
  }

  function pathTo(x, y) {
    const goal = { x, y };
    if (!walk(x, y)) {
      // procura o tile andável mais próximo do clique
      let best = null, bd = Infinity;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const cx = Math.floor(x) + dx + 0.5, cy = Math.floor(y) + dy + 0.5;
        if (walk(cx, cy)) { const d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; best = { x: cx, y: cy }; } }
      }
      if (!best) return false;
      goal.x = best.x; goal.y = best.y;
    }
    const p = findPath(walk, hero.x, hero.y, goal.x, goal.y);
    if (!p) return false;
    if (p.length) p[p.length - 1] = { x: goal.x, y: goal.y };
    else p.push({ x: goal.x, y: goal.y });
    hero.path = p;
    return true;
  }

  // ── Cenas ──────────────────────────────────────────────────────────────────
  function enterDungeon() {
    scene = "dungeon";
    resize();
    run = { gold: 0, crystals: 0, floor: 1, kills: 0 };
    loadFloor(1);
    hero.hp = heroStats(save).maxHp;
    cb.onToast?.("Desceste às masmorras. Andar 1", "#b98cff");
  }
  function loadFloor(n) {
    dungeon = buildDungeon(n, save.seed + Math.floor(Math.random() * 1e6));
    loot = []; floaters = []; hero.path = []; hero.target = null;
    hero.x = dungeon.portal.x + 1; hero.y = dungeon.portal.y + 0.6;
    if (!canMoveTo(hero.x, hero.y)) { hero.x = dungeon.portal.x; hero.y = dungeon.portal.y; }
    run.floor = n;
    if (n > save.bestFloor) { save.bestFloor = n; writeSave(save); }
    window.QuestTracker?.record("floor", n);
    snapCamera();
  }
  function bankRun() {
    save.gold += run.gold; save.crystals += run.crystals;
    writeSave(save);
  }
  function returnToIsland(banked = true) {
    if (banked && (run.gold || run.crystals)) {
      cb.onToast?.(`Voltaste com ${run.gold} de ouro e ${run.crystals} cristais`, N.gold);
    }
    if (banked) bankRun();
    scene = "island"; dungeon = null; loot = []; floaters = [];
    resize();
    run = { gold: 0, crystals: 0, floor: 0, kills: 0 };
    hero.x = 10; hero.y = 11.2; hero.path = []; hero.target = null; hero.pendingBuilding = null;
    hero.hp = heroStats(save).maxHp;
    snapCamera();
  }
  function descend() {
    const n = run.floor + 1;
    loadFloor(n);
    cb.onToast?.(n % BOSS_EVERY === 0 ? `Andar ${n}. Sentes algo enorme por perto…` : `Andar ${n}`, n % BOSS_EVERY === 0 ? N.blood : "#b98cff");
  }

  // ── Interação ──────────────────────────────────────────────────────────────
  function computeNear() {
    if (scene === "island") {
      for (const b of BUILDINGS) if (dist(hero, buildingDoor(b)) < 1.3) return { kind: "building", b };
      return null;
    }
    if (!dungeon) return null;
    if (dist(hero, dungeon.stairs) < 1.1) return { kind: "stairs" };
    if (dist(hero, dungeon.portal) < 1.1) return { kind: "portal" };
    return null;
  }
  function interact() {
    if (paused || dead) return;
    const n = computeNear();
    if (!n) return;
    if (n.kind === "building") {
      if (n.b.id === "portal") enterDungeon();
      else cb.onOpenBuilding?.(n.b);
    } else if (n.kind === "stairs") descend();
    else if (n.kind === "portal") returnToIsland(true);
  }

  // ── Combate ────────────────────────────────────────────────────────────────
  function heroAttack(m) {
    const st = heroStats(save);
    const crit = Math.random() < 0.1;
    const dmg = Math.round(rnd(st.dmg[0], st.dmg[1]) * (crit ? 2 : 1));
    m.hp -= dmg; m.hit = 7; m.aggro = true;
    hero.swing = 14; hero.atkCd = HERO.attackCd;
    hero.facing = (m.x - m.y) - (hero.x - hero.y) >= 0 ? 1 : -1;
    floater(m.x, m.y, crit ? `${dmg}!` : `${dmg}`, crit ? N.rare : "#ffffff", crit ? 20 : 16);
    hero.sprayCol = ((hero.sprayCol || 0) + 1) % SPRAY_COLORS.length;
    const paint = SPRAY_COLORS[hero.sprayCol];
    burst(m.x, m.y, paint, 8);
    // tinta que fica no chão da masmorra
    if (dungeon) {
      dungeon.decals = dungeon.decals || [];
      dungeon.decals.push({ x: m.x + rnd(-0.3, 0.3), y: m.y + rnd(-0.3, 0.3), c: paint, seed: Math.random() * 100, r: rnd(0.7, 1.2) });
      if (dungeon.decals.length > 140) dungeon.decals.shift();
    }
    // empurrão
    const d = dist(m, hero) || 1;
    const kx = m.x + (m.x - hero.x) / d * 0.15, ky = m.y + (m.y - hero.y) / d * 0.15;
    if (canMoveTo(kx, ky)) { m.x = kx; m.y = ky; }
    if (m.hp <= 0) killMonster(m);
  }

  function killMonster(m) {
    m.dead = true;
    run.kills++; save.kills++;
    window.QuestTracker?.record("kills", 1);
    if (m.type === "boss") window.QuestTracker?.record("boss", 1);
    if (m.type === "boss") { save.bosses++; cb.onToast?.("Derrotaste o Senhor do Lag!", N.gold); }
    burst(m.x, m.y, m.def.color, 22);
    const drops = m.type === "boss" ? 5 : 1;
    for (let i = 0; i < drops; i++) dropLoot(m.x + rnd(-0.6, 0.6) * (drops > 1), m.y + rnd(-0.6, 0.6) * (drops > 1), m.type === "boss");
    if (Math.random() < 0.18) loot.push({ kind: "orb", x: m.x + rnd(-0.4, 0.4), y: m.y + rnd(-0.4, 0.4), rarity: null });
    if (hero.target === m) hero.target = null;
    writeSave(save);
  }

  function dropLoot(x, y, boss) {
    const total = RARITIES.reduce((s, r) => s + r.chance, 0);
    let roll = Math.random() * total;
    if (boss) roll = Math.max(roll, total * 0.7);
    let rar = RARITIES[0];
    for (const r of RARITIES) { if (roll < r.chance) { rar = r; break; } roll -= r.chance; }
    const st = heroStats(save);
    const f = 1 + (run.floor - 1) * 0.3;
    const gold = Math.round(rint(rar.gold[0], rar.gold[1]) * f * (1 + st.goldBonus));
    const crystals = rar.crystals[1] ? rint(rar.crystals[0], rar.crystals[1]) + Math.floor(run.floor / 4) : 0;
    loot.push({ kind: "item", x, y, rarity: rar, gold, crystals });
  }

  function hurtHero(dmg) {
    if (dead) return;
    hero.hp -= dmg; hero.hurt = 22;
    floater(hero.x, hero.y, `-${dmg}`, "#ff5a5a", 16);
    if (hero.hp <= 0) {
      hero.hp = 0; dead = true; hero.path = []; hero.target = null;
      const st = heroStats(save);
      const lostGold = Math.round(run.gold * st.deathLoss), lostCrystals = Math.round(run.crystals * st.deathLoss);
      run.gold -= lostGold; run.crystals -= lostCrystals;
      cb.onDeath?.({ lostGold, lostCrystals, keptGold: run.gold, keptCrystals: run.crystals, floor: run.floor });
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  const MOVE = { ArrowUp: [-1, -1], w: [-1, -1], W: [-1, -1], ArrowDown: [1, 1], s: [1, 1], S: [1, 1],
                 ArrowLeft: [-1, 1], a: [-1, 1], A: [-1, 1], ArrowRight: [1, -1], d: [1, -1], D: [1, -1] };

  function onKeyDown(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (paused) return;
    if (MOVE[e.key]) { keys[e.key] = true; e.preventDefault(); }
    if (e.key === "e" || e.key === "E" || e.key === "Enter") { e.preventDefault(); interact(); }
    if (e.key === " ") {
      e.preventDefault();
      if (scene === "dungeon") {
        // ataca o monstro mais próximo
        let best = null, bd = 2.2;
        dungeon.monsters.forEach(m => { if (!m.dead) { const d = dist(m, hero); if (d < bd) { bd = d; best = m; } } });
        if (best) hero.target = best; else interact();
      } else interact();
    }
  }
  function onKeyUp(e) { delete keys[e.key]; }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  }
  function onPointerMove(e) { const p = pointerPos(e); mouse.x = p.x; mouse.y = p.y; }
  function onPointerDown(e) {
    if (paused || dead) return;
    const p = pointerPos(e); mouse.x = p.x; mouse.y = p.y; mouse.down = true; mouse.holdT = 0;
    canvas.setPointerCapture?.(e.pointerId);
    updateHover();
    if (hoverMonster) { hero.target = hoverMonster; hero.path = []; return; }
    if (hoverBuilding) {
      const d = buildingDoor(hoverBuilding);
      hero.target = null;
      if (dist(hero, d) < 1.3) { hero.pendingBuilding = null; interact(); return; }
      hero.pendingBuilding = hoverBuilding;
      pathTo(d.x, d.y);
      return;
    }
    const w = screenToWorld(p.x, p.y, cam);
    hero.target = null; hero.pendingBuilding = null;
    if (pathTo(w.x, w.y)) marker = { x: w.x, y: w.y, life: 1 };
  }
  function onPointerUp() { mouse.down = false; }
  function onLeave() { mouse.x = -999; mouse.y = -999; mouse.down = false; }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onLeave);

  function updateHover() {
    hoverMonster = null; hoverBuilding = null;
    if (scene === "dungeon") {
      let best = null, bd = Infinity;
      dungeon.monsters.forEach(m => {
        if (m.dead) return;
        const s = iso(m.x, m.y, cam), k = m.def.size * PIXEL.scale;
        if (mouse.x > s.x - 18 * k && mouse.x < s.x + 18 * k && mouse.y > s.y - 52 * k && mouse.y < s.y + 8) {
          const d = Math.abs(mouse.x - s.x) + Math.abs(mouse.y - (s.y - 20 * k));
          if (d < bd) { bd = d; best = m; }
        }
      });
      hoverMonster = best;
    } else {
      const bc = islandCam();
      // 1) etiqueta com o nome  2) pegada no chão  3) corpo do edifício (o da frente ganha)
      const labelHit = BUILDINGS.find(b => {
        const lp = buildingLabelPos(b, bc), half = (b.name.length + 6) * 4.5 * FONT_K;
        return mouse.x > lp.x - half && mouse.x < lp.x + half && mouse.y > lp.y - 20 * FONT_K && mouse.y < lp.y + 8;
      });
      const w = screenToWorld(mouse.x, mouse.y, bc);
      const footHit = BUILDINGS.find(b => w.x > b.tx - 0.2 && w.x < b.tx + b.w + 0.2 && w.y > b.ty - 0.2 && w.y < b.ty + b.h + 0.2);
      const bodyHit = [...BUILDINGS].sort((a, b) => (b.tx + b.ty + (b.w + b.h) / 2) - (a.tx + a.ty + (a.w + a.h) / 2)).find(b => {
        const c = iso(b.tx + b.w / 2, b.ty + b.h / 2, bc), halfW = (b.w + b.h) * TW / 4 * 0.8;
        const lp = buildingLabelPos(b, bc);
        return mouse.x > c.x - halfW && mouse.x < c.x + halfW && mouse.y > lp.y + 8 && mouse.y < c.y;
      });
      hoverBuilding = labelHit || footHit || bodyHit || null;
    }
    canvas.style.cursor = hoverMonster ? "crosshair" : hoverBuilding ? "pointer" : "default";
  }

  // ── Câmara ─────────────────────────────────────────────────────────────────
  function camTarget() {
    return { ox: W / 2 - (hero.x - hero.y) * TW / 2, oy: H / 2 - (hero.x + hero.y) * TH / 2 + 30 };
  }
  function snapCamera() { const c = camTarget(); cam.ox = c.ox; cam.oy = c.oy; }
  snapCamera();

  // ── Atualização ────────────────────────────────────────────────────────────
  function update(dt) {
    t += dt; frame++;
    if (hero.swing > 0) hero.swing--;
    if (hero.hurt > 0) hero.hurt--;
    if (hero.atkCd > 0) hero.atkCd--;
    floaters.forEach(f => f.life -= dt * 0.9); floaters = floaters.filter(f => f.life > 0);
    if (marker) marker.life -= dt * 1.8;

    if (!paused && !dead) {
      // teclado
      let kx = 0, ky = 0;
      Object.keys(keys).forEach(k => { if (MOVE[k]) { kx += MOVE[k][0]; ky += MOVE[k][1]; } });
      hero.moving = false;
      if (kx || ky) {
        hero.path = []; hero.target = null; hero.pendingBuilding = null;
        const d = Math.hypot(kx, ky);
        stepToward(hero, hero.x + kx / d, hero.y + ky / d, HERO.speed, dt);
        hero.moving = true;
      } else {
        // manter o botão premido = continuar a andar (como no Diablo)
        if (mouse.down && !hero.target && !hero.pendingBuilding) {
          mouse.holdT += dt;
          if (mouse.holdT > 0.25 && frame % 10 === 0) {
            const w = screenToWorld(mouse.x, mouse.y, cam);
            pathTo(w.x, w.y);
          }
        }
        // alvo de ataque
        if (hero.target) {
          const m = hero.target;
          if (m.dead) hero.target = null;
          else {
            const d = dist(hero, m);
            if (d > HERO.attackRange) {
              if (frame % 12 === 0 || !hero.path.length) pathTo(m.x, m.y);
            } else {
              hero.path = [];
              if (hero.atkCd === 0) heroAttack(m);
            }
          }
        }
        // seguir caminho
        if (hero.path.length) {
          const n = hero.path[0];
          if (stepToward(hero, n.x, n.y, HERO.speed, dt)) hero.path.shift();
          hero.moving = true;
        } else if (hero.pendingBuilding) {
          const b = hero.pendingBuilding; hero.pendingBuilding = null;
          if (dist(hero, buildingDoor(b)) < 1.4) interact();
        }
      }

      if (scene === "dungeon") updateDungeon(dt);
      updateReactions(dt);
    }

    // câmara suave
    const c = camTarget();
    cam.ox += (c.ox - cam.ox) * Math.min(1, dt * 8);
    cam.oy += (c.oy - cam.oy) * Math.min(1, dt * 8);

    updateHover();
    const n = computeNear();
    nearSpot = n;
    emitState();
  }

  // ── Reações do herói (para onde olham os óculos e com que expressão) ─────
  function updateReactions(dt) {
    if (hero.rock > 0) hero.rock--;
    if (hero.surprise > 0) hero.surprise--;
    hero.idle = hero.moving || hero.target || hero.swing ? 0 : (hero.idle || 0) + dt;
    if (hero.moving) hero.rock = 0;
    if (scene === "island" && hero.idle > 6 && !hero.rock) { hero.rock = 90; hero.idle = 0; }

    let look = null, mood = "calmo";
    if (scene === "dungeon") {
      const st = heroStats(save);
      let best = null, bd = st.light + 1;
      dungeon.monsters.forEach(m => { if (!m.dead) { const d = dist(m, hero); if (d < bd) { bd = d; best = m; } } });
      if (hoverMonster) best = hoverMonster;
      if (best) {
        look = { x: best.x, y: best.y };
        if (bd < 2.6) mood = "alerta";
        if (!best.seen) { best.seen = true; hero.surprise = 30; }
      } else if (dist(hero, dungeon.stairs) < st.light + 1) look = dungeon.stairs;
      if (hero.hp / st.maxHp < 0.3) mood = "medo";
    } else {
      const b = hoverBuilding || (nearSpot && nearSpot.b);
      if (b) { look = { x: b.tx + b.w / 2, y: b.ty + b.h / 2 }; mood = "feliz"; }
      if (hero.rock) mood = "feliz";
    }
    if (hero.swing > 0) mood = "foco";
    if (hero.hurt > 0) mood = "ai";
    hero.look = look; hero.mood = mood;
  }

  function updateDungeon(dt) {
    const st = heroStats(save);
    // regeneração lenta
    hero.regen += dt;
    if (hero.regen > 2 && hero.hp < st.maxHp) { hero.regen = 0; hero.hp = Math.min(st.maxHp, hero.hp + 1); }

    // explorar
    const R = st.light;
    const hx = Math.floor(hero.x), hy = Math.floor(hero.y);
    for (let y = hy - Math.ceil(R); y <= hy + Math.ceil(R); y++) for (let x = hx - Math.ceil(R); x <= hx + Math.ceil(R); x++) {
      if (y < 0 || x < 0 || y >= dungeon.H || x >= dungeon.W) continue;
      if (Math.hypot(x + 0.5 - hero.x, y + 0.5 - hero.y) <= R + 0.5) dungeon.explored[y][x] = 1;
    }

    // monstros
    const alive = dungeon.monsters.filter(m => !m.dead);
    alive.forEach(m => {
      if (m.hit > 0) m.hit--;
      if (m.cd > 0) m.cd--;
      const d = dist(m, hero);
      if (!m.aggro && d < Math.min(6.5, R + 2)) m.aggro = true;
      if (m.aggro && d > 15) { m.aggro = false; m.path = null; }
      if (!m.aggro) return;
      if (d > m.def.range) {
        m.repath--;
        if (m.repath <= 0 || !m.path || !m.path.length) {
          m.repath = 25 + Math.floor(Math.random() * 15);
          m.path = d < 2 ? [{ x: hero.x, y: hero.y }] : findPath(walk, m.x, m.y, hero.x, hero.y, 700);
        }
        if (m.path && m.path.length) {
          const n = m.path[0];
          if (stepToward(m, n.x, n.y, m.def.speed, dt)) m.path.shift();
        }
      } else if (m.cd === 0) {
        m.cd = m.def.cd;
        m.lunge = 12; m.ldx = (hero.x - m.x) / (d || 1); m.ldy = (hero.y - m.y) / (d || 1);
        m.facing = (hero.x - hero.y) - (m.x - m.y) >= 0 ? 1 : -1;
        hurtHero(m.dmg);
      }
    });
    // não se amontoarem
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 0.6) {
        const push = (0.6 - d) / 2;
        const ax = a.x - dx / d * push, ay = a.y - dy / d * push, bx = b.x + dx / d * push, by = b.y + dy / d * push;
        if (canMoveTo(ax, ay)) { a.x = ax; a.y = ay; }
        if (canMoveTo(bx, by)) { b.x = bx; b.y = by; }
      }
    }

    // apanhar saque
    loot = loot.filter(l => {
      if (dist(l, hero) > 0.9) return true;
      if (l.kind === "orb") {
        const heal = Math.round(st.maxHp * 0.3);
        hero.hp = Math.min(st.maxHp, hero.hp + heal);
        floater(hero.x, hero.y, `+${heal} vida`, "#ff7a7a", 15);
        return false;
      }
      run.gold += l.gold; run.crystals += l.crystals;
      const txt = l.crystals ? `+${l.gold} ouro  +${l.crystals} 💎` : `+${l.gold} ouro`;
      floater(l.x, l.y, txt, l.rarity.color, 15);
      burst(l.x, l.y, l.rarity.color, 8);
      return false;
    });
  }

  function emitState() {
    if (frame % 6 !== 0) return;
    const st = heroStats(save);
    const snap = {
      scene, dead,
      hp: Math.ceil(hero.hp), maxHp: st.maxHp,
      gold: save.gold, crystals: save.crystals,
      runGold: run.gold, runCrystals: run.crystals, floor: run.floor, kills: run.kills,
      bestFloor: save.bestFloor, levels: { ...save.levels },
      near: nearSpot ? (nearSpot.kind === "building" ? nearSpot.b.id : nearSpot.kind) : null,
      monstersLeft: dungeon ? dungeon.monsters.filter(m => !m.dead).length : 0,
    };
    const s = JSON.stringify(snap);
    if (s !== lastSnap) { lastSnap = s; cb.onState?.(snap); }
  }

  // ── Desenho ────────────────────────────────────────────────────────────────
  let overlay = [], screenUI = [];
  function render() {
    // janela minimizada / layout a mudar: o canvas pode ter 0 px por instantes
    if (!canvas.width || !canvas.height || !(W > 0) || !(H > 0)) return;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    ctx.imageSmoothingEnabled = true;
    FONT_K = 1 / zoom;
    ctx.clearRect(0, 0, W, H);
    overlay = []; screenUI = [];
    if (scene === "island") renderIsland(); else renderDungeon();
    // a cena inteira passa pelo filtro de pixel art (a mesma textura das personagens)
    drawBats(ctx, W, H, scene === "island" ? islandCam() : cam, t, scene, hero);
    pixelizeScene(ctx, canvas, Math.max(2, Math.round(2 * dpr * zoom)));
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    // nomes, números e barras ficam por cima do filtro, nítidos
    overlay.forEach(f => f());
    applyRift(ctx, canvas, W, H, t, scene);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    screenUI.forEach(f => f());
  }

  function islandCam() { return { ox: cam.ox, oy: cam.oy - Math.abs(Math.sin(t * Math.PI * 2 / VOX.period)) * 3 }; } // a ilha sobe e desce com os passos do elefante

  // ── Personagens em pixel art (sombra suave por baixo, sprite filtrado por cima) ──
  const SHADOW_R = { glitch: 22, skeleton: 32, demon: 32, boss: 80 };
  function pixelHero(c) {
    const s = iso(hero.x, hero.y, c);
    softShadow(ctx, s.x, s.y + 1, 18 * PIXEL.scale, 0.6);
    hero._pxHead = true;
    _skipShadow = true;
    // ilha: sol baixo, sombras compridas para cima-esquerda (como no Diablo II)
    const shadow = scene === "island" ? { sx: 0.85, sy: 0.42, a: 0.42 } : { sx: -0.35, sy: -0.25, a: 0.3 };
    drawPixelSprite(ctx, s.x, s.y, hero.x, hero.y, SPRITE_BOX.hero, (o, pc) => drawHero(o, hero, pc, t), {
      shadow,
      post: (d, cw, ch, P) => {
        const hp = hero._headPos; if (!hp) return;
        stampHead(d, cw, ch, Math.round(hp.x / P), Math.round(hp.y / P), hp.flip, hero, t, hero._look.x, hero._look.y);
      },
    });
    _skipShadow = false;
  }
  function pixelMonster(m, c, hovered) {
    const s = iso(m.x, m.y, c);
    softShadow(ctx, s.x, s.y, (SHADOW_R[m.type] || 30) * 0.7 * PIXEL.scale, 0.6);
    // a luz é o herói: a sombra estende-se para longe dele
    const hs = iso(hero.x, hero.y, c);
    let dx = s.x - hs.x, dy = s.y - hs.y; const dd = Math.hypot(dx, dy) || 1; dx /= dd; dy /= dd;
    const fall = clamp(1.4 - dd / 260, 0.35, 1);
    const shadow = { sx: -dx * 0.75 * fall, sy: -(Math.abs(dy) < 0.25 ? 0.25 * Math.sign(dy || 1) : dy) * 0.4 * fall, a: 0.4 };
    _skipShadow = true;
    drawPixelSprite(ctx, s.x, s.y, m.x, m.y, SPRITE_BOX[m.type], (o, pc) => drawMonsterBody(o, m, pc, t), { shadow });
    _skipShadow = false;
    overlay.push(() => drawMonsterUI(ctx, m, c, t, hovered));
  }

  function renderIsland() {
    const bobCam = islandCam();
    drawSea(ctx, bobCam, W, H, t);
    drawElephantVoxel(ctx, isle, bobCam, t);
    drawIslandGround(ctx, isle, bobCam, W, H);
    drawGrime(ctx, isle, bobCam);

    // caminho até ao destino
    drawClickMarker(ctx, marker, bobCam);
    if (nearSpot && nearSpot.kind === "building") {
      const d = buildingDoor(nearSpot.b), s = iso(d.x, d.y, bobCam);
      ctx.strokeStyle = rgba(nearSpot.b.color, 0.7 + Math.sin(t * 5) * 0.2); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 22, 11, 0, 0, Math.PI * 2); ctx.stroke();
    }

    const items = [];
    isle.props.forEach(p => items.push({ d: p.x + p.y + 1, f: () => p.kind === "tree" ? drawTree(ctx, p, bobCam, t) : drawRock(ctx, p, bobCam) }));
    BUILD_LEVELS = save.levels;
    BUILDINGS.forEach(b => items.push({ d: b.tx + b.w / 2 + b.ty + b.h / 2, f: () => { drawBuildingStage(ctx, b, save.levels[b.id] || 0, bobCam, t, hoverBuilding === b || (nearSpot && nearSpot.b === b)); drawBuildingMoss(ctx, b, bobCam); } }));
    const totalLv = Object.values(save.levels).reduce((a, v) => a + v, 0);
    islandGrowthItems(ctx, isle, totalLv, bobCam, t).forEach(it => items.push(it));
    items.push({ d: hero.x + hero.y, f: () => pixelHero(bobCam) });
    items.sort((a, b) => a.d - b.d).forEach(i => i.f());

    tickParticles(ctx, -bobCam.ox, -bobCam.oy);

    // nomes dos edifícios (desenhados depois do filtro)
    overlay.push(() => BUILDINGS.forEach(b => {
      const p = buildingLabelPos(b, bobCam);
      const lvl = save.levels[b.id];
      const active = hoverBuilding === b || (nearSpot && nearSpot.b === b);
      const name = b.upgrade ? `${b.name} · Nv ${lvl}` : b.name;
      labelBox(ctx, name, p.x, p.y, active ? b.color : N.text, active ? 16 : 14, active ? "Cinzel" : "Montserrat");
    }));

    postProcess(ctx, W, H, 0.3);
  }

  function renderDungeon() {
    ctx.fillStyle = "#030203"; ctx.fillRect(0, 0, W, H);
    drawDungeonFloor(ctx, dungeon, cam, W, H);
    drawDungeonGrime(ctx, dungeon, cam);
    drawDecals(ctx, dungeon, cam);
    drawStairs(ctx, dungeon.stairs, cam, t);
    drawDungeonPortal(ctx, dungeon.portal, cam, t);
    drawClickMarker(ctx, marker, cam);

    const st = heroStats(save);
    const hDepth = hero.x + hero.y;
    const hs = iso(hero.x, hero.y, cam);
    const items = [];
    for (let y = 0; y < dungeon.H; y++) for (let x = 0; x < dungeon.W; x++) {
      if (dungeon.grid[y][x] !== DG.WALL || !dungeon.explored[y][x]) continue;
      const p = iso(x, y, cam);
      if (p.x < -TW || p.x > W + TW || p.y < -TH - WALL_H || p.y > H + TH + WALL_H) continue;
      const depth = x + y + 1;
      let alpha = 1;
      if (depth > hDepth + 0.2 && depth - hDepth < 4 && Math.abs(p.x + TW / 2 * 0 - hs.x) < TW * 1.3) alpha = 0.28;
      items.push({ d: depth, f: () => drawWall(ctx, x, y, cam, alpha) });
    }
    dungeon.torches.forEach(tc => { if (dungeon.explored[tc.y][tc.x]) items.push({ d: tc.x + tc.y + 1.01, f: () => drawTorch(ctx, tc, cam, t) }); });
    loot.forEach(l => items.push({ d: l.x + l.y - 0.3, f: () => drawLoot(ctx, l, cam, t, false) }));
    dungeon.monsters.forEach(m => { if (!m.dead && dungeon.explored[Math.floor(m.y)][Math.floor(m.x)]) items.push({ d: m.x + m.y, f: () => pixelMonster(m, cam, m === hoverMonster || m === hero.target) }); });
    items.push({ d: hDepth, f: () => pixelHero(cam) });
    items.sort((a, b) => a.d - b.d).forEach(i => i.f());
    drawHangingBats(ctx, dungeon, cam, t);

    tickParticles(ctx, -cam.ox, -cam.oy);

    // luzes (coordenadas lógicas)
    const lights = [];
    const flick = Math.sin(t * 9) * 4 + Math.sin(t * 23) * 2;
    lights.push({ x: hs.x, y: hs.y - 18, r: st.light * 58 + flick, i: 1 });
    dungeon.torches.forEach(tc => {
      if (!dungeon.explored[tc.y][tc.x]) return;
      const p = iso(tc.x + 0.5, tc.y + 1, cam);
      if (p.x < -200 || p.x > W + 200 || p.y < -200 || p.y > H + 200) return;
      lights.push({ x: p.x, y: p.y - 20, r: 120 + flick * 2, i: 0.8, warm: "rgba(255,140,50,0.16)" });
    });
    [dungeon.portal, dungeon.stairs].forEach((s, i) => {
      if (!dungeon.explored[Math.floor(s.y)][Math.floor(s.x)]) return;
      const p = iso(s.x, s.y, cam);
      lights.push({ x: p.x, y: p.y - 20, r: 90, i: 0.7, warm: i ? "rgba(216,169,74,0.12)" : "rgba(155,92,255,0.18)" });
    });
    loot.forEach(l => {
      if (l.kind === "item" && (l.rarity.id === "raro" || l.rarity.id === "unico")) {
        const p = iso(l.x, l.y, cam);
        lights.push({ x: p.x, y: p.y - 10, r: 45, i: 0.6 });
      }
    });
    drawDarknessScaled(lights);

    // etiquetas do saque por cima da escuridão
    overlay.push(() => {
    loot.forEach(l => { if (l.kind === "item" && dist(l, hero) < st.light + 1) { const s = iso(l.x, l.y, cam); labelBox(ctx, l.rarity.label, s.x, s.y - 24, l.rarity.color, 14); } });
    drawFloaters(ctx, floaters, cam);
    });

    // nome do monstro sob o rato (no topo, como no Diablo). Vai para depois da
    // fenda, senão a borda da fenda tapa-o; fica por baixo da barra do HUD.
    const focus = hoverMonster || hero.target;
    if (focus && !focus.dead) screenUI.push(() => drawFocusPlate(focus));

    postProcess(ctx, W, H, 0.5);
  }

  function drawFocusPlate(focus) {
    const k = 1 / zoom;                       // tamanho constante no ecrã
    const narrow = W * zoom < 640;            // telemóvel: os botões do HUD empilham-se
    const w = Math.min(260, W * zoom - 140) * k, h = 44 * k, x = W / 2 - w / 2, y = (narrow ? 150 : 56) * k;
    ctx.fillStyle = "rgba(10,6,8,0.9)"; ctx.fillRect(x, y, w, h);
    ctx.lineWidth = k; ctx.strokeStyle = "rgba(179,32,44,0.7)"; ctx.strokeRect(x + 0.5 * k, y + 0.5 * k, w - k, h - k);
    ctx.fillStyle = "#3a0a10"; ctx.fillRect(x + 8 * k, y + 28 * k, w - 16 * k, 8 * k);
    ctx.fillStyle = N.blood; ctx.fillRect(x + 8 * k, y + 28 * k, (w - 16 * k) * Math.max(0, focus.hp / focus.maxHp), 8 * k);
    ctx.font = `600 ${Math.round(17 * k)}px Cinzel, serif`; ctx.textAlign = "center";
    ctx.fillStyle = focus.type === "boss" ? N.unique : N.text;
    ctx.fillText(focus.def.name, W / 2, y + 22 * k);
    ctx.textAlign = "left";
  }

  function drawDarknessScaled(lights) {
    // a escuridão é desenhada em píxeis reais para ficar nítida
    const scale = dpr * zoom;
    const L = lights.map(l => ({ ...l, x: l.x * scale, y: l.y * scale, r: l.r * scale }));
    const pw = canvas.width, ph = canvas.height;
    if (!_darkCanvas) _darkCanvas = document.createElement("canvas");
    if (_darkCanvas.width !== pw || _darkCanvas.height !== ph) { _darkCanvas.width = pw; _darkCanvas.height = ph; }
    const d = _darkCanvas.getContext("2d");
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = "source-over";
    d.clearRect(0, 0, pw, ph);
    d.fillStyle = "rgba(3,2,4,0.86)"; d.fillRect(0, 0, pw, ph);
    d.globalCompositeOperation = "destination-out";
    L.forEach(l => {
      d.save(); d.translate(l.x, l.y); d.scale(1, 0.62);
      const g = d.createRadialGradient(0, 0, 0, 0, 0, l.r);
      g.addColorStop(0, `rgba(0,0,0,${l.i})`); g.addColorStop(0.55, `rgba(0,0,0,${l.i * 0.75})`); g.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = g; d.beginPath(); d.arc(0, 0, l.r, 0, Math.PI * 2); d.fill(); d.restore();
    });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(_darkCanvas, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    L.forEach(l => {
      if (!l.warm) return;
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.55);
      g.addColorStop(0, l.warm); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    });
    ctx.restore();
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  function loop(now) {
    // agenda já o próximo frame: um erro pontual nunca pode parar o jogo de vez
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try {
      update(dt);
      render();
    } catch (e) {
      if (!loop._warned) { loop._warned = true; console.warn("Frame do jogo falhou (o jogo continua):", e); }
    }
  }

  // modo de teste: store.html?debug expõe o motor na consola
  if (/[?&]debug\b/.test(location.search)) window.__geek = { hero, save, get dungeon() { return dungeon; }, get run() { return run; }, enterDungeon, descend };

  // ── API pública ────────────────────────────────────────────────────────────
  return {
    start() { if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(loop); } },
    stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
    setPaused(v) { paused = v; if (v) { Object.keys(keys).forEach(k => delete keys[k]); mouse.down = false; } },
    interact,
    getSave() { return JSON.parse(JSON.stringify(save)); },
    upgrade(id) {
      const lvl = save.levels[id];
      if (lvl === undefined || lvl >= MAX_LEVEL) return false;
      const c = upgradeCost(lvl);
      if (save.gold < c.gold || save.crystals < c.crystals) return false;
      save.gold -= c.gold; save.crystals -= c.crystals;
      save.levels[id] = lvl + 1; save.upgrades++;
      window.QuestTracker?.record("upgrade", 1);
      writeSave(save);
      hero.hp = heroStats(save).maxHp;
      const b = BUILDINGS.find(x => x.id === id);
      burst(b.tx + b.w / 2, b.ty + b.h / 2, b.color, 30);
      lastSnap = ""; emitState();
      return true;
    },
    respawn() { dead = false; returnToIsland(true); lastSnap = ""; },
    leaveDungeon() { if (scene === "dungeon" && !dead) returnToIsland(true); },
    destroy() {
      this.stop(); ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
