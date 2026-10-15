import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import FormError from '../components/FormError.jsx'
import FormField from '../components/FormField.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ApiError } from '../services/api.js'

export default function Login() {
  const { login } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setError('')
    setSubmitting(true)

    try {
      // Depois de entrar, o App.jsx leva a pessoa para a página certa sozinho.
      await login({ email, password })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1 className="auth-title">Entrar</h1>

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            label="E-mail"
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          <FormField
            label="Senha"
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />

          <FormError message={error} />

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* O state leva junto a página que a pessoa tentou abrir, para ela voltar a ela depois do cadastro. */}
        <p className="auth-switch">
          Ainda não tem conta?{' '}
          <Link className="auth-link" to="/cadastro" state={location.state}>
            Cadastre-se
          </Link>
        </p>
      </section>
    </main>
  )
}
