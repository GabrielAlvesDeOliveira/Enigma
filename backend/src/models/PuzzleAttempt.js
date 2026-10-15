import db from "../config/db.js";
import { parseJson, toJsonColumn, toBool } from "../utils/dbTypes.js";
import { toMillis } from "../utils/time.js";

const conn = (trx) => trx || db;

// A resposta é guardada dentro de um envelope { value }. Sem ele, um texto simples
// seria devolvido de formas diferentes pelo SQLite e pelo PostgreSQL.
// Devolve o id da tentativa criada.
export async function create({ roomId, puzzleKey, userId, answer, isCorrect }, trx) {
  const [row] = await conn(trx)("puzzle_attempts")
    .insert({
      room_id: roomId,
      puzzle_key: puzzleKey,
      user_id: userId,
      answer: toJsonColumn({ value: answer }),
      is_correct: isCorrect,
    })
    .returning("id");

  return typeof row === "object" ? row.id : row;
}

const COLUMNS = [
  "pa.id",
  "pa.puzzle_key",
  "pa.user_id",
  "u.name as user_name",
  "pa.answer",
  "pa.is_correct",
  "pa.created_at",
];

function toAttempt(row) {
  return {
    id: row.id,
    puzzleKey: row.puzzle_key,
    userId: row.user_id,
    userName: row.user_name,
    answer: parseJson(row.answer)?.value,
    isCorrect: toBool(row.is_correct),
    createdAtMs: toMillis(row.created_at),
  };
}

export async function findById(id, trx) {
  const row = await conn(trx)("puzzle_attempts as pa")
    .join("users as u", "u.id", "pa.user_id")
    .where("pa.id", id)
    .select(COLUMNS)
    .first();

  return row ? toAttempt(row) : null;
}

// Todas as tentativas da sala, da mais antiga para a mais recente.
export async function listForRoom(roomId, trx) {
  const rows = await conn(trx)("puzzle_attempts as pa")
    .join("users as u", "u.id", "pa.user_id")
    .where("pa.room_id", roomId)
    .orderBy("pa.id")
    .select(COLUMNS);

  return rows.map(toAttempt);
}
