const gameCanvas = document.getElementById("gameCanvas");
const gtx = gameCanvas.getContext("2d");
window.focus();

function resizeGameCanvas() {
  gameCanvas.width = window.innerWidth;
  gameCanvas.height = window.innerHeight;
}
resizeGameCanvas();
window.addEventListener("resize", resizeGameCanvas);

// 🧍 Player
const tileSize = 32;

let player = {
  x: 100,
  y: 100,
  speed: 4
};

// 🎥 Câmera
let camera = {
  x: 0,
  y: 0
};

// 🎮 Movimento suave (melhor que grid puro)
let keys = {};

document.addEventListener("keydown", (e) => keys[e.key] = true);
document.addEventListener("keyup", (e) => keys[e.key] = false);

function updatePlayer() {
  if (keys["ArrowUp"]) player.y -= player.speed;
  if (keys["ArrowDown"]) player.y += player.speed;
  if (keys["ArrowLeft"]) player.x -= player.speed;
  if (keys["ArrowRight"]) player.x += player.speed;
}

// 🎥 câmera segue player
function updateCamera() {
  camera.x += (player.x - gameCanvas.width / 2 - camera.x) * 0.01;
  camera.y += (player.y - gameCanvas.height / 2 - camera.y) * 0.01;
}
// 🎨 player
function drawPlayer() {
  gtx.fillStyle = "#C060A1";

  // corpo
  gtx.fillRect(player.x - camera.x, player.y - camera.y, 32, 32);

  // “olho” pra dar direção
  gtx.fillStyle = "#000";
  gtx.fillRect(player.x - camera.x + 10, player.y - camera.y + 10, 7, 7);
}

// 🎨 scene
function drawFloor() {
  for (let x = -camera.x % 32; x < gameCanvas.width; x += 32) {
    for (let y = -camera.y % 32; y < gameCanvas.height; y += 32) {

      // chão mais visível
      gtx.fillStyle = "rgba(67, 3, 126, 0.21)";
      gtx.fillRect(x, y, 32, 32);

      // grid mais forte
      gtx.strokeStyle = "rgba(168, 39, 136, 0.18)";
      gtx.strokeRect(x, y, 32, 32);
    }
  }
}

// 🔁 loop
function gameLoop() {
  gtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  drawFloor();
  updatePlayer();
  updateCamera();
  drawPlayer();

  requestAnimationFrame(gameLoop);
  console.log(player.x, player.y);
}


gameLoop();
