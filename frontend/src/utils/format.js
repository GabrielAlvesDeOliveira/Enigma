// Funções de apresentação usadas pelas páginas (datas, tempo e situação da sala).

// "2026-10-15T22:09:00.000Z" -> "15/10/2026 19:09" (no fuso do navegador)
export function formatDateTime(iso) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// 125000 -> "02:05". Sem valor, devolve "-".
export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '-'
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

// Texto da situação de uma sala (serve para o estado da sala e para o histórico).
export function roomStatusLabel({ status, finishReason }) {
  if (status === 'waiting') return 'Aguardando o mestre iniciar'
  if (status === 'in_progress') return 'Em andamento'
  if (finishReason === 'completed') return 'Concluída'
  if (finishReason === 'timeout') return 'Tempo esgotado'
  if (finishReason === 'cancelled') return 'Cancelada'
  return 'Encerrada'
}

// "2026-10-15T22:09:41.000Z" -> "19:09:41" (no fuso do navegador)
export function formatClock(iso) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('pt-BR')
}

// A resposta enviada pode ser texto, número ou a lista de salas do labirinto.
export function formatAnswer(answer) {
  if (Array.isArray(answer)) return answer.join(' > ')
  return String(answer)
}
