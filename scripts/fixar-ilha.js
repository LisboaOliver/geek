// Regista a "impressão digital" dos ficheiros do jogo antigo (a Ilha).
// O teste de regressão falha se algum mudar sem querermos.
// Só corre isto quando mudares o jogo de propósito: node scripts/fixar-ilha.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');
const lista = ['store.html', 'css/style.css', 'css/store.css', ...fs.readdirSync(path.join(RAIZ, 'js')).map(f => 'js/' + f)];
const hashes = Object.fromEntries(lista.sort().map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, f))).digest('hex')]));
fs.writeFileSync(path.join(RAIZ, 'tests', 'ilha-original.json'), JSON.stringify(hashes, null, 2) + '\n');
console.log(`${lista.length} ficheiros do jogo registados em tests/ilha-original.json`);
