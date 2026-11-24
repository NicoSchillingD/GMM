// Lógica pura (sin APIs de Deno) de a quién avisar y con qué texto. La usan la función send-push y los tests de la App.

export interface PProfile { id: string; nombre?: string; rol: string }
export interface PAsset { id: string; parent_id: string | null; area_id: string | null; tag?: string; tipo?: string; marca?: string }
export interface PAssignment { profile_id: string; asset_id: string | null; area_id: string | null }
export interface PFailure { id: string; numero: number; tipo?: string; asset_id: string; severidad: string; detiene_produccion?: boolean; descripcion: string; encargado_id: string | null }

export interface Notice { recipients: string[]; title: string; body: string; url: string; tag: string; urgent: boolean }

export const STATUS_LABEL: Record<string, string> = { abierto: 'Abierto', en_revision: 'En revisión', gestion_compra: 'Gestión de compra', resuelto: 'Resuelto', cerrado: 'Cerrado' };

/** Todo el equipo de Mantención (rol "mantenimiento"). */
export const maintenanceTeam = (profiles: PProfile[]) => profiles.filter((p) => p.rol === 'mantenimiento').map((p) => p.id);

/** Responsables de un activo: quienes tienen asignado el activo, uno de sus activos padre, o su área. */
export function areaOwners(assetId: string, assets: PAsset[], assignments: PAssignment[]): string[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const chain: PAsset[] = [];
  for (let cur = byId.get(assetId), hops = 0; cur && hops < 20; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined, hops++) chain.push(cur);
  const ids = new Set(chain.map((a) => a.id)); const areas = new Set(chain.flatMap((a) => (a.area_id ? [a.area_id] : [])));
  return [...new Set(assignments.filter((s) => (s.asset_id && ids.has(s.asset_id)) || (s.area_id && areas.has(s.area_id))).map((s) => s.profile_id))];
}

const uniq = (ids: (string | null | undefined)[], actor: string) => [...new Set(ids.filter((x): x is string => !!x && x !== actor))];
const label = (a?: PAsset) => (a ? `${a.tag || 'S/TAG'} · ${[a.tipo, a.marca].filter(Boolean).join(' ')}`.trim() : 'Equipo');
const kind = (f: PFailure) => (f.tipo === 'hallazgo' ? 'Hallazgo' : 'Falla');
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

interface Ctx { profiles: PProfile[]; assets: PAsset[]; assignments: PAssignment[]; actor: string }

/** Reporte nuevo: avisa a todo Mantención y a los responsables del área o componente. */
export function noticeFailureCreated(f: PFailure, c: Ctx): Notice {
  const urgent = f.severidad === 'urgente' || !!f.detiene_produccion;
  const asset = c.assets.find((a) => a.id === f.asset_id);
  return {
    recipients: uniq([...maintenanceTeam(c.profiles), ...areaOwners(f.asset_id, c.assets, c.assignments)], c.actor),
    title: f.tipo === 'hallazgo' ? `Nuevo hallazgo #${f.numero}` : `${urgent ? 'Falla URGENTE' : 'Nueva falla'} #${f.numero}`,
    body: `${label(asset)} — ${cut(f.descripcion, 90)}`, url: `/fallas/${f.id}`, tag: `failure-${f.id}`, urgent,
  };
}

/** Cambio de estado: avisa a los responsables del área o componente. */
export function noticeStatusChanged(f: PFailure, estado: string, comment: string, c: Ctx): Notice {
  const asset = c.assets.find((a) => a.id === f.asset_id);
  return {
    recipients: uniq(areaOwners(f.asset_id, c.assets, c.assignments), c.actor),
    title: `${kind(f)} #${f.numero}: ${STATUS_LABEL[estado] ?? estado}`,
    body: `${label(asset)}${comment ? ` — ${cut(comment, 90)}` : ''}`, url: `/fallas/${f.id}`, tag: `failure-${f.id}`, urgent: false,
  };
}

/** Caso asignado: avisa al encargado de Mantención. */
export function noticeCaseAssigned(f: PFailure, c: Ctx): Notice {
  const asset = c.assets.find((a) => a.id === f.asset_id);
  return {
    recipients: uniq([f.encargado_id], c.actor), title: `Se te asignó el caso #${f.numero}`,
    body: `${kind(f)} · ${label(asset)} — ${cut(f.descripcion, 80)}`, url: `/fallas/${f.id}`, tag: `assigned-${f.id}`, urgent: f.severidad === 'urgente',
  };
}

/** Área o equipo asignado: avisa a la persona a cargo. */
export function noticeAreaAssigned(s: PAssignment & { id?: string }, areaName: string | undefined, c: Ctx): Notice {
  const asset = s.asset_id ? c.assets.find((a) => a.id === s.asset_id) : undefined;
  return {
    recipients: uniq([s.profile_id], c.actor), title: s.asset_id ? 'Se te asignó un equipo' : 'Se te asignó un área',
    body: s.asset_id ? label(asset) : `Área ${areaName ?? ''}`.trim(), url: s.asset_id ? `/activos/${s.asset_id}` : '/fallas', tag: `asg-${s.id ?? s.profile_id}`, urgent: false,
  };
}
