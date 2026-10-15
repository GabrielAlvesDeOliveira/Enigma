import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  auth,
  clearToken,
  getToken,
  setToken,
  setUnauthorizedHandler,
} from '../services/api.js'

const AuthContext = createContext(null)

// Guarda quem está logado e oferece login, cadastro e saída para o app inteiro.
// Ao abrir a página, se houver um token salvo, confirma com a API quem é o usuário.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Verdadeiro quando a pessoa clicou em sair (e não quando a sessão venceu).
  // O App usa isso para NÃO guardar a página de onde ela saiu.
  const [loggedOut, setLoggedOut] = useState(false)
  // Só começa "carregando" se houver token para conferir (evita piscar a tela de login).
  const [isLoading, setIsLoading] = useState(() => Boolean(getToken()))

  // Conta quantas vezes a sessão mudou (login, cadastro, saída). Assim, a resposta
  // atrasada de uma conferência antiga nunca desfaz uma mudança mais nova.
  const sessionVersion = useRef(0)

  // A sessão acabou sem a pessoa pedir (por exemplo, o token venceu).
  const expireSession = useCallback(() => {
    sessionVersion.current += 1
    clearToken()
    setUser(null)
  }, [])

  // A pessoa clicou em sair.
  const logout = useCallback(() => {
    expireSession()
    setLoggedOut(true)
  }, [expireSession])

  // Restaura a sessão ao abrir a página.
  useEffect(() => {
    if (!getToken()) return undefined

    const version = sessionVersion.current
    let active = true

    auth
      .me()
      .then(({ user: current }) => {
        if (active && version === sessionVersion.current) setUser(current)
      })
      .catch((error) => {
        // Só descarta o token se a API disse que ele não vale mais.
        // Se foi falha de conexão, o token é mantido para uma próxima tentativa.
        if (error instanceof ApiError && error.status === 401) clearToken()
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Se a API recusar o token no meio do uso (venceu), sai automaticamente.
  useEffect(() => {
    setUnauthorizedHandler(expireSession)
    return () => setUnauthorizedHandler(null)
  }, [expireSession])

  const startSession = useCallback(({ user: loggedUser, token }) => {
    sessionVersion.current += 1
    setToken(token)
    setUser(loggedUser)
    setLoggedOut(false)
    setIsLoading(false)
    return loggedUser
  }, [])

  const login = useCallback(
    async ({ email, password }) => startSession(await auth.login({ email, password })),
    [startSession],
  )

  const register = useCallback(
    async ({ name, email, password }) =>
      startSession(await auth.register({ name, email, password })),
    [startSession],
  )

  const value = useMemo(
    () => ({
      user,
      isLoading,
      loggedOut,
      isAuthenticated: user !== null,
      isMaster: user?.role === 'admin',
      isPlayer: user?.role === 'player',
      login,
      register,
      logout,
    }),
    [user, isLoading, loggedOut, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth precisa ser usado dentro de <AuthProvider>.')
  }
  return context
}
