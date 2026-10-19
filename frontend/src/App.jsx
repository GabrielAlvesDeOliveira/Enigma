import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import MasterLayout from './components/MasterLayout.jsx'
import PlayerLayout from './components/PlayerLayout.jsx'
import History from './pages/History.jsx'
import JoinGame from './pages/JoinGame.jsx'
import Login from './pages/Login.jsx'
import MasterPanel from './pages/MasterPanel.jsx'
import MasterRoom from './pages/MasterRoom.jsx'
import Register from './pages/Register.jsx'
import Room from './pages/Room.jsx'

const homeFor = (user) => (user.role === 'admin' ? '/mestre' : '/jogo')

function Loading() {
  return <p className="app-loading">Carregando...</p>
}


function ProtectedRoute({ role }) {
  const { user, isLoading, loggedOut } = useAuth()
  const location = useLocation()

  if (isLoading) return <Loading />

  if (!user) return <Navigate to="/login" replace state={loggedOut ? undefined : { from: location }} />
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />

  return <Outlet />
}


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
        <Route element={<PlayerLayout />}>
          <Route path="/jogo" element={<JoinGame />} />
          <Route path="/historico" element={<History />} />
        </Route>

        <Route path="/sala/:roomId" element={<Room />} />
      </Route>

      <Route element={<ProtectedRoute role="admin" />}>
        <Route element={<MasterLayout />}>
          <Route path="/mestre" element={<MasterPanel />} />
        </Route>

        <Route path="/mestre/sala/:roomId" element={<MasterRoom />} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
