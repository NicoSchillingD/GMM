import { Top } from '../components/Brand';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { useApp } from '../lib/app';
import { assetQrUrl } from '../lib/qr';
import type { Asset } from '../lib/types';

/** Código QR de un activo (SVG como data URL). */
export function useQr(assetId: string | undefined, width = 220) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!assetId) return;
    let ok = true;
    void QRCode.toDataURL(assetQrUrl(assetId), { errorCorrectionLevel: 'M', margin: 1, width }).then((u) => { if (ok) setSrc(u); });
    return () => { ok = false; };
  }, [assetId, width]);
  return src;
}

export function QrLabel({ a, area }: { a: Asset; area?: string }) {
  const src = useQr(a.id, 240);
  return (
    <div className="qrlabel">
      {src ? <img src={src} alt={`QR de ${a.tag || 'equipo sin TAG'}`} /> : <div className="qrph" />}
      <div><b>{a.tag || 'S/TAG'}</b><div>{a.tipo} {a.marca}</div>{area && <div className="muted">{area}</div>}</div>
    </div>
  );
}

/** Hoja imprimible de etiquetas QR por área, para pegar en cada equipo o componente. */
export default function Labels() {
  const { data } = useApp();
  const [sp, setSp] = useSearchParams();
  const area = sp.get('area') ?? '';
  const list = data.assets.filter((a) => a.estado !== 'desincorporado' && (!area || a.area_id === area));
  const areaName = (id: string | null) => data.areas.find((x) => x.id === id)?.nombre;
  return (
    <>
      <Top className="noprint" low><div><Link to="/activos">← Activos</Link><h1>Etiquetas QR</h1></div>
        <button className="btn accent" onClick={() => window.print()}><Printer size={16} />Imprimir</button></Top>
      <div className="card row noprint" style={{ marginBottom: 16 }}>
        <select style={{ maxWidth: 260 }} value={area} onChange={(e) => setSp(e.target.value ? { area: e.target.value } : {})}><option value="">Todas las áreas</option>{data.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
        <span className="muted">{list.length} etiquetas · cada QR abre el reporte de falla con ese equipo ya elegido.</span>
      </div>
      <div className="qrgrid">{list.map((a) => <QrLabel key={a.id} a={a} area={areaName(a.area_id)} />)}</div>
    </>
  );
}
