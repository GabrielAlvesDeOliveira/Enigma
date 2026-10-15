// Regras da sala em funções puras (sem banco e sem relógio escondido).
// Todas as decisões devolvem { allowed: true } ou
// { allowed: false, status, message }, onde "status" é o código HTTP que o
// service deve usar ao lançar o AppError.

export const MAX_PLAYERS = 3;
export const ROOM_DURATION_MS = 40 * 60 * 1000;

// ---------- Tempo (sempre em milissegundos) ----------

export const computeEndsAt = (startedAtMs, durationMs = ROOM_DURATION_MS) =>
  startedAtMs + durationMs;

export const remainingMs = (endsAtMs, nowMs = Date.now()) =>
  Math.max(0, endsAtMs - nowMs);

export const isExpired = (endsAtMs, nowMs = Date.now()) => nowMs >= endsAtMs;

// ---------- Decisões ----------

const allow = () => ({ allowed: true });
const deny = (message) => ({ allowed: false, status: 409, message });

// Entrar pelo código: só enquanto a sala aguarda e há vaga.
// Quem já é membro sempre pode voltar (por exemplo, ao recarregar a página).
export function joinDecision({ status, playerCount, isMember }) {
  if (isMember) return allow();
  if (status !== "waiting") return deny("Esta sala já foi iniciada ou encerrada.");
  if (playerCount >= MAX_PLAYERS) return deny("A sala está cheia.");
  return allow();
}

// Iniciar o cronômetro: a sala precisa aguardar e ter pelo menos 1 jogador.
export function startDecision({ status, playerCount }) {
  if (status !== "waiting") return deny("Esta sala já foi iniciada ou encerrada.");
  if (playerCount < 1) return deny("Aguarde pelo menos um jogador entrar.");
  return allow();
}

// Responder um enigma: só com a sala em andamento e dentro do tempo.
export function answerDecision({ status, endsAtMs }, nowMs = Date.now()) {
  if (status !== "in_progress") return deny("A sala não está em andamento.");
  if (endsAtMs == null || isExpired(endsAtMs, nowMs)) {
    return deny("O tempo da sala acabou.");
  }
  return allow();
}

// A sala deve ser encerrada por tempo esgotado? Usado na checagem
// "preguiçosa": sempre que alguém consulta a sala, o service confere.
export function shouldTimeout({ status, endsAtMs }, nowMs = Date.now()) {
  return status === "in_progress" && endsAtMs != null && isExpired(endsAtMs, nowMs);
}
