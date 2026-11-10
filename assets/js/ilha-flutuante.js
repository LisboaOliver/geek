// Ilha Geekonverse a flutuar na página: uma janela que se arrasta, muda de tamanho e fica por cima do site.
// O jogo (motor em JS + interface em React) só é descarregado quando alguém abre a janela.
// Os ficheiros são os mesmos de store.html, por esta ordem.
(() => {
  const SCRIPTS = [
    'assets/vendor/react.production.min.js', 'assets/vendor/react-dom.production.min.js',
    'js/constants.js', 'js/events.js', 'js/world.js', 'js/particles.js', 'js/renderer.js',
    'js/buildings.js', 'js/creatures.js', 'js/pixel.js', 'js/game.js',
    'assets/vendor/supabase.js', 'js/account.js', 'js/ui.js',
  ];
  const GUARDA = 'geekonverse-janela-ilha';
  const $ = (s, el = document) => el.querySelector(s);

  const janela = $('[data-ilha]'), palco = $('[data-ilha-jogo]'), bolha = $('[data-ilha-bolha]');
  if (!janela || !palco) return;
  const barra = $('[data-ilha-arrastar]', janela);
  const telemovel = matchMedia('(max-width: 700px)');

  let pref = { tamanho: 'janela', x: null, y: null };
  try { pref = { ...pref, ...JSON.parse(localStorage.getItem(GUARDA)) }; } catch (_) { /* sem armazenamento */ }
  const guardar = () => { try { localStorage.setItem(GUARDA, JSON.stringify(pref)); } catch (_) {} };

  let aberta = false, motor = null, carregamento = null;

  /* ---------- carregar o jogo uma única vez ---------- */
  function carregar() {
    if (carregamento) return carregamento;
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'css/store.css';
    document.head.append(css);
    carregamento = new Promise((ok, falha) => {
      SCRIPTS.forEach((src, i) => {
        const s = document.createElement('script');
        s.src = src; s.async = false; // async=false mantém a ordem
        s.onerror = () => falha(new Error('Não foi possível carregar ' + src));
        if (i === SCRIPTS.length - 1) s.onload = ok;
        document.body.append(s);
      });
    }).then(() => {
      palco.innerHTML = '';
      ReactDOM.createRoot(palco).render(React.createElement(PixelStore, {
        flutuante: true,
        // o teclado só mexe o herói quando o foco está dentro da janela
        isActive: () => aberta && janela.contains(document.activeElement),
        aoIniciar: m => { motor = m; if (!aberta) m.stop(); },
      }));
    }).catch(e => {
      carregamento = null;
      palco.innerHTML = `<p class="ilha-janela__aviso">A ilha não carregou. <a href="store.html">Abrir na página própria</a></p>`;
      console.warn(e);
    });
    return carregamento;
  }

  /* ---------- tamanho e posição ---------- */
  function medidas() {
    const vw = innerWidth, vh = innerHeight;
    if (telemovel.matches || pref.tamanho === 'inteiro') return { x: 0, y: 0, w: vw, h: vh, inteiro: true };
    const w = pref.tamanho === 'grande' ? Math.min(1180, vw - 48) : Math.min(720, vw - 40);
    const h = pref.tamanho === 'grande' ? Math.min(780, vh - 48) : Math.min(500, vh - 40);
    let x = pref.x ?? vw - w - 24, y = pref.y ?? vh - h - 24;
    x = Math.min(Math.max(8, x), vw - w - 8); y = Math.min(Math.max(8, y), vh - h - 8);
    return { x, y, w, h, inteiro: false };
  }
  function aplicar() {
    const m = medidas();
    Object.assign(janela.style, { left: m.x + 'px', top: m.y + 'px', width: m.w + 'px', height: m.h + 'px' });
    janela.classList.toggle('is-inteiro', m.inteiro);
    janela.querySelectorAll('[data-ilha-tamanho]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ilhaTamanho === pref.tamanho)));
    // em ecrã inteiro a página por baixo não deve rolar
    const travar = aberta && m.inteiro;
    document.documentElement.classList.toggle('ilha-trava', travar);
    if (window.__lenis) travar ? __lenis.stop() : __lenis.start();
  }

  /* ---------- abrir e fechar ---------- */
  function abrir() {
    aberta = true;
    janela.hidden = false; bolha?.classList.add('is-escondida');
    aplicar();
    requestAnimationFrame(() => janela.classList.add('is-aberta'));
    carregar().then(() => { motor?.start(); palco.focus({ preventScroll: true }); });
    palco.focus({ preventScroll: true });
  }
  function fechar() {
    aberta = false;
    motor?.stop(); // o progresso fica gravado neste navegador
    janela.classList.remove('is-aberta');
    bolha?.classList.remove('is-escondida');
    aplicar();
    setTimeout(() => { if (!aberta) janela.hidden = true; }, 250);
    bolha?.focus({ preventScroll: true });
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-jogar]')) { e.preventDefault(); aberta ? palco.focus() : abrir(); }
  });
  $('[data-ilha-fechar]', janela).addEventListener('click', fechar);
  janela.querySelectorAll('[data-ilha-tamanho]').forEach(b => b.addEventListener('click', () => {
    pref.tamanho = b.dataset.ilhaTamanho; guardar(); aplicar(); palco.focus({ preventScroll: true });
  }));
  // clicar no jogo dá-lhe o foco (e o teclado); clicar fora devolve o teclado à página
  janela.addEventListener('pointerdown', e => { if (!e.target.closest('button, a, input, textarea, select')) palco.focus({ preventScroll: true }); });
  addEventListener('resize', () => { if (!janela.hidden) aplicar(); });

  /* ---------- arrastar pela barra ---------- */
  let arrasto = null;
  barra.addEventListener('pointerdown', e => {
    if (e.target.closest('button, a') || janela.classList.contains('is-inteiro')) return;
    const r = janela.getBoundingClientRect();
    arrasto = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    barra.setPointerCapture(e.pointerId);
    janela.classList.add('is-a-arrastar');
  });
  barra.addEventListener('pointermove', e => {
    if (!arrasto) return;
    pref.x = e.clientX - arrasto.dx; pref.y = e.clientY - arrasto.dy;
    aplicar();
  });
  const largar = () => { if (!arrasto) return; arrasto = null; janela.classList.remove('is-a-arrastar'); guardar(); };
  barra.addEventListener('pointerup', largar);
  barra.addEventListener('pointercancel', largar);
  barra.addEventListener('dblclick', e => {
    if (e.target.closest('button, a')) return;
    pref.tamanho = pref.tamanho === 'grande' ? 'janela' : 'grande'; guardar(); aplicar();
  });

  /* ---------- a bolha aparece depois da capa ---------- */
  const capa = $('.capa');
  if (bolha && capa) new IntersectionObserver(([e]) => bolha.classList.toggle('is-fora', e.isIntersecting), { threshold: .35 }).observe(capa);

  // o regresso do pagamento (?pedido=) e do login (#access_token) é tratado na página própria da Ilha
  if (/[?&]pedido=|access_token=/.test(location.search + location.hash)) location.replace('store.html' + location.search + location.hash);

  window.IlhaFlutuante = { abrir, fechar };
})();
