// Cliente da API. Todas as chamadas ao backend passam por aqui.
// O contrato (rotas, corpos e respostas) está em docs/API.md.

const BASE_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const TOKEN_KEY = 'enigma.token'

export const API_BASE_URL = BASE_URL

// Erro devolvido pela API (ou falha de conexão, com status 0).
// "message" já vem em português, pronta para mostrar na tela.
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ---------- Token de login ----------
// Fica no localStorage para a pessoa continuar logada ao recarregar a página.
// Se o navegador bloquear o armazenamento, o token vale só até fechar a aba.

let memoryToken = null

export function getToken() {
  if (memoryToken) return memoryToken
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  memoryToken = token
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // sem armazenamento: segue só com o token em memória
  }
}

export function clearToken() {
  memoryToken = null
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // nada a fazer
  }
}

// Função chamada quando a API recusa um token que estava sendo usado (expirado ou inválido).
// O AuthContext registra aqui a sua saída automática.
let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

// Avisa que a sessão não vale mais, para quem descobriu isso por outro caminho
// que não uma requisição HTTP (por exemplo, o tempo real recusou o token).
export function notifyUnauthorized() {
  if (unauthorizedHandler) unauthorizedHandler()
}

// ---------- Requisições ----------

// Monta "?page=1&status=finished", ignorando valores vazios.
export function buildQuery(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.append(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

const segment = (value) => encodeURIComponent(String(value))

// auth: false nas chamadas de login e cadastro. Elas não enviam o token e um 401
// ali significa "senha errada", não "sessão vencida".
async function request(method, path, { body, query, auth = true } = {}) {
  const token = auth ? getToken() : null

  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(BASE_URL + path + buildQuery(query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua conexão.')
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // resposta sem JSON (por exemplo, erro de um servidor intermediário)
  }

  if (!response.ok) {
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler()
    throw new ApiError(response.status, data?.error || 'Erro inesperado do servidor.')
  }

  return data
}

// ---------- Rotas da API ----------

export const auth = {
  register: ({ name, email, password }) =>
    request('POST', '/api/auth/register', { body: { name, email, password }, auth: false }),
  login: ({ email, password }) =>
    request('POST', '/api/auth/login', { body: { email, password }, auth: false }),
  me: () => request('GET', '/api/auth/me'),
}

export const rooms = {
  create: () => request('POST', '/api/rooms'),
  join: (code) => request('POST', '/api/rooms/join', { body: { code } }),
  get: (roomId) => request('GET', `/api/rooms/${segment(roomId)}`),
  start: (roomId) => request('POST', `/api/rooms/${segment(roomId)}/start`),
  cancel: (roomId) => request('POST', `/api/rooms/${segment(roomId)}/cancel`),
  leave: (roomId) => request('POST', `/api/rooms/${segment(roomId)}/leave`),
  mine: (params) => request('GET', '/api/rooms/mine', { query: params }),
}

export const puzzles = {
  list: (roomId) => request('GET', `/api/rooms/${segment(roomId)}/puzzles`),
  get: (roomId, key) => request('GET', `/api/rooms/${segment(roomId)}/puzzles/${segment(key)}`),
  answer: (roomId, key, answer) =>
    request('POST', `/api/rooms/${segment(roomId)}/puzzles/${segment(key)}/answer`, {
      body: { answer },
    }),
}

export const admin = {
  rooms: (params) => request('GET', '/api/admin/rooms', { query: params }),
  room: (roomId) => request('GET', `/api/admin/rooms/${segment(roomId)}`),
}
