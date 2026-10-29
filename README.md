# GMM · Glasstech Maintenance Manager

PWA de gestión de mantenimiento (React + Vite + TypeScript, Supabase) con el sistema de diseño Glasstech.

## Funciones
Activos anidables (árbol activo → componente) · reporte de falla con cámara/galería y severidad Urgente/Informativo · feedback de Mantenimiento · preventivos y órdenes de trabajo · usuarios, roles y asignaciones por activo/área · costos (compras/gastos) por incidencia · MTTR, MTBF, disponibilidad y Pareto con exportación CSV · dashboard con alertas.

## Ejecutar
```bash
npm install
npm run dev          # modo demo (datos locales, 114 activos del inventario)
npm test && npm run build
```

## Conectar Supabase + Microsoft 365
1. Crear proyecto Supabase y ejecutar `SUPABASE_ACCESS_TOKEN=… [SUPABASE_PROJECT_REF=…] scripts/setup-supabase.sh` (usa la API de administración; migraciones + seed de 114 activos), o pegar `supabase/migrations/0001_init.sql` y `supabase/seed/seed.sql` (generar con `node scripts/build-seed-sql.mjs`) en el SQL Editor.
2. El inventario sale de `data/inventory.csv` (planilla Taxonomía Equipos Glasstech; TAGs duplicados/vacíos se conservan para revisión). Los correos de los responsables son provisionales (`nombre-apellido@glasstech.cl`): corrígelos en Usuarios o en la tabla `profiles`; al ingresar con M365 el perfil se enlaza por correo.
3. Authentication → Providers → Azure: registrar app en Entra ID (tenant Glasstech) y pegar client id/secret.
4. Copiar `.env.example` a `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Pendiente
- Web Push multiusuario (Edge Function) y cola offline de reportes.
- Seed SQL del inventario para Supabase (la lógica de mapeo está en `src/lib/seed.ts`).
