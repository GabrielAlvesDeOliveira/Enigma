import { useEffect, useState } from 'react'
import { formatDuration } from '../utils/format.js'

const LOW_TIME_MS = 5 * 60 * 1000

// Tempo que falta, em ms, usando o relógio do servidor.
// "offset" é a diferença entre o relógio do servidor e o deste computador.
const remainingFor = (endsAt, offset) => Math.max(0, Date.parse(endsAt) - (Date.now() + offset))

// Cronômetro regressivo da partida (mm:ss). Nos últimos 5 minutos recebe também a
// classe "countdown-low", para quem cuida do visual poder destacar.
// Quando chega a zero, mostra 00:00 e espera o aviso do servidor de que o tempo acabou.
export default function Countdown({ endsAt, offset }) {
  const [remaining, setRemaining] = useState(() => remainingFor(endsAt, offset))

  useEffect(() => {
    const timer = setInterval(() => setRemaining(remainingFor(endsAt, offset)), 250)
    return () => clearInterval(timer)
  }, [endsAt, offset])

  const className = remaining <= LOW_TIME_MS ? 'countdown countdown-low' : 'countdown'

  return (
    <p className={className} role="timer">
      {formatDuration(remaining)}
    </p>
  )
}
