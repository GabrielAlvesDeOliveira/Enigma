export function mergeAttempts(current, incoming) {
  const byId = new Map(current.map((attempt) => [attempt.id, attempt]))

  for (const attempt of incoming) byId.set(attempt.id, attempt)

  return [...byId.values()].sort((a, b) => a.id - b.id)
}

export function countByPuzzle(attempts) {
  const counts = {}

  for (const attempt of attempts) {
    counts[attempt.puzzleKey] ??= { total: 0, wrong: 0 }
    counts[attempt.puzzleKey].total += 1
    if (!attempt.isCorrect) counts[attempt.puzzleKey].wrong += 1
  }

  return counts
}
