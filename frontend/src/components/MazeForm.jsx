import { useMemo, useState } from 'react'
import { buildAdjacency, listNodes } from '../utils/maze.js'

// Enigma do labirinto: a pessoa monta o caminho da entrada até a saída, sala por sala.
// Só dá para clicar em salas conectadas à última escolhida (e que ainda não foram
// usadas). O caminho começa em "start" e só pode ser enviado quando chega em "end".
export default function MazeForm({ puzzle, submitting, onSubmit }) {
  const adjacency = useMemo(() => buildAdjacency(puzzle.edges), [puzzle.edges])
  const nodes = useMemo(() => listNodes(puzzle.edges), [puzzle.edges])

  const [path, setPath] = useState([puzzle.start])

  const last = path[path.length - 1]
  const reachedEnd = last === puzzle.end

  const canVisit = (node) =>
    !reachedEnd && (adjacency.get(last) ?? []).includes(node) && !path.includes(node)

  const visit = (node) => setPath((current) => [...current, node])
  const undo = () => setPath((current) => (current.length > 1 ? current.slice(0, -1) : current))
  const reset = () => setPath([puzzle.start])

  function handleSubmit(event) {
    event.preventDefault()
    if (reachedEnd && !submitting) onSubmit(path)
  }

  return (
    <form className="puzzle-form maze-form" onSubmit={handleSubmit}>
      <p className="puzzle-statement">{puzzle.statement}</p>

      <section className="maze-map">
        <h3 className="maze-map-title">Conexões</h3>
        <ul className="maze-edges">
          {puzzle.edges.map(([a, b]) => (
            <li className="maze-edge" key={`${a}-${b}`}>
              {a} - {b}
            </li>
          ))}
        </ul>
      </section>

      <p className="maze-path" aria-live="polite">
        Caminho: {path.join(' > ')}
      </p>

      <div className="maze-nodes" role="group" aria-label="Salas do labirinto">
        {nodes.map((node) => (
          <button
            className="maze-node"
            type="button"
            key={node}
            data-visited={path.includes(node)}
            disabled={submitting || !canVisit(node)}
            onClick={() => visit(node)}
          >
            {node}
          </button>
        ))}
      </div>

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
