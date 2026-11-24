-- Flujo de fallas y hallazgos: Abierto → En revisión → Gestión de compra → Resuelto → Cerrado.
-- 1) Se distingue Falla de Hallazgo.
alter table public.failures add column if not exists tipo text not null default 'falla' check (tipo in ('falla','hallazgo'));

-- 2) Nuevo conjunto de estados ('en_curso' pasa a 'en_revision'; se agrega 'gestion_compra').
alter table public.failures drop constraint if exists failures_estado_check;
update public.failures set estado = 'en_revision' where estado = 'en_curso';
update public.feedback set estado = 'en_revision' where estado = 'en_curso';
alter table public.failures add constraint failures_estado_check
  check (estado in ('abierto','en_revision','gestion_compra','resuelto','cerrado'));

-- 3) El responsable del área (supervisor asignado al activo, a un activo padre o a su área) valida y cierra.
create or replace function public.es_responsable_de(p_asset text) returns boolean language sql stable security definer set search_path = public as $$
  with recursive up as (
    select id, parent_id, area_id from assets where id = p_asset
    union all
    select a.id, a.parent_id, a.area_id from assets a join up on a.id = up.parent_id
  )
  select exists (
    select 1 from assignments s join up on s.asset_id = up.id or (s.area_id is not null and s.area_id = up.area_id)
    where s.profile_id = auth.uid()
  )
$$;
revoke execute on function public.es_responsable_de(text) from public, anon;
grant execute on function public.es_responsable_de(text) to authenticated;

-- Solo puede mover una falla 'resuelto' a 'cerrado' (validar) o 'en_revision' (reabrir).
create policy "validar fallas" on public.failures for update to authenticated
  using (gmm_role() = 'supervisor' and estado = 'resuelto' and es_responsable_de(asset_id))
  with check (estado in ('cerrado','en_revision'));

-- Los responsables del área también comentan el historial (ya permitido a supervisores por la política "feedback").
