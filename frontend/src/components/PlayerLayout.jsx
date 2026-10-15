import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Estrutura da visão do jogador: menu lateral à esquerda (links no topo e
// "Desconectar" no rodapé) e, ao lado, a página atual (Outlet).
// O link da página aberta recebe automaticamente a classe "active".
export default function PlayerLayout() {
  const { logout } = useAuth()

  return (
    <div className="player-layout">
      <aside className="sidebar">
        <nav className="sidebar-nav" aria-label="Menu do jogador">
          <NavLink className="sidebar-link" to="/jogo">
            Entrar no jogo
          </NavLink>
          <NavLink className="sidebar-link" to="/historico">
            Histórico
          </NavLink>
        </nav>

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
