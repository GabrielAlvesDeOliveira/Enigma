import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from './Logo.jsx'

export default function MasterLayout() {
  const { logout } = useAuth()

  return (
    <div className="master-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Logo className="sidebar-logo" />
          <nav className="sidebar-nav" aria-label="Menu do mestre">
            <NavLink className="sidebar-link" to="/mestre">
              Sessões
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-logout" type="button" onClick={logout}>
            Desconectar
          </button>
        </div>
      </aside>

      <main className="master-content">
        <Outlet />
      </main>
    </div>
  )
}
