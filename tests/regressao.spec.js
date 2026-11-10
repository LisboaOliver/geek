// Teste de regressão do site do Geekonverse.
// Corre antes de cada entrega: npm test
// Se algo que funcionava deixar de funcionar, um destes testes falha e diz qual.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..');
const lerPost = f => fs.readFileSync(path.join(RAIZ, 'posts', f), 'utf8');
const publicados = fs.readdirSync(path.join(RAIZ, 'posts'))
  .filter(f => f.endsWith('.md') && !f.startsWith('_'))
  .filter(f => !/^rascunho:\s*sim\s*$/m.test(lerPost(f)));
const slug = f => f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Junta os erros da página. Falhas de serviços externos (Google Fonts, Twitch...) não contam:
// o teste é sobre o nosso código e os nossos ficheiros.
function vigiar(page) {
  const erros = [];
  page.on('pageerror', e => erros.push('JS: ' + e.message));
  page.on('response', r => { if (r.url().startsWith('http://localhost') && r.status() >= 400) erros.push(`${r.status()}: ${r.url()}`); });
  return erros;
}

// Todos os ficheiros locais referidos na página (imagens, vídeos, estilos, scripts, links) têm de existir.
async function ficheirosLocais(page) {
  return page.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll('[src],[href],[poster],[data-src]').forEach(el => {
      for (const at of ['src', 'href', 'poster', 'data-src']) {
        const v = el.getAttribute(at);
        if (!v || /^(https?:|mailto:|tel:|#|data:|javascript:)/.test(v)) continue;
        urls.add(new URL(v, location.href).href.split('#')[0]);
      }
    });
    return [...urls];
  });
}

test.describe('Página principal', () => {
  test('abre sem erros de JavaScript nem ficheiros em falta', async ({ page }) => {
    const erros = vigiar(page);
    await page.goto('/');
    await page.waitForTimeout(3500); // deixa terminar a abertura animada
    await page.mouse.wheel(0, 20000); // rola até ao fim, para carregar o que é preguiçoso
    await page.waitForTimeout(1500);
    expect(erros).toEqual([]);
  });

  test('todos os ficheiros locais existem', async ({ page, request }) => {
    await page.goto('/');
    const falhas = [];
    for (const url of await ficheirosLocais(page)) {
      const r = await request.get(url);
      if (!r.ok()) falhas.push(`${r.status()} ${url}`);
    }
    expect(falhas).toEqual([]);
  });

  test('não há scroll para o lado', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3500);
    for (const y of [0, 1500, 4000, 8000, 20000]) {
      await page.evaluate(v => window.scrollTo(0, v), y);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  });

  test('os links do menu levam a secções que existem', async ({ page }) => {
    await page.goto('/');
    const alvos = await page.$$eval('a[href^="#"]', as => as.map(a => a.getAttribute('href')).filter(h => h.length > 1 && !h.startsWith('#devlog/')));
    for (const a of alvos) expect(await page.locator(a).count(), `secção ${a}`).toBe(1);
  });

  test('o título e as secções principais estão lá', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    for (const id of ['#projetos', '#devlog', '#canais', '#contacto']) await expect(page.locator(id)).toHaveCount(1);
  });
});

test.describe('Projetos', () => {
  test('estão os quatro projetos e a Ilha liga para o jogo antigo', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.painel:not(.painel--intro)')).toHaveCount(4);
    for (const nome of ['Grafite City', 'Ilha Geekonverse', 'Assistente virtual', 'Sites com movimento']) {
      await expect(page.locator('.info h3', { hasText: nome })).toHaveCount(1);
    }
    const ilha = page.locator('.painel--ilha');
    expect(await ilha.locator('a[href="store.html"]').count()).toBeGreaterThan(0);
    await expect(page.locator('.hero a[href="store.html"]')).toHaveCount(1);
  });
});

