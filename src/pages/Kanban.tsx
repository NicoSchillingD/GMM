import { Top } from '../components/Brand';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../lib/app';
import PhotoAttach from '../components/PhotoAttach';
import { FAIL_STATUS, KindBadge, SevBadge, assetLabel, fmt } from '../lib/ui';
import { STATUS_FLOW, allowedTransitions, changeStatus, isMantenimiento } from '../lib/workflow';
import type { Failure, FailureStatus } from '../lib/types';

/** Tablero Kanban del flujo de fallas y hallazgos. Mover una tarjeta pide un comentario opcional. */
export default function Kanban() {
  const { data, me, can, reload } = useApp();
  const [kind, setKind] = useState(''); const [area, setArea] = useState(''); const [mine, setMine] = useState(false);
  const [move, setMove] = useState<{ f: Failure; to: FailureStatus } | null>(null);
  const [comment, setComment] = useState(''); const [enc, setEnc] = useState(''); const [sol, setSol] = useState(''); const [shots, setShots] = useState<string[]>([]);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);

  const assetOf = (f: Failure) => data.assets.find((a) => a.id === f.asset_id);
  const areaOf = (f: Failure) => assetOf(f)?.area_id ?? '';
  const who = (id: string | null) => data.profiles.find((p) => p.id === id)?.nombre;
  const cards = useMemo(() => data.failures
    .filter((f) => (!kind || (f.tipo ?? 'falla') === kind) && (!area || areaOf(f) === area) && (!mine || f.encargado_id === me?.id || f.reportado_por === me?.id))
    .sort((a, b) => b.creado.localeCompare(a.creado)), [data, kind, area, mine, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = (f: Failure) => allowedTransitions(f, me, data.assets, data.assignments);
  const mantList = data.profiles.filter((p) => p.rol === 'mantenimiento' || p.rol === 'admin');

  const ask = (f: Failure, to: FailureStatus) => { setMove({ f, to }); setComment(''); setSol(f.nota_solucion ?? ''); setShots([]); setEnc(f.encargado_id ?? ''); setErr(''); };
  const confirm = async () => {
    if (!move) return;
    setBusy(true); setErr('');
    try { await changeStatus(move.f, move.to, me!.id, comment, enc || null, move.to === 'resuelto' ? sol : undefined, shots); setMove(null); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo cambiar el estado.'); } finally { setBusy(false); }
  };
  const drop = (to: FailureStatus) => {
    const f = data.failures.find((x) => x.id === drag); setDrag(null);
    if (!f || f.estado === to) return;
    if (!next(f).includes(to)) return setErr(`No puedes mover #${f.numero} de ${FAIL_STATUS[f.estado][0]} a ${FAIL_STATUS[to][0]}.`);
    ask(f, to);
  };

  return (
    <>
      <Top><h1>Tablero de fallas y hallazgos</h1>{can('supervisor', 'mantenimiento') && <Link className="btn accent" to="/fallas/nueva"><Plus size={16} />Reportar</Link>}</Top>
      <div className="card row" style={{ marginBottom: 16 }}>
        <select style={{ maxWidth: 170 }} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Fallas y hallazgos</option><option value="falla">Solo fallas</option><option value="hallazgo">Solo hallazgos</option></select>
        <select style={{ maxWidth: 220 }} value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas las áreas</option>{data.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
        <label className="row"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Solo mis casos</label>
      </div>
      {err && !move && <div className="alert red" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="kanban">
        {STATUS_FLOW.map((s) => {
          const col = cards.filter((f) => f.estado === s);
          return (
            <section key={s} className={`kcol ${drag ? 'drop' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(s)} aria-label={FAIL_STATUS[s][0]}>
              <header><b>{FAIL_STATUS[s][0]}</b><span className="badge">{col.length}</span></header>
              {col.map((f) => (
                <article key={f.id} className="kcard" draggable={next(f).length > 0} onDragStart={() => setDrag(f.id)} onDragEnd={() => setDrag(null)}>
                  <div className="row"><Link to={`/fallas/${f.id}`}><b>#{f.numero}</b></Link><KindBadge k={f.tipo} /><SevBadge s={f.severidad} /></div>
                  <div style={{ marginTop: 6 }}>{assetLabel(assetOf(f))}</div>
                  <div className="muted">{f.descripcion.slice(0, 90)}</div>
                  {f.nota_solucion && (f.estado === 'resuelto' || f.estado === 'cerrado') && <div style={{ marginTop: 6 }}><b>Solución:</b> {f.nota_solucion.slice(0, 90)}</div>}
                  <div className="muted" style={{ marginTop: 6 }}>{fmt(f.creado)} · {who(f.encargado_id) ?? 'Sin encargado'}</div>
                  {next(f).length > 0 && <div className="row" style={{ marginTop: 8 }}>{next(f).map((to) => <button key={to} className="btn sm sec" onClick={() => ask(f, to)}>{s === 'resuelto' && to === 'en_revision' ? 'Reabrir' : `→ ${FAIL_STATUS[to][0]}`}</button>)}</div>}
                </article>
              ))}
              {!col.length && <div className="muted" style={{ padding: 8 }}>Sin casos</div>}
            </section>
          );
        })}
      </div>
      {move && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => !busy && setMove(null)}>
          <div className="card form" onClick={(e) => e.stopPropagation()}>
            <h2>#{move.f.numero}: {FAIL_STATUS[move.f.estado][0]} → {FAIL_STATUS[move.to][0]}</h2>
            {move.to === 'en_revision' && isMantenimiento(me) && !move.f.encargado_id && <label className="f">Encargado de Mantención *
              <select value={enc} onChange={(e) => setEnc(e.target.value)}><option value="">Selecciona…</option>{mantList.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>}
            {move.to === 'resuelto' && <label className="f">Solución aplicada *<textarea value={sol} onChange={(e) => setSol(e.target.value)} placeholder="Qué se hizo para resolver el problema" /></label>}
            {move.to === 'cerrado' && <div className="alert">Al cerrar das por validada la reparación.</div>}
            <label className="f">Comentario (opcional)<textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Diagnóstico, acción tomada, repuestos, validación…" /></label>
            <PhotoAttach value={shots} onChange={setShots} />
            {err && <div className="alert red">{err}</div>}
            <div className="row"><button className="btn" disabled={busy} onClick={confirm}>Confirmar</button><button className="btn ghost" disabled={busy} onClick={() => setMove(null)}>Cancelar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
