import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'

// Página inicial de cada tipo de usuário.
const homeFor = (user) => (user.role === 'admin' ? '/mestre' : '/jogo')

// Provisório: ocupa o lugar das páginas até elas serem criadas (pasta pages).
function Placeholder({ name }) {
  return (
    <main className="placeholder">
      <p>Página: {name}</p>
    </main>
  )
}

function Loading() {
  return <p className="app-loading">Carregando...</p>
}

// Só deixa passar quem está logado. Com "role", só aquele tipo de usuário:
// o outro tipo é levado para a própria página inicial.
function ProtectedRoute({ role }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />

  return <Outlet />
}

// Login e cadastro: quem já está logado é levado para dentro, de volta à página
// que tentou abrir antes de entrar (se houver) ou para a sua página inicial.
function PublicOnlyRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <Loading />

  if (user) {
    const from = location.state?.from
    const target = from ? `${from.pathname}${from.search ?? ''}` : homeFor(user)
    return <Navigate to={target} replace />
  }

  return <Outlet />
}

// "/" e qualquer endereço desconhecido: manda cada um para o lugar certo.
function HomeRedirect() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <Loading />

  return <Navigate to={user ? homeFor(user) : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute role="player" />}>
        {/* Depois: um layout com o menu lateral envolvendo "/jogo" e "/historico". */}
        <Route path="/jogo" element={<Placeholder name="Entrar no jogo" />} />
        <Route path="/historico" element={<Placeholder name="Histórico" />} />
        <Route path="/sala/:roomId" element={<Placeholder name="Sala" />} />
      </Route>

      <Route element={<ProtectedRoute role="admin" />}>
        <Route path="/mestre" element={<Placeholder name="Painel do mestre" />} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
