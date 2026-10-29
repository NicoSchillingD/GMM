import { useApp } from '../lib/app';
import { update } from '../lib/db';
import { Badge, assetLabel, fmt } from '../lib/ui';
import type { WOStatus } from '../lib/types';

export default function WorkOrders() {
  const { data, can, reload } = useApp();
  const set = async (id: string, estado: WOStatus) => {
    const now = new Date().toISOString();
    await update('work_orders', id, { estado, ...(estado === 'en_curso' ? { inicio: now } : estado === 'completada' ? { fin: now } : {}) });
    await reload();
  };
  const rows = [...data.work_orders].sort((a, b) => b.creado.localeCompare(a.creado));
  return (
    <>
      <div className="top"><h1>Órdenes de trabajo</h1></div>
      <div className="card"><table className="stack"><thead><tr><th>Creada</th><th>Activo</th><th>Tipo</th><th>Descripción</th><th>Estado</th><th /></tr></thead><tbody>
        {rows.map((w) => <tr key={w.id}><td>{fmt(w.creado)}</td><td>{assetLabel(data.assets.find((a) => a.id === w.asset_id))}</td><td><Badge t={w.tipo} c={w.tipo === 'preventivo' ? 'info' : 'warn'} /></td><td style={{ whiteSpace: 'pre-line' }}>{w.descripcion}</td>
          <td><Badge t={w.estado} c={w.estado === 'completada' ? 'ok' : w.estado === 'en_curso' ? 'info' : 'warn'} /></td>
          <td>{can('mantenimiento') && w.estado !== 'completada' && <button className="btn sm" onClick={() => set(w.id, w.estado === 'pendiente' ? 'en_curso' : 'completada')}>{w.estado === 'pendiente' ? 'Iniciar' : 'Completar'}</button>}</td></tr>)}
        {!rows.length && <tr><td className="muted">Sin órdenes. Se generan desde Preventivo.</td></tr>}
      </tbody></table></div>
    </>
  );
}
