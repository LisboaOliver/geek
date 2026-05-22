const gameCanvas = document.getElementById("gameCanvas");
const gtx = gameCanvas.getContext("2d");

function resizeGameCanvas() {
  gameCanvas.width = window.innerWidth;
  gameCanvas.height = window.innerHeight;
}
resizeGameCanvas();
window.addEventListener("resize", resizeGameCanvas);

const SC = 3;

let player = { x: 200, y: 200, speed: 3 };
let camera = { x: 0, y: 0 };
let keys = {};
let time = 0;

document.addEventListener("keydown", e => { keys[e.key] = true; });
document.addEventListener("keyup",   e => { keys[e.key] = false; });

// aplicar estilos via JS
Object.assign(document.body.style, {
  margin: "0",
  padding: "0",
  overflow: "hidden",
  background: "#0a3d6b",
});
Object.assign(gameCanvas.style, {
  display: "block",
  width: "100vw",
  height: "100vh",
  imageRendering: "pixelated",
  cursor: "none",
});

// ——— Ilhas ———
const islands = [
  { x: 400,  y: 300,  r: 52, trees: [{dx:-10,dy:-20},{dx:15,dy:-30},{dx:-25,dy:-10}] },
  { x: 900,  y: 150,  r: 40, trees: [{dx:0,dy:-25},{dx:20,dy:-15}] },
  { x: 700,  y: 600,  r: 60, trees: [{dx:-15,dy:-28},{dx:10,dy:-35},{dx:30,dy:-18},{dx:-30,dy:-15}] },
  { x: 1300, y: 400,  r: 45, trees: [{dx:5,dy:-22},{dx:-18,dy:-18}] },
  { x: 150,  y: 700,  r: 38, trees: [{dx:0,dy:-20},{dx:18,dy:-12}] },
  { x: 1100, y: 750,  r: 55, trees: [{dx:-20,dy:-30},{dx:15,dy:-32},{dx:35,dy:-18}] },
  { x: 550,  y: 900,  r: 35, trees: [{dx:-8,dy:-20},{dx:10,dy:-18}] },
  { x: 1500, y: 200,  r: 48, trees: [{dx:-5,dy:-28},{dx:20,dy:-20},{dx:-22,dy:-12}] },
];

// ——— Navio pixel art ———
const SHIP = [
  {x:-1,y:2,c:'#8B6914'},{x:0,y:2,c:'#A0791A'},{x:1,y:2,c:'#8B6914'},
  {x:-2,y:3,c:'#7A5C10'},{x:-1,y:3,c:'#C8960C'},{x:0,y:3,c:'#D4A017'},{x:1,y:3,c:'#C8960C'},{x:2,y:3,c:'#7A5C10'},
  {x:-2,y:4,c:'#6B4F0E'},{x:-1,y:4,c:'#C8960C'},{x:0,y:4,c:'#D4A017'},{x:1,y:4,c:'#C8960C'},{x:2,y:4,c:'#6B4F0E'},
  {x:-1,y:5,c:'#5A3F0C'},{x:0,y:5,c:'#7A5C10'},{x:1,y:5,c:'#5A3F0C'},
  {x:0,y:-5,c:'#5C4020'},{x:0,y:-4,c:'#6B4F0E'},{x:0,y:-3,c:'#7A5C10'},
  {x:0,y:-2,c:'#8B6914'},{x:0,y:-1,c:'#A0791A'},{x:0,y:0,c:'#8B6914'},{x:0,y:1,c:'#8B6914'},
  {x:-3,y:-4,c:'#E8E0D0'},{x:-2,y:-4,c:'#F5F0E8'},{x:-1,y:-4,c:'#FFFEF8'},{x:1,y:-4,c:'#FFFEF8'},{x:2,y:-4,c:'#F5F0E8'},{x:3,y:-4,c:'#E8E0D0'},
  {x:-3,y:-3,c:'#E0D8C8'},{x:-2,y:-3,c:'#F5F0E8'},{x:-1,y:-3,c:'#FFFEF8'},{x:1,y:-3,c:'#FFFEF8'},{x:2,y:-3,c:'#F5F0E8'},{x:3,y:-3,c:'#E0D8C8'},
  {x:-2,y:-2,c:'#E8E0D0'},{x:-1,y:-2,c:'#F5F0E8'},{x:1,y:-2,c:'#F5F0E8'},{x:2,y:-2,c:'#E8E0D0'},
  {x:-2,y:-1,c:'#E0D8C8'},{x:-1,y:-1,c:'#F0EAD8'},{x:1,y:-1,c:'#F0EAD8'},{x:2,y:-1,c:'#E0D8C8'},
  {x:-2,y:-4,c:'#CC3322'},{x:2,y:-4,c:'#CC3322'},
  {x:-2,y:-2,c:'#CC3322'},{x:2,y:-2,c:'#CC3322'},
  {x:-1,y:-5,c:'#8B6914'},{x:1,y:-5,c:'#8B6914'},
  {x:1,y:-6,c:'#E63030'},{x:2,y:-6,c:'#E63030'},{x:1,y:-7,c:'#CC2020'},
  {x:-2,y:3,c:'#2A1A08'},{x:2,y:3,c:'#2A1A08'},
  {x:-1,y:1,c:'#5A3F0C'},{x:1,y:1,c:'#5A3F0C'},
];

