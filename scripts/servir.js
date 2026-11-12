// Servidor mínimo para ver dist/ no computador e para os testes: node scripts/servir.js [porta]
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const PORTA = +process.argv[2] || 4173;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

// Cabeçalhos de segurança: lê o ficheiro _headers como o Cloudflare Pages o lê,
// para os testes verem os mesmos cabeçalhos que o site tem no ar.
function lerCabecalhos(pasta) {
  const f = path.join(pasta, '_headers');
  if (!fs.existsSync(f)) return [];
  const regras = [];
  for (const linha of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!linha.trim() || linha.trim().startsWith('#')) continue;
    if (!/^\s/.test(linha)) { regras.push({ padrao: linha.trim(), poe: [], tira: [] }); continue; }
    const r = regras[regras.length - 1], t = linha.trim();
    if (t.startsWith('!')) r.tira.push(t.slice(1).trim().toLowerCase());
    else { const i = t.indexOf(':'); r.poe.push([t.slice(0, i).trim(), t.slice(i + 1).trim()]); }
  }
  return regras;
}
function cabecalhosPara(regras, caminho) {
  const out = {};
  for (const r of regras) {
    const re = new RegExp('^' + r.padrao.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    if (!re.test(caminho)) continue;
    for (const [n, v] of r.poe) { const k = n.toLowerCase(); out[k] = out[k] ? [out[k][0], out[k][1] + ', ' + v] : [n, v]; }
    for (const k of r.tira) delete out[k];
  }
  return Object.fromEntries(Object.values(out));
}
const REGRAS = lerCabecalhos(DIST);

http.createServer((req, res) => {
  const pedido = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let p = pedido;
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { ...cabecalhosPara(REGRAS, pedido), 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORTA, () => console.log(`A servir dist/ em http://localhost:${PORTA}`));
