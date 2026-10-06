# Ligar os pagamentos (Stripe) — Portugal e Espanha

Faça isto **depois** do `GUIA.md` (contas e pontos já a funcionar).
Comece sempre em **modo de teste** da Stripe: nada é cobrado a sério até mudar para as chaves "live".

> 🔒 **Regra de ouro:** as chaves secretas da Stripe (`sk_...`, `whsec_...`) só se colam no painel do Supabase
> (Edge Functions → Secrets). Nunca no código, no GitHub, em mensagens ou emails.

---

## 1. Conta Stripe
1. Crie conta em **stripe.com** (é você que a cria, com os seus dados e IBAN).
2. Confirme que o interruptor **Test mode / Ambiente de testes** está ligado (canto superior direito).
3. **Settings → Payment methods**: ligue **Cards**, **MB WAY** e **Multibanco**.
   (Apple Pay / Google Pay vêm com os cartões.)
4. **Developers → API keys**: vai precisar da **Secret key** (`sk_test_...`) no passo 4. Não a copie para mais lado nenhum.

## 2. Base de dados
Supabase → **SQL Editor → New query** → cole o ficheiro `supabase/migrations/20261006120100_pagamentos.sql` → **Run**.

Isto cria:
- `products` — **preço e stock oficiais** (é aqui que se mudam preços; o site atualiza sozinho);
- `orders` e `order_items` — as encomendas;
- funções internas para reservar/devolver pontos e baixar o stock (só o servidor as pode usar).

## 3. Criar as duas funções
Supabase → **Edge Functions → Deploy a new function → Via Editor**.

| Nome (exatamente) | Código a colar |
|---|---|
| `checkout` | `supabase/functions/checkout/index.ts` |
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` |

(Ou, pela CLI: `npm run functions:deploy` — o `config.toml` já desliga o JWT nas duas.)

Em **cada uma**, depois de criada pelo editor: **Details / Settings → "Verify JWT with legacy secret" / "Enforce JWT verification" → DESLIGADO** → Save.
(A `checkout` valida a conta por dentro; a `stripe-webhook` é chamada pela Stripe e valida a assinatura.)

## 4. Segredos
Supabase → **Edge Functions → Secrets** → adicione:

| Nome | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | a `sk_test_...` da Stripe |
| `SITE_URL` | `https://geekonpage.vercel.app` |
| `STRIPE_WEBHOOK_SECRET` | o `whsec_...` (vem do passo 5) |

## 5. Webhook (a Stripe avisa quando um pagamento muda de estado)
Stripe → **Developers → Webhooks → Add endpoint / Add destination**:
- **URL:** `https://fstnhbhzadgqcvzsvkwb.supabase.co/functions/v1/stripe-webhook`
- **Eventos:**
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`

Depois de criar, abra o endpoint → **Signing secret → Reveal** → cole-o no Supabase como `STRIPE_WEBHOOK_SECRET` (passo 4).

## 6. Testar
1. Abra `https://geekonpage.vercel.app/store.html`, ponha peças na bolsa, escolha o país, **Pagar**.
2. Na Stripe use o cartão de teste **4242 4242 4242 4242**, qualquer data futura, qualquer CVC.
3. Volta à loja com "Encomenda recebida".
4. Supabase → **Table Editor → orders**: a encomenda aparece com `status = paid`, nome, email e morada.
   O stock em `products` baixa sozinho.

Se algo falhar: Supabase → Edge Functions → (função) → **Logs**, e Stripe → Webhooks → (endpoint) → tentativas.

## Como funciona (resumo)
- O browser só envia **ids e quantidades**. Preços, stock, pontos e portes são calculados no servidor.
- Pontos: **100 pontos = 5 €**, no máximo **20%** do subtotal. São reservados ao abrir o pagamento
  e devolvidos se o pagamento for cancelado, falhar ou expirar (1 hora).
- Portes: **Portugal 4,90 €**, **Espanha 7,90 €**, **grátis a partir de 50 €** (depois do desconto).
- A Stripe só aceita morada do país escolhido. Brasil e outros países: por mensagem.
- Multibanco: a encomenda fica `awaiting_payment` até a referência ser paga, e depois passa a `paid`.

## Dia a dia
- **Encomendas a enviar:** Table Editor → `orders` → filtre `status = paid`. Depois de enviar, mude para `shipped`.
- **Mudar preço/stock:** Table Editor → `products` (preços em cêntimos: `2990` = 29,90 €).
- **Produto novo:** adicione a linha em `products` **e** o produto em `js/constants.js` com o mesmo `id`.
- **Reembolsos:** faça-os na Stripe (Payments → o pagamento → Refund).

## Passar a vender a sério
1. Stripe → complete a ativação da conta (dados fiscais, IBAN).
2. Desligue o Test mode, copie a `sk_live_...` → substitua `STRIPE_SECRET_KEY` no Supabase.
3. Crie o webhook outra vez **em modo live** (passo 5) e substitua `STRIPE_WEBHOOK_SECRET`.
