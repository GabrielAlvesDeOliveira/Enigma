import { useAuth } from '../context/AuthContext.jsx'

// PÁGINA PROVISÓRIA do mestre. O painel de verdade (criar sala, acompanhar
// jogadores, tempo e tentativas) vem em uma próxima etapa. Já tem o botão de
// sair para o mestre conseguir trocar de conta durante os testes.
export default function MasterPanel() {
  const { user, logout } = useAuth()

  return (
    <main className="master-page">
      <h1 className="master-title">Painel do mestre</h1>
      <p className="master-note">Olá, {user.name}. Esta tela está em construção.</p>

      <button className="master-logout" type="button" onClick={logout}>
        Desconectar
      </button>
    </main>
  )
}
