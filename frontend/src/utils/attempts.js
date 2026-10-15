// Apoio às tentativas de resposta mostradas no painel do mestre.

// Junta tentativas novas às que já existem, sem repetir (pelo id) e em ordem.
// Serve tanto para a carga inicial quanto para as que chegam ao vivo.
export function mergeAttempts(current, incoming) {
  const byId = new Map(current.map((attempt) => [attempt.id, attempt]))

  for (const attempt of incoming) byId.set(attempt.id, attempt)

  return [...byId.values()].sort((a, b) => a.id - b.id)
}

// Quantas tentativas cada enigma teve: { cipher: { total: 3, wrong: 2 }, ... }
export function countByPuzzle(attempts) {
  const counts = {}

  for (const attempt of attempts) {
    counts[attempt.puzzleKey] ??= { total: 0, wrong: 0 }
    counts[attempt.puzzleKey].total += 1
    if (!attempt.isCorrect) counts[attempt.puzzleKey].wrong += 1
  }

  return counts
}
