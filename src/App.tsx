import { useEffect, useRef } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle, BarChart3, Boxes, CalendarClock, LayoutDashboard, LogOut, Users, Wallet, ClipboardList, Columns3 } from 'lucide-react';
import { useApp } from './lib/app';
import { isDemo } from './lib/db';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import Failures from './pages/Failures';
import FailureNew from './pages/FailureNew';
import FailureDetail from './pages/FailureDetail';
import Plans from './pages/Plans';
import WorkOrders from './pages/WorkOrders';
import Costs from './pages/Costs';
import Reports from './pages/Reports';
import UsersPage from './pages/Users';
import Kanban from './pages/Kanban';
import Labels from './pages/Labels';

const links = [
  ['/', 'Dashboard', LayoutDashboard], ['/fallas', 'Fallas', AlertTriangle], ['/tablero', 'Tablero', Columns3], ['/activos', 'Activos', Boxes],
  ['/ordenes', 'Órdenes', ClipboardList], ['/planes', 'Preventivo', CalendarClock], ['/costos', 'Costos', Wallet],
  ['/reportes', 'Reportes', BarChart3], ['/usuarios', 'Usuarios', Users],
] as const;

export function App() {
  const { me, loading, signOut, can } = useApp();
  const loc = useLocation();
  const bar = useRef<HTMLElement>(null);
  // Al cambiar de sección, la barra se desliza para dejar visible la pestaña activa.
  useEffect(() => { bar.current?.querySelector('a.active')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [loc.pathname, loading, me]);
  if (loading) return <div className="main muted">Cargando…</div>;
  if (!me) return <Login />;
  const visible = links.filter(([to]) => (to === '/usuarios' ? can() : to === '/costos' || to === '/reportes' ? can('mantenimiento', 'consulta') : true));
  const items = visible.map(([to, label, Icon]) => (
    <NavLink key={to} to={to} end={to === '/'}><Icon size={18} />{label}</NavLink>
  ));
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><b>GMM</b><i /><small>Glasstech Maintenance Manager</small></div>
        <nav className="nav">{items}</nav>
        <div className="sp" />
        <div style={{ padding: 8, fontSize: 12 }}>
          <div>{me.nombre}</div><div style={{ opacity: .65 }}>{me.rol}{isDemo && ' · demo'}</div>
          <button className="btn ghost sm" style={{ color: '#fff', marginTop: 6 }} onClick={signOut}><LogOut size={14} />Salir</button>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/activos" element={<Assets />} />
          <Route path="/activos/:id" element={<AssetDetail />} />
          <Route path="/tablero" element={<Kanban />} />
          <Route path="/fallas" element={<Failures />} />
          <Route path="/fallas/nueva" element={<FailureNew />} />
          <Route path="/fallas/:id" element={<FailureDetail />} />
          <Route path="/ordenes" element={<WorkOrders />} />
          <Route path="/planes" element={<Plans />} />
          <Route path="/costos" element={<Costs />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/etiquetas" element={can('mantenimiento') ? <Labels /> : <Navigate to="/" />} />
          <Route path="/usuarios" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      {/* Celular: barra inferior que se desliza hacia los lados con todas las secciones; "Salir" al final. */}
      <nav className="tabbar" ref={bar} aria-label="Secciones">
        {items}
        <button type="button" onClick={signOut}><LogOut size={18} />Salir</button>
      </nav>
    </div>
  );
}
