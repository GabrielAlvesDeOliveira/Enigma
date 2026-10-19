import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from './Logo.jsx'

export default function PlayerLayout() {
  const { logout } = useAuth()

  return (
    <div className="player-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Logo className="sidebar-logo" />
          <nav className="sidebar-nav" aria-label="Menu do jogador">
            <NavLink className="sidebar-link" to="/jogo">
              Entrar no jogo
            </NavLink>
            <NavLink className="sidebar-link" to="/historico">
              Histórico
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-logout" type="button" onClick={logout}>
            Desconectar
          </button>
        </div>
      </aside>

      <main className="player-content">
        <Outlet />
      </main>
    </div>
  )
}
