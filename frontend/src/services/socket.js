import { io } from 'socket.io-client'
import { API_BASE_URL, getToken } from './api.js'

// Cria uma conexão de tempo real com o servidor. Quem cria é responsável por
// fechar com socket.disconnect() (o hook useRoom já faz isso).
//
// O token é lido a cada (re)conexão, então uma reconexão sempre usa o token atual.
// O servidor recusa a conexão com o erro "unauthorized" se o token for inválido.
export function createSocket() {
  return io(API_BASE_URL, {
    auth: (callback) => callback({ token: getToken() }),
  })
}
