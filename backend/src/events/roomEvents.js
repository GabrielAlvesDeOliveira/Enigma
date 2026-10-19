import { EventEmitter } from "node:events";

export const roomEvents = new EventEmitter();

export const ROOM_CHANGED = "room:changed";
export const ATTEMPT_CREATED = "attempt:created";

export function publishRoomChange(roomId, type, extra = {}) {
  roomEvents.emit(ROOM_CHANGED, { roomId, type, ...extra });
}

export function publishAttempt(roomId, attemptId) {
  roomEvents.emit(ATTEMPT_CREATED, { roomId, attemptId });
}
