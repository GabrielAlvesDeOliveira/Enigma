import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Estrutura das páginas do mestre: menu lateral à esquerda (links no topo e
// "Desconectar" no rodapé) e, ao lado, a página atual (Outlet).
// As classes do menu são as mesmas da visão do jogador (sidebar-*).
export default function MasterLayout() {
  const { logout } = useAuth()

  return (
    <div className="master-layout">
      <aside className="sidebar">
        <nav className="sidebar-nav" aria-label="Menu do mestre">
          <NavLink className="sidebar-link" to="/mestre">
            Sessões
          </NavLink>
        </nav>

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
