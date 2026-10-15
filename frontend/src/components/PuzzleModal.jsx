import { useEffect, useId, useRef, useState } from 'react'
import { ApiError, puzzles } from '../services/api.js'
import CipherForm from './CipherForm.jsx'
import MazeForm from './MazeForm.jsx'
import SequenceForm from './SequenceForm.jsx'

// Cada tipo de enigma tem o seu formulário.
const FORMS = { cipher: CipherForm, sequence: SequenceForm, maze: MazeForm }

// Depois de acertar, o modal fecha sozinho depois deste tempo.
const CLOSE_DELAY_MS = 1500

// Modal de um enigma (usa o <dialog> nativo: fundo escurecido, ESC fecha e o foco
// fica preso dentro). É montado só quando está aberto.
//
// "puzzleState" é o estado AO VIVO do enigma na sala ({ status, solvedBy }), então se
// outra pessoa resolver com o modal aberto, ele avisa e trava o formulário na hora.
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

  // Abre como modal de verdade (com um plano B para navegadores muito antigos).
  // O "open" evita abrir duas vezes (o modo de desenvolvimento do React roda efeitos em dobro).
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog.open) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }, [])

  // Busca o conteúdo do enigma ao abrir.
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

  // Quando a própria pessoa acerta, fecha sozinho depois de mostrar "Resolvido!".
  // O onClose mais recente fica em um ref para o tempo não reiniciar a cada atualização.
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
      onRoomUpdate(result.room) // não espera o aviso do tempo real para atualizar a tela
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
