#!/usr/bin/env bash
# Crea tablas, permisos y datos iniciales en Supabase.
# Requiere SUPABASE_DB_URL (Project Settings → Database → Connection string → URI, con la contraseña).
set -euo pipefail
: "${SUPABASE_DB_URL:?Define SUPABASE_DB_URL (cadena de conexión Postgres de Supabase)}"
cd "$(dirname "$0")/.."
node scripts/build-seed-sql.mjs
for f in supabase/migrations/*.sql supabase/seed/seed.sql; do
  echo "→ $f"; psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "Listo."
