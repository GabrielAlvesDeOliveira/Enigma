import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Countdown from '../components/Countdown.jsx'
import FormError from '../components/FormError.jsx'
import Logo from '../components/Logo.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import usePuzzleTitles from '../hooks/usePuzzleTitles.js'
import useRoom from '../hooks/useRoom.js'
import { admin, ApiError, rooms } from '../services/api.js'
import { countByPuzzle, mergeAttempts } from '../utils/attempts.js'
import { formatAnswer, formatClock, roomStatusLabel } from '../utils/format.js'

const MAX_PLAYERS = 3

const RESULT_MESSAGES = {
  completed: 'Os jogadores resolveram os 3 enigmas.',
  timeout: 'O tempo acabou.',
  cancelled: 'A sala foi cancelada.',
}

export default function MasterRoom() {
  const { roomId } = useParams()
  const [attempt, setAttempt] = useState(0)

  return (
    <MasterRoomView
      key={`${roomId}-${attempt}`}
      roomId={roomId}
      onRetry={() => setAttempt((count) => count + 1)}
    />
  )
}

function MasterRoomView({ roomId, onRetry }) {
  const { user } = useAuth()
  const titles = usePuzzleTitles(roomId)

  const [attempts, setAttempts] = useState([])
  const addAttempt = useCallback((attempt) => setAttempts((current) => mergeAttempts(current, [attempt])), [])

  const { room, error, loading, offline, serverOffset, applyRoom } = useRoom(roomId, {
    onAttempt: addAttempt,
  })

  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  useEffect(() => {
    let active = true

    admin
      .room(roomId)
      .then((result) => {
        if (active) setAttempts((current) => mergeAttempts(current, result.attempts))
      })
      .catch(() => {
      })

    return () => {
      active = false
    }
  }, [roomId])

  const wasOffline = useRef(false)
  useEffect(() => {
    if (offline) {
      wasOffline.current = true
      return undefined
    }
    if (!wasOffline.current) return undefined
    wasOffline.current = false

    let active = true

    admin
      .room(roomId)
      .then((result) => {
        if (active) setAttempts((current) => mergeAttempts(current, result.attempts))
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [offline, roomId])

  async function runAction(action) {
    setActionError('')
    setBusy(true)

    try {
      const result = await action()
      applyRoom(result.room) 
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
      setConfirmingCancel(false)
    }
  }

  if (loading) {
    return (
      <main className="master-room-page">
        <Logo />
        <p className="room-status">Carregando sala...</p>

        {offline && (
          <>
            <p className="room-slow" role="status">
              Está demorando mais do que o normal para conectar ao servidor. Verifique se ele está
              rodando e se a sua conexão está boa. Continuamos tentando.
            </p>
            <button className="room-retry" type="button" onClick={onRetry}>
              Tentar de novo
            </button>
            <Link className="room-back" to="/mestre">
              Voltar ao painel
            </Link>
          </>
        )}
      </main>
    )
  }

  if (error) {
    return (
      <main className="master-room-page">
        <Logo />
        <FormError message={error} />
        <Link className="room-back" to="/mestre">
          Voltar ao painel
        </Link>
      </main>
    )
  }

  const waiting = room.status === 'waiting'
  const inProgress = room.status === 'in_progress'
  const finished = room.status === 'finished'
  const isOwner = room.master.id === user.id
  const counts = countByPuzzle(attempts)
  const playerName = (id) => room.players.find((player) => player.id === id)?.name ?? 'outro jogador'

  return (
    <main className="master-room-page">
      <header className="master-room-header">
        <Link className="room-back" to="/mestre">
          Voltar ao painel
        </Link>
        <div className="master-room-heading">
          <Logo />
          <h1 className="master-room-title">
            Sala <span className="room-code">{room.code}</span>
          </h1>
        </div>
        <p className="master-room-status">{roomStatusLabel(room)}</p>
        {offline && (
          <p className="room-connection" role="status">
            Reconectando...
          </p>
        )}
      </header>

      {waiting && (
        <p className="master-room-hint">
          Passe o código aos jogadores. Eles entram pela opção "Entrar no jogo".
        </p>
      )}

      {inProgress && <Countdown endsAt={room.endsAt} offset={serverOffset} />}

      {finished && (
        <p className="room-result" role="status" data-reason={room.finishReason}>
          {RESULT_MESSAGES[room.finishReason] ?? 'A sala foi encerrada.'}
        </p>
      )}

      <section className="master-players-section">
        <h2 className="master-section-title">
          Jogadores ({room.players.length}/{MAX_PLAYERS})
        </h2>
        {room.players.length === 0 ? (
          <p className="master-players-empty">Nenhum jogador entrou ainda.</p>
        ) : (
          <ul className="room-players">
            {room.players.map((player) => (
              <li className="room-player" key={player.id}>
                {player.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!waiting && (
        <>
          <section className="master-puzzles-section">
            <h2 className="master-section-title">Enigmas</h2>
            <ul className="master-puzzle-list">
              {room.puzzles.map((puzzle) => {
                const count = counts[puzzle.key] ?? { total: 0, wrong: 0 }
                return (
                  <li className="master-puzzle" key={puzzle.key} data-status={puzzle.status}>
                    <span className="master-puzzle-title">{titles[puzzle.key] ?? puzzle.key}</span>
                    <span className="master-puzzle-status">
                      {puzzle.status === 'solved'
                        ? `Resolvido por ${playerName(puzzle.solvedBy)}`
                        : 'Em aberto'}
                    </span>
                    <span className="master-puzzle-attempts">
                      {count.total} {count.total === 1 ? 'tentativa' : 'tentativas'} ({count.wrong}{' '}
                      {count.wrong === 1 ? 'errada' : 'erradas'})
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="master-attempts-section">
            <h2 className="master-section-title">Tentativas</h2>
            {attempts.length === 0 ? (
              <p className="master-attempts-empty">Nenhuma tentativa ainda.</p>
            ) : (
              <ul className="attempt-list">
                {[...attempts].reverse().map((attempt) => (
                  <li className="attempt" key={attempt.id} data-correct={attempt.isCorrect}>
                    <span className="attempt-time">{formatClock(attempt.createdAt)}</span>
                    <span className="attempt-player">{attempt.user.name}</span>
                    <span className="attempt-puzzle">{titles[attempt.puzzleKey] ?? attempt.puzzleKey}</span>
                    <span className="attempt-answer">{formatAnswer(attempt.answer)}</span>
                    <span className="attempt-result">{attempt.isCorrect ? 'Certa' : 'Errada'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {!finished && !isOwner && (
        <p className="master-room-note">
          Esta sala é de {room.master.name}. Você pode acompanhar, mas só ele controla a sala.
        </p>
      )}

      {!finished && isOwner && (
        <section className="master-actions">
          <FormError message={actionError} />

          {waiting && (
            <button
              className="master-start"
              type="button"
              disabled={busy || room.players.length === 0}
              onClick={() => runAction(() => rooms.start(roomId))}
            >
              {busy ? 'Iniciando...' : 'Iniciar'}
            </button>
          )}

          {!confirmingCancel && (
            <button
              className="master-cancel"
              type="button"
              disabled={busy}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancelar sala
            </button>
          )}

          {confirmingCancel && (
            <div className="master-cancel-confirm" role="group" aria-label="Confirmar cancelamento">
              <p className="master-cancel-question">Tem certeza? Os jogadores perdem a partida.</p>
              <button
                className="master-cancel-yes"
                type="button"
                disabled={busy}
                onClick={() => runAction(() => rooms.cancel(roomId))}
              >
                {busy ? 'Cancelando...' : 'Sim, cancelar'}
              </button>
              <button
                className="master-cancel-no"
                type="button"
                disabled={busy}
                onClick={() => setConfirmingCancel(false)}
              >
                Voltar
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
