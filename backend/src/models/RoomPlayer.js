import db from "../config/db.js";

const conn = (trx) => trx || db;

export async function isMember(roomId, userId, trx) {
  const row = await conn(trx)("room_players")
    .where({ room_id: roomId, user_id: userId })
    .first();
  return Boolean(row);
}

export async function count(roomId, trx) {
  const [row] = await conn(trx)("room_players")
    .where({ room_id: roomId })
    .count({ total: "*" });
  return Number(row.total); 
}

export async function add(roomId, userId, trx) {
  await conn(trx)("room_players").insert({ room_id: roomId, user_id: userId });
}

export async function remove(roomId, userId, trx) {
  return conn(trx)("room_players").where({ room_id: roomId, user_id: userId }).del();
}

export async function listPlayers(roomId, trx) {
  return conn(trx)("room_players as rp")
    .join("users as u", "u.id", "rp.user_id")
    .where("rp.room_id", roomId)
    .orderBy([{ column: "rp.joined_at" }, { column: "u.id" }])
    .select("u.id", "u.name");
}

export async function listForRooms(roomIds, trx) {
  if (roomIds.length === 0) return [];

  return conn(trx)("room_players as rp")
    .join("users as u", "u.id", "rp.user_id")
    .whereIn("rp.room_id", roomIds)
    .orderBy([{ column: "rp.joined_at" }, { column: "u.id" }])
    .select("rp.room_id", "u.id", "u.name");
}
