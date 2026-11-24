-- Videos de hasta 10 s en el reporte de fallas (máximo 2 por falla; la app valida duración y tamaño).
alter table public.failures add column if not exists videos text[] not null default '{}';
alter table public.failures add constraint failures_max_2_videos check (coalesce(array_length(videos, 1), 0) <= 2);
