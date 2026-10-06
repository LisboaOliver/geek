// ─────────────────────────────────────────────────────────────────────────────
// ui.js
// Camada React da loja: faixa de eventos no topo, HUD, painéis dos edifícios
// (mercado, forja, altar, farol, cofre, quests), carrinho e ecrã de morte.
// Estilos em css/store.css.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const { useState, useEffect, useRef, useCallback } = React;

const fmtEUR = p => `${p.toFixed(2).replace(".", ",")} ${CURRENCY}`;
const CART_KEY = "geekonverse-carrinho-v1";
const HINT_KEY = "geekonverse-dica-vista";

function safeGet(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } }
function safeSet(k, v) { try { window.localStorage.setItem(k, v); } catch (_) { /* ignora */ } }

// ── Faixa de eventos (substitui a caixa de diálogo inicial) ──────────────────
function EventBanner({ onOpenQuests }) {
  const [now, setNow] = useState(Date.now());
  const feat = featuredEvent(now);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  if (!feat) {
    return (
      <div className="gs-banner">
        <span className="gs-banner-tag">Ilha Geekonverse</span>
        <span className="gs-banner-text">Desce às masmorras, junta ouro e evolui a tua ilha. As peças estão no Mercado.</span>
      </div>
    );
  }
  const { ev, status } = feat;
  return (
    <div className={`gs-banner ${status === "ativo" ? "is-live" : ""}`} role="status">
      <span className="gs-banner-tag">{status === "ativo" ? "● Evento ativo" : "Próximo evento"}</span>
      <span className="gs-banner-title">{ev.title}</span>
      <span className="gs-banner-text">{ev.desc}</span>
      <span className="gs-banner-time">
        {status === "ativo"
          ? <>Termina em <b>{fmtCountdown(Date.parse(ev.end) - now)}</b></>
          : <>Começa {fmtEventDate(ev.start)} · faltam <b>{fmtCountdown(Date.parse(ev.start) - now)}</b></>}
      </span>
      <button className="gs-btn gs-btn-ghost gs-banner-btn" onClick={onOpenQuests}>Ver quest</button>
    </div>
  );
}

