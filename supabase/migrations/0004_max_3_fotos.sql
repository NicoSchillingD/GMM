-- Máximo 3 fotos por falla (la app también lo valida).
alter table public.failures add constraint failures_max_3_fotos check (coalesce(array_length(fotos, 1), 0) <= 3);
