# GMM · Glasstech Maintenance Manager

PWA de gestión de mantenimiento (React + Vite + TypeScript, Supabase) con el sistema de diseño Glasstech.

## Funciones
Activos anidables (árbol activo → componente) · reporte de falla con cámara/galería y severidad Urgente/Informativo · feedback de Mantenimiento · preventivos y órdenes de trabajo · usuarios, roles y asignaciones por activo/área · costos (compras/gastos) por incidencia · MTTR, MTBF, disponibilidad y Pareto con exportación CSV · dashboard con alertas.

## Ejecutar
```bash
npm install
npm run dev          # modo demo (datos locales, 101 activos del inventario)
npm test && npm run build
```

## Conectar Supabase + Microsoft 365
1. Crear proyecto Supabase y ejecutar `supabase/migrations/0001_init.sql`.
2. Cargar el inventario: `data/inventory.csv` (101 equipos; TAGs duplicados/vacíos se conservan para revisión).
3. Authentication → Providers → Azure: registrar app en Entra ID (tenant Glasstech) y pegar client id/secret.
4. Copiar `.env.example` a `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Pendiente
- Campos exactos de la planilla de fallas: editar `src/config/failureFields.ts`.
- Web Push multiusuario (Edge Function) y cola offline de reportes.
- Seed SQL del inventario para Supabase (la lógica de mapeo está en `src/lib/seed.ts`).
