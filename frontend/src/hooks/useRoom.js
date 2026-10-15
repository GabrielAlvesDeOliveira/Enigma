import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, notifyUnauthorized, rooms } from '../services/api.js'
import { createSocket } from '../services/socket.js'

// Se a conexão em tempo real não abrir neste tempo, a tela passa a avisar.
const STALL_MS = 4000

// Mantém o estado de uma sala sempre atual.
//
// A sala é lida pela API normal assim que a tela abre (rápido e confiável) e, por cima,
// o tempo real mantém tudo atualizado. Assim a sala aparece mesmo que a conexão em
// tempo real demore ou esteja bloqueada.
//
// Devolve:
//   room          estado completo da sala (null até chegar)
//   loading       true até chegar o primeiro estado (ou um erro)
//   error         mensagem de erro, se não foi possível entrar na sala
//   offline       true quando o tempo real caiu ou não consegue conectar (o hook segue tentando)
//   serverOffset  diferença, em ms, entre o relógio do servidor e o deste computador
//   applyRoom     aplica um estado de sala recebido por outro caminho (resposta HTTP)
//
// Cada mudança na sala chega com o estado COMPLETO, então basta substituir o anterior.
export default function useRoom(roomId) {
  const [state, setState] = useState({ room: null, error: '', loading: true })
  const [offline, setOffline] = useState(false)
  const [serverOffset, setServerOffset] = useState(0)

  // Relógio do servidor (serverNow) do estado mais novo já aplicado. Um estado que
  // chegar atrasado, mais antigo que o atual, é ignorado e nunca desfaz uma mudança.
  const newestState = useRef(0)

  const applyRoom = useCallback((incoming) => {
    if (incoming.serverNow < newestState.current) return
    newestState.current = incoming.serverNow
    setServerOffset(incoming.serverNow - Date.now())
    setState({ room: incoming, error: '', loading: false })
  }, [])

  useEffect(() => {
    const socket = createSocket()
    let active = true

    // Se a conexão demorar demais para abrir, avisa.
    const stallTimer = setTimeout(() => setOffline(true), STALL_MS)

    // Estado inicial pela API normal. Só a sala inexistente (404) é tratada aqui;
    // outras falhas são ignoradas porque o tempo real ainda pode entregar a sala.
    rooms
      .get(roomId)
      .then(({ room }) => {
        if (active) applyRoom(room)
      })
      .catch((err) => {
        if (active && err instanceof ApiError && err.status === 404) {
          setState({ room: null, error: err.message, loading: false })
          socket.disconnect()
        }
      })

    // Roda a cada conexão, inclusive nas reconexões: o servidor não lembra das
    // inscrições, e a resposta já traz o estado atual (cobrindo o que mudou na queda).
    function subscribe() {
      socket.emit('room:subscribe', { roomId }, (response) => {
        if (!active) return

        if (response.ok) {
          applyRoom(response.room)
        } else {
          setState({ room: null, error: response.error, loading: false })
          socket.disconnect()
        }
      })
    }

    socket.on('connect', () => {
      clearTimeout(stallTimer)
      setOffline(false)
      subscribe()
    })
    socket.on('disconnect', () => setOffline(true))
    socket.on('connect_error', (error) => {
      if (error.message === 'unauthorized') {
        // O token deixou de valer: encerra a sessão (o App leva ao login).
        socket.disconnect()
        notifyUnauthorized()
        return
      }
      setOffline(true) // falha de rede: o socket.io tenta de novo sozinho
    })
    socket.on('room:updated', ({ room }) => applyRoom(room))

    return () => {
      active = false
      clearTimeout(stallTimer)
      socket.disconnect()
    }
  }, [roomId, applyRoom])

  return { ...state, offline, serverOffset, applyRoom }
}
