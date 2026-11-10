// Teste de regressão: npm test (gera o site e verifica-o no computador e no telemóvel).
// Na primeira vez, instala o navegador dos testes: npx playwright install chromium
const { defineConfig, devices } = require('@playwright/test');
const navegador = process.env.CHROME_PATH ? { launchOptions: { executablePath: process.env.CHROME_PATH } } : {};
module.exports = defineConfig({
  testDir: 'tests',
  timeout: 60000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', ...navegador },
  webServer: { command: 'node scripts/servir.js 4173', url: 'http://localhost:4173', reuseExistingServer: true },
  projects: [
    { name: 'computador', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'telemovel', use: { ...devices['Pixel 7'], ...navegador } },
  ],
});
