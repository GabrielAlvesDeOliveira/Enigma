import { useEffect, useState } from 'react'
import { puzzles } from '../services/api.js'

// Títulos dos enigmas da sala, por chave: { cipher: 'Mensagem cifrada', ... }
// Não mudam durante a partida, então busca uma vez. Enquanto não chegam (ou se a busca
// falhar), devolve {} e as telas mostram a própria chave do enigma.
export default function usePuzzleTitles(roomId) {
  const [titles, setTitles] = useState({})

  useEffect(() => {
    let active = true

    puzzles
      .list(roomId)
      .then((result) => {
        if (active) setTitles(Object.fromEntries(result.puzzles.map((p) => [p.key, p.title])))
      })
      .catch(() => {
        // sem os títulos, as telas usam a chave do enigma
      })

    return () => {
      active = false
    }
  }, [roomId])

  return titles
}
