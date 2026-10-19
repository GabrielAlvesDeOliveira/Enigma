import * as Room from "../models/Room.js";
import * as RoomPlayer from "../models/RoomPlayer.js";
import * as RoomProgress from "../models/RoomProgress.js";
import * as PuzzleAttempt from "../models/PuzzleAttempt.js";
import { PUZZLE_KEYS, getPublicPuzzle } from "./puzzles/index.js";
import { getRoomState } from "./roomService.js";
import { AppError } from "../utils/AppError.js";

const toIso = (ms) => (ms == null ? null : new Date(ms).toISOString());

export function toAttemptView(a) {
  return {
    id: a.id,
    puzzleKey: a.puzzleKey,
    user: { id: a.userId, name: a.userName },
    answer: a.answer,
    isCorrect: a.isCorrect,
    createdAt: toIso(a.createdAtMs),
  };
}

async function listPage(filters) {
  const { page, pageSize } = filters;
  const { total, rooms } = await Room.search(filters, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const ids = rooms.map((room) => room.id);
  const [playerRows, progressRows] = await Promise.all([
    RoomPlayer.listForRooms(ids),
    RoomProgress.listForRooms(ids),
  ]);

  const items = rooms.map((room) => {
    const players = playerRows
      .filter((p) => p.room_id === room.id)
      .map((p) => ({ id: p.id, name: p.name }));
    const solved = progressRows.filter((p) => p.roomId === room.id && p.status === "solved");
    const spent =
      room.startedAtMs != null && room.finishedAtMs != null
        ? room.finishedAtMs - room.startedAtMs
        : null;

    return {
      id: room.id,
      code: room.code,
      status: room.status,
      finishReason: room.finishReason,
      master: { id: room.createdBy, name: room.masterName },
      players,
      createdAt: toIso(room.createdAtMs),
      startedAt: toIso(room.startedAtMs),
      finishedAt: toIso(room.finishedAtMs),
      timeSpentMs: spent,
      puzzlesSolved: solved.length,
      puzzlesTotal: PUZZLE_KEYS.length,
    };
  });

  return { rooms: items, page, pageSize, total };
}

export async function listPlayerHistory(user, filters, now = Date.now()) {
  if (user.role !== "player") {
    throw new AppError(403, "Mestres veem as sessões em /api/admin/rooms.");
  }

  await Room.expireOverdue(now);
  return listPage({ ...filters, memberId: user.id, createdBy: null });
}

export async function listAdminHistory(user, filters, now = Date.now()) {
  await Room.expireOverdue(now);
  return listPage({ ...filters, memberId: null, createdBy: filters.guided ? user.id : null });
}

export async function getAdminRoomDetail(roomId, user, now = Date.now()) {
  const room = await getRoomState(roomId, user, now);
  const attempts = await PuzzleAttempt.listForRoom(room.id);

  const summary = room.puzzles.map((puzzle) => {
    const mine = attempts.filter((a) => a.puzzleKey === puzzle.key);
    const solver = room.players.find((p) => p.id === puzzle.solvedBy);

    return {
      key: puzzle.key,
      title: getPublicPuzzle(puzzle.key).title,
      status: puzzle.status,
      solvedBy: solver ? { id: solver.id, name: solver.name } : null,
      solvedAt: puzzle.solvedAt,
      attempts: mine.length,
      wrongAttempts: mine.filter((a) => !a.isCorrect).length,
    };
  });

  return {
    room,
    summary,
    attempts: attempts.map(toAttemptView),
  };
}
