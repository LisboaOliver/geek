// ─────────────────────────────────────────────────────────────────────────────
// Função "stripe-webhook" (Supabase Edge Function)
// A Stripe chama este endereço quando um pagamento muda de estado.
// Só aqui as encomendas passam a "paga" — nunca a partir do browser.
//
// Segredos necessários (Edge Functions → Secrets):
//   STRIPE_WEBHOOK_SECRET — whsec_... (dado pela Stripe ao criar o webhook)
// Esta função deve ter "Verify JWT" DESLIGADO (quem a chama é a Stripe).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "jsr:@supabase/supabase-js@2";

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

/** Verifica a assinatura "Stripe-Signature" (HMAC-SHA256), com 5 min de tolerância. */
async function verify(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=") as [string, string]));
  const t = parts["t"];
  const sigs = header.split(",").filter(p => p.startsWith("v1=")).map(p => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = toHex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)));
  return sigs.some(s => s.length === expected.length && [...s].every((c, i) => c === expected[i]));
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const ok = await verify(payload, req.headers.get("Stripe-Signature") || "", Deno.env.get("STRIPE_WEBHOOK_SECRET") || "");
  if (!ok) return new Response("assinatura inválida", { status: 400 });

  const event = JSON.parse(payload);
  const session = event?.data?.object;
  const orderId: string | undefined = session?.metadata?.order_id;
  if (!orderId) return new Response("ignorado", { status: 200 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: order } = await admin.from("orders").select("id,status,user_id,points_used").eq("id", orderId).maybeSingle();
  if (!order) return new Response("encomenda desconhecida", { status: 200 });

  const details = {
    customer_email: session.customer_details?.email ?? null,
    customer_name: session.customer_details?.name ?? session.shipping_details?.name ?? null,
    shipping_address: session.shipping_details?.address ?? session.customer_details?.address ?? null,
  };

  const markPaid = async () => {
    if (order.status === "paid" || order.status === "shipped") return;
    await admin.from("orders").update({ status: "paid", paid_at: new Date().toISOString(), ...details }).eq("id", order.id);
    await admin.rpc("decrement_stock", { p_order: order.id });
  };
  const cancel = async () => {
    if (order.status !== "pending" && order.status !== "awaiting_payment") return;
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    await admin.rpc("refund_points", { p_user: order.user_id, p_points: order.points_used });
  };

  switch (event.type) {
    case "checkout.session.completed":
      // cartão / MB WAY: pago na hora · Multibanco: fica à espera da referência ser paga
      if (session.payment_status === "paid") await markPaid();
      else await admin.from("orders").update({ status: "awaiting_payment", ...details }).eq("id", order.id);
      break;
    case "checkout.session.async_payment_succeeded":
      await markPaid();
      break;
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await cancel();
      break;
  }
  return new Response("ok", { status: 200 });
});
