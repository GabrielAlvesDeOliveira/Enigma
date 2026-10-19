import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormError from '../components/FormError.jsx'
import FormField from '../components/FormField.jsx'
import { ApiError, rooms } from '../services/api.js'

const CODE_LENGTH = 6

const cleanCode = (text) => text.replace(/\s+/g, '').toUpperCase().slice(0, CODE_LENGTH)

export default function JoinGame() {
  const navigate = useNavigate()

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setError('')
    setSubmitting(true)

    try {
      const { room } = await rooms.join(code)
      navigate(`/sala/${room.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar na sala. Tente novamente.')
      setSubmitting(false)
    }
  }

  return (
    <section className="join-page">
      <div className="join-card">
        <h1 className="join-title">Entrar no jogo</h1>

        <form className="join-form" onSubmit={handleSubmit}>
          <FormField
            label="Código da sala"
            name="code"
            value={code}
            onChange={(text) => setCode(cleanCode(text))}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            minLength={CODE_LENGTH}
            required
          />

          <FormError message={error} />

          <button className="join-submit" type="submit" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar na sala'}
          </button>
        </form>
      </div>
    </section>
  )
}
