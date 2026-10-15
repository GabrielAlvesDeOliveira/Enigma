import db from "../config/db.js";
import { toMillis } from "../utils/time.js";

const conn = (trx) => trx || db;

// Converte a linha do banco para o formato usado pelo código (datas em ms).
function toRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    createdBy: row.created_by,
    status: row.status,
    finishReason: row.finish_reason ?? null,
    startedAtMs: toMillis(row.started_at),
    endsAtMs: toMillis(row.ends_at),
    finishedAtMs: toMillis(row.finished_at),
    createdAtMs: toMillis(row.created_at),
  };
}

// Com forUpdate, a linha fica travada até o fim da transação
// (evita duas pessoas mexendo na mesma sala ao mesmo tempo no PostgreSQL).
export async function findById(id, { trx, forUpdate = false } = {}) {
  let query = conn(trx)("rooms").where({ id });
  if (forUpdate && trx) query = query.forUpdate();
  return toRoom(await query.first());
}

export async function findByCode(code, { trx, forUpdate = false } = {}) {
  let query = conn(trx)("rooms").where({ code });
  if (forUpdate && trx) query = query.forUpdate();
  return toRoom(await query.first());
}

export async function create({ code, createdBy }, trx) {
  const [row] = await conn(trx)("rooms")
    .insert({ code, created_by: createdBy })
    .returning("id");

  const id = typeof row === "object" ? row.id : row;
  return findById(id, { trx });
}

// Muda o estado da sala só se ela ainda estiver em um dos estados esperados.
// Devolve quantas linhas mudaram (0 significa que alguém chegou antes).
export async function transition(id, fromStatuses, fields, trx) {
  const changes = { updated_at: db.fn.now() };

  if ("status" in fields) changes.status = fields.status;
  if ("finishReason" in fields) changes.finish_reason = fields.finishReason;
  if ("startedAtMs" in fields) changes.started_at = new Date(fields.startedAtMs);
  if ("endsAtMs" in fields) changes.ends_at = new Date(fields.endsAtMs);
  if ("finishedAtMs" in fields) changes.finished_at = new Date(fields.finishedAtMs);

  return conn(trx)("rooms").where({ id }).whereIn("status", fromStatuses).update(changes);
}

// ---------- Histórico e listagens ----------

const isSqlite = () => String(db.client.config.client).includes("sqlite");

// created_at é preenchido pelo próprio banco. O SQLite guarda texto UTC
// ("2026-10-14 00:30:09"), então a comparação precisa usar o mesmo formato.
function createdAtParam(ms) {
  if (!isSqlite()) return new Date(ms);
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

function applyFilters(query, { memberId, createdBy, status, finishReason, fromMs, toMs }) {
  if (memberId != null) {
    query.whereIn("r.id", db("room_players").select("room_id").where({ user_id: memberId }));
  }
  if (createdBy != null) query.where("r.created_by", createdBy);
  if (status) query.where("r.status", status);
  if (finishReason) query.where("r.finish_reason", finishReason);
  if (fromMs != null) query.where("r.created_at", ">=", createdAtParam(fromMs));
  if (toMs != null) query.where("r.created_at", "<", createdAtParam(toMs)); // toMs é exclusivo
  return query;
}

// Busca salas com filtros, da mais nova para a mais antiga.
// Devolve também o total (para a paginação) e o nome do mestre.
export async function search(filters, { limit, offset }) {
  const [{ total }] = await applyFilters(db("rooms as r"), filters).count({ total: "*" });

  const rows = await applyFilters(db("rooms as r"), filters)
    .join("users as m", "m.id", "r.created_by")
    .orderBy("r.id", "desc")
    .limit(limit)
    .offset(offset)
    .select("r.*", "m.name as master_name");

  return {
    total: Number(total),
    rooms: rows.map((row) => ({ ...toRoom(row), masterName: row.master_name })),
  };
}

// Encerra de uma vez todas as salas em andamento cujo tempo já acabou.
// Usado antes das listagens, para elas não mostrarem salas "fantasmas".
export async function expireOverdue(nowMs) {
  return db("rooms")
    .where({ status: "in_progress" })
    .where("ends_at", "<=", new Date(nowMs))
    .update({
      status: "finished",
      finish_reason: "timeout",
      finished_at: db.ref("ends_at"),
      updated_at: db.fn.now(),
    });
}

// Salas em andamento cujo tempo já acabou (usado pelo encerramento automático).
export async function findOverdue(nowMs) {
  const rows = await db("rooms")
    .where({ status: "in_progress" })
    .where("ends_at", "<=", new Date(nowMs));
  return rows.map(toRoom);
}