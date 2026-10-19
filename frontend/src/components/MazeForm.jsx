import { useMemo, useState } from 'react'
import { areAdjacent, parseLayout, stepFrom } from '../utils/maze.js'

const KEY_DIRECTIONS = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

const KIND_LABELS = { start: 'início', end: 'fim', floor: '', wall: '' }
const KIND_SYMBOLS = { start: 'I', end: 'F', floor: '', wall: '' }

export default function MazeForm({ puzzle, submitting, onSubmit }) {
  const rows = useMemo(() => parseLayout(puzzle.layout), [puzzle.layout])
  const openIds = useMemo(
    () => new Set(rows.flat().filter((cell) => cell.open).map((cell) => cell.id)),
    [rows],
  )

  const [path, setPath] = useState([puzzle.start])

  const last = path[path.length - 1]
  const reachedEnd = last === puzzle.end

  const canStepTo = (id) =>
    !submitting && !reachedEnd && openIds.has(id) && !path.includes(id) && areAdjacent(last, id)

  const undo = () => setPath((current) => (current.length > 1 ? current.slice(0, -1) : current))
  const reset = () => setPath([puzzle.start])

  function handleCellClick(id) {
    const index = path.indexOf(id)

    if (index !== -1) setPath(path.slice(0, index + 1)) 
    else if (canStepTo(id)) setPath([...path, id])
  }

  function handleKeyDown(event) {
    if (submitting) return

    if (event.key === 'Backspace') {
      event.preventDefault()
      undo()
      return
    }

    const direction = KEY_DIRECTIONS[event.key]
    if (!direction) return
    event.preventDefault()

    const target = stepFrom(last, direction, puzzle.rows, puzzle.cols)
    if (!target) return

    if (path.length > 1 && target === path[path.length - 2]) undo()
    else if (canStepTo(target)) setPath([...path, target])
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (reachedEnd && !submitting) onSubmit(path)
  }

  function stateOf(id) {
    if (id === last) return 'current'
    if (path.includes(id)) return 'path'
    return canStepTo(id) ? 'reachable' : 'idle'
  }

  return (
    <form className="puzzle-form maze-form" onSubmit={handleSubmit}>
      <p className="puzzle-statement">{puzzle.statement}</p>
      <p className="maze-help">
        Clique nas casas vizinhas ou selecione a grade e use as setas do teclado para andar. Clique
        em uma casa do caminho para voltar até ela.
      </p>

      <div
        className="maze-grid"
        role="group"
        aria-label="Labirinto"
        tabIndex={0}
        style={{ '--maze-cols': puzzle.cols }}
        onKeyDown={handleKeyDown}
      >
        {rows.flat().map((cell) => {
          if (!cell.open) return <div className="maze-wall" key={cell.id} aria-hidden="true" />

          const state = stateOf(cell.id)
          const inPath = path.includes(cell.id)
          const label = [
            `Linha ${cell.row + 1}, coluna ${cell.col + 1}`,
            KIND_LABELS[cell.kind],
            inPath ? 'no caminho' : '',
          ]
            .filter(Boolean)
            .join(', ')

          return (
            <button
              className="maze-cell"
              type="button"
              key={cell.id}
              tabIndex={-1}
              data-cell={cell.id}
              data-kind={cell.kind}
              data-state={state}
              aria-label={label}
              disabled={submitting || (!inPath && !canStepTo(cell.id))}
              onClick={() => handleCellClick(cell.id)}
            >
              {KIND_SYMBOLS[cell.kind]}
            </button>
          )
        })}
      </div>

      <p className="maze-steps" aria-live="polite">
        Casas no caminho: {path.length}
        {reachedEnd ? ' (chegou ao fim)' : ''}
      </p>

      <div className="maze-actions">
        <button
          className="maze-undo"
          type="button"
          disabled={submitting || path.length <= 1}
          onClick={undo}
        >
          Desfazer
        </button>
        <button
          className="maze-reset"
          type="button"
          disabled={submitting || path.length <= 1}
          onClick={reset}
        >
          Limpar
        </button>
        <button className="puzzle-submit" type="submit" disabled={submitting || !reachedEnd}>
          {submitting ? 'Enviando...' : 'Enviar caminho'}
        </button>
      </div>
    </form>
  )
}
