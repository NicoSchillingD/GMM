-- Hasta 3 fotos por comentario del historial de cada caso (la app también lo valida).
alter table public.feedback add column if not exists fotos text[] not null default '{}';
alter table public.feedback add constraint feedback_max_3_fotos check (coalesce(array_length(fotos, 1), 0) <= 3);
