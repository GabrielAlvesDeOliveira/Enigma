import { useEffect, useId, useRef, useState } from 'react'
import { ApiError, puzzles } from '../services/api.js'
import CipherForm from './CipherForm.jsx'
import MazeForm from './MazeForm.jsx'
import SequenceForm from './SequenceForm.jsx'

const FORMS = { cipher: CipherForm, sequence: SequenceForm, maze: MazeForm }

const CLOSE_DELAY_MS = 1500

export default function PuzzleModal({
  roomId,
  puzzleKey,
  title,
  puzzleState,
  solverName,
  roomActive,
  currentUserId,
  onRoomUpdate,
  onClose,
}) {
  const titleId = useId()
  const dialogRef = useRef(null)

  const [content, setContent] = useState({ loading: true, error: '', data: null })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const solved = puzzleState.status === 'solved'
  const solvedByMe = solved && puzzleState.solvedBy === currentUserId

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog.open) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }, [])

  useEffect(() => {
    let active = true

    puzzles
      .get(roomId, puzzleKey)
      .then(({ puzzle }) => {
        if (active) setContent({ loading: false, error: '', data: puzzle })
      })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : 'Não foi possível carregar o enigma.'
        if (active) setContent({ loading: false, error: message, data: null })
      })

    return () => {
      active = false
    }
  }, [roomId, puzzleKey])

  const latestOnClose = useRef(onClose)
  useEffect(() => {
    latestOnClose.current = onClose
  })
  useEffect(() => {
    if (!solvedByMe) return undefined
    const timer = setTimeout(() => latestOnClose.current(), CLOSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [solvedByMe])

  async function handleSubmit(answer) {
    setFeedback('')
    setSubmitting(true)

    try {
      const result = await puzzles.answer(roomId, puzzleKey, answer)
      onRoomUpdate(result.room) 
      if (!result.correct) setFeedback('Resposta incorreta. Tente de novo.')
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'Não foi possível enviar a resposta.')
    } finally {
      setSubmitting(false)
    }
  }

  const Form = FORMS[puzzleKey]
  const canAnswer = roomActive && !solved && content.data && Form

  return (
    <dialog
      className="puzzle-modal"
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <header className="puzzle-modal-header">
        <h2 className="puzzle-modal-title" id={titleId}>
          {title}
        </h2>
        <button className="puzzle-modal-close" type="button" onClick={onClose}>
          Fechar
        </button>
      </header>

      <div className="puzzle-modal-body">
        {content.loading && <p className="puzzle-status">Carregando enigma...</p>}

        {content.error && (
          <p className="puzzle-feedback" role="alert">
            {content.error}
          </p>
        )}

        {solvedByMe && (
          <p className="puzzle-feedback puzzle-feedback-success" role="status">
            Resolvido!
          </p>
        )}

        {solved && !solvedByMe && (
          <p className="puzzle-feedback" role="status">
            Este enigma foi resolvido por {solverName}.
          </p>
        )}

        {!solved && !roomActive && (
          <p className="puzzle-feedback" role="status">
            A sala foi encerrada.
          </p>
        )}

        {canAnswer && <Form puzzle={content.data} submitting={submitting} onSubmit={handleSubmit} />}

        {feedback && (
          <p className="puzzle-feedback" role="alert">
            {feedback}
          </p>
        )}
      </div>
    </dialog>
  )
}
