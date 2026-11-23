-- Al eliminar un perfil, lo que tenía asignado queda "sin asignar" en vez de bloquear el borrado.
alter table public.plans drop constraint plans_responsable_fkey,
  add constraint plans_responsable_fkey foreign key (responsable) references public.profiles(id) on update cascade on delete set null;
alter table public.work_orders drop constraint work_orders_asignado_a_fkey,
  add constraint work_orders_asignado_a_fkey foreign key (asignado_a) references public.profiles(id) on update cascade on delete set null;
alter table public.failures drop constraint failures_encargado_id_fkey,
  add constraint failures_encargado_id_fkey foreign key (encargado_id) references public.profiles(id) on update cascade on delete set null;
