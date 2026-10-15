import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FormError from '../components/FormError.jsx'
import { ApiError, rooms } from '../services/api.js'
import { roomStatusLabel } from '../utils/format.js'

// PÁGINA PROVISÓRIA. Mostra o estado da sala lido uma vez pela API, só para o
// fluxo de entrada não terminar no vazio. A tela de verdade (tempo real,
// cronômetro e enigmas) vem na próxima etapa e substitui este arquivo.
export default function Room() {
  const { roomId } = useParams()
  const [state, setState] = useState({ loading: true, error: '', room: null })

  useEffect(() => {
    let active = true

    rooms
      .get(roomId)
      .then(({ room }) => {
        if (active) setState({ loading: false, error: '', room })
      })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : 'Não foi possível carregar a sala.'
        if (active) setState({ loading: false, error: message, room: null })
      })

    return () => {
      active = false
    }
  }, [roomId])

  const { loading, error, room } = state

  return (
    <main className="room-page">
      {loading && <p className="room-status">Carregando sala...</p>}

      <FormError message={error} />

      {room && (
        <>
          <h1 className="room-title">Sala {room.code}</h1>
          <p className="room-note">Esta tela é provisória: o tempo real e os enigmas chegam na próxima etapa.</p>

          <dl className="room-details">
            <div className="room-detail">
              <dt>Situação</dt>
              <dd>{roomStatusLabel(room)}</dd>
            </div>
            <div className="room-detail">
              <dt>Mestre</dt>
              <dd>{room.master.name}</dd>
            </div>
            <div className="room-detail">
              <dt>Jogadores</dt>
              <dd>{room.players.map((player) => player.name).join(', ') || 'Ninguém ainda'}</dd>
            </div>
          </dl>
        </>
      )}

      <Link className="room-back" to="/jogo">
        Voltar
      </Link>
    </main>
  )
}
