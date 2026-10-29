-- GMM · esquema inicial. Los nombres de tabla/columna coinciden con src/lib/types.ts.
create table profiles (id uuid primary key, nombre text not null, email text unique not null,
  rol text not null default 'consulta' check (rol in ('admin','mantenimiento','supervisor','consulta')));
create table areas (id text primary key, nombre text unique not null);
create table assets (id text primary key, parent_id text references assets(id) on delete set null,
  area_id text references areas(id), tag text not null default '', tipo text not null default '', marca text default '',
  modelo text default '', serie text default '', anio_fab int, estado text not null default 'operativo'
  check (estado in ('operativo','fuera_servicio','en_mantencion','desincorporado')),
  criticidad text default '', diagnostico text default '', es_componente boolean not null default false);
create table assignments (id text primary key, profile_id uuid not null references profiles(id) on delete cascade,
  asset_id text references assets(id) on delete cascade, area_id text references areas(id) on delete cascade,
  check (asset_id is not null or area_id is not null));
create table failures (id text primary key, asset_id text not null references assets(id),
  reportado_por uuid not null references profiles(id), severidad text not null check (severidad in ('urgente','informativo')),
  detiene_produccion boolean not null default false, inicio_detencion timestamptz, liberacion timestamptz,
  descripcion text not null, causa_inmediata text default '', extra jsonb not null default '{}',
  estado text not null default 'abierto' check (estado in ('abierto','en_revision','en_curso','resuelto','cerrado')),
  fotos text[] not null default '{}', creado timestamptz not null default now());
create table feedback (id text primary key, failure_id text not null references failures(id) on delete cascade,
  autor uuid not null references profiles(id), comentario text default '', estado text, creado timestamptz not null default now());
create table plans (id text primary key, asset_id text not null references assets(id) on delete cascade, nombre text not null,
  tareas jsonb not null default '[]', frecuencia_dias int not null default 30, proxima_fecha date not null, responsable uuid references profiles(id));
create table work_orders (id text primary key, failure_id text references failures(id), plan_id text references plans(id) on delete set null,
  asset_id text not null references assets(id), tipo text not null check (tipo in ('correctivo','preventivo')),
  asignado_a uuid references profiles(id), estado text not null default 'pendiente' check (estado in ('pendiente','en_curso','completada')),
  descripcion text default '', creado timestamptz not null default now(), inicio timestamptz, fin timestamptz);
create table cost_docs (id text primary key, tipo text not null check (tipo in ('compra','gasto','factura')), numero text default '',
  proveedor text default '', monto numeric not null, fecha date not null, failure_id text references failures(id) on delete set null,
  work_order_id text references work_orders(id) on delete set null, archivo text);

-- Rol del usuario autenticado
create function public.gmm_role() returns text language sql stable security definer set search_path = public as
$$ select rol from profiles where id = auth.uid() $$;

alter table profiles enable row level security; alter table areas enable row level security; alter table assets enable row level security;
alter table assignments enable row level security; alter table failures enable row level security; alter table feedback enable row level security;
alter table plans enable row level security; alter table work_orders enable row level security; alter table cost_docs enable row level security;

-- Lectura para cualquier usuario autenticado
do $$ declare t text; begin
  foreach t in array array['profiles','areas','assets','assignments','failures','feedback','plans','work_orders','cost_docs'] loop
    execute format('create policy "leer" on %I for select to authenticated using (true)', t);
  end loop;
  -- Mantenimiento y admin gestionan todo lo operativo
  foreach t in array array['areas','assets','plans','work_orders','cost_docs'] loop
    execute format($f$create policy "gestion" on %I for all to authenticated using (gmm_role() in ('admin','mantenimiento')) with check (gmm_role() in ('admin','mantenimiento'))$f$, t);
  end loop;
end $$;
-- Solo admin gestiona perfiles y asignaciones; cada usuario puede crear su propio perfil (rol consulta) al primer ingreso
create policy "admin perfiles" on profiles for all to authenticated using (gmm_role() = 'admin') with check (gmm_role() = 'admin');
create policy "auto perfil" on profiles for insert to authenticated with check (id = auth.uid() and rol = 'consulta');
create policy "admin asignaciones" on assignments for all to authenticated using (gmm_role() = 'admin') with check (gmm_role() = 'admin');
-- Fallas: supervisores y mantenimiento reportan; mantenimiento actualiza estado
create policy "reportar" on failures for insert to authenticated with check (gmm_role() in ('admin','mantenimiento','supervisor') and reportado_por = auth.uid());
create policy "gestionar fallas" on failures for update to authenticated using (gmm_role() in ('admin','mantenimiento')) with check (true);
create policy "feedback" on feedback for insert to authenticated with check (autor = auth.uid() and gmm_role() in ('admin','mantenimiento','supervisor'));

-- Fotos de fallas
insert into storage.buckets (id, name, public) values ('failure-photos','failure-photos', true) on conflict do nothing;
create policy "subir fotos" on storage.objects for insert to authenticated with check (bucket_id = 'failure-photos');
create policy "ver fotos" on storage.objects for select using (bucket_id = 'failure-photos');
