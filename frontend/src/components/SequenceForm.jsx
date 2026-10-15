import { useState } from 'react'
import FormField from './FormField.jsx'

// Enigma da sequência: mostra os números e recebe o próximo (número).
export default function SequenceForm({ puzzle, submitting, onSubmit }) {
  const [text, setText] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!submitting) onSubmit(text.trim())
  }

  return (
    <form className="puzzle-form" onSubmit={handleSubmit}>
      <p className="puzzle-statement">{puzzle.statement}</p>
      <p className="sequence-terms">{puzzle.terms.join(', ')}, ?</p>

      <FormField
        label="Próximo número"
        name="answer"
        type="number"
        step="any"
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