test.describe('Devlog', () => {
  test('tem uma entrada por cada post publicado', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-registo] > li')).toHaveCount(publicados.length);
  });

  test('o link «Ler a apresentação» do Grafite City abre a entrada', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const erros = vigiar(page);
    await page.goto('/');
    const link = page.locator('.painel--grafite a[href^="#devlog/"]');
    const alvo = (await link.getAttribute('href')).replace('#devlog/', 'log-');
    await link.click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(id => document.getElementById(id)?.open, alvo)).toBe(true);
    expect(erros).toEqual([]);
  });

  test('cada entrada abre pelo seu endereço (#devlog/nome)', async ({ page }) => {
    for (const f of publicados) {
      const s = slug(f);
      await page.goto('/#devlog/' + s);
      await page.waitForTimeout(3800);
      expect(await page.evaluate(id => document.getElementById(id)?.open, 'log-' + s), s).toBe(true);
    }
  });

  test('o filtro mostra só o projeto escolhido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const botoes = page.locator('[data-filtros] button[data-projeto]:not([data-projeto=""])');
    const n = await botoes.count();
    test.skip(n < 2, 'só há um projeto no devlog');
    for (let i = 0; i < n; i++) {
      const b = botoes.nth(i), proj = await b.getAttribute('data-projeto');
      await b.click();
      const visiveis = await page.$$eval('[data-registo] > li', (lis) => lis.filter(l => !l.hidden).map(l => l.dataset.projeto));
      expect(visiveis.length).toBeGreaterThan(0);
      expect(new Set(visiveis)).toEqual(new Set([proj]));
    }
    await page.locator('[data-filtros] button[data-projeto=""]').click();
    await expect(page.locator('[data-registo] > li:not([hidden])')).toHaveCount(publicados.length);
  });

  test('o feed RSS tem uma entrada por post', async ({ request }) => {
    const r = await request.get('/feed.xml');
    expect(r.ok()).toBe(true);
    expect(((await r.text()).match(/<item>/g) || []).length).toBe(publicados.length);
  });
});

test.describe('Contacto', () => {
  test('o formulário tem os campos e a chave do Web3Forms', async ({ page }) => {
    await page.goto('/');
    const f = page.locator('#contactForm');
    for (const nome of ['name', 'email', 'message']) await expect(f.locator(`[name="${nome}"][required]`)).toHaveCount(1);
    expect(await f.locator('[name="access_key"]').getAttribute('value')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

test.describe('Ilha Geekonverse (jogo antigo)', () => {
  test('os ficheiros do jogo estão iguais ao original', async ({}, info) => {
    test.skip(info.project.name !== 'computador', 'basta verificar uma vez');
    const original = JSON.parse(fs.readFileSync(path.join(__dirname, 'ilha-original.json'), 'utf8'));
    const mudados = Object.entries(original).filter(([f, h]) =>
      !fs.existsSync(path.join(RAIZ, f)) || crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, f))).digest('hex') !== h);
    expect(mudados.map(([f]) => f), 'se mudaste o jogo de propósito: node scripts/fixar-ilha.js').toEqual([]);
  });

  test('store.html abre e os ficheiros locais do jogo existem', async ({ page, request }) => {
    const erros = [];
    page.on('response', r => { if (r.url().startsWith('http://localhost') && r.status() >= 400) erros.push(`${r.status()}: ${r.url()}`); });
    await page.goto('/store.html');
    const falhas = [];
    for (const url of await ficheirosLocais(page)) {
      if (/\.html$/.test(url)) continue; // as ligações do menu antigo são redirecionadas pela Vercel
      const r = await request.get(url);
      if (!r.ok()) falhas.push(`${r.status()} ${url}`);
    }
    expect([...erros, ...falhas]).toEqual([]);
  });
});

test.describe('Revisão visual', () => {
  test('guarda capturas da página inteira em tests/capturas', async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    // passa pela página toda para as imagens "preguiçosas" carregarem antes da captura
    for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += 600) {
      await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(80);
    }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
    fs.mkdirSync(path.join(__dirname, 'capturas'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, 'capturas', `${info.project.name}.png`), fullPage: true });
  });
});
