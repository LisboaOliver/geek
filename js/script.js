const canvas = document.getElementById("neonGrid");
const ctx = canvas.getContext("2d");

let offset = 0;
const spacing = 80;
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animate() {
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;

  const xOffset = ((mouseX - centerX) / centerX) * 5;
  const yOffset = ((mouseY - centerY) / centerY) * 5;

  // Fundo semi-transparente para criar rastro
  ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 2;
  ctx.shadowColor = "rgb(31, 25, 61)";
  ctx.shadowBlur = 5;

  // Desenhar as linhas fixas (opcional: pode esconder se quiser só o feixe)
  
  ctx.strokeStyle = "rgba(0, 0, 0, 0)";
  for (let x = 0; x <= width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  

  // Luzes verticais caminhando para cima e para baixo
  for (let x = 0; x <= width; x += spacing) {
    const y = (Math.sin(offset + x * 0.01) * (height / 2)) + centerY + yOffset;
    ctx.strokeStyle = "rgb(37, 0, 105)";

    ctx.beginPath();
    ctx.moveTo(x, y - 100);
    ctx.lineTo(x, y + 100);
    ctx.stroke();
  }

  // Luzes horizontais caminhando para os lados
  for (let y = 0; y <= height; y += spacing) {
    const x = (Math.cos(offset + y * 0.01) * (width / 2)) + centerX + xOffset;
    ctx.strokeStyle = "rgb(62, 0, 92)";

    ctx.beginPath();
    ctx.moveTo(x - 100, y);
    ctx.lineTo(x + 100, y);
    ctx.stroke();
  }

  offset += 0.05;
  requestAnimationFrame(animate);
}

animate();
