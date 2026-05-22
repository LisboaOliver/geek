// ─────────────────────────────────────────────────────────────────────────────
// constants.js
// Todas as constantes do jogo: tamanhos, paleta, IDs de tile, mapa e zonas.
// Edite ZONES.items para colocar seus produtos reais.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ── Tamanhos ─────────────────────────────────────────────────────────────────
const TILE      = 48;   // pixels por tile no canvas interno
const MAP_COLS  = 30;
const MAP_ROWS  = 22;
const VIEW_COLS = 17;   // tiles visíveis na horizontal
const VIEW_ROWS = 13;   // tiles visíveis na vertical

// ── Paleta neon (Geekonverse) ─────────────────────────────────────────────────
const N = {
  cyan:    "#00f5ff",
  magenta: "#ff00cc",
  yellow:  "#ffee00",
  green:   "#00ff88",
  orange:  "#ff6600",
  purple:  "#aa00ff",
  red:     "#ff2244",
  pink:    "#ff66cc",
  bg:      "#04040a",
  panel:   "#080814",
  panelB:  "#0c0c1e",
  border:  "#1a1a3a",
  dim:     "#223",
  text:    "#e8e8ff",
  textDim: "#556",
};

// ── IDs de tile ───────────────────────────────────────────────────────────────
const T = {
  VOID:    0,   // intransponível / fora do mapa
  FLOOR:   1,   // chão interno da loja
  WALL_N:  2,   // parede norte (com neon superior)
  WALL_S:  3,   // parede sul
  WALL_E:  4,   // parede leste
  WALL_W:  5,   // parede oeste
  CNR_NE:  6,   // canto NE
  CNR_NW:  7,   // canto NW
  CNR_SE:  8,   // canto SE
  CNR_SW:  9,   // canto SW
  DOOR_N:  10,  // porta norte (entra pela frente)
  DOOR_S:  11,  // porta sul (sai pela frente)
  COUNTER: 12,  // balcão de atendimento
  SHELF:   13,  // prateleira com produtos
  PILLAR:  14,  // coluna neon
  RUG:     15,  // tapete decorativo
  SCREEN:  16,  // tela/monitor
  CHEST:   17,  // baú de recompensas
  NEON:    18,  // placa neon
  PLANT:   19,  // planta cyberpunk
  ARCADE:  20,  // máquina arcade
  LAMP:    21,  // poste de luz
  OUTSIDE: 22,  // calçada / área externa
  PATH:    23,  // corredor interno
  FLOOR2:  24,  // chão alternativo (listras)
};

// Tiles que o personagem pode pisar
const WALK = new Set([
  T.FLOOR, T.DOOR_N, T.DOOR_S, T.RUG,
  T.OUTSIDE, T.PATH, T.FLOOR2,
]);

