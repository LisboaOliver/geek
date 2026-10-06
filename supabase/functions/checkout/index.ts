// ─────────────────────────────────────────────────────────────────────────────
// Função "checkout" (Supabase Edge Function)
// Recebe a bolsa do jogador, confirma preços e stock NA BASE DE DADOS,
// aplica os pontos de promoção (reservados) e cria a página de pagamento
// da Stripe. Devolve o URL para onde o browser deve ir.
//
// Segredos necessários (Edge Functions → Secrets):
//   STRIPE_SECRET_KEY   — sk_test_... (testes) ou sk_live_... (a sério)
//   SITE_URL            — https://geekonpage.vercel.app
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem por defeito.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Regras da loja (as que contam no pagamento) ──────────────────────────────
const SHIPPING_CENTS: Record<string, number> = { PT: 490, ES: 790 };
const FREE_SHIPPING_FROM_CENTS = 5000;   // envio grátis a partir de 50 €
const POINT_CENTS = 5;                   // 100 pontos = 5 €
const POINTS_MAX_SHARE = 0.2;            // máximo 20% do subtotal em pontos
const MAX_LINES = 20, MAX_QTY = 10;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Codifica um objeto no formato que a API da Stripe espera (a[b][0][c]=...). */
function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => typeof item === "object" ? form(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item)));
    else if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(path: string, params: Record<string, unknown>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Erro na Stripe");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let reserved = 0, userId: string | null = null;

  try {
    const body = await req.json();
    const country = body?.country === "ES" ? "ES" : body?.country === "PT" ? "PT" : null;
    if (!country) return json({ error: "Escolhe o país de envio (Portugal ou Espanha)." }, 400);

    // ── quem está a comprar (opcional: também se pode comprar sem conta) ──
    let email: string | undefined;
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (token && token.split(".").length === 3) {
      const { data } = await admin.auth.getUser(token);
      if (data?.user) { userId = data.user.id; email = data.user.email ?? undefined; }
    }

    // ── itens: só ids e quantidades vêm do browser; preços vêm da base de dados ──
    const raw: { id: string; qty: number }[] = Array.isArray(body?.items) ? body.items : [];
    const wanted = new Map<string, number>();
    for (const it of raw.slice(0, MAX_LINES)) {
      const q = Math.floor(Number(it?.qty));
      if (typeof it?.id === "string" && q >= 1) wanted.set(it.id, Math.min(MAX_QTY, (wanted.get(it.id) || 0) + q));
    }
    if (!wanted.size) return json({ error: "A bolsa está vazia." }, 400);

    const { data: products, error: pErr } = await admin.from("products")
      .select("id,name,price_cents,stock").in("id", [...wanted.keys()]).eq("active", true);
    if (pErr) throw pErr;
    if (!products || products.length !== wanted.size) return json({ error: "Um dos produtos já não está disponível." }, 409);

    const lines = products.map(p => ({ ...p, qty: wanted.get(p.id)! }));
    const short = lines.find(l => l.qty > l.stock);
    if (short) return json({ error: `Só restam ${short.stock} de "${short.name}".` }, 409);

    const subtotal = lines.reduce((s, l) => s + l.price_cents * l.qty, 0);

    // ── pontos de promoção ──
    let points = 0;
    const askPoints = Math.max(0, Math.floor(Number(body?.points) || 0));
    if (askPoints && userId) {
      const maxByShare = Math.floor((subtotal * POINTS_MAX_SHARE) / POINT_CENTS);
      const { data: prof } = await admin.from("profiles").select("points").eq("id", userId).maybeSingle();
      points = Math.min(askPoints, maxByShare, prof?.points ?? 0);
      if (points > 0) {
        const { data: ok } = await admin.rpc("reserve_points", { p_user: userId, p_points: points });
        if (!ok) return json({ error: "Não tens pontos suficientes." }, 409);
        reserved = points;
      }
    }
    const discount = points * POINT_CENTS;
    const shipping = subtotal - discount >= FREE_SHIPPING_FROM_CENTS ? 0 : SHIPPING_CENTS[country];
    const total = subtotal - discount + shipping;

    // ── encomenda pendente ──
    const { data: order, error: oErr } = await admin.from("orders").insert({
      user_id: userId, country, subtotal_cents: subtotal, discount_cents: discount,
      shipping_cents: shipping, total_cents: total, points_used: points, customer_email: email ?? null,
    }).select("id").single();
    if (oErr) throw oErr;
    const { error: iErr } = await admin.from("order_items").insert(
      lines.map(l => ({ order_id: order.id, product_id: l.id, name: l.name, unit_cents: l.price_cents, qty: l.qty })));
    if (iErr) throw iErr;

    // ── desconto dos pontos como cupão de uso único ──
    let discounts: unknown[] | undefined;
    if (discount > 0) {
      const coupon = await stripe("coupons", {
        amount_off: discount, currency: "eur", duration: "once", max_redemptions: 1,
        name: `Pontos de promoção (${points})`,
      });
      discounts = [{ coupon: coupon.id }];
    }

    // ── página de pagamento da Stripe ──
    const site = (Deno.env.get("SITE_URL") || "https://geekonpage.vercel.app").replace(/\/$/, "");
    const session = await stripe("checkout/sessions", {
      mode: "payment",
      locale: country === "ES" ? "es" : "pt",
      line_items: lines.map(l => ({
        quantity: l.qty,
        price_data: { currency: "eur", unit_amount: l.price_cents, product_data: { name: l.name } },
      })),
      discounts,
      shipping_address_collection: { allowed_countries: [country] },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount", display_name: shipping ? `Envio ${country === "PT" ? "Portugal" : "Espanha"}` : "Envio grátis",
          fixed_amount: { amount: shipping, currency: "eur" },
        },
      }],
      phone_number_collection: { enabled: true },
      customer_email: email,
      client_reference_id: order.id,
      metadata: { order_id: order.id, user_id: userId ?? "", points: String(points) },
      payment_intent_data: { metadata: { order_id: order.id } },
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,   // 1 hora para pagar
      success_url: `${site}/store.html?pedido=ok`,
      cancel_url: `${site}/store.html?pedido=cancelado`,
    });

    await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return json({ url: session.url });
  } catch (e) {
    if (reserved && userId) await admin.rpc("refund_points", { p_user: userId, p_points: reserved });
    console.error(e);
    return json({ error: "Não foi possível iniciar o pagamento. Tenta de novo." }, 500);
  }
});
