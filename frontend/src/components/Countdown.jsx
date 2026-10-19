import { useEffect, useState } from 'react'
import { formatDuration } from '../utils/format.js'

const LOW_TIME_MS = 5 * 60 * 1000

const remainingFor = (endsAt, offset) => Math.max(0, Date.parse(endsAt) - (Date.now() + offset))

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
