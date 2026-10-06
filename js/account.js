// ─────────────────────────────────────────────────────────────────────────────
// account.js
// Contas de jogador (Supabase Auth, login por link mágico no email),
// eventos vindos da base de dados, progresso das quests e reclamar pontos.
//
// O URL e a chave pública abaixo podem estar no código do site: quem protege
// os dados são as regras de segurança da base de dados (supabase/migrations/).
// NUNCA pôr aqui a "secret key" / "service_role".
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const SUPABASE_URL = "https://fstnhbhzadgqcvzsvkwb.supabase.co";
const SUPABASE_KEY = "sb_publishable_OZQYOhjaIPkEvUElNplAMQ_2H4Wc14U";

// ── Progresso das quests (neste navegador) ───────────────────────────────────
// Conta só o que acontece enquanto o evento está ativo.
const QuestTracker = (() => {
  const KEY = "geekonverse-quests-v1";
  let data = {};
  try { data = JSON.parse(window.localStorage.getItem(KEY)) || {}; } catch (_) { data = {}; }
  const save = () => { try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) { /* sem armazenamento */ } };
  const active = () => EVENTS.filter(e => eventStatus(e) === "ativo");
  const entry = id => (data[id] = data[id] || { floor: 0, kills: 0, boss: 0, upgrade: 0, playSeconds: 0 });

  // tempo de jogo: conta 1 s por segundo com a página visível
  setInterval(() => {
    if (document.hidden) return;
    const evs = active();
    if (!evs.length) return;
    evs.forEach(e => entry(e.id).playSeconds++);
    if (Math.random() < 0.2) save();
  }, 1000);

  return {
    /** type: "floor" (valor = andar), "kills", "boss", "upgrade" (somam 1) */
    record(type, value = 1) {
      active().forEach(e => {
        const p = entry(e.id);
        if (type === "floor") p.floor = Math.max(p.floor, value);
        else p[type] = (p[type] || 0) + value;
      });
      save();
    },
    progress(ev) {
      const p = data[ev.id] || {};
      return { value: p[ev.objective.type] || 0, playSeconds: p.playSeconds || 0 };
    },
  };
})();

// ── Conta ────────────────────────────────────────────────────────────────────
const Account = (() => {
  const listeners = new Set();
  const state = { enabled: false, ready: false, user: null, points: 0, claims: new Set(), error: null };
  let sb = null;

  const emit = () => listeners.forEach(fn => fn({ ...state, claims: new Set(state.claims) }));

  function friendly(err) {
    const m = (err && (err.message || err.error_description)) || "";
    if (/rate limit|too many/i.test(m)) return "Foram pedidos demasiados emails. Espera uns minutos e tenta de novo.";
    if (/invalid.*email/i.test(m)) return "Esse email não parece válido.";
    if (/fetch|network/i.test(m)) return "Sem ligação ao servidor. Verifica a internet.";
    return m || "Algo correu mal. Tenta de novo.";
  }

  async function loadProfile() {
    if (!state.user) { state.points = 0; state.claims = new Set(); return; }
    const [{ data: prof }, { data: claims }] = await Promise.all([
      sb.from("profiles").select("points").eq("id", state.user.id).maybeSingle(),
      sb.from("quest_claims").select("event_id").eq("user_id", state.user.id),
    ]);
    state.points = prof ? prof.points : 0;
    state.claims = new Set((claims || []).map(c => c.event_id));
  }

  /** Os eventos passam a vir da base de dados (o events.js fica como reserva). */
  async function loadEvents() {
    const { data, error } = await sb.from("events")
      .select("id,title,description,starts_at,ends_at,objective_type,objective_value,points")
      .order("starts_at");
    if (error || !data) return;
    const evs = data.map(e => ({
      id: e.id, title: e.title, desc: e.description,
      start: e.starts_at, end: e.ends_at,
      objective: { type: e.objective_type, value: e.objective_value },
      points: e.points,
    }));
    EVENTS.splice(0, EVENTS.length, ...evs);
  }

  /** Preço e stock oficiais vêm da tabela "products" (o servidor só confia nesses). */
  async function loadProducts() {
    const { data, error } = await sb.from("products").select("id,price_cents,old_cents,stock");
    if (error || !data) return;
    const byId = new Map(data.map(r => [r.id, r]));
    PRODUCTS.forEach(p => {
      const r = byId.get(p.id);
      if (!r) return;
      p.price = r.price_cents / 100;
      p.old = r.old_cents ? r.old_cents / 100 : null;
      p.stock = r.stock;
    });
  }

  async function init() {
    if (!window.supabase || !window.supabase.createClient) { state.ready = true; emit(); return; }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    state.enabled = true;
    try { await Promise.all([loadEvents(), loadProducts()]); } catch (_) { /* fica com os dados do constants.js / events.js */ }
    const { data } = await sb.auth.getSession();
    state.user = data.session ? data.session.user : null;
    try { await loadProfile(); } catch (_) { /* tenta mais tarde */ }
    state.ready = true;
    emit();
    sb.auth.onAuthStateChange(async (_evt, session) => {
      state.user = session ? session.user : null;
      try { await loadProfile(); } catch (_) { /* ignora */ }
      emit();
    });
  }

  return {
    init,
    subscribe(fn) { listeners.add(fn); fn({ ...state, claims: new Set(state.claims) }); return () => listeners.delete(fn); },
    async sendLink(email) {
      if (!sb) throw new Error("As contas não estão disponíveis de momento.");
      const redirect = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
      if (error) throw new Error(friendly(error));
    },
    async signOut() { if (sb) await sb.auth.signOut(); },
    /** Atualiza os pontos (por exemplo depois de voltar do pagamento). */
    async refresh() { if (sb && state.user) { try { await loadProfile(); } catch (_) { /* ignora */ } emit(); } },
    /** Cria o pagamento na Stripe (função "checkout" no Supabase) e devolve o URL. */
    async checkout({ items, country, points }) {
      if (!sb) throw new Error("O pagamento online não está disponível de momento.");
      const { data, error } = await sb.functions.invoke("checkout", {
        body: { items, country, points: state.user ? points : 0 },
      });
      if (error) {
        let msg = "";
        try { msg = (await error.context.json()).error; } catch (_) { /* sem detalhe */ }
        throw new Error(msg || friendly(error));
      }
      if (!data || !data.url) throw new Error((data && data.error) || "Não foi possível iniciar o pagamento.");
      return data.url;
    },
    async claim(ev) {
      if (!sb || !state.user) throw new Error("Entra na tua conta para reclamar pontos.");
      const pr = QuestTracker.progress(ev);
      const { data, error } = await sb.rpc("claim_quest", { p_event: ev.id, p_value: pr.value, p_play_seconds: pr.playSeconds });
      if (error) throw new Error(friendly(error));
      state.points = data.points;
      state.claims.add(ev.id);
      emit();
      return data;
    },
  };
})();

// disponíveis para o jogo e a interface (const não fica em window)
window.Account = Account;
window.QuestTracker = QuestTracker;
Account.init();
