export function formatDateTime(iso) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '-'
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function roomStatusLabel({ status, finishReason }) {
  if (status === 'waiting') return 'Aguardando o mestre iniciar'
  if (status === 'in_progress') return 'Em andamento'
  if (finishReason === 'completed') return 'Concluída'
  if (finishReason === 'timeout') return 'Tempo esgotado'
  if (finishReason === 'cancelled') return 'Cancelada'
  return 'Encerrada'
}

export function formatClock(iso) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('pt-BR')
}

export function formatAnswer(answer) {
  if (!Array.isArray(answer)) return String(answer)
  if (answer.length <= 6) return answer.join(' > ')

  return `${answer.slice(0, 3).join(' > ')} > ... > ${answer.slice(-2).join(' > ')} (${answer.length} casas)`
}
