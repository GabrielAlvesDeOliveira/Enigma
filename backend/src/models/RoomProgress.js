import db from "../config/db.js";
import { toMillis } from "../utils/time.js";

const conn = (trx) => trx || db;

export async function createForRoom(roomId, puzzleKeys, trx) {
  const rows = puzzleKeys.map((key) => ({ room_id: roomId, puzzle_key: key }));
  await conn(trx)("room_puzzle_progress").insert(rows);
}

export async function listForRoom(roomId, trx) {
  const rows = await conn(trx)("room_puzzle_progress").where({ room_id: roomId });

  return rows.map((row) => ({
    key: row.puzzle_key,
    status: row.status,
    solvedBy: row.solved_by ?? null,
    solvedAtMs: toMillis(row.solved_at),
  }));
}

export async function markSolved(roomId, puzzleKey, userId, nowMs, trx) {
  return conn(trx)("room_puzzle_progress")
    .where({ room_id: roomId, puzzle_key: puzzleKey, status: "open" })
    .update({ status: "solved", solved_by: userId, solved_at: new Date(nowMs) });
}

export async function countOpen(roomId, trx) {
  const [row] = await conn(trx)("room_puzzle_progress")
    .where({ room_id: roomId, status: "open" })
    .count({ total: "*" });
  return Number(row.total);
}

export async function listForRooms(roomIds, trx) {
  if (roomIds.length === 0) return [];

  const rows = await conn(trx)("room_puzzle_progress").whereIn("room_id", roomIds);
  return rows.map((row) => ({ roomId: row.room_id, key: row.puzzle_key, status: row.status }));
}
