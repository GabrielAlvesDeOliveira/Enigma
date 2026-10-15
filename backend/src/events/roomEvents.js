import { EventEmitter } from "node:events";

// Canal interno entre os serviços e a camada de tempo real.
// Os serviços só avisam "algo mudou"; quem decide o que enviar
// aos clientes é a camada de sockets. Sem sockets ligados, nada acontece.
export const roomEvents = new EventEmitter();

export const ROOM_CHANGED = "room:changed";
export const ATTEMPT_CREATED = "attempt:created";

// type: player_joined, player_left, started, puzzle_solved, completed, cancelled, timeout
export function publishRoomChange(roomId, type, extra = {}) {
  roomEvents.emit(ROOM_CHANGED, { roomId, type, ...extra });
}

export function publishAttempt(roomId, attemptId) {
  roomEvents.emit(ATTEMPT_CREATED, { roomId, attemptId });
}