// ── Mapa ──────────────────────────────────────────────────────────────────────
// Linhas = Y (0 = topo), Colunas = X (0 = esquerda)
// Para editar o layout: altere os números usando os IDs de T acima.
const MAP = [
//   0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25  26  27  28  29
  [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // 0
  [  0, 22, 22, 22, 22, 22, 21, 22, 22, 22, 22, 22, 22, 22, 21, 22, 22, 22, 22, 22, 22, 21, 22, 22, 22, 22, 22, 22, 22,  0], // 1
  [  0, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,  0], // 2
  [  0, 22, 22,  7,  2,  2,  2,  2,  2,  2,  2,  2,  6, 22, 22, 22,  7,  2,  2,  2,  2,  2,  2,  2,  2,  2,  6, 22, 22,  0], // 3
  [  0, 22, 22,  5, 24, 24, 24, 18, 24, 24, 24, 24,  4, 22, 22, 22,  5, 24, 24, 24, 18, 24, 24, 24, 24, 24,  4, 22, 22,  0], // 4
  [  0, 22, 22,  5, 24, 13, 13, 13, 13, 13, 13, 24,  4, 22, 22, 22,  5, 24, 13, 13, 13, 13, 13, 13, 24, 24,  4, 22, 22,  0], // 5
  [  0, 22, 22,  5, 24, 13, 17, 13, 13, 13, 13, 24,  4, 22, 22, 22,  5, 24, 13, 17, 13, 13, 13, 13, 24, 20,  4, 22, 22,  0], // 6
  [  0, 22, 22,  5, 24, 13, 13, 13, 13, 13, 13, 24,  4, 22, 22, 22,  5, 24, 13, 13, 13, 13, 13, 13, 24, 20,  4, 22, 22,  0], // 7
  [  0, 22, 22,  5, 15, 15, 12, 12, 12, 12, 15, 15,  4, 22, 22, 22,  5, 15, 15, 12, 12, 12, 12, 15, 15, 24,  4, 22, 22,  0], // 8
  [  0, 22, 22,  5, 24, 24, 24, 24, 24, 24, 24, 24,  4, 22, 22, 22,  5, 24, 24, 24, 24, 24, 24, 24, 24, 24,  4, 22, 22,  0], // 9
  [  0, 22, 22,  5, 24, 14, 24, 16, 16, 24, 14, 24,  4, 22, 22, 22,  5, 24, 14, 24, 16, 16, 24, 14, 24, 24,  4, 22, 22,  0], // 10
  [  0, 23, 23,  8,  3,  3,  3, 10,  3,  3,  3,  3,  9, 23, 23, 23,  8,  3,  3,  3, 10,  3,  3,  3,  3,  3,  9, 23, 23,  0], // 11
  [  0, 23, 23, 23, 23, 23, 23,  1, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,  1, 23, 23, 23, 23, 23, 23, 23, 23,  0], // 12
  [  0, 23, 23,  7,  2,  2,  2, 11,  2,  2,  2,  2,  6, 23, 23, 23,  7,  2,  2,  2, 11,  2,  2,  2,  2,  2,  6, 23, 23,  0], // 13
  [  0, 23, 23,  5, 24, 13, 13, 13, 13, 13, 13, 24,  4, 23, 23, 23,  5, 24, 13, 13, 13, 13, 13, 13, 24, 24,  4, 23, 23,  0], // 14
  [  0, 23, 23,  5, 24, 13, 17, 13, 13, 13, 13, 24,  4, 23, 23, 23,  5, 24, 13, 17, 13, 13, 13, 13, 24, 20,  4, 23, 23,  0], // 15
  [  0, 23, 23,  5, 24, 13, 13, 13, 13, 13, 13, 24,  4, 23, 23, 23,  5, 24, 13, 13, 13, 13, 13, 13, 24, 20,  4, 23, 23,  0], // 16
  [  0, 23, 23,  5, 15, 15, 12, 12, 12, 12, 15, 15,  4, 23, 23, 23,  5, 15, 15, 12, 12, 12, 12, 15, 15, 24,  4, 23, 23,  0], // 17
  [  0, 23, 23,  5, 24, 24, 24, 24, 24, 24, 24, 24,  4, 23, 23, 23,  5, 24, 24, 24, 24, 24, 24, 24, 24, 24,  4, 23, 23,  0], // 18
  [  0, 23, 23,  5, 24, 14, 24, 16, 16, 24, 14, 24,  4, 23, 23, 23,  5, 24, 14, 24, 16, 16, 24, 14, 24, 24,  4, 23, 23,  0], // 19
  [  0, 23, 22,  8,  3,  3,  3,  3,  3,  3,  3,  3,  9, 23, 23, 23,  8,  3,  3,  3,  3,  3,  3,  3,  3,  3,  9, 22, 23,  0], // 20
  [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // 21
];

// ── Posição inicial do jogador ─────────────────────────────────────────────────
const PLAYER_START = { x: 14, y: 12 }; // corredor central (PATH)

// ── NPCs ──────────────────────────────────────────────────────────────────────
const NPCS = [
  { tx: 7,  ty: 5,  color: N.cyan    },
  { tx: 20, ty: 5,  color: N.magenta },
  { tx: 7,  ty: 14, color: N.green   },
  { tx: 20, ty: 14, color: N.yellow  },
];

// ── Zonas de loja ─────────────────────────────────────────────────────────────
// 👉 EDITE items[] com seus produtos reais.
// Campos:
//   name    — nome do produto
//   price   — preço numérico (0 = grátis/cupom)
//   old     — preço antigo (null se não tiver desconto)
//   badge   — etiqueta exibida no card ("NOVO", "-40%", "#1", etc.)
//   emoji   — emoji decorativo
//   desc    — descrição curta
//   stock   — quantidade em estoque
//   tags    — array de hashtags
//   image   — (opcional) caminho PNG, ex: "assets/products/camiseta-op.png"
const ZONES = [
  {
    id:    "drops",
    x:     7,
    y:     6,
    r:     3,
    name:  "DROPS & LANÇAMENTOS",
    sub:   "Novidades quentíssimas",
    color: N.cyan,
    glyph: "⚡",
    items: [
      { name:"Camiseta One Piece Ed. Especial", price:189.90, old:null,   badge:"NOVO",   emoji:"🏴‍☠️", desc:"Edição limitada em silk premium 100% algodão", stock:12, tags:["anime","manga"],  image:null },
      { name:"Moletom Attack on Titan",         price:279.90, old:null,   badge:"DROP",   emoji:"⚔️",  desc:"Survey Corps algodão 380g com capuz duplo",   stock:8,  tags:["anime","collab"], image:null },
      { name:"Hoodie Cyberpunk 2077",           price:319.90, old:null,   badge:"COLLAB", emoji:"🤖",  desc:"Arte oficial Night City — peça exclusiva",     stock:5,  tags:["games","neon"],   image:null },
      { name:"Camiseta Studio Ghibli",          price:159.90, old:null,   badge:"NOVO",   emoji:"🌿",  desc:"Totoro em impressão DTF toque aveludado",      stock:20, tags:["anime","kawaii"], image:null },
    ],
  },
  {
    id:    "promo",
    x:     20,
    y:     6,
    r:     3,
    name:  "ARENA DE PROMOÇÕES",
    sub:   "Missões com desconto épico",
    color: N.magenta,
    glyph: "🔥",
    items: [
      { name:"Kit Naruto Completo",  price:199.90, old:349.90, badge:"-43%", emoji:"🦊", desc:"Camiseta + moletom + boné — combo completo",    stock:7,  tags:["anime","kit"],      image:null },
      { name:"Camiseta Dragon Ball", price:79.90,  old:139.90, badge:"-43%", emoji:"🐉", desc:"Goku Ultra Instinct silk plastisol premium",    stock:15, tags:["anime","clássico"], image:null },
      { name:"Pack Gamer Legends",   price:249.90, old:419.90, badge:"-40%", emoji:"🎮", desc:"3 camisetas temáticas gamer oversize",          stock:6,  tags:["games","pack"],     image:null },
      { name:"Boné Demon Slayer",    price:59.90,  old:99.90,  badge:"-40%", emoji:"🗡️", desc:"Bordado 3D oficial Tanjiro — snap back",        stock:22, tags:["anime","acessório"], image:null },
    ],
  },
  {
    id:    "top",
    x:     7,
    y:     15,
    r:     3,
    name:  "HALL DA FAMA",
    sub:   "Os mais amados da galera",
    color: N.green,
    glyph: "👑",
    items: [
      { name:"Camiseta Zelda TOTK", price:219.90, old:null, badge:"#1", emoji:"🗡️", desc:"Arte exclusiva Tears of Kingdom — oversize", stock:9,  tags:["games","nintendo"], image:null },
      { name:"Moletom Among Us",    price:259.90, old:null, badge:"#2", emoji:"🚀", desc:"Impostor Edition — cores vibrantes",          stock:11, tags:["games","meme"],    image:null },
      { name:"Camiseta Minecraft",  price:149.90, old:null, badge:"#3", emoji:"⛏️", desc:"Creeper oversize — impressão em todo tecido", stock:18, tags:["games","kids"],    image:null },
      { name:"Conjunto Evangelion", price:399.90, old:null, badge:"#4", emoji:"🤖", desc:"Rei x Asuka collab dupla — kit numerado",    stock:4,  tags:["anime","collab"],  image:null },
    ],
  },
  {
    id:    "vip",
    x:     20,
    y:     15,
    r:     3,
    name:  "BAÚS DO DUNGEON",
    sub:   "Tesouros e cupons VIP",
    color: N.yellow,
    glyph: "💎",
    items: [
      { name:"Cupom GEEK20",      price:0, old:null, badge:"20% OFF", emoji:"🎟️", desc:"20% em toda a loja — válido por 7 dias",  stock:99, tags:["cupom","vip"],     image:null },
      { name:"Frete Grátis VIP",  price:0, old:null, badge:"GRÁTIS",  emoji:"📦", desc:"Frete grátis em compras acima de R$200", stock:99, tags:["frete","vip"],     image:null },
      { name:"Acesso Early Drop", price:0, old:null, badge:"VIP",     emoji:"👑", desc:"Novidades 48h antes de todo mundo",       stock:50, tags:["exclusivo","vip"], image:null },
      { name:"Brinde Misterioso", price:0, old:null, badge:"GIFT",    emoji:"🎁", desc:"Surpresa em compras acima de R$350",     stock:30, tags:["gift","surpresa"], image:null },
    ],
  },
];
