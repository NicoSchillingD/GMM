-- Notificaciones push (Web Push). Todo se maneja desde la función send-push con la service role: sin políticas = sin acceso desde la App.
create table if not exists public.push_config (id int primary key default 1 check (id = 1), public_key text not null, private_key text not null, created timestamptz not null default now());
create table if not exists public.push_subscriptions (
  endpoint text primary key, profile_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  p256dh text not null, auth text not null, user_agent text default '', created timestamptz not null default now());
create index if not exists push_subscriptions_profile_idx on public.push_subscriptions(profile_id);
-- Evita avisos duplicados: cada evento se envía una sola vez.
create table if not exists public.push_log (key text primary key, created timestamptz not null default now());
alter table public.push_config enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;
revoke all on public.push_config, public.push_subscriptions, public.push_log from anon, authenticated;
