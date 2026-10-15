// Um dos 3 quadrados da sala (um por enigma).
// Aberto: clicável. Resolvido: desativado para todos, mostrando quem resolveu.
// "readOnly" é para a sala fora de andamento (aguardando ou encerrada).
export default function PuzzleSquare({ title, status, solverName, readOnly, onOpen }) {
  const solved = status === 'solved'

  let statusText = 'Resolver'
  if (solved) statusText = `Resolvido por ${solverName}`
  else if (readOnly) statusText = 'Não resolvido'

  return (
    <button
      className="puzzle-square"
      type="button"
      data-status={status}
      disabled={solved || readOnly}
      onClick={onOpen}
    >
      <span className="puzzle-square-title">{title}</span>
      <span className="puzzle-square-status">{statusText}</span>
    </button>
  )
}
