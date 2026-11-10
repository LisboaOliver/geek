// Gera o site em dist/: a página única (pagina.html) com o devlog preenchido a partir de posts/*.md.
// Corre com: npm run build   (a Vercel corre isto sozinha a cada envio para o GitHub)
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const RAIZ = path.join(__dirname, '..');
const DIST = path.join(RAIZ, 'dist');
const POSTS = path.join(RAIZ, 'posts');
const SITE = 'https://geekonpage.vercel.app';

// Copiado tal como está (o jogo da Ilha usa store.html, css/, js/ e assests/)
const COPIAR = ['assets', 'assests', 'css', 'js', 'store.html', 'privacypolicy.html', 'licencas'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const dataBonita = d => { const [a, m, dia] = d.split('-'); return `${+dia} ${MESES[+m - 1]} ${a}`; };
// imagens em posts/img: "img/x.webp" passa a "posts/img/x.webp" (a página fica na raiz)
const caminho = src => /^(https?:|\/|assets\/|posts\/)/.test(src) ? src : 'posts/' + src.replace(/^\.\//, '');

function lerPost(ficheiro) {
  const bruto = fs.readFileSync(path.join(POSTS, ficheiro), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = bruto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${ficheiro}: falta o cabeçalho entre --- e ---`);
  const dados = {};
  for (const linha of m[1].split('\n')) {
    const i = linha.indexOf(':');
    if (i > 0) dados[linha.slice(0, i).trim()] = linha.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  for (const campo of ['titulo', 'data', 'projeto']) if (!dados[campo]) throw new Error(`${ficheiro}: falta "${campo}:" no cabeçalho`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) throw new Error(`${ficheiro}: a data tem de ser AAAA-MM-DD (ex.: 2026-11-10)`);
  const slug = ficheiro.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const html = marked.parse(m[2]).replace(/(<img[^>]*?\ssrc=")([^"]+)"/g, (_, a, src) => `${a}${caminho(src)}" loading="lazy"`);
  return { ...dados, slug, html, rascunho: dados.rascunho === 'sim' };
}

const posts = fs.readdirSync(POSTS)
  .filter(f => f.endsWith('.md') && !f.startsWith('_'))
  .map(lerPost).filter(p => !p.rascunho)
  .sort((a, b) => b.data.localeCompare(a.data) || a.titulo.localeCompare(b.titulo));
const vistos = new Set();
for (const p of posts) { if (vistos.has(p.slug)) throw new Error(`Há duas entradas com o mesmo nome: ${p.slug}`); vistos.add(p.slug); }
const projetos = [...new Set(posts.map(p => p.projeto))];

const entradas = posts.length ? posts.map(p => `<li data-projeto="${esc(p.projeto)}"><details class="entrada" id="log-${p.slug}">
        <summary><time datetime="${p.data}">${dataBonita(p.data)}</time><h3>${esc(p.titulo)}</h3><span class="etiqueta">${esc(p.projeto)}</span><span class="mais" aria-hidden="true">+</span></summary>
        <div class="entrada__corpo"><div class="texto">
          ${p.resumo ? `<p class="resumo">${esc(p.resumo)}</p>` : ''}
          ${p.capa ? `<img src="${esc(caminho(p.capa))}" alt="${esc(p.capa_texto || '')}" loading="lazy">` : ''}
          ${p.html}
        </div></div>
      </details></li>`).join('\n      ') : '<li class="vazio">Ainda não há entradas no devlog.</li>';

const filtros = projetos.length > 1 ? `<fieldset class="filtros" data-filtros hidden><legend>Filtrar por projeto</legend>
      <button type="button" aria-pressed="true" data-projeto="">Todos</button>${projetos.map(p => `<button type="button" aria-pressed="false" data-projeto="${esc(p)}">${esc(p)}</button>`).join('')}
    </fieldset>` : '';

let pagina = fs.readFileSync(path.join(RAIZ, 'pagina.html'), 'utf8');
for (const marca of ['<!-- DEVLOG -->', '<!-- FILTROS -->']) if (!pagina.includes(marca)) throw new Error(`pagina.html: falta a marca ${marca}`);
pagina = pagina.replace('<!-- DEVLOG -->', entradas).replace('<!-- FILTROS -->', filtros);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const item of COPIAR) if (fs.existsSync(path.join(RAIZ, item))) fs.cpSync(path.join(RAIZ, item), path.join(DIST, item), { recursive: true });
if (fs.existsSync(path.join(POSTS, 'img'))) fs.cpSync(path.join(POSTS, 'img'), path.join(DIST, 'posts', 'img'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), pagina);

// ---------- Ilha: bibliotecas locais e ui.js sem JSX ----------
const VENDOR = {
  'react.production.min.js': 'react/umd/react.production.min.js',
  'react-dom.production.min.js': 'react-dom/umd/react-dom.production.min.js',
  'supabase.js': '@supabase/supabase-js/dist/umd/supabase.js',
};
fs.mkdirSync(path.join(DIST, 'assets', 'vendor'), { recursive: true });
for (const [nome, origem] of Object.entries(VENDOR)) fs.copyFileSync(path.join(RAIZ, 'node_modules', origem), path.join(DIST, 'assets', 'vendor', nome));
const ui = require('esbuild').transformSync(fs.readFileSync(path.join(RAIZ, 'js', 'ui.js'), 'utf8'), { loader: 'jsx', jsx: 'transform', target: 'es2019', sourcefile: 'ui.js' });
fs.writeFileSync(path.join(DIST, 'js', 'ui.js'), '// Gerado a partir de js/ui.js pelo build (JSX convertido). Edita o original, não este.\n' + ui.code);

fs.writeFileSync(path.join(DIST, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Geekonverse · Devlog</title><link>${SITE}/</link><description>O que mudou nos projetos do Geekonverse</description><language>pt-PT</language>
${posts.map(p => `<item><title>${esc(p.titulo)}</title><link>${SITE}/#devlog/${p.slug}</link><guid>${SITE}/#devlog/${p.slug}</guid><pubDate>${new Date(p.data + 'T12:00:00Z').toUTCString()}</pubDate><category>${esc(p.projeto)}</category><description>${esc(p.resumo || '')}</description></item>`).join('\n')}
</channel></rss>
`);
console.log(`Site gerado em dist/: ${posts.length} entradas no devlog, ${projetos.length} projetos.`);
