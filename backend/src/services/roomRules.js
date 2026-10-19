export const MAX_PLAYERS = 3;
export const ROOM_DURATION_MS = 40 * 60 * 1000;

export const computeEndsAt = (startedAtMs, durationMs = ROOM_DURATION_MS) =>
  startedAtMs + durationMs;

export const remainingMs = (endsAtMs, nowMs = Date.now()) =>
  Math.max(0, endsAtMs - nowMs);

export const isExpired = (endsAtMs, nowMs = Date.now()) => nowMs >= endsAtMs;

const allow = () => ({ allowed: true });
const deny = (message) => ({ allowed: false, status: 409, message });

export function joinDecision({ status, playerCount, isMember }) {
  if (isMember) return allow();
  if (status !== "waiting") return deny("Esta sala já foi iniciada ou encerrada.");
  if (playerCount >= MAX_PLAYERS) return deny("A sala está cheia.");
  return allow();
}

export function startDecision({ status, playerCount }) {
  if (status !== "waiting") return deny("Esta sala já foi iniciada ou encerrada.");
  if (playerCount < 1) return deny("Aguarde pelo menos um jogador entrar.");
  return allow();
}

export function answerDecision({ status, endsAtMs }, nowMs = Date.now()) {
  if (status !== "in_progress") return deny("A sala não está em andamento.");
  if (endsAtMs == null || isExpired(endsAtMs, nowMs)) {
    return deny("O tempo da sala acabou.");
  }
  return allow();
}

export function shouldTimeout({ status, endsAtMs }, nowMs = Date.now()) {
  return status === "in_progress" && endsAtMs != null && isExpired(endsAtMs, nowMs);
}
