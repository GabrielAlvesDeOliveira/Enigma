import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FormError from '../components/FormError.jsx'
import { ApiError, rooms } from '../services/api.js'
import { formatDateTime, formatDuration, roomStatusLabel } from '../utils/format.js'

const PAGE_SIZE = 10

// Histórico do jogador: só as sessões em que ele entrou, da mais nova para a mais antiga.
export default function History() {
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({ loading: true, error: '', data: null })

  useEffect(() => {
    let active = true

    rooms
      .mine({ page, pageSize: PAGE_SIZE })
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((err) => {
        const message =
          err instanceof ApiError ? err.message : 'Não foi possível carregar o histórico.'
        if (active) setState((previous) => ({ ...previous, loading: false, error: message }))
      })

    return () => {
      active = false
    }
  }, [page, reloadKey])

  function goToPage(next) {
    setState((previous) => ({ ...previous, loading: true, error: '' }))
    setPage(next)
  }

  function retry() {
    setState((previous) => ({ ...previous, loading: true, error: '' }))
    setReloadKey((key) => key + 1)
  }

  const { loading, error, data } = state
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <section className="history-page">
      <h1 className="history-title">Histórico</h1>

      {loading && <p className="history-status">Carregando histórico...</p>}

      <FormError message={error} />
      {error && (
        <button className="history-retry" type="button" onClick={retry}>
          Tentar de novo
        </button>
      )}

      {!loading && !error && data && data.rooms.length === 0 && (
        <p className="history-empty">Você ainda não jogou nenhuma sessão.</p>
      )}

      {!loading && !error && data && data.rooms.length > 0 && (
        <>
          <ul className="history-list">
            {data.rooms.map((room) => (
              <li className="history-item" key={room.id}>
                <h2 className="history-item-title">Sala {room.code}</h2>

                <dl className="history-item-details">
                  <div className="history-detail">
                    <dt>Data</dt>
                    <dd>{formatDateTime(room.createdAt)}</dd>
                  </div>
                  <div className="history-detail">
                    <dt>Mestre</dt>
                    <dd>{room.master.name}</dd>
                  </div>
                  <div className="history-detail">
                    <dt>Jogadores</dt>
                    <dd>{room.players.map((player) => player.name).join(', ')}</dd>
                  </div>
                  <div className="history-detail">
                    <dt>Resultado</dt>
                    <dd>{roomStatusLabel(room)}</dd>
                  </div>
                  <div className="history-detail">
                    <dt>Enigmas resolvidos</dt>
                    <dd>
                      {room.puzzlesSolved}/{room.puzzlesTotal}
                    </dd>
                  </div>
                  <div className="history-detail">
                    <dt>Tempo gasto</dt>
                    <dd>{formatDuration(room.timeSpentMs)}</dd>
                  </div>
                </dl>

                {/* Salas que ainda não terminaram permitem voltar. */}
                {room.status !== 'finished' && (
                  <Link className="history-item-link" to={`/sala/${room.id}`}>
                    Abrir sala
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav className="pagination" aria-label="Páginas do histórico">
              <button
                className="pagination-button"
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                Anterior
              </button>
              <span className="pagination-info">
                Página {page} de {totalPages}
              </span>
              <button
                className="pagination-button"
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
