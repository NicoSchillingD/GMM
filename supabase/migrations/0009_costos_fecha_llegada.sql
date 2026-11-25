-- Fecha estimada de llegada de una compra (se pide al registrar costos de tipo "compra").
alter table public.cost_docs add column if not exists fecha_llegada date;
