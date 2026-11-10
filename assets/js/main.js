// Geekonverse: movimento e interação da página.
// Depende de gsap, ScrollTrigger, SplitText e Lenis (locais em assets/js). Sem eles, a página funciona na mesma.
(() => {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toque = matchMedia('(pointer: coarse)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- capa: grelha de píxeis que acende à volta do cursor ---------- */
  function pixeis(canvas) {
    const ctx = canvas.getContext('2d');
    const rato = { x: -9999, y: -9999, ativo: false };
    let w, h, cel, cols, lins, brilho = [], faisca = [], visivel = true, raf = 0;
    function medir() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cel = w < 700 ? 22 : 30;
      cols = Math.ceil(w / cel); lins = Math.ceil(h / cel);
      brilho = new Float32Array(cols * lins); faisca = new Float32Array(cols * lins);
    }
    function desenhar(t) {
      ctx.clearRect(0, 0, w, h);
      if (toque || !rato.ativo) { // sem rato, um "jogador" fantasma passeia
        rato.x = w * (.55 + .35 * Math.sin(t * .00029)); rato.y = h * (.5 + .32 * Math.sin(t * .00043 + 1));
      }
      const raio = cel * 7;
      if (!reduzido && Math.random() < .5) faisca[(Math.random() * cols * lins) | 0] = 1;
      for (let j = 0; j < lins; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i, cx = i * cel + cel / 2, cy = j * cel + cel / 2;
        const inf = Math.max(0, 1 - Math.hypot(cx - rato.x, cy - rato.y) / raio);
        brilho[k] += (Math.round(inf * 4) / 4 - brilho[k]) * .18; // degraus: parece pixel art
        faisca[k] *= .94;
        const a = brilho[k] * .75 + faisca[k] * .35;
        ctx.fillStyle = 'rgba(255,255,255,.045)';
        ctx.fillRect(i * cel + 1, j * cel + 1, cel - 2, cel - 2);
        if (a > .02) {
          ctx.fillStyle = brilho[k] > .55 ? `rgba(255,79,163,${a.toFixed(3)})` : `rgba(201,178,255,${a.toFixed(3)})`;
          ctx.fillRect(i * cel + 1, j * cel + 1, cel - 2, cel - 2);
        }
      }
    }
    function ciclo(t) { desenhar(t); if (visivel) raf = requestAnimationFrame(ciclo); }
    medir();
    if (reduzido) { desenhar(0); addEventListener('resize', () => { medir(); desenhar(0); }); return; }
    addEventListener('resize', medir);
    addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); rato.x = e.clientX - r.left; rato.y = e.clientY - r.top; rato.ativo = true; }, { passive: true });
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting; cancelAnimationFrame(raf); if (visivel) raf = requestAnimationFrame(ciclo); }).observe(canvas);
  }
  $$('[data-pixeis]').forEach(pixeis);

  /* ---------- jogo novo: um nível que se vai construindo bloco a bloco ---------- */
  function esboco(canvas) {
    const ctx = canvas.getContext('2d');
    let w, h, cel, blocos = [], n = 0, raf = 0, ult = 0, visivel = false;
    function medir() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cel = Math.max(12, Math.round(w / 32));
      const cols = Math.ceil(w / cel), base = Math.floor(h / cel) - 1;
      blocos = []; let alt = 3;
      for (let i = 0; i < cols; i++) { // chão com colinas e algumas plataformas
        alt = Math.max(2, Math.min(6, alt + (Math.random() < .3 ? (Math.random() < .5 ? -1 : 1) : 0)));
        for (let a = 0; a < alt; a++) blocos.push({ x: i, y: base - a, topo: a === alt - 1 });
        if (i % 7 === 3) for (let p = 0; p < 3; p++) blocos.push({ x: i + p, y: base - alt - 4, topo: true, plat: true });
      }
      blocos.sort((a, b) => a.x - b.x || b.y - a.y);
      n = reduzido ? blocos.length : 0;
    }
    function desenhar() {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,213,230,.09)'; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += cel) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); ctx.stroke(); }
      for (let y = 0; y < h; y += cel) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke(); }
      for (let i = 0; i < n; i++) {
        const b = blocos[i];
        ctx.fillStyle = b.plat ? '#ffd5e6' : b.topo ? '#ff4fa3' : '#a3205a';
        ctx.fillRect(b.x * cel + 1, b.y * cel + 1, cel - 2, cel - 2);
      }
      if (n < blocos.length) { const b = blocos[n]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(b.x * cel + 2, b.y * cel + 2, cel - 4, cel - 4); }
    }
    function ciclo(t) {
      if (t - ult > 45) { ult = t; n++; if (n > blocos.length + 40) medir(); desenhar(); }
      if (visivel) raf = requestAnimationFrame(ciclo);
    }
    medir(); desenhar();
    addEventListener('resize', () => { medir(); desenhar(); });
    if (reduzido) return;
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting; cancelAnimationFrame(raf); if (visivel) raf = requestAnimationFrame(ciclo); }).observe(canvas);
  }
  $$('[data-esboco]').forEach(esboco);

  /* ---------- vídeo do Grafite City: só corre quando está à vista ---------- */
  $$('[data-video]').forEach(v => {
    if (reduzido) { v.removeAttribute('loop'); return; }
    new IntersectionObserver(([e]) => e.isIntersecting ? v.play().catch(() => {}) : v.pause(), { threshold: .3 }).observe(v);
  });

  /* ---------- devlog: filtros e ligação direta (#devlog/nome) ---------- */
  const filtros = $('[data-filtros]');
  if (filtros) {
    filtros.hidden = false;
    filtros.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', filtros).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $$('[data-registo] li').forEach(li => { li.hidden = !!b.dataset.projeto && li.dataset.projeto !== b.dataset.projeto; });
      window.ScrollTrigger && ScrollTrigger.refresh();
    });
  }
  $$('.entrada').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) history.replaceState(null, '', '#devlog/' + d.id.replace(/^log-/, ''));
    window.ScrollTrigger && ScrollTrigger.refresh();
  }));
  function abrirDoEndereco() {
    const m = location.hash.match(/^#devlog\/(.+)$/);
    const d = m && document.getElementById('log-' + m[1]);
    if (d) { d.open = true; setTimeout(() => (window.__lenis ? __lenis.scrollTo(d, { offset: -20 }) : d.scrollIntoView()), 60); }
  }

  /* ---------- live da Twitch: só carrega quando se pede ---------- */
  $('[data-ver-live]')?.addEventListener('click', e => {
    const host = location.hostname || 'geekonpage.vercel.app';
    e.currentTarget.parentElement.innerHTML = `<iframe src="https://player.twitch.tv/?channel=geekonverse&parent=${host}&autoplay=false" title="Live do Geekonverse na Twitch" allowfullscreen></iframe>`;
    window.ScrollTrigger && ScrollTrigger.refresh();
  });

  /* ---------- formulário (Web3Forms) ---------- */
  const form = $('#contactForm');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const botao = $('#submitButton'), estado = $('[data-estado]', form);
    botao.disabled = true; botao.textContent = 'A enviar…'; estado.textContent = '';
    try {
      const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: new FormData(form) });
      const d = await r.json();
      if (!d.success) throw new Error(d.message);
      form.reset(); estado.textContent = 'Mensagem enviada. Respondo para o email que indicaste.';
      botao.textContent = 'Enviada';
    } catch {
      estado.textContent = 'Não foi possível enviar agora. Tenta outra vez daqui a pouco.';
      botao.disabled = false; botao.textContent = 'Enviar mensagem';
    }
  });

  addEventListener('hashchange', abrirDoEndereco); // links #devlog/nome dentro da própria página
  if (!window.gsap || reduzido) { abrirDoEndereco(); return; }
  gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ---------- rolagem suave ---------- */
  const lenis = window.__lenis = new Lenis({ lerp: .1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (id.length < 2 || id.startsWith('#devlog/')) return; // #devlog/... abre pelo hashchange
    const alvo = $(id); if (alvo) { e.preventDefault(); lenis.scrollTo(alvo, { duration: 1.4 }); }
  }));

  /* ---------- arranque: barra de carregamento e píxeis a desfazer ---------- */
  const arranque = document.createElement('div');
  arranque.className = 'arranque';
  const lado = innerWidth < 700 ? 56 : 80;
  const c = Math.ceil(innerWidth / lado), l = Math.ceil(innerHeight / lado);
  arranque.style.gridTemplateColumns = `repeat(${c},1fr)`;
  arranque.innerHTML = '<i></i>'.repeat(c * l) + '<div class="arranque__texto"><span>Geekonverse</span><span class="arranque__barra"><b></b></span><span data-pct>0%</span></div>';
  document.body.append(arranque);
  lenis.stop();
  const titulo = SplitText.create('[data-titulo]', { type: 'lines,words', mask: 'lines' });
  gsap.set(titulo.lines, { yPercent: 110 });
  const pct = { v: 0 };
  gsap.timeline({ onComplete: () => { arranque.remove(); lenis.start(); abrirDoEndereco(); } })
    .to(pct, { v: 100, duration: .9, ease: 'steps(10)', onUpdate: () => { $('[data-pct]', arranque).textContent = Math.round(pct.v) + '%'; } })
    .to('.arranque__barra b', { scaleX: 1, duration: .9, ease: 'steps(10)' }, 0)
    .to('.arranque__texto', { opacity: 0, duration: .2 }, '+=.15')
    .to($$('i', arranque), { scale: 0, duration: .35, ease: 'steps(3)', stagger: { grid: [l, c], from: 'center', amount: .6 } }, '<')
    .to(titulo.lines, { yPercent: 0, duration: 1, stagger: .1, ease: 'power4.out' }, '-=.4')
    .from('[data-entra]', { y: 30, opacity: 0, duration: .8, stagger: .1, ease: 'power3.out' }, '-=.7')
    .from('.topo .wrap > *', { y: -20, opacity: 0, duration: .6, stagger: .1 }, '<');

  gsap.to('.hero', { yPercent: -18, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.capa', start: 'top top', end: 'bottom top', scrub: true } });

  /* ---------- entradas ao rolar ---------- */
  $$('[data-sobe]').forEach(t => gsap.from(t, { y: 50, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: t, start: 'top 88%' } }));
  gsap.from('[data-registo] > li', { y: 30, opacity: 0, duration: .6, stagger: .07, ease: 'power3.out', scrollTrigger: { trigger: '[data-registo]', start: 'top 85%' } });

  /* ---------- projetos: horizontal no computador ---------- */
  const galeria = $('.galeria'), pista = $('.pista', galeria);
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    galeria.classList.add('js-horizontal');
    const distancia = () => pista.scrollWidth - innerWidth;
    const mover = gsap.to(pista, {
      x: () => -distancia(), ease: 'none',
      scrollTrigger: { trigger: galeria, pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, end: () => '+=' + distancia(), onUpdate: s => gsap.set('.progresso', { scaleX: s.progress }) }
    });
    $$('[data-info]', galeria).forEach(info => gsap.from(info.children, {
      x: 120, opacity: 0, stagger: .06, ease: 'power3.out',
      scrollTrigger: { trigger: info.closest('.painel'), containerAnimation: mover, start: 'left 75%', end: 'left 20%', scrub: 1 }
    }));
    $$('.janela', galeria).forEach(j => gsap.fromTo(j, { rotateY: -14, scale: .9 }, {
      rotateY: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: j.closest('.painel'), containerAnimation: mover, start: 'left right', end: 'left 15%', scrub: true }
    }));
    return () => galeria.classList.remove('js-horizontal');
  });
  mm.add('(max-width: 899px)', () => {
    $$('[data-info], .janela', galeria).forEach(el => gsap.from(el, { y: 60, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } }));
  });

  // a página do portfólio rola sozinha dentro da janela
  $$('[data-rolo]').forEach(vista => {
    const img = $('img', vista);
    const passeio = gsap.to(img, { y: () => -(img.offsetHeight - vista.offsetHeight), duration: 7, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatDelay: .8, paused: true });
    const janela = vista.closest('.janela');
    janela.addEventListener('pointerenter', () => gsap.to(passeio, { timeScale: 3, duration: .4 }));
    janela.addEventListener('pointerleave', () => gsap.to(passeio, { timeScale: 1, duration: .6 }));
    img.decode?.().catch(() => {}).finally(() => passeio.invalidate());
    new IntersectionObserver(([e]) => e.isIntersecting ? passeio.play() : passeio.pause()).observe(vista);
  });
  // a Ilha segue o cursor
  $$('[data-paralaxe]').forEach(v => {
    const img = $('img', v);
    gsap.to(img, { scale: 1.18, duration: 9, ease: 'sine.inOut', repeat: -1, yoyo: true });
    v.addEventListener('pointermove', e => {
      const r = v.getBoundingClientRect();
      gsap.to(img, { xPercent: ((e.clientX - r.left) / r.width - .5) * -6, yPercent: ((e.clientY - r.top) / r.height - .5) * -6, duration: .8, ease: 'power3.out' });
    });
  });
  if (!toque) $$('[data-inclina]').forEach(j => {
    j.addEventListener('pointermove', e => {
      const r = j.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      gsap.to(j, { rotateY: x * 8, rotateX: -y * 8, transformPerspective: 1100, duration: .6, ease: 'power3.out' });
    });
    j.addEventListener('pointerleave', () => gsap.to(j, { rotateY: 0, rotateX: 0, duration: 1, ease: 'elastic.out(1,.5)' }));
  });

  /* ---------- canais: a ilustração desliza ---------- */
  gsap.fromTo('.canais__fundo', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.canais', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('[data-rede]', { x: -80, opacity: 0, duration: .9, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '.redes', start: 'top 85%' } });

  /* ---------- letreiro: acelera com a rolagem ---------- */
  const corre = gsap.to('[data-letreiro]', { xPercent: -50, duration: 14, ease: 'none', repeat: -1 });
  ScrollTrigger.create({
    trigger: '.contacto', start: 'top bottom', end: 'bottom top',
    onUpdate: s => {
      const v = s.getVelocity();
      gsap.to(corre, { timeScale: (s.direction || 1) * (1 + Math.min(Math.abs(v) / 300, 6)), duration: .25, overwrite: true });
      gsap.to(corre, { timeScale: s.direction || 1, duration: 1.2, delay: .25 });
    }
  });

  /* ---------- botões magnéticos e mira ---------- */
  if (!toque) $$('[data-iman]').forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * .35, y: (e.clientY - r.top - r.height / 2) * .45, duration: .4, ease: 'power3.out' }); });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1,.4)' }));
  });
  const mira = $('.mira');
  if (!toque && mira) {
    const mx = gsap.quickTo(mira, 'x', { duration: .35, ease: 'power3' }), my = gsap.quickTo(mira, 'y', { duration: .35, ease: 'power3' });
    addEventListener('pointermove', e => { mx(e.clientX); my(e.clientY); }, { passive: true });
    $$('[data-cursor]').forEach(el => {
      el.addEventListener('pointerenter', () => { $('b', mira).textContent = el.dataset.cursor || 'Abrir'; mira.classList.add('grande'); });
      el.addEventListener('pointerleave', () => mira.classList.remove('grande'));
    });
  } else mira?.remove();

  addEventListener('load', () => ScrollTrigger.refresh());
})();
