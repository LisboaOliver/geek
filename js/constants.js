// ─────────────────────────────────────────────────────────────────────────────
// constants.js
// Configuração do jogo da loja: paleta, edifícios da ilha, monstros, saque
// e PRODUTOS. Para mudar produtos ou preços, edite PRODUCTS mais abaixo.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ── Isometria ─────────────────────────────────────────────────────────────────
const TW = 64;          // largura de um losango (tile) em px
const TH = 32;          // altura de um losango em px
const WALL_H = 38;      // altura das paredes da masmorra

// ── Paleta (masmorra sombria + rosa Geekonverse) ──────────────────────────────
const N = {
  bg:       "#07060a",
  panel:    "#120e12",
  panelB:   "#1c161b",
  border:   "#3a2c2a",
  gold:     "#d8a94a",
  goldDim:  "#8a6a2e",
  blood:    "#b3202c",
  magenta:  "#e0379a",
  pink:     "#ff7ac8",
  text:     "#efe3cf",
  textDim:  "#a3968a",
  magic:    "#6f8cff",
  rare:     "#f2d24b",
  unique:   "#d0843c",
  green:    "#5ec46a",
  sea:      "#0b2a3a",
  seaLight: "#14465c",
  grass:    "#33452a",
  grass2:   "#2c3c24",
  dirt:     "#5a4630",
  stone:    "#2a2626",
  stone2:   "#232020",
  wall:     "#3b3330",
  wallTop:  "#4d4340",
};

// ── Raridades do saque (estilo Diablo) ────────────────────────────────────────
// chance: probabilidade relativa · gold/crystals: [mín, máx] antes do bónus de andar
const RARITIES = [
  { id: "comum",  label: "Moedas de Ouro",   color: "#e8e1d0", chance: 68, gold: [4, 9],   crystals: [0, 0] },
  { id: "magico", label: "Bolsa Encantada",  color: N.magic,   chance: 22, gold: [12, 22], crystals: [0, 0] },
  { id: "raro",   label: "Cristal Raro",     color: N.rare,    chance: 8,  gold: [6, 12],  crystals: [1, 2] },
  { id: "unico",  label: "Relíquia Única",   color: N.unique,  chance: 2,  gold: [30, 50], crystals: [3, 5] },
];

// ── Monstros ──────────────────────────────────────────────────────────────────
// hp/dmg/speed são valores do andar 1; crescem com a profundidade.
const MONSTERS = {
  glitch:   { name: "Fio Errante",       hp: 10, dmg: 3, speed: 2.6, range: 0.9, cd: 55, color: "#7fd8e8", size: 0.8 },
  skeleton: { name: "Andarilho",         hp: 18, dmg: 5, speed: 1.9, range: 1.0, cd: 70, color: "#d9cfb8", size: 1.0 },
  demon:    { name: "Massa Sussurrante", hp: 34, dmg: 8, speed: 1.5, range: 1.1, cd: 85, color: "#c2337f", size: 1.1 },
  boss:     { name: "Senhor do Lag",     hp: 140, dmg: 13, speed: 1.6, range: 1.4, cd: 75, color: "#ff3048", size: 1.7 },
};
const BOSS_EVERY = 5; // um boss a cada N andares

// ── Herói ─────────────────────────────────────────────────────────────────────
const HERO = {
  speed: 3.6,        // tiles por segundo
  baseHp: 50,
  baseDmg: [4, 7],
  attackRange: 1.7,       // alcance do jato de spray
  attackCd: 32,      // frames entre ataques
  baseLight: 4.2,    // raio de luz na masmorra (tiles)
};

// ── Edifícios da ilha ─────────────────────────────────────────────────────────
// tx/ty: canto do edifício na grelha da ilha · w/h: tamanho em tiles
// upgrade: o que cada nível melhora (null = não evolui)
const MAX_LEVEL = 5;
const BUILDINGS = [
  { id: "mercado", name: "Mercado",            glyph: "🛒", tx: 5,  ty: 5,  w: 3, h: 2, color: "#e0379a", roof: "#8c1f5e",
    desc: "As peças da Geekonverse. Aqui fazes compras.", upgrade: null },
  { id: "quests",  name: "Quadro de Quests",   glyph: "📜", tx: 12, ty: 6,  w: 1, h: 1, color: "#d8a94a", roof: "#6b4a1e",
    desc: "Eventos com dia e hora marcados.", upgrade: null },
  { id: "forja",   name: "Forja",              glyph: "⚒️", tx: 3,  ty: 10, w: 2, h: 2, color: "#d0843c", roof: "#5a2f17",
    desc: "Mais dano em cada golpe.", upgrade: { stat: "dano", per: 3, unit: "de dano" } },
  { id: "altar",   name: "Altar de Sangue",    glyph: "🩸", tx: 15, ty: 9,  w: 2, h: 2, color: "#b3202c", roof: "#4a0d14",
    desc: "Mais vida máxima.", upgrade: { stat: "vida", per: 15, unit: "de vida" } },
  { id: "farol",   name: "Farol",              glyph: "🔦", tx: 13, ty: 3,  w: 1, h: 1, color: "#f2d24b", roof: "#6b5a12",
    desc: "A tua luz vai mais longe na masmorra.", upgrade: { stat: "luz", per: 0.8, unit: "de raio de luz" } },
  { id: "cofre",   name: "Cofre",              glyph: "💰", tx: 7,  ty: 11, w: 2, h: 1, color: "#6f8cff", roof: "#25306b",
    desc: "Mais ouro por monstro e perdes menos ao morrer.", upgrade: { stat: "ouro", per: 10, unit: "% de ouro" } },
  { id: "portal",  name: "Portal da Masmorra", glyph: "🌀", tx: 9,  ty: 8,  w: 2, h: 2, color: "#9b5cff", roof: "#2b1a4a",
    desc: "Desce às masmorras para juntar ouro e cristais.", upgrade: null },
];

