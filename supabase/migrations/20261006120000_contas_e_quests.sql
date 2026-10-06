-- ════════════════════════════════════════════════════════════════════════════
-- Geekonverse · Ilha — base de dados (Supabase)
-- Cole tudo isto no Supabase: SQL Editor → New query → Run.
-- Pode correr de novo sem problema (não apaga dados de jogadores).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Perfis: um por conta, com o saldo de pontos de promoção ─────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  points      integer not null default 0 check (points >= 0),
  created_at  timestamptz not null default now()
);

-- ── Eventos / mini quests (é aqui que se criam e editam) ────────────────────
create table if not exists public.events (
  id               text primary key,               -- ex: 'sexta-das-masmorras'
  title            text not null,
  description      text not null default '',
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  objective_type   text not null check (objective_type in ('floor', 'kills', 'boss', 'upgrade')),
  objective_value  integer not null check (objective_value > 0),
  points           integer not null check (points > 0 and points <= 1000),
  active           boolean not null default true,  -- desligar um evento sem o apagar
  check (ends_at > starts_at)
);

-- ── Quests reclamadas: no máximo uma vez por conta e por evento ─────────────
create table if not exists public.quest_claims (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  event_id    text not null references public.events (id) on delete cascade,
  value       integer not null,
  play_seconds integer not null,
  points      integer not null,
  claimed_at  timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- ── Segurança (RLS): cada jogador só lê o que é seu e não altera nada ───────
alter table public.profiles     enable row level security;
alter table public.events       enable row level security;
alter table public.quest_claims enable row level security;

drop policy if exists "ler o próprio perfil" on public.profiles;
create policy "ler o próprio perfil" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "eventos são públicos" on public.events;
create policy "eventos são públicos" on public.events
  for select to anon, authenticated using (active);

drop policy if exists "ler as próprias quests" on public.quest_claims;
create policy "ler as próprias quests" on public.quest_claims
  for select to authenticated using (user_id = auth.uid());

-- Sem políticas de insert/update/delete: os jogadores não podem escrever
-- diretamente. Os pontos só mudam através da função claim_quest abaixo.
revoke insert, update, delete on public.profiles, public.events, public.quest_claims from anon, authenticated;

-- ── Criar o perfil automaticamente quando alguém cria conta ─────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Reclamar os pontos de uma quest (validado no servidor) ──────────────────
-- p_value:        o que o jogador alcançou (andar, monstros, bosses, melhorias)
-- p_play_seconds: tempo de jogo desde que começou a contar para este evento
create or replace function public.claim_quest(p_event text, p_value integer, p_play_seconds integer)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ev  public.events;
  min_seconds integer;
  new_points integer;
begin
  if uid is null then
    raise exception 'Precisas de entrar na tua conta.' using errcode = '28000';
  end if;

  select * into ev from public.events where id = p_event and active;
  if not found then
    raise exception 'Este evento não existe.' using errcode = 'P0002';
  end if;

  if now() < ev.starts_at then
    raise exception 'Este evento ainda não começou.' using errcode = 'P0001';
  end if;
  if now() > ev.ends_at + interval '10 minutes' then   -- pequena tolerância
    raise exception 'Este evento já terminou.' using errcode = 'P0001';
  end if;

  if p_value is null or p_value < ev.objective_value then
    raise exception 'O objetivo ainda não foi cumprido.' using errcode = 'P0001';
  end if;

  -- tempo mínimo plausível para cumprir o objetivo
  min_seconds := case ev.objective_type
    when 'floor'   then ev.objective_value * 25   -- ~25 s por andar
    when 'kills'   then ev.objective_value * 3    -- ~3 s por monstro
    when 'boss'    then ev.objective_value * 120  -- um boss está no andar 5
    when 'upgrade' then 0
  end;
  if p_play_seconds is null or p_play_seconds < min_seconds
     or p_play_seconds > extract(epoch from (now() - ev.starts_at)) + 120 then
    raise exception 'Não foi possível validar esta quest.' using errcode = 'P0001';
  end if;

  -- garante o perfil (contas criadas antes do trigger)
  insert into public.profiles (id, email)
    select uid, (select email from auth.users where id = uid)
    on conflict (id) do nothing;

  begin
    insert into public.quest_claims (user_id, event_id, value, play_seconds, points)
      values (uid, ev.id, p_value, p_play_seconds, ev.points);
  exception when unique_violation then
    raise exception 'Já reclamaste esta quest.' using errcode = 'P0001';
  end;

  update public.profiles set points = points + ev.points where id = uid
    returning points into new_points;

  return json_build_object('ok', true, 'awarded', ev.points, 'points', new_points);
end $$;

revoke all on function public.claim_quest(text, integer, integer) from public, anon;
grant execute on function public.claim_quest(text, integer, integer) to authenticated;

-- ── Eventos de exemplo (iguais aos que estavam no site) ─────────────────────
insert into public.events (id, title, description, starts_at, ends_at, objective_type, objective_value, points) values
  ('inauguracao-ilha', 'Inauguração da Ilha', 'A nova loja abriu! Desce às masmorras e chega ao andar 3.',
   '2026-10-06 00:00:00+01', '2026-10-20 23:59:00+01', 'floor', 3, 50),
  ('sexta-das-masmorras', 'Sexta das Masmorras', 'Só nesta noite: derrota o Senhor do Lag.',
   '2026-10-09 20:00:00+01', '2026-10-09 23:00:00+01', 'boss', 1, 100)
on conflict (id) do nothing;
