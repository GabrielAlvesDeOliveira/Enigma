import { io } from 'socket.io-client'
import { API_BASE_URL, getToken } from './api.js'

export function createSocket() {
  return io(API_BASE_URL, {
    auth: (callback) => callback({ token: getToken() }),
  })
}
