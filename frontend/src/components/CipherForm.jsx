import { useState } from 'react'
import FormField from './FormField.jsx'

export default function CipherForm({ puzzle, submitting, onSubmit }) {
  const [text, setText] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!submitting) onSubmit(text.trim())
  }

  return (
    <form className="puzzle-form" onSubmit={handleSubmit}>
      <p className="puzzle-statement">{puzzle.statement}</p>
      <p className="cipher-text">{puzzle.encryptedText}</p>

      <FormField
        label="Mensagem decifrada"
        name="answer"
        value={text}
        onChange={setText}
        autoComplete="off"
        required
      />

      <button className="puzzle-submit" type="submit" disabled={submitting}>
        {submitting ? 'Enviando...' : 'Enviar resposta'}
      </button>
    </form>
  )
}
