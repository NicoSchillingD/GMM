// Genera supabase/seed/seed.sql desde data/inventory.csv (mismo mapeo que src/lib/seed.ts).
import { readFileSync, writeFileSync } from 'node:fs';
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
const q = (v) => (v === '' || v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const [head, ...lines] = readFileSync('data/inventory.csv', 'utf8').trim().split(/\r?\n/);
const cols = head.split(',');
const rows = lines.map((l) => { const v = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()])); });
const status = (e, d) => ({ OP: 'operativo', 'EN MANT.': 'en_mantencion', STANDBY: 'standby' })[e.toUpperCase()] ?? (d.toLowerCase().includes('desincorporado') ? 'desincorporado' : 'fuera_servicio');
const areas = [...new Set(rows.map((r) => r.area))];
const people = [...new Set(rows.map((r) => r.responsable).filter(Boolean))];
const o = ['-- Generado por scripts/build-seed-sql.mjs. Idempotente.', 'begin;'];
o.push(`insert into areas (id, nombre) values\n${areas.map((a) => `  ('area-${slug(a)}', ${q(a)})`).join(',\n')}\non conflict (id) do nothing;`);
// Perfiles precargados: el correo es provisional y se corrige en Usuarios; al ingresar con M365 se enlaza por correo (claim_profile).
o.push(`insert into profiles (id, nombre, email, rol) values\n${people.map((p) => `  (gen_random_uuid(), ${q(p)}, '${slug(p)}@glasstech.cl', 'supervisor')`).join(',\n')}\non conflict (email) do nothing;`);
o.push(`insert into assets (id, area_id, tag, tipo, marca, modelo, serie, anio_fab, estado, criticidad, diagnostico) values\n${rows.map((r) => `  ('a-${r.n}', 'area-${slug(r.area)}', ${q(r.tag)}, ${q(r.tipo)}, ${q(r.marca)}, ${q(r.modelo)}, ${q(r.serie)}, ${r.fabricacion || 'null'}, '${status(r.estado, r.diagnostico)}', ${q(r.prioridad)}, ${q(r.diagnostico)})`).join(',\n')}\non conflict (id) do nothing;`);
o.push(`insert into assignments (id, profile_id, asset_id)\nselect 'as-' || a.id, p.id, a.id from (values\n${rows.filter((r) => r.responsable).map((r) => `  ('a-${r.n}', ${q(r.responsable)})`).join(',\n')}\n) as a(id, nombre) join profiles p on p.nombre = a.nombre\non conflict (id) do nothing;`);
o.push('commit;');
writeFileSync('supabase/seed/seed.sql', o.join('\n\n') + '\n');
console.log(`seed.sql: ${areas.length} áreas, ${people.length} responsables, ${rows.length} activos`);
