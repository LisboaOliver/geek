# Geekonverse

Canal de um desenvolvedor de jogos: uma só página com os projetos (Grafite City, Ilha Geekonverse,
assistente virtual, sites), o devlog, os canais e o contacto. A Ilha joga-se por cima da página.
Em produção em https://geekonpage.vercel.app

## Publicar uma entrada no devlog

1. Em `posts/`, copia `_modelo.md` e dá-lhe o nome `AAAA-MM-DD-nome-curto.md`.
2. Preenche o cabeçalho entre os dois `---`:
   - `titulo`, `data` (AAAA-MM-DD) e `projeto` são obrigatórios;
   - `resumo`, `capa` e `capa_texto` são opcionais;
   - enquanto houver `rascunho: sim`, a entrada não aparece. Apaga essa linha para publicar.
3. Escreve o texto por baixo, em Markdown. Imagens em `posts/img/` (no texto: `img/nome.webp`).
4. Envia para o GitHub (`main`). A Vercel gera e publica sozinha em 1 a 2 minutos.

Escreve o nome do projeto sempre igual (`Grafite City`, `Ilha Geekonverse`, `Geekonverse`...):
é ele que cria os filtros. Cada entrada tem ligação direta: `/#devlog/nome-curto`.

## Ver no computador

Precisa do Node.js.

```bash
npm install        # só na primeira vez
npm run build      # gera o site em dist/
npx serve dist     # abre http://localhost:3000
```

## Estrutura

```
pagina.html          a página única (o devlog entra no lugar de <!-- DEVLOG -->)
assets/css/site.css  visual
assets/js/main.js    animações (GSAP, ScrollTrigger, SplitText, Lenis: locais em assets/js)
assets/img/          imagens e o vídeo do Grafite City
posts/               devlog (.md) e imagens (posts/img/)
scripts/construir.js gera dist/: index.html e feed.xml
assets/js/ilha-flutuante.js  a Ilha numa janela flutuante na página (só carrega o jogo quando se abre)
store.html           a Ilha Geekonverse na página própria
css/, js/, assests/  ficheiros do jogo da Ilha
supabase/            contas, pontos e pagamentos da Ilha (ver GUIA.md)
licencas/            licenças das fontes (OFL), GSAP e Lenis (MIT)
```

## A Ilha (jogo)

- O motor está em `js/game.js` e companhia (JavaScript simples); a interface em `js/ui.js` (React, com JSX).
- O build converte o JSX do `ui.js` em JavaScript normal e copia o React, o ReactDOM e o Supabase
  para `assets/vendor/`. Não há Babel no navegador nem bibliotecas vindas de CDNs.
- Por isso, para ver o jogo no computador, usa sempre `npm run build` e abre a versão em `dist/`.
- Na janela flutuante o teclado só mexe o herói quando o jogo tem o foco (clica no jogo).

## Por preencher

- Assistente virtual: nome, o que faz e com que tecnologia (`pagina.html`, procurar `data-a-preencher`).