/** Custo para subir um edifício do nível `lvl` para `lvl+1`. */
function upgradeCost(lvl) {
  return {
    gold:     Math.round(40 * Math.pow(1.85, lvl)),
    crystals: lvl >= 1 ? lvl * 2 : 0,
  };
}

// ── Grelha da ilha ────────────────────────────────────────────────────────────
// 0 = mar · 1 = relva · 2 = caminho de terra · 3 = areia (margem)
const ISLAND_SIZE = 20;
const ISLAND_START = { x: 10.5, y: 13.5 };
const ISLAND_HUB = { x: 10, y: 13 };

// ── Loja ──────────────────────────────────────────────────────────────────────
const CURRENCY = "€";
// ⚠️ Estes valores são só para mostrar na loja. Os valores que contam no
// pagamento estão no servidor (supabase/functions/checkout/index.ts).
const FREE_SHIPPING_FROM = 50;                 // € — envio grátis a partir deste subtotal
const SHIPPING = { PT: 4.9, ES: 7.9 };          // € por país
const SHIPPING_COST = SHIPPING.PT;              // (compatibilidade)
const POINTS_CENT_VALUE = 5;                    // 1 ponto = 5 cêntimos (100 pontos = 5 €)
const POINTS_MAX_SHARE = 0.20;                  // desconto máximo com pontos: 20% do subtotal

// 👉 EDITE AQUI OS PRODUTOS
// Campos:
//   id (igual ao da tabela products no Supabase), name, price (€), old (preço antigo ou null), badge, emoji, desc, stock, tags
//   image     — (opcional) caminho de uma imagem, ex: "assests/produtos/camiseta.png"
//   official  — true = peça própria Geekonverse (vai ao carrinho, envio manual)
//   external  — para peças da TeePublic ou Redbubble: { platform: "TeePublic", url: "https://..." }
//               (estas abrem a página da plataforma, não entram no carrinho)
const PRODUCTS = [
  { id: "one-piece-especial", name: "Camiseta One Piece Ed. Especial", price: 34.90, old: null,  badge: "NOVO",   emoji: "🏴‍☠️", desc: "Edição limitada em silk premium, 100% algodão.",   stock: 12, tags: ["anime", "manga"],  official: true },
  { id: "moletom-attack-on-titan", name: "Moletom Attack on Titan",         price: 49.90, old: null,  badge: "DROP",   emoji: "⚔️",  desc: "Survey Corps, algodão 380g com capuz duplo.",     stock: 8,  tags: ["anime"],           official: true },
  { id: "hoodie-cyberpunk", name: "Hoodie Cyberpunk",                price: 54.90, old: null,  badge: "RARO",   emoji: "🤖",  desc: "Arte de Night City, peça exclusiva.",           stock: 5,  tags: ["games", "neon"],   official: true },
  { id: "camiseta-ghibli", name: "Camiseta Studio Ghibli",          price: 29.90, old: null,  badge: "NOVO",   emoji: "🌿",  desc: "Totoro em impressão DTF de toque aveludado.",    stock: 20, tags: ["anime", "kawaii"], official: true },
  { id: "camiseta-dragon-ball", name: "Camiseta Dragon Ball",            price: 19.90, old: 27.90, badge: "-29%",   emoji: "🐉",  desc: "Goku Ultra Instinct em silk plastisol.",          stock: 15, tags: ["anime", "clássico"], official: true },
  { id: "bone-demon-slayer", name: "Boné Demon Slayer",               price: 14.90, old: 19.90, badge: "-25%",   emoji: "🗡️",  desc: "Bordado 3D do Tanjiro, snapback.",               stock: 22, tags: ["anime", "acessório"], official: true },
  { id: "camiseta-zelda", name: "Camiseta Zelda",                  price: 32.90, old: null,  badge: "#1",     emoji: "🛡️",  desc: "Arte exclusiva, corte oversize.",                stock: 9,  tags: ["games"],           official: true },
  { id: "conjunto-evangelion", name: "Conjunto Evangelion",             price: 69.90, old: null,  badge: "ÚNICO",  emoji: "🦾",  desc: "Kit numerado, edição de colecionador.",          stock: 4,  tags: ["anime", "collab"], official: true },
  // Exemplos de peças externas — troque os URLs pelos das suas páginas:
  { id: "ext-teepublic", name: "Coleção Geekonverse na TeePublic", price: null, old: null, badge: "TEEPUBLIC", emoji: "👕", desc: "Designs Geekonverse impressos e enviados pela TeePublic.", stock: null, tags: ["externo"],
    external: { platform: "TeePublic", url: "https://www.teepublic.com/" } },
  { id: "ext-redbubble", name: "Coleção Geekonverse na Redbubble", price: null, old: null, badge: "REDBUBBLE", emoji: "🎨", desc: "Autocolantes, posters e mais, enviados pela Redbubble.", stock: null, tags: ["externo"],
    external: { platform: "Redbubble", url: "https://www.redbubble.com/" } },
];

// ── Gravação local ────────────────────────────────────────────────────────────
const SAVE_KEY = "geekonverse-ilha-v1";
