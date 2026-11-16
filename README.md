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

## Supabase (ya conectado)
Proyecto `rhwfkdtbjpahfnwnrelv`: tablas, RLS, bucket `failure-photos` y datos iniciales (12 áreas, 114 activos, asignaciones) aplicados con las migraciones de `supabase/migrations/`. `.env` (no versionado) lleva `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

**Acceso:** correo corporativo y contraseña; no hay registro público ni Microsoft 365. El administrador crea los usuarios en la pantalla *Usuarios* (función `admin-create-user`) o en Supabase → Authentication → Users → Add user. Al primer ingreso el usuario se enlaza por correo con su perfil precargado. Los correos de los supervisores del seed son provisionales: reemplázalos por los reales.

## Pendiente
- Web Push multiusuario (Edge Function) y cola offline de reportes.
- Seed SQL del inventario para Supabase (la lógica de mapeo está en `src/lib/seed.ts`).
