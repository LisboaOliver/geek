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
store.html           a Ilha Geekonverse. Com ?embed=1 aparece sem menu (é assim que abre na página)
css/, js/, assests/  ficheiros do jogo da Ilha
supabase/            contas, pontos e pagamentos da Ilha (ver GUIA.md)
licencas/            licenças das fontes (OFL), GSAP e Lenis (MIT)
```

## Por preencher

- Assistente virtual: nome, o que faz e com que tecnologia (`pagina.html`, procurar `data-a-preencher`).
