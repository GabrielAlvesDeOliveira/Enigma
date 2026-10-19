import { useEffect, useState } from 'react'
import { puzzles } from '../services/api.js'

export default function usePuzzleTitles(roomId) {
  const [titles, setTitles] = useState({})

  useEffect(() => {
    let active = true

    puzzles
      .list(roomId)
      .then((result) => {
        if (active) setTitles(Object.fromEntries(result.puzzles.map((p) => [p.key, p.title])))
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [roomId])

  return titles
}
