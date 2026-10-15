import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Countdown from '../components/Countdown.jsx'
import FormError from '../components/FormError.jsx'
import PuzzleModal from '../components/PuzzleModal.jsx'
import PuzzleSquare from '../components/PuzzleSquare.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import usePuzzleTitles from '../hooks/usePuzzleTitles.js'
import useRoom from '../hooks/useRoom.js'
import { ApiError, rooms } from '../services/api.js'

// Mensagem de cada resultado possível quando a sala termina.
const RESULT_MESSAGES = {
  completed: 'Parabéns! Vocês resolveram os 3 enigmas.',
  timeout: 'O tempo acabou.',
  cancelled: 'O mestre cancelou a sala.',
}

// A "key" faz o estado recomeçar do zero se a pessoa passar de uma sala para outra
// (e também quando ela pede para tentar de novo).
export default function Room() {
  const { roomId } = useParams()
  const [attempt, setAttempt] = useState(0)

  return (
    <RoomView
      key={`${roomId}-${attempt}`}
      roomId={roomId}
      onRetry={() => setAttempt((count) => count + 1)}
    />
  )
}

function RoomView({ roomId, onRetry }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { room, error, loading, offline, serverOffset, applyRoom } = useRoom(roomId)

  const titles = usePuzzleTitles(roomId)
  const [openKey, setOpenKey] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')

  async function handleLeave() {
    setLeaveError('')
    setLeaving(true)

    try {
      await rooms.leave(roomId)
      navigate('/jogo')
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : 'Não foi possível sair da sala.')
      setLeaving(false)
    }
  }

  if (loading) {
    return (
      <main className="room-page">
        <p className="room-status">Carregando sala...</p>

        {/* Se a conexão estiver demorando ou falhando, explica e dá uma saída. */}
        {offline && (
          <>
            <p className="room-slow" role="status">
              Está demorando mais do que o normal para conectar ao servidor. Verifique se ele está
              rodando e se a sua conexão está boa. Continuamos tentando.
            </p>
            <button className="room-retry" type="button" onClick={onRetry}>
              Tentar de novo
            </button>
            <Link className="room-back" to="/jogo">
              Voltar
            </Link>
          </>
        )}
      </main>
    )
  }

  if (error) {
    return (
      <main className="room-page">
        <FormError message={error} />
        <Link className="room-back" to="/jogo">
          Voltar
        </Link>
      </main>
    )
  }

  const playerName = (id) => room.players.find((player) => player.id === id)?.name ?? 'outro jogador'
  const waiting = room.status === 'waiting'
  const inProgress = room.status === 'in_progress'
  const finished = room.status === 'finished'

  const openPuzzle = room.puzzles.find((puzzle) => puzzle.key === openKey)

  return (
    <main className="room-page">
      <header className="room-header">
        <h1 className="room-title">Sala {room.code}</h1>
        {offline && (
          <p className="room-connection" role="status">
            Reconectando...
          </p>
        )}
      </header>

      {waiting && <p className="room-waiting">Aguardando o mestre iniciar.</p>}

      {inProgress && <Countdown endsAt={room.endsAt} offset={serverOffset} />}

      {finished && (
        <p className="room-result" role="status">
          {RESULT_MESSAGES[room.finishReason] ?? 'A sala foi encerrada.'}
        </p>
      )}

      {/* Os quadrados só aparecem com a sala em andamento ou encerrada (aí, só para leitura). */}
      {!waiting && (
        <div className="puzzle-grid">
          {room.puzzles.map((puzzle) => (
            <PuzzleSquare
              key={puzzle.key}
              title={titles[puzzle.key] ?? puzzle.key}
              status={puzzle.status}
              solverName={playerName(puzzle.solvedBy)}
              readOnly={!inProgress}
              onOpen={() => setOpenKey(puzzle.key)}
            />
          ))}
        </div>
      )}

      <section className="room-players-section">
        <h2 className="room-players-title">Jogadores</h2>
        <ul className="room-players">
          {room.players.map((player) => (
            <li className="room-player" key={player.id}>
              {player.name}
            </li>
          ))}
        </ul>
      </section>

      {waiting && (
        <>
          <FormError message={leaveError} />
          <button className="room-leave" type="button" disabled={leaving} onClick={handleLeave}>
            {leaving ? 'Saindo...' : 'Sair da sala'}
          </button>
        </>
      )}

      {finished && (
        <Link className="room-back" to="/jogo">
          Voltar
        </Link>
      )}

      {openPuzzle && (
        <PuzzleModal
          key={openPuzzle.key}
          roomId={roomId}
          puzzleKey={openPuzzle.key}
          title={titles[openPuzzle.key] ?? openPuzzle.key}
          puzzleState={openPuzzle}
          solverName={playerName(openPuzzle.solvedBy)}
          roomActive={inProgress}
          currentUserId={user.id}
          onRoomUpdate={applyRoom}
          onClose={() => setOpenKey(null)}
        />
      )}
    </main>
  )
}