// ——— Oceano ———
function drawWaves(t) {
  const W = gameCanvas.width;
  const H = gameCanvas.height;
  const cols = Math.ceil(W / SC) + 2;
  const rows = Math.ceil(H / SC) + 2;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const worldCol = col + camera.x / SC;
      const worldRow = row + camera.y / SC;

      const w1 = Math.sin(worldCol * 0.18 + t * 1.1) * 1.5;
      const w2 = Math.sin(worldCol * 0.11 - t * 0.7 + worldRow * 0.3) * 1.2;
      const w3 = Math.cos(worldCol * 0.25 + t * 0.45 + worldRow * 0.15) * 0.8;
      const wv  = w1 + w2 + w3;

      const depth = Math.min(1, worldRow / 60);
      let r, g, b;
      if      (wv > 2.6)        { r=195; g=228; b=255; }
      else if (depth < 0.3)     { r=40;  g=120; b=200; }
      else if (depth < 0.6)     { r=15;  g=80;  b=160; }
      else                       { r=8;   g=50;  b=120; }

      const n = (Math.sin(worldCol * 7.3 + worldRow * 3.1) * 0.5 + 0.5) * 12 - 6;
      gtx.fillStyle = `rgb(${r + n | 0},${g + n | 0},${b + n | 0})`;
      gtx.fillRect(col * SC, row * SC, SC, SC);
    }
  }
}

// ——— Ilhas ———
function drawIslandPixel(wx, wy, color) {
  const sx = (wx - camera.x) * SC;
  const sy = (wy - camera.y) * SC;
  if (sx < -SC * 4 || sx > gameCanvas.width  + SC * 4) return;
  if (sy < -SC * 4 || sy > gameCanvas.height + SC * 4) return;
  gtx.fillStyle = color;
  gtx.fillRect(Math.floor(sx), Math.floor(sy), SC, SC);
}

function drawIsland(isl, t) {
  const r = isl.r / SC | 0;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      const wx   = isl.x / SC + dx;
      const wy   = isl.y / SC + dy;
      const edge = d / r;
      let col;
      if (edge > 0.82) {
        col = '#D4B483';
      } else if (edge > 0.68) {
        col = '#C8A45A';
      } else {
        const n = Math.sin(wx * 0.8) * Math.cos(wy * 0.9);
        col = n > 0.1 ? '#4A8C3F' : '#3A7230';
      }
      drawIslandPixel(wx, wy, col);
    }
  }

  // ondas de praia
  const shore = r + 2;
  for (let dy = -shore; dy <= shore; dy++) {
    for (let dx = -shore; dx <= shore; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < r || d > shore) continue;
      const wave = Math.sin(d * 1.5 - t * 2 + dx * 0.4) * 0.5 + 0.5;
      if (wave > 0.6) {
        drawIslandPixel(
          isl.x / SC + dx,
          isl.y / SC + dy,
          `rgba(200,235,255,${(wave - 0.6) * 0.8})`
        );
      }
    }
  }

  // árvores
  isl.trees.forEach(tr => {
    const tx = isl.x / SC + tr.dx / SC;
    const ty = isl.y / SC + tr.dy / SC;
    for (let i = 0; i < 4; i++) drawIslandPixel(tx, ty + i, '#5C3A1A');
    const leafR = 3;
    for (let dy2 = -leafR; dy2 <= leafR; dy2++) {
      for (let dx2 = -leafR; dx2 <= leafR; dx2++) {
        const ld = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (ld <= leafR) {
          drawIslandPixel(tx + dx2, ty - 1 + dy2, ld < leafR - 1 ? '#1E6B2A' : '#2A8C3A');
        }
      }
    }
  });
}

// ——— Esteira ———
function drawWake(cx, cy, t) {
  const foam = [
    {x:-1,y:1},{x:0,y:1},{x:1,y:1},
    {x:-2,y:2},{x:-1,y:2},{x:0,y:2},{x:1,y:2},{x:2,y:2},
    {x:-1,y:3},{x:0,y:3},{x:1,y:3},
    {x:-2,y:4},{x:2,y:4},
  ];
  foam.forEach(p => {
    const alpha = Math.max(0, 0.65 - p.y * 0.12 + Math.sin(t * 2 + p.x) * 0.1);
    gtx.fillStyle = `rgba(200,230,255,${alpha})`;
    gtx.fillRect(Math.floor(cx + p.x * SC), Math.floor(cy + (p.y + 5) * SC), SC, SC);
  });
}

// ——— Navio ———
function drawShip(cx, cy) {
  SHIP.forEach(p => {
    gtx.fillStyle = p.c;
    gtx.fillRect(Math.floor(cx + p.x * SC), Math.floor(cy + p.y * SC), SC, SC);
  });
}

// ——— Movimento ———
function updatePlayer() {
  if (keys["ArrowUp"]    || keys["w"] || keys["W"]) player.y -= player.speed;
  if (keys["ArrowDown"]  || keys["s"] || keys["S"]) player.y += player.speed;
  if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) player.x -= player.speed;
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;
}

// ——— Câmera ———
function updateCamera() {
  camera.x += (player.x - gameCanvas.width  / (2 * SC) - camera.x) * 0.08;
  camera.y += (player.y - gameCanvas.height / (2 * SC) - camera.y) * 0.08;
}

// ——— Loop principal ———
function gameLoop() {
  time += 0.016;

  gtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  updatePlayer();
  updateCamera();

  const bobY = Math.sin(time * 2)   * 0.8;
  const bobX = Math.sin(time * 1.3) * 0.4;

  drawWaves(time);

  islands.forEach(isl => drawIsland(isl, time));

  const sx = (player.x - camera.x) * SC + bobX * SC;
  const sy = (player.y - camera.y) * SC + bobY * SC;

  drawWake(sx, sy, time);
  drawShip(sx, sy - 6 * SC);

  requestAnimationFrame(gameLoop);
}

gameLoop();
