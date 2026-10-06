
[README.md](https://github.com/user-attachments/files/19932235/README.md)
# Geekonverse

Geekonverse é um projeto focado em conectar e expandir a comunidade geek e da cultura pop.
Este website oferece uma plataforma interativa com efeitos dinâmicos de neon, design responsivo e navegação simples.

## Estrutura do Projeto

```
/ (raiz)
├── index.html
├── about.html
├── /assets
│    └── imagens, gifs
├── /css
│    └── style.css
├── /js
│    └── script.js
      └── game.js
└── README.md
```

## Funcionalidades

- Animações de fundo em neon dinâmicas (canvas + JavaScript)
- Efeitos interativos com o movimento do mouse
- Footer fixo e responsivo
- Layout adaptável para dispositivos móveis
- Navegação clara entre páginas

## Tecnologias Utilizadas

- HTML5
- CSS3
- JavaScript
- Git e GitHub

## Como Executar Localmente

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
```
2. Navegue até a pasta do projeto:
```bash
cd seu-repositorio
```
3. Abra o arquivo `index.html` no seu navegador.

## Melhorias Futuras

- Integração com API para conteúdos dinâmicos
- Seção de blog para novidades e atualizações
- Modo escuro baseado no horário do usuário
- Personalização do cursor

## Licença

Este projeto está licenciado sob a licença MIT.

---

🚀 Geekonverse - Explore seu universo digital!


## Tecnologias Utilizadas

- HTML5
- CSS3
- JavaScript
- Git e GitHub

## Como Executar Localmente

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/seu-repositorio.git

## Loja (store.html): Ilha Geekonverse

A loja é um jogo em vista isométrica: uma ilha base sobre um peixe gigante e masmorras ao estilo Diablo.

- **Produtos e preços:** `js/constants.js`, lista `PRODUCTS` (preços em euros). Peças da TeePublic/Redbubble usam o campo `external` com o link da sua página.
- **Eventos e mini quests:** criam-se no Supabase, tabela `events` (ver `supabase/GUIA.md`). `js/events.js` fica como reserva. O evento ativo aparece na faixa do topo da loja.
- **Contas e pontos de promoção:** Supabase (login por link mágico). Configuração em `supabase/GUIA.md`, base de dados em `supabase/migrations/`, código em `js/account.js`.
- **Envio:** `FREE_SHIPPING_FROM` e `SHIPPING_COST` em `js/constants.js`.
- **Edifícios, monstros e saque:** também em `js/constants.js`.
- **Aspeto e fases dos edifícios (nível 0 a 5) e crescimento da ilha:** `js/buildings.js` (nomes das fases em `BUILDING_STAGES`).
- O ouro e os cristais das masmorras só servem para evoluir a ilha e ficam guardados no navegador de cada jogador.
- Para testar, abra `store.html?debug` e use `__geek` na consola.

Ficheiros do jogo: `constants.js`, `events.js`, `world.js` (mapas), `particles.js`, `renderer.js` (desenho), `buildings.js` (edifícios), `creatures.js` (herói e monstros), `pixel.js` (filtro de pixel art), `game.js` (motor), `ui.js` (React) e `css/store.css`.
