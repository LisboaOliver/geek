# Ligar a loja ao Supabase (contas e pontos)

São 3 passos, uma única vez. Tudo no painel do Supabase (supabase.com → o seu projeto).

## 1. Criar a base de dados
1. Menu da esquerda → **SQL Editor** → **New query**.
2. Abra o ficheiro `supabase/schema.sql` deste projeto, copie tudo e cole.
3. Carregue em **Run**. Deve aparecer "Success. No rows returned".

Isto cria:
- `profiles` — uma linha por jogador, com os **pontos de promoção**;
- `events` — os eventos / mini quests (com 2 de exemplo);
- `quest_claims` — que quests cada jogador já reclamou;
- a função `claim_quest`, a única forma de ganhar pontos, que valida no servidor:
  horário do evento, objetivo cumprido, tempo de jogo plausível e uma vez por conta;
- as regras de segurança: cada jogador só vê os seus dados e ninguém altera pontos à mão a partir do site.

## 2. Configurar o login por email
Menu **Authentication** → **URL Configuration**:
- **Site URL:** `https://geekonpage.vercel.app`
- **Redirect URLs** → Add URL:
  - `https://geekonpage.vercel.app/store.html`
  - (para testar no seu computador, se usar o Live Server do VS Code) `http://127.0.0.1:5500/**`

Menu **Authentication** → **Sign In / Providers** → **Email**: confirme que está ligado.

⚠️ O email que o Supabase envia por defeito tem um **limite baixo (poucos emails por hora)** e serve para testes.
Antes de abrir ao público, configure um serviço de email próprio em **Authentication → Emails → SMTP Settings**
(por exemplo Resend ou Brevo, ambos com plano gratuito).

Opcional: em **Authentication → Emails → Templates → Magic Link** pode traduzir o email para português.

## 3. Gerir eventos
Menu **Table Editor** → tabela **events** → **Insert row**:

| campo | exemplo |
|---|---|
| id | `halloween-2026` (sem espaços) |
| title | Noite das Bruxas |
| description | Derrota 30 monstros esta noite. |
| starts_at | 2026-10-31 20:00:00+00 |
| ends_at | 2026-10-31 23:59:00+00 |
| objective_type | `floor`, `kills`, `boss` ou `upgrade` |
| objective_value | 30 |
| points | 80 |
| active | true |

O site lê os eventos daqui automaticamente (a faixa do topo e o Quadro de Quests).
O ficheiro `js/events.js` fica só como reserva, caso o Supabase não responda.

Para ver os pontos dos jogadores: **Table Editor → profiles**.

## Segurança
- No site só estão o **URL** e a **publishable key**, que são públicos por natureza.
- A **secret key** (`sb_secret_...` / `service_role`) nunca deve ir para o código nem para o GitHub.
- O jogo corre no browser, por isso alguém com conhecimentos técnicos pode tentar fingir progresso.
  O servidor limita isso (horário, uma vez por conta, tempo mínimo), mas mantenha os descontos moderados.
