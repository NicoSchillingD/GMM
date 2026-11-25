-- Los administradores pueden eliminar fallas (y sus fotos/videos). Comentarios: se borran en cascada;
-- costos y órdenes de trabajo se conservan, solo pierden el vínculo con la falla.
alter table public.work_orders drop constraint if exists work_orders_failure_id_fkey;
alter table public.work_orders add constraint work_orders_failure_id_fkey foreign key (failure_id) references public.failures(id) on delete set null;
create policy "admin elimina fallas" on public.failures for delete to authenticated using (gmm_role() = 'admin');
create policy "admin borra fotos" on storage.objects for delete to authenticated using (bucket_id = 'failure-photos' and gmm_role() = 'admin');