// ── Painel genérico (abre só quando o jogador pede) ──────────────────────────
function Panel({ title, accent, onClose, children, wide, footer }) {
  useEffect(() => {
    const k = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="gs-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`gs-panel ${wide ? "is-wide" : ""}`} style={{ "--accent": accent || N.gold }} role="dialog" aria-label={title}>
        <header className="gs-panel-head">
          <h2>{title}</h2>
          <button className="gs-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="gs-panel-body">{children}</div>
        {footer && <footer className="gs-panel-foot">{footer}</footer>}
      </div>
    </div>
  );
}

// ── Mercado (produtos) ────────────────────────────────────────────────────────
function ProductCard({ p, onAdd }) {
  const [qty, setQty] = useState(1);
  const ext = !!p.external;
  return (
    <article className={`gs-card ${ext ? "is-external" : ""}`}>
      <div className="gs-card-media">
        {p.image ? <img src={p.image} alt={p.name}/> : <span className="gs-card-emoji" aria-hidden="true">{p.emoji}</span>}
        <span className="gs-badge">{p.badge}</span>
      </div>
      <h3 className="gs-card-name">{p.name}</h3>
      <p className="gs-card-desc">{p.desc}</p>
      {ext ? (
        <a className="gs-btn gs-btn-ghost gs-card-cta" href={p.external.url} target="_blank" rel="noopener noreferrer">
          Ver na {p.external.platform} ↗
        </a>
      ) : (
        <>
          <div className="gs-card-price">
            {p.old && <s>{fmtEUR(p.old)}</s>}
            <strong className={p.old ? "is-sale" : ""}>{fmtEUR(p.price)}</strong>
          </div>
          <div className={`gs-card-stock ${p.stock <= 5 ? "is-low" : ""}`}>
            {p.stock <= 5 ? `Só restam ${p.stock}` : `${p.stock} em stock`}
          </div>
          <div className="gs-card-actions">
            <div className="gs-qty">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Menos">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty(q => Math.min(p.stock, q + 1))} aria-label="Mais">+</button>
            </div>
            <button className="gs-btn" onClick={() => { onAdd(p, qty); setQty(1); }}>Adicionar</button>
          </div>
          <div className="gs-card-official">Peça oficial Geekonverse</div>
        </>
      )}
    </article>
  );
}

function MarketPanel({ onClose, onAdd, cartCount, onOpenCart }) {
  const [filter, setFilter] = useState("todas");
  const list = PRODUCTS.filter(p => filter === "todas" ? true : filter === "oficiais" ? !p.external : !!p.external);
  return (
    <Panel title="🛒 Mercado" accent={N.magenta} onClose={onClose} wide
      footer={<>
        <span className="gs-muted">Envio para Portugal e Espanha. Peças externas são vendidas pela própria plataforma.</span>
        <button className="gs-btn" onClick={onOpenCart}>Ver bolsa{cartCount ? ` (${cartCount})` : ""}</button>
      </>}>
      <div className="gs-tabs" role="tablist">
        {[["todas", "Todas"], ["oficiais", "Peças oficiais"], ["externas", "TeePublic e Redbubble"]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? "is-on" : ""} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      <div className="gs-grid">
        {list.map(p => <ProductCard key={p.name} p={p} onAdd={onAdd}/>)}
      </div>
    </Panel>
  );
}

// ── Carrinho e pagamento ──────────────────────────────────────────────────────
// Os valores aqui são só para mostrar: quem decide o preço final é o servidor
// (função "checkout"), com os preços e os pontos da base de dados.
const COUNTRY_KEY = "geekonverse-pais";
const COUNTRIES = [["PT", "Portugal"], ["ES", "Espanha"]];

function CartPanel({ cart, acc, onClose, onChange, onClear, onLogin }) {
  const [country, setCountry] = useState(() => safeGet(COUNTRY_KEY) === "ES" ? "ES" : "PT");
  const [usePoints, setUsePoints] = useState(true);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { safeSet(COUNTRY_KEY, country); }, [country]);

  const cents = v => Math.round(v * 100);
  const subtotalC = cart.reduce((s, i) => s + cents(i.price) * i.qty, 0);
  const maxPts = Math.floor((subtotalC * POINTS_MAX_SHARE) / POINTS_CENT_VALUE);
  const usable = acc.user ? Math.min(acc.points, maxPts) : 0;
  const pts = usePoints ? usable : 0;
  const discountC = pts * POINTS_CENT_VALUE;
  const freeC = FREE_SHIPPING_FROM * 100;
  const shippingC = subtotalC === 0 || subtotalC - discountC >= freeC ? 0 : cents(SHIPPING[country]);
  const totalC = subtotalC - discountC + shippingC;
  const eur = c => fmtEUR(c / 100);

  const pay = async () => {
    setErr(null); setPaying(true);
    try {
      const url = await Account.checkout({ items: cart.map(i => ({ id: i.id, qty: i.qty })), country, points: pts });
      window.location.href = url;
    } catch (e) {
      setErr(e.message); setPaying(false);
    }
  };

  return (
    <Panel title="🎒 Bolsa do Aventureiro" accent={N.magenta} onClose={onClose}>
      {cart.length === 0 ? (
        <div className="gs-empty">
          <div className="gs-empty-icon">🎒</div>
          <p>A tua bolsa está vazia.</p>
          <p className="gs-muted">As peças estão no Mercado da ilha.</p>
        </div>
      ) : (
        <>
          <ul className="gs-cart">
            {cart.map(i => (
              <li key={i.id}>
                <span className="gs-cart-emoji" aria-hidden="true">{i.emoji}</span>
                <span className="gs-cart-name">{i.name}<small>{fmtEUR(i.price)} cada</small></span>
                <div className="gs-qty">
                  <button onClick={() => onChange(i.id, i.qty - 1)} aria-label="Menos">−</button>
                  <span>{i.qty}</span>
                  <button onClick={() => onChange(i.id, Math.min(i.stock, i.qty + 1))} aria-label="Mais">+</button>
                </div>
                <strong>{fmtEUR(i.price * i.qty)}</strong>
              </li>
            ))}
          </ul>

          <div className="gs-field">
            <span>Enviar para</span>
            <div className="gs-tabs gs-tabs-sm" role="radiogroup" aria-label="País de envio">
              {COUNTRIES.map(([id, label]) => (
                <button key={id} role="radio" aria-checked={country === id} className={country === id ? "is-on" : ""}
                  onClick={() => setCountry(id)}>{label}</button>
              ))}
            </div>
          </div>

          {acc.enabled && (acc.user ? (
            usable > 0 ? (
              <label className="gs-points-toggle">
                <input type="checkbox" checked={usePoints} onChange={e => setUsePoints(e.target.checked)}/>
                <span>Usar <b>{usable}</b> pontos de promoção (−{eur(usable * POINTS_CENT_VALUE)})
                  {usable < acc.points && <small> · máximo 20% da compra; ficas com {acc.points - usable}</small>}</span>
              </label>
            ) : (
              <p className="gs-muted gs-points-note">⭐ {acc.points} pontos · completa quests de eventos para ganhar descontos (100 pontos = 5 €).</p>
            )
          ) : (
            <p className="gs-muted gs-points-note">
              Tens pontos de promoção? <button className="gs-linkbtn" onClick={onLogin}>Entra na tua conta</button> para os usar.
            </p>
          ))}

          <div className="gs-summary">
            <div><span>Subtotal</span><span>{eur(subtotalC)}</span></div>
            {discountC > 0 && <div className="is-discount"><span>Pontos ({pts})</span><span>−{eur(discountC)}</span></div>}
            <div><span>Envio ({country === "PT" ? "Portugal" : "Espanha"})</span><span>{shippingC ? eur(shippingC) : "Grátis"}</span></div>
            {shippingC > 0 && (
              <div className="gs-progress-row">
                <span className="gs-muted">Faltam {eur(freeC - (subtotalC - discountC))} para envio grátis</span>
                <div className="gs-progress"><div style={{ width: `${((subtotalC - discountC) / freeC) * 100}%` }}/></div>
              </div>
            )}
            <div className="gs-total"><span>Total</span><span>{eur(totalC)}</span></div>
          </div>

          {err && <div className="gs-error" role="alert">{err}</div>}
          <button className="gs-btn gs-btn-block gs-pay" onClick={pay} disabled={paying || !acc.enabled}>
            {paying ? "A abrir o pagamento…" : `Pagar ${eur(totalC)}`}
          </button>
          <div className="gs-checkout-note">
            Pagamento seguro pela Stripe: cartão, MB WAY ou Multibanco. A morada é pedida no passo seguinte.
            Do Brasil ou de outro país? <a href="contact.html">Fala connosco por mensagem</a>.
          </div>
          <button className="gs-btn gs-btn-ghost gs-btn-block" onClick={onClear} disabled={paying}>Esvaziar bolsa</button>
        </>
      )}
    </Panel>
  );
}

/** Ecrã depois de voltar da Stripe (?pedido=ok / ?pedido=cancelado). */
function OrderPanel({ ok, onClose }) {
  return (
    <Panel title={ok ? "✅ Encomenda recebida" : "Pagamento cancelado"} accent={ok ? N.green : N.magenta} onClose={onClose}
      footer={<button className="gs-btn" onClick={onClose}>Voltar à ilha</button>}>
      {ok ? (
        <>
          <p>Obrigado! O pagamento foi registado e vais receber um recibo por email.</p>
          <p className="gs-muted">Se pagaste por Multibanco, a encomenda fica confirmada assim que a referência for paga.
            Enviamos a peça à mão, normalmente em 2 a 4 dias úteis.</p>
        </>
      ) : (
        <>
          <p>Não foi cobrado nada. A tua bolsa continua guardada.</p>
          <p className="gs-muted">Se usaste pontos, voltam para a tua conta dentro de uma hora.</p>
        </>
      )}
    </Panel>
  );
}

// ── Edifícios que evoluem ─────────────────────────────────────────────────────
function UpgradePanel({ b, state, onUpgrade, onClose }) {
  const lvl = state.levels[b.id];
  const max = lvl >= MAX_LEVEL;
  const cost = upgradeCost(lvl);
  const canPay = state.gold >= cost.gold && state.crystals >= cost.crystals;
  const u = b.upgrade;
  const fmt = v => (Number.isInteger(v) ? v : v.toFixed(1)).toString().replace(".", ",");
  return (
    <Panel title={`${b.glyph} ${b.name}`} accent={b.color} onClose={onClose}>
      <p className="gs-lead">{b.desc}</p>
      <div className="gs-stars" aria-label={`Nível ${lvl} de ${MAX_LEVEL}`}>
        {Array.from({ length: MAX_LEVEL }, (_, i) => <span key={i} className={i < lvl ? "is-on" : ""}>★</span>)}
        <span className="gs-muted"> Nível {lvl} de {MAX_LEVEL}</span>
      </div>
      {BUILDING_STAGES[b.id] && (
        <div className="gs-stages">
          <div><span className="gs-muted">Agora</span><b>{BUILDING_STAGES[b.id][lvl]}</b></div>
          {!max && <div><span className="gs-muted">Próximo nível</span><b className="gs-accent">{BUILDING_STAGES[b.id][lvl + 1]}</b></div>}
        </div>
      )}
      <div className="gs-statline">
        Bónus atual: <b>+{fmt(u.per * lvl)} {u.unit}</b>
        {!max && <> → <b className="gs-accent">+{fmt(u.per * (lvl + 1))}</b></>}
      </div>
      {max ? (
        <div className="gs-note">Este edifício está no nível máximo.</div>
      ) : (
        <>
          <div className="gs-cost">
            <span className={state.gold >= cost.gold ? "" : "is-short"}>🪙 {cost.gold} ouro</span>
            {cost.crystals > 0 && <span className={state.crystals >= cost.crystals ? "" : "is-short"}>💎 {cost.crystals} cristais</span>}
          </div>
          <button className="gs-btn gs-btn-block" disabled={!canPay} onClick={() => onUpgrade(b.id)}>
            {canPay ? "Melhorar" : "Recursos insuficientes"}
          </button>
          {!canPay && <p className="gs-muted gs-center">Tens {state.gold} de ouro e {state.crystals} cristais. Desce às masmorras para juntar mais.</p>}
        </>
      )}
    </Panel>
  );
}

// ── Quadro de quests ──────────────────────────────────────────────────────────
// ── Conta (login por link mágico) ─────────────────────────────────────────────
function useAccount() {
  const [acc, setAcc] = useState(null);
  useEffect(() => (window.Account ? Account.subscribe(setAcc) : undefined), []);
  return acc || { enabled: false, ready: false, user: null, points: 0, claims: new Set() };
}

function AccountPanel({ acc, onClose, notify }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);
  const send = async e => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await Account.sendLink(email.trim()); setSent(true); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <Panel title="👤 A tua conta" accent={N.gold} onClose={onClose}>
      {!acc.enabled ? (
        <p className="gs-muted">As contas não estão disponíveis de momento. Tenta mais tarde.</p>
      ) : acc.user ? (
        <>
          <p className="gs-lead">Entraste como <b>{acc.user.email}</b>.</p>
          <div className="gs-points-big"><span>⭐</span><b>{acc.points}</b><small>pontos de promoção</small></div>
          <p className="gs-muted">Ganhas pontos nas mini quests do Quadro de Quests. Em breve vais poder trocá-los por descontos nas peças oficiais.</p>
          <button className="gs-btn gs-btn-ghost gs-btn-block" onClick={async () => { await Account.signOut(); notify("Saíste da conta"); }}>Sair</button>
        </>
      ) : sent ? (
        <div className="gs-note">
          Enviámos um link para <b>{email}</b>. Abre o email neste dispositivo e carrega no link para entrar.
          Se não o encontrares, vê também a pasta de spam.
        </div>
      ) : (
        <form onSubmit={send} className="gs-login">
          <p className="gs-lead">Entra para guardar os teus pontos de promoção. Não precisas de senha: enviamos-te um link por email.</p>
          <label htmlFor="gs-email">Email</label>
          <input id="gs-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="o.teu@email.com"/>
          {err && <p className="gs-error" role="alert">{err}</p>}
          <button className="gs-btn gs-btn-block" disabled={busy}>{busy ? "A enviar…" : "Enviar link de entrada"}</button>
          <p className="gs-muted gs-small">Ao criar conta aceitas a <a href="privacypolicy.html">política de privacidade</a>.</p>
        </form>
      )}
    </Panel>
  );
}

