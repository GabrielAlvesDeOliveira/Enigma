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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const [loggedOut, setLoggedOut] = useState(false)
  const [isLoading, setIsLoading] = useState(() => Boolean(getToken()))

  const sessionVersion = useRef(0)

  const expireSession = useCallback(() => {
    sessionVersion.current += 1
    clearToken()
    setUser(null)
  }, [])

  const logout = useCallback(() => {
    expireSession()
    setLoggedOut(true)
  }, [expireSession])

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
        if (error instanceof ApiError && error.status === 401) clearToken()
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

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

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth precisa ser usado dentro de <AuthProvider>.')
  }
  return context
}
