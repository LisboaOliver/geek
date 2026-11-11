# Geekonverse

Canal de um desenvolvedor de jogos: uma só página com os projetos (Grafite City, Ilha Geekonverse,
Faísca, sites), o devlog, os canais e o contacto. A Ilha joga-se por cima da página.
Publicado no Cloudflare Pages: https://geekonverse.pages.dev (ligado ao GitHub: cada envio publica sozinho).

## Publicar uma entrada no devlog

1. Em `posts/`, copia `_modelo.md` e dá-lhe o nome `AAAA-MM-DD-nome-curto.md`.
2. Preenche o cabeçalho entre os dois `---`:
   - `titulo`, `data` (AAAA-MM-DD) e `projeto` são obrigatórios;
   - `resumo`, `capa` e `capa_texto` são opcionais;
   - enquanto houver `rascunho: sim`, a entrada não aparece. Apaga essa linha para publicar.
3. Escreve o texto por baixo, em Markdown. Imagens em `posts/img/` (no texto: `img/nome.webp`).
4. Corre `npm test` e, se passar, envia para o GitHub. O Cloudflare gera e publica sozinho em 1 a 2 minutos.

Escreve o nome do projeto sempre igual (`Grafite City`, `Ilha Geekonverse`, `Geekonverse`...):
é ele que cria os filtros. Cada entrada tem ligação direta: `/#devlog/nome-curto`.

## Ver no computador

Precisa do Node.js.

```bash
npm install        # só na primeira vez
npm run ver        # gera o site e abre-o em http://localhost:4173
```

## Teste de regressão (antes de cada entrega)

```bash
npx playwright install chromium   # só na primeira vez
npm test                          # gera o site e testa no computador e no telemóvel
```

Verifica que a página abre sem erros, que nenhum ficheiro falta, que não há scroll para o lado,
que o menu, o devlog (entradas, links diretos e filtros), o RSS e o formulário funcionam, e que os
ficheiros da Ilha continuam iguais ao original. Deixa capturas da página em `tests/capturas/` para
olhares. Se um teste falhar, a mensagem diz qual e porquê; não publiques até passar.

## Estrutura

```
pagina.html          a página única (o devlog entra no lugar de <!-- DEVLOG -->)
assets/css/site.css  visual
assets/js/main.js    animações (GSAP, ScrollTrigger, SplitText, Lenis: locais em assets/js)
assets/img/          imagens e o vídeo do Grafite City
posts/               devlog (.md) e imagens (posts/img/)
scripts/construir.js gera dist/: index.html e feed.xml
scripts/servir.js    servidor local para ver dist/ (npm run ver)
tests/               teste de regressão (npm test)
store.html           a Ilha Geekonverse (jogo antigo, sem alterações)
css/, js/, assests/  ficheiros do jogo da Ilha
supabase/            contas, pontos e pagamentos da Ilha (ver GUIA.md)
licencas/            licenças das fontes (OFL), GSAP e Lenis (MIT)
```

## A Ilha (jogo)

A Ilha Geekonverse fica como estava: `store.html` com os ficheiros em `css/`, `js/` e `assests/`.
A página principal só liga para ela. O jogo vai ter um site próprio; até lá, não mexer nestes ficheiros
(o teste de regressão confirma que continuam iguais).

## Cloudflare Pages (configuração do projeto)

- Build command: `npm run build`
- Build output directory: `dist`
- Versão do Node: a do ficheiro `.node-version`
- Variável opcional `SITE_URL` (ex.: o domínio próprio, quando houver)
- Redirecionamentos dos endereços antigos: gerados em `dist/_redirects`

Ao mudar de endereço, atualiza também no Supabase o Site URL e o endereço de regresso
(`.../store.html`), como explica `supabase/GUIA.md`.
