#!/usr/bin/env bash
# Crea tablas, permisos y datos iniciales en Supabase vía la API de administración
# (POST /v1/projects/{ref}/database/query). No requiere contraseña de Postgres ni psql.
# Variables:
#   SUPABASE_PROJECT_REF     ref del proyecto (opcional si la cuenta tiene un solo proyecto)
#   SUPABASE_ACCESS_TOKEN    token personal (https://supabase.com/dashboard/account/tokens);
#                            opcional si un proxy ya inyecta la credencial
#   SUPABASE_API_URL         por defecto https://api.supabase.com
set -euo pipefail
cd "$(dirname "$0")/.."
API="${SUPABASE_API_URL:-https://api.supabase.com}"
auth=()
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  SUPABASE_PROJECT_REF=$(curl -fsS "${auth[@]}" "$API/v1/projects" | node -e '
    const p = JSON.parse(require("fs").readFileSync(0, "utf8"));
    if (p.length !== 1) { console.error("Define SUPABASE_PROJECT_REF; proyectos: " + p.map((x) => x.ref + " (" + x.name + ")").join(", ")); process.exit(1); }
    console.log(p[0].ref)')
fi
echo "Proyecto: $SUPABASE_PROJECT_REF"

node scripts/build-seed-sql.mjs
for f in supabase/migrations/*.sql supabase/seed/seed.sql; do
  echo "→ $f"
  node -e 'process.stdout.write(JSON.stringify({ query: require("fs").readFileSync(process.argv[1], "utf8") }))' "$f" |
    curl -sS -o /tmp/supabase-resp.json -w '%{http_code}' "${auth[@]}" -H 'Content-Type: application/json' \
      --data-binary @- "$API/v1/projects/$SUPABASE_PROJECT_REF/database/query" > /tmp/supabase-code
  code=$(cat /tmp/supabase-code)
  if [ "$code" != 200 ] && [ "$code" != 201 ]; then echo "Error $code en $f:" >&2; cat /tmp/supabase-resp.json >&2; echo >&2; exit 1; fi
done
rm -f /tmp/supabase-resp.json /tmp/supabase-code
echo "Listo."
