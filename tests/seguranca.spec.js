// Teste de segurança: os cabeçalhos do _headers chegam ao navegador e não bloqueiam nada do site.
// Corre com o resto: npm test
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PAGINAS = ['/', '/privacypolicy.html'];

const ESPERADOS = {
  'strict-transport-security': /max-age=\d{7,}/,
  'x-content-type-options': /^nosniff$/,
  'x-frame-options': /^DENY$/,
  'referrer-policy': /^strict-origin-when-cross-origin$/,
  'permissions-policy': /camera=\(\).*microphone=\(\).*geolocation=\(\)/,
  'content-security-policy': /default-src 'self'.*object-src 'none'.*frame-ancestors 'none'/,
};

// Junta as violações da política de segurança que a página reportar
async function vigiarCSP(page) {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} bloqueou ${e.blockedURI || 'código em linha'}`));
  });
}

test.describe('Segurança', () => {
  for (const pagina of PAGINAS) {
    test(`${pagina} tem os cabeçalhos de segurança`, async ({ request }) => {
      const r = await request.get(pagina);
      expect(r.status()).toBe(200);
      const h = r.headers();
      for (const [nome, re] of Object.entries(ESPERADOS)) expect(h[nome], nome).toMatch(re);
      // nada de 'unsafe-inline' nem 'unsafe-eval' nos scripts
      expect(h['content-security-policy']).not.toMatch(/script-src[^;]*unsafe/);
    });

    test(`${pagina} funciona com a política de segurança ligada`, async ({ page }) => {
      await vigiarCSP(page);
      await page.goto(pagina);
      await page.waitForTimeout(1200);
      for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(100); }
      await page.waitForTimeout(800);
      // o leitor da Twitch tem de poder abrir
      const live = page.locator('[data-ver-live]');
      if (await live.count()) { await live.scrollIntoViewIfNeeded(); await live.click(); await page.waitForTimeout(800); }
      expect(await page.evaluate(() => window.__csp)).toEqual([]);
    });
  }

  test('a loja da Ilha fica como estava: cabeçalhos básicos, sem a política que a partiria', async ({ request }) => {
    const h = (await request.get('/store.html')).headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['content-security-policy']).toBeUndefined();
  });

  test('o _headers vai para o ar com o site', async () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'dist', '_headers'))).toBe(true);
  });
});
