-- ════════════════════════════════════════════════════════════════════════════
-- Geekonverse · Ilha — PAGAMENTOS (Stripe)
-- Corra DEPOIS do schema.sql. SQL Editor → New query → Run.
-- Pode correr de novo sem problema.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Produtos: preço e stock oficiais (o servidor só confia nestes valores) ──
create table if not exists public.products (
  id           text primary key,                 -- igual ao "id" em js/constants.js
  name         text not null,
  price_cents  integer not null check (price_cents > 0),   -- 3490 = 34,90 €
  old_cents    integer,                          -- preço antigo (opcional, para mostrar desconto)
  stock        integer not null default 0 check (stock >= 0),
  active       boolean not null default true
);

-- ── Encomendas ──────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles (id) on delete set null,
  status            text not null default 'pending'
                    check (status in ('pending', 'awaiting_payment', 'paid', 'cancelled', 'shipped')),
  country           text not null check (country in ('PT', 'ES')),
  subtotal_cents    integer not null,
  discount_cents    integer not null default 0,
  shipping_cents    integer not null,
  total_cents       integer not null,
  points_used       integer not null default 0,
  stripe_session_id text unique,
  customer_email    text,
  customer_name     text,
  shipping_address  jsonb,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);

create table if not exists public.order_items (
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   text not null references public.products (id),
  name         text not null,
  unit_cents   integer not null,
  qty          integer not null check (qty > 0),
  primary key (order_id, product_id)
);

-- ── Segurança ───────────────────────────────────────────────────────────────
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "produtos são públicos" on public.products;
create policy "produtos são públicos" on public.products
  for select to anon, authenticated using (active);

drop policy if exists "ver as próprias encomendas" on public.orders;
create policy "ver as próprias encomendas" on public.orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "ver os itens das próprias encomendas" on public.order_items;
create policy "ver os itens das próprias encomendas" on public.order_items
  for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- Só as funções do servidor (com a chave secreta) escrevem nestas tabelas.
revoke insert, update, delete on public.products, public.orders, public.order_items from anon, authenticated;

-- ── Pontos: reservar ao iniciar o pagamento, devolver se não for pago ───────
-- (só o servidor as pode chamar)
create or replace function public.reserve_points(p_user uuid, p_points integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_points <= 0 then return true; end if;
  update public.profiles set points = points - p_points
    where id = p_user and points >= p_points;
  return found;
end $$;

create or replace function public.refund_points(p_user uuid, p_points integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_points > 0 and p_user is not null then
    update public.profiles set points = points + p_points where id = p_user;
  end if;
end $$;

create or replace function public.decrement_stock(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.products p set stock = greatest(0, p.stock - i.qty)
    from public.order_items i where i.order_id = p_order and i.product_id = p.id;
end $$;

revoke all on function public.reserve_points(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_points(uuid, integer) from public, anon, authenticated;
revoke all on function public.decrement_stock(uuid) from public, anon, authenticated;
grant execute on function public.reserve_points(uuid, integer) to service_role;
grant execute on function public.refund_points(uuid, integer) to service_role;
grant execute on function public.decrement_stock(uuid) to service_role;

-- ── Produtos atuais da loja (edite preços e stock no Table Editor) ──────────
insert into public.products (id, name, price_cents, old_cents, stock) values
  ('one-piece-especial',      'Camiseta One Piece Ed. Especial', 3490, null, 12),
  ('moletom-attack-on-titan', 'Moletom Attack on Titan',         4990, null, 8),
  ('hoodie-cyberpunk',        'Hoodie Cyberpunk',                5490, null, 5),
  ('camiseta-ghibli',         'Camiseta Studio Ghibli',          2990, null, 20),
  ('camiseta-dragon-ball',    'Camiseta Dragon Ball',            1990, 2790, 15),
  ('bone-demon-slayer',       'Boné Demon Slayer',               1490, 1990, 22),
  ('camiseta-zelda',          'Camiseta Zelda',                  3290, null, 9),
  ('conjunto-evangelion',     'Conjunto Evangelion',             6990, null, 4)
on conflict (id) do nothing;
