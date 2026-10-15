import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FormError from '../components/FormError.jsx'
import FormField from '../components/FormField.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { admin, ApiError, rooms } from '../services/api.js'
import { formatDateTime, formatDuration, roomStatusLabel } from '../utils/format.js'

const PAGE_SIZE = 10
const NO_FILTERS = { guided: false, status: '', reason: '', from: '', to: '' }

// Página inicial do mestre: botão para criar sala e a lista de todas as sessões,
// com filtros, da mais nova para a mais antiga.
export default function MasterPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [filters, setFilters] = useState(NO_FILTERS)
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({ loading: true, error: '', data: null })

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    let active = true

    admin
      .rooms({
        page,
        pageSize: PAGE_SIZE,
        status: filters.status,
        reason: filters.reason,
        from: filters.from,
        to: filters.to,
        guided: filters.guided || undefined,
      })
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : 'Não foi possível carregar as sessões.'
        if (active) setState((previous) => ({ ...previous, loading: false, error: message }))
      })

    return () => {
      active = false
    }
  }, [filters, page, reloadKey])

  function startLoading() {
    setState((previous) => ({ ...previous, loading: true, error: '' }))
  }

  // Qualquer mudança de filtro volta para a primeira página.
  function changeFilter(name, value) {
    startLoading()
    setPage(1)
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  function clearFilters() {
    startLoading()
    setPage(1)
    setFilters(NO_FILTERS)
  }

  function goToPage(next) {
    startLoading()
    setPage(next)
  }

  function reload() {
    startLoading()
    setReloadKey((key) => key + 1)
  }

  async function handleCreate() {
    setCreateError('')
    setCreating(true)

    try {
      const { room } = await rooms.create()
      navigate(`/mestre/sala/${room.id}`)
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Não foi possível criar a sala.')
      setCreating(false)
    }
  }

  const { loading, error, data } = state
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <section className="master-page">
      <h1 className="master-title">Painel do mestre</h1>

      <div className="master-create">
        <button className="master-create-button" type="button" disabled={creating} onClick={handleCreate}>
          {creating ? 'Criando...' : 'Criar sala'}
        </button>
        <FormError message={createError} />
      </div>

      <h2 className="sessions-title">Sessões</h2>

      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <label className="filter filter-guided">
          <input
            type="checkbox"
            checked={filters.guided}
            onChange={(event) => changeFilter('guided', event.target.checked)}
          />{' '}
          Só as que eu guiei
        </label>

        <label className="filter">
          <span className="filter-label">Situação</span>
          <select value={filters.status} onChange={(event) => changeFilter('status', event.target.value)}>
            <option value="">Todas</option>
            <option value="waiting">Aguardando</option>
            <option value="in_progress">Em andamento</option>
            <option value="finished">Encerrada</option>
          </select>
        </label>

        <label className="filter">
          <span className="filter-label">Resultado</span>
          <select value={filters.reason} onChange={(event) => changeFilter('reason', event.target.value)}>
            <option value="">Todos</option>
            <option value="completed">Concluída</option>
            <option value="timeout">Tempo esgotado</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>

        <FormField
          label="De"
          name="from"
          type="date"
          value={filters.from}
          onChange={(value) => changeFilter('from', value)}
        />
        <FormField
          label="Até"
          name="to"
          type="date"
          value={filters.to}
          onChange={(value) => changeFilter('to', value)}
        />

        <button className="filters-clear" type="button" onClick={clearFilters}>
          Limpar filtros
        </button>
        <button className="filters-reload" type="button" onClick={reload}>
          Atualizar
        </button>
      </form>

      {loading && <p className="sessions-status">Carregando sessões...</p>}

      <FormError message={error} />

      {!loading && !error && data && data.rooms.length === 0 && (
        <p className="sessions-empty">Nenhuma sessão encontrada.</p>
      )}

      {!loading && !error && data && data.rooms.length > 0 && (
        <>
          <ul className="sessions-list">
            {data.rooms.map((room) => (
              <li className="session-item" key={room.id} data-mine={room.master.id === user.id}>
                <h3 className="session-item-title">Sala {room.code}</h3>

                <dl className="session-item-details">
                  <div className="session-detail">
                    <dt>Data</dt>
                    <dd>{formatDateTime(room.createdAt)}</dd>
                  </div>
                  <div className="session-detail">
                    <dt>Mestre</dt>
                    <dd>
                      {room.master.name}
                      {room.master.id === user.id ? ' (você)' : ''}
                    </dd>
                  </div>
                  <div className="session-detail">
                    <dt>Jogadores</dt>
                    <dd>{room.players.map((player) => player.name).join(', ') || 'Ninguém'}</dd>
                  </div>
                  <div className="session-detail">
                    <dt>Situação</dt>
                    <dd>{roomStatusLabel(room)}</dd>
                  </div>
                  <div className="session-detail">
                    <dt>Enigmas resolvidos</dt>
                    <dd>
                      {room.puzzlesSolved}/{room.puzzlesTotal}
                    </dd>
                  </div>
                  <div className="session-detail">
                    <dt>Tempo gasto</dt>
                    <dd>{formatDuration(room.timeSpentMs)}</dd>
                  </div>
                </dl>

                <Link className="session-item-link" to={`/mestre/sala/${room.id}`}>
                  Abrir
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav className="pagination" aria-label="Páginas das sessões">
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
