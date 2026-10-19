import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, notifyUnauthorized, rooms } from '../services/api.js'
import { createSocket } from '../services/socket.js'

const STALL_MS = 4000

export default function useRoom(roomId, { onAttempt } = {}) {
  const [state, setState] = useState({ room: null, error: '', loading: true })
  const [offline, setOffline] = useState(false)
  const [serverOffset, setServerOffset] = useState(0)

  const latestOnAttempt = useRef(onAttempt)
  useEffect(() => {
    latestOnAttempt.current = onAttempt
  })

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

    const stallTimer = setTimeout(() => setOffline(true), STALL_MS)

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
        socket.disconnect()
        notifyUnauthorized()
        return
      }
      setOffline(true) 
    })
    socket.on('room:updated', ({ room }) => applyRoom(room))
    socket.on('attempt:new', ({ attempt }) => latestOnAttempt.current?.(attempt))

    return () => {
      active = false
      clearTimeout(stallTimer)
      socket.disconnect()
    }
  }, [roomId, applyRoom])

  return { ...state, offline, serverOffset, applyRoom }
}
