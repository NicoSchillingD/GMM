import { useState } from 'react';
import { useApp } from '../lib/app';
import { update } from '../lib/db';
import { logEdit } from '../lib/failureAdmin';
import { assetLabel } from '../lib/ui';
import type { Failure, FailureKind } from '../lib/types';

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

/** Formulario para que un administrador corrija los datos de una falla o hallazgo. */
export default function FailureEdit({ f, onDone }: { f: Failure; onDone: () => void }) {
  const { data, me, reload } = useApp();
  const [tipo, setTipo] = useState<FailureKind>(f.tipo ?? 'falla');
  const [assetId, setAssetId] = useState(f.asset_id); const [q, setQ] = useState('');
  const [desc, setDesc] = useState(f.descripcion); const [causa, setCausa] = useState(f.causa_inmediata ?? '');
  const [detiene, setDetiene] = useState(f.detiene_produccion);
  const [inicio, setInicio] = useState(toLocal(f.inicio_detencion)); const [lib, setLib] = useState(toLocal(f.liberacion));
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const options = data.assets.filter((a) => a.id === assetId || !q || `${a.tag} ${a.tipo} ${a.marca}`.toLowerCase().includes(q.toLowerCase())).slice(0, 80);

  const save = async () => {
    if (!desc.trim()) return setErr('La descripción no puede quedar vacía.');
    const stops = tipo === 'falla' && detiene;
    if (stops && !inicio) return setErr('Indica cuándo comenzó la detención.');
    if (stops && lib && new Date(lib) < new Date(inicio)) return setErr('La liberación no puede ser anterior al inicio de la detención.');
    const patch: Partial<Failure> = {
      tipo, asset_id: assetId, descripcion: desc.trim(), causa_inmediata: causa.trim(),
      detiene_produccion: stops, severidad: stops ? 'urgente' : 'informativo',
      inicio_detencion: stops ? new Date(inicio).toISOString() : null, liberacion: stops && lib ? new Date(lib).toISOString() : null,
    };
    const names: [keyof Failure, string][] = [['tipo', 'clase'], ['asset_id', 'equipo'], ['descripcion', 'problema'], ['causa_inmediata', 'diagnóstico inicial'], ['detiene_produccion', 'detención'], ['inicio_detencion', 'inicio de detención'], ['liberacion', 'liberación']];
    const changed = names.filter(([k]) => (patch[k] ?? null) !== ((f[k] as unknown) ?? null) && !(k === 'causa_inmediata' && !patch[k] && !f[k])).map(([, n]) => n);
    if (!changed.length) return onDone();
    setBusy(true); setErr('');
    try { await update('failures', f.id, patch); await logEdit(f, me!.id, changed); await reload(); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  };

  return (
    <div className="card form" style={{ marginBottom: 16, borderColor: 'var(--celeste)' }}>
      <h2>Editar #{f.numero}</h2>
      <div className="grid g4">
        <label className="f">Clase<select value={tipo} onChange={(e) => setTipo(e.target.value as FailureKind)}><option value="falla">Falla</option><option value="hallazgo">Hallazgo</option></select></label>
      </div>
      <label className="f">Equipo o componente
        <input placeholder="Buscar por TAG, tipo o marca…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>{options.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}{a.parent_id ? ' (componente)' : ''}</option>)}</select>
      </label>
      <label className="f">Problema / detalle<textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <label className="f">Diagnóstico inicial operacional<textarea value={causa} onChange={(e) => setCausa(e.target.value)} /></label>
      {tipo === 'falla' && <>
        <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={detiene} onChange={(e) => setDetiene(e.target.checked)} />La máquina quedó detenida (urgente)</label>
        {detiene && <div className="grid g4">
          <label className="f">Inicio de la detención<input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
          <label className="f">Liberación (opcional)<input type="datetime-local" value={lib} onChange={(e) => setLib(e.target.value)} /></label>
        </div>}
      </>}
      {err && <div className="alert red">{err}</div>}
      <div className="row"><button className="btn" disabled={busy} onClick={save}>Guardar cambios</button><button className="btn ghost" disabled={busy} onClick={onDone}>Cancelar</button></div>
    </div>
  );
}