function QuestPanel({ onClose, acc, onLogin, notify }) {
  const [busyId, setBusyId] = useState(null);
  const claim = async ev => {
    setBusyId(ev.id);
    try { const r = await Account.claim(ev); notify(`+${r.awarded} pontos de promoção!`, N.gold); }
    catch (x) { notify(x.message, N.blood); }
    setBusyId(null);
  };
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const list = [...EVENTS].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .filter(e => eventStatus(e, now) !== "terminado");
  return (
    <Panel title="📜 Quadro de Quests" accent={N.gold} onClose={onClose}>
      <p className="gs-lead">Mini quests com dia e hora. Cada uma dá pontos de promoção para descontos na loja.</p>
      {!acc.user && <div className="gs-note">Para reclamar pontos tens de <button className="gs-link" onClick={onLogin}>entrar na tua conta</button>. O progresso conta na mesma enquanto jogas.</div>}
      {list.length === 0 && <p className="gs-muted gs-center">Sem eventos marcados de momento. Volta em breve!</p>}
      <ul className="gs-quests">
        {list.map(ev => {
          const st = eventStatus(ev, now);
          return (
            <li key={ev.id} className={st === "ativo" ? "is-live" : ""}>
              <div className="gs-quest-top">
                <span className={`gs-pill ${st === "ativo" ? "is-live" : ""}`}>{st === "ativo" ? "A decorrer" : "Em breve"}</span>
                <span className="gs-quest-points">{ev.points} pontos</span>
              </div>
              <h3>{ev.title}</h3>
              <p>{ev.desc}</p>
              <div className="gs-quest-meta">
                <span>🎯 {OBJECTIVE_TEXT[ev.objective.type]?.(ev.objective.value)}</span>
                <span>🕒 {fmtEventDate(ev.start)} até {fmtEventDate(ev.end)}</span>
                <span>{st === "ativo" ? `Termina em ${fmtCountdown(Date.parse(ev.end) - now)}` : `Começa em ${fmtCountdown(Date.parse(ev.start) - now)}`}</span>
              </div>
              {st === "ativo" && (() => {
                const pr = QuestTracker.progress(ev), goal = ev.objective.value, done = pr.value >= goal;
                const claimed = acc.claims && acc.claims.has(ev.id);
                return (
                  <div className="gs-quest-progress">
                    <div className="gs-progress"><div style={{ width: `${Math.min(100, (pr.value / goal) * 100)}%` }}/></div>
                    <span className="gs-muted">{Math.min(pr.value, goal)} / {goal}</span>
                    {claimed ? <span className="gs-pill is-done">✓ Reclamado</span>
                      : done && acc.user ? <button className="gs-btn gs-btn-sm" disabled={busyId === ev.id} onClick={() => claim(ev)}>{busyId === ev.id ? "A validar…" : `Reclamar ${ev.points} pontos`}</button>
                      : done ? <button className="gs-btn gs-btn-sm gs-btn-ghost" onClick={onLogin}>Entrar para reclamar</button>
                      : null}
                  </div>
                );
              })()}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function HelpPanel({ onClose }) {
  return (
    <Panel title="Como jogar" accent={N.gold} onClose={onClose}>
      <ul className="gs-help">
        <li><b>Clicar ou tocar no chão</b> para andar. Mantém premido para continuar a andar.</li>
        <li><b>W A S D</b> ou <b>setas</b> também movem o herói.</li>
        <li><b>Clicar num monstro</b> para atacar. <b>Espaço</b> ataca o mais próximo.</li>
        <li><b>E</b> (ou o botão em baixo) para entrar em edifícios, descer escadas e usar portais.</li>
        <li>O <b>ouro</b> e os <b>cristais</b> das masmorras servem para melhorar a ilha. Se morreres, perdes parte do que levavas.</li>
        <li>As <b>peças</b> estão no <b>Mercado</b>. Os <b>eventos</b> estão no Quadro de Quests.</li>
      </ul>
    </Panel>
  );
}

function DeathPanel({ info, onRespawn }) {
  return (
    <div className="gs-overlay is-death">
      <div className="gs-death">
        <h2>Caíste no andar {info.floor}</h2>
        <p>Perdeste <b>{info.lostGold} de ouro</b>{info.lostCrystals ? <> e <b>{info.lostCrystals} cristais</b></> : null}.</p>
        <p className="gs-muted">Guardas {info.keptGold} de ouro e {info.keptCrystals} cristais. O Cofre reduz o que perdes.</p>
        <button className="gs-btn" onClick={onRespawn} autoFocus>Voltar à ilha</button>
      </div>
    </div>
  );
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function HpOrb({ hp, max }) {
  const pct = Math.max(0, Math.min(1, hp / max));
  return (
    <div className="gs-orb" aria-label={`Vida ${hp} de ${max}`}>
      <div className="gs-orb-fill" style={{ height: `${pct * 100}%` }}/>
      <div className="gs-orb-text">{hp}<small>/{max}</small></div>
    </div>
  );
}

const ACTION_LABEL = {
  mercado: "Entrar no Mercado", quests: "Ler o Quadro de Quests", forja: "Entrar na Forja",
  altar: "Usar o Altar", farol: "Subir ao Farol", cofre: "Abrir o Cofre",
  portal: "Descer às masmorras", stairs: "Descer as escadas", "portal-back": "Voltar à ilha",
};

function Hud({ s, cartCount, onAction, onCart, onHelp, onLeave, acc, onAccount }) {
  const near = s.near === "portal" && s.scene === "dungeon" ? "portal-back" : s.near;
  return (
    <>
      <div className="gs-hud-top">
        <div className="gs-hud-left">
          <button className="gs-icon-btn" onClick={onHelp} aria-label="Como jogar">?</button>
          {s.scene === "dungeon"
            ? <span className="gs-chip is-dungeon">Andar {s.floor} · {s.monstersLeft} monstros</span>
            : <span className="gs-chip">Ilha: {ISLAND_STAGES[islandStage(Object.values(s.levels || {}).reduce((a, v) => a + v, 0))].name}{s.bestFloor ? ` · recorde: andar ${s.bestFloor}` : ""}</span>}
        </div>
        <div className="gs-hud-right">
          {s.scene === "dungeon" && <button className="gs-btn gs-btn-ghost gs-btn-sm" onClick={onLeave}>🌀 Portal para a ilha</button>}
          {acc.enabled && (
            <button className="gs-btn gs-btn-sm gs-btn-ghost" onClick={onAccount}>
              {acc.user ? <>⭐ {acc.points} pontos</> : <>👤 Entrar</>}
            </button>
          )}
          <button className={`gs-btn gs-btn-sm ${cartCount ? "" : "gs-btn-ghost"}`} onClick={onCart}>🎒 Bolsa{cartCount ? ` (${cartCount})` : ""}</button>
        </div>
      </div>

      <div className="gs-hud-bottom">
        <HpOrb hp={s.hp} max={s.maxHp}/>
        <div className="gs-hud-center">
          {near && !s.dead ? (
            <button className="gs-btn gs-action" onClick={onAction}>{ACTION_LABEL[near]} <kbd>E</kbd></button>
          ) : (
            <span className="gs-hint">{s.scene === "dungeon" ? "Clica num monstro para atacar" : "Clica no chão para andar"}</span>
          )}
        </div>
        <div className="gs-res">
          <div className="gs-res-row"><span>🪙</span><b>{s.gold}</b><small>ouro</small></div>
          <div className="gs-res-row"><span>💎</span><b>{s.crystals}</b><small>cristais</small></div>
          {s.scene === "dungeon" && (
            <div className="gs-res-run">A levar: <b>+{s.runGold}</b> 🪙 {s.runCrystals ? <> <b>+{s.runCrystals}</b> 💎</> : null}</div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Componente raiz ───────────────────────────────────────────────────────────
function PixelStore() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [s, setS] = useState({ scene: "island", hp: HERO.baseHp, maxHp: HERO.baseHp, gold: 0, crystals: 0, runGold: 0, runCrystals: 0, floor: 0, bestFloor: 0, levels: {}, near: null, monstersLeft: 0 });
  const [open, setOpen] = useState(null);   // id do painel aberto
  const [death, setDeath] = useState(null);
  const [toast, setToast] = useState(null);
  const [cart, setCart] = useState(() => {
    let c = [];
    try { c = JSON.parse(safeGet(CART_KEY)) || []; } catch (_) { c = []; }
    // bolsas antigas não tinham "id": recupera pelo nome e descarta o que já não existe
    return c.map(i => {
      const p = PRODUCTS.find(x => (i.id && x.id === i.id) || x.name === i.name);
      return p && !p.external ? { ...i, id: p.id } : null;
    }).filter(Boolean);
  });
  const [showHint, setShowHint] = useState(() => !safeGet(HINT_KEY));

  const notify = useCallback((msg, col = N.gold) => {
    setToast({ msg, col, id: Math.random() });
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3200); return () => clearTimeout(id); }, [toast]);

  useEffect(() => { safeSet(CART_KEY, JSON.stringify(cart)); }, [cart]);

  useEffect(() => {
    const engine = createGameEngine(canvasRef.current, {
      onState: setS,
      onToast: notify,
      onOpenBuilding: b => setOpen(b.id),
      onDeath: info => setDeath(info),
    });
    engineRef.current = engine;
    engine.start();
    return () => engine.destroy();
  }, [notify]);

  useEffect(() => { engineRef.current?.setPaused(!!open || !!death); }, [open, death]);

  useEffect(() => {
    if (!showHint) return;
    const id = setTimeout(() => { setShowHint(false); safeSet(HINT_KEY, "1"); }, 12000);
    return () => clearTimeout(id);
  }, [showHint]);

  const addToCart = (p, qty) => {
    setCart(c => {
      const ex = c.find(i => i.id === p.id);
      if (ex) return c.map(i => i.id === p.id ? { ...i, price: p.price, stock: p.stock, qty: Math.min(p.stock, i.qty + qty) } : i);
      return [...c, { id: p.id, name: p.name, price: p.price, emoji: p.emoji, stock: p.stock, qty }];
    });
    notify(`${p.emoji} ${p.name} ×${qty} na bolsa`, N.green);
  };
  const changeQty = (id, q) => setCart(c => q <= 0 ? c.filter(i => i.id !== id) : c.map(i => i.id === id ? { ...i, qty: q } : i));
  const cartCount = cart.reduce((n, i) => n + i.qty, 0);

  const doUpgrade = id => {
    if (engineRef.current?.upgrade(id)) {
      const b = BUILDINGS.find(x => x.id === id);
      notify(`${b.name} melhorado!`, b.color);
    }
  };

  const acc = useAccount();

  // quando os preços/stock oficiais chegam do Supabase, acerta a bolsa
  useEffect(() => {
    if (!acc.ready) return;
    setCart(c => c.map(i => {
      const p = PRODUCTS.find(x => x.id === i.id);
      return p ? { ...i, price: p.price, stock: p.stock, qty: Math.min(i.qty, Math.max(p.stock, 0)) } : i;
    }).filter(i => i.qty > 0));
  }, [acc.ready]);

  // regresso da página de pagamento
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("pedido");
    if (r !== "ok" && r !== "cancelado") return;
    if (r === "ok") setCart([]);
    setOpen(r === "ok" ? "pedido-ok" : "pedido-cancelado");
    params.delete("pedido");
    const q = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : "") + window.location.hash);
  }, []);

  const building = BUILDINGS.find(b => b.id === open);
  const close = () => setOpen(null);

  return (
    <div className="gs-root">
      <EventBanner onOpenQuests={() => setOpen("quests")}/>
      <div className="gs-stage">
        <canvas ref={canvasRef} className="gs-canvas" aria-label="Jogo da loja Geekonverse"/>
        <Hud s={s} cartCount={cartCount}
          onAction={() => engineRef.current?.interact()}
          onCart={() => setOpen("cart")}
          onHelp={() => setOpen("help")}
          onLeave={() => engineRef.current?.leaveDungeon()}
          acc={acc} onAccount={() => setOpen("account")}/>

        {toast && <div key={toast.id} className="gs-toast" style={{ "--accent": toast.col }}>{toast.msg}</div>}

        {showHint && (
          <div className="gs-firsthint">
            <span>Clica no chão para andar · <kbd>E</kbd> para entrar nos edifícios · as peças estão no <b>Mercado</b></span>
            <button onClick={() => { setShowHint(false); safeSet(HINT_KEY, "1"); }} aria-label="Fechar dica">×</button>
          </div>
        )}
      </div>

      {open === "mercado" && <MarketPanel onClose={close} onAdd={addToCart} cartCount={cartCount} onOpenCart={() => setOpen("cart")}/>}
      {open === "cart" && <CartPanel cart={cart} acc={acc} onClose={close} onChange={changeQty} onClear={() => setCart([])} onLogin={() => setOpen("account")}/>}
      {(open === "pedido-ok" || open === "pedido-cancelado") && <OrderPanel ok={open === "pedido-ok"} onClose={() => { close(); Account.refresh(); }}/>}
      {open === "quests" && <QuestPanel onClose={close} acc={acc} onLogin={() => setOpen("account")} notify={notify}/>}
      {open === "account" && <AccountPanel acc={acc} onClose={close} notify={notify}/>}
      {open === "help" && <HelpPanel onClose={close}/>}
      {building && building.upgrade && <UpgradePanel b={building} state={s} onUpgrade={doUpgrade} onClose={close}/>}
      {death && <DeathPanel info={death} onRespawn={() => { setDeath(null); engineRef.current?.respawn(); }}/>}
    </div>
  );
}
