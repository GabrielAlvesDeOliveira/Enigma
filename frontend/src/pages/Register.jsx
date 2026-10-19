import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import FormError from '../components/FormError.jsx'
import FormField from '../components/FormField.jsx'
import Logo from '../components/Logo.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ApiError } from '../services/api.js'

export default function Register() {
  const { register } = useAuth()
  const location = useLocation()

  const [name, setName] = useState('')
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
      await register({ name, email, password })
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível cadastrar. Tente novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand">
        <Logo />
        <p className="auth-brand-name">Sala de Enigmas</p>
      </div>

      <section className="auth-card">
        <h1 className="auth-title">Cadastrar</h1>

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            label="Nome"
            name="name"
            value={name}
            onChange={setName}
            autoComplete="name"
            minLength={2}
            maxLength={80}
            required
          />
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
            hint="Mínimo de 8 caracteres."
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />

          <FormError message={error} />

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>

        <p className="auth-switch">
          Já tem conta?{' '}
          <Link className="auth-link" to="/login" state={location.state}>
            Entrar
          </Link>
        </p>
      </section>
    </main>
  )
}
