import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NovoFrete from './pages/NovoFrete'
import Historico from './pages/Historico'
import Relatorios from './pages/Relatorios'

function Header() {
  const location = useLocation()
  const titles = {
    '/': 'Dashboard',
    '/novo': 'Novo Frete',
    '/historico': 'Histórico',
    '/relatorios': 'Relatórios',
  }

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="logo-badge" aria-label="DM Sul">
          <span className="logo-dm">DM</span>
          <span className="logo-sul">SUL</span>
        </div>
        <div className="brand-line" />
      </div>
      <div className="header-info">
        <div className="title">DM SUL</div>
        <div className="subtitle">{titles[location.pathname] || 'Gestão de Fretes'}</div>
      </div>
    </header>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon">01</span>
        <span>Início</span>
      </NavLink>
      <NavLink to="/novo" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon">02</span>
        <span>Novo</span>
      </NavLink>
      <NavLink to="/historico" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon">03</span>
        <span>Histórico</span>
      </NavLink>
      <NavLink to="/relatorios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon">04</span>
        <span>Relatórios</span>
      </NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Header />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/novo" element={<NovoFrete />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/relatorios" element={<Relatorios />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
