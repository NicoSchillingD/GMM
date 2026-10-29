import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AlertTriangle, BarChart3, Boxes, CalendarClock, LayoutDashboard, LogOut, Users, Wallet, ClipboardList } from 'lucide-react';
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

const links = [
  ['/', 'Dashboard', LayoutDashboard], ['/fallas', 'Fallas', AlertTriangle], ['/activos', 'Activos', Boxes],
  ['/ordenes', 'Órdenes', ClipboardList], ['/planes', 'Preventivo', CalendarClock], ['/costos', 'Costos', Wallet],
  ['/reportes', 'Reportes', BarChart3], ['/usuarios', 'Usuarios', Users],
] as const;

export function App() {
  const { me, loading, signOut, can } = useApp();
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
          <Route path="/fallas" element={<Failures />} />
          <Route path="/fallas/nueva" element={<FailureNew />} />
          <Route path="/fallas/:id" element={<FailureDetail />} />
          <Route path="/ordenes" element={<WorkOrders />} />
          <Route path="/planes" element={<Plans />} />
          <Route path="/costos" element={<Costs />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/usuarios" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <nav className="tabbar">{items.slice(0, 5)}</nav>
    </div>
  );
}
