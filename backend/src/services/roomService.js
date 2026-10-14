import db from "../config/db.js";
import * as Room from "../models/Room.js";
import * as RoomPlayer from "../models/RoomPlayer.js";
import * as RoomProgress from "../models/RoomProgress.js";
import * as User from "../models/User.js";
import { PUZZLE_KEYS } from "./puzzles/index.js";
import {
  ROOM_DURATION_MS,
  computeEndsAt,
  remainingMs,
  joinDecision,
  startDecision,
  shouldTimeout,
} from "./roomRules.js";
import { generateRoomCode, normalizeRoomCode } from "../utils/roomCode.js";
import { isUniqueViolation } from "../utils/dbErrors.js";
import { AppError } from "../utils/AppError.js";

const MAX_CODE_ATTEMPTS = 5;

const notFound = () => new AppError(404, "Sala não encontrada.");

function assertAllowed(decision) {
  if (!decision.allowed) throw new AppError(decision.status, decision.message);
}

const toIso = (ms) => (ms == null ? null : new Date(ms).toISOString());

// Tempo restante mostrado ao cliente: sala aguardando mostra a duração cheia.
function remainingFor(room, now) {
  if (room.status === "waiting") return ROOM_DURATION_MS;
  if (room.status === "in_progress") return remainingMs(room.endsAtMs, now);
  return 0;
}

// Se o tempo acabou, encerra a sala (checagem "preguiçosa": roda sempre que a sala é consultada).
async function applyTimeout(room, now) {
  if (!shouldTimeout(room, now)) return room;

  await Room.transition(room.id, ["in_progress"], {
    status: "finished",
    finishReason: "timeout",
    finishedAtMs: room.endsAtMs,
  });

  return Room.findById(room.id);
}

// Monta o estado completo da sala que a API devolve.
async function buildState(room, now) {
  const [players, progress, master] = await Promise.all([
    RoomPlayer.listPlayers(room.id),
    RoomProgress.listForRoom(room.id),
    User.findById(room.createdBy),
  ]);

  const puzzles = progress
    .sort((a, b) => PUZZLE_KEYS.indexOf(a.key) - PUZZLE_KEYS.indexOf(b.key))
    .map((p) => ({
      key: p.key,
      status: p.status,
      solvedBy: p.solvedBy,
      solvedAt: toIso(p.solvedAtMs),
    }));

  return {
    id: room.id,
    code: room.code,
    status: room.status,
    finishReason: room.finishReason,
    durationMs: ROOM_DURATION_MS,
    startedAt: toIso(room.startedAtMs),
    endsAt: toIso(room.endsAtMs),
    finishedAt: toIso(room.finishedAtMs),
    remainingMs: remainingFor(room, now),
    serverNow: now, // o cliente usa para acertar a diferença de relógio
    master: master ? { id: master.id, name: master.name } : null,
    players,
    puzzles,
  };
}

// O mestre cria a sala; o código é gerado pelo servidor (com nova tentativa se repetir).
export async function createRoom(adminId, { generateCode = generateRoomCode } = {}) {
  let roomId = null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && roomId === null; attempt++) {
    try {
      roomId = await db.transaction(async (trx) => {
        const room = await Room.create({ code: generateCode(), createdBy: adminId }, trx);
        await RoomProgress.createForRoom(room.id, PUZZLE_KEYS, trx);
        return room.id;
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }

  if (roomId === null) {
    throw new AppError(500, "Não foi possível gerar um código de sala. Tente novamente.");
  }

  return getRoomState(roomId, { id: adminId, role: "admin" });
}

// Jogador entra pelo código. Só enquanto a sala aguarda e há vaga.
export async function joinRoom(user, rawCode, now = Date.now()) {
  if (user.role !== "player") {
    throw new AppError(403, "Apenas jogadores entram em uma sala pelo código.");
  }

  const code = normalizeRoomCode(rawCode);
  if (!code) throw new AppError(400, "Código inválido.");

  const roomId = await db.transaction(async (trx) => {
    const room = await Room.findByCode(code, { trx, forUpdate: true });
    if (!room) throw notFound();

    const isMember = await RoomPlayer.isMember(room.id, user.id, trx);
    const playerCount = await RoomPlayer.count(room.id, trx);

    assertAllowed(joinDecision({ status: room.status, playerCount, isMember }));

    if (!isMember) await RoomPlayer.add(room.id, user.id, trx);
    return room.id;
  });

  return getRoomState(roomId, user, now);
}

// Carrega a sala para quem tem acesso: jogadores da sala e qualquer mestre.
// Quem não pode recebe 404, para não revelar quais salas existem.
// Também encerra a sala se o tempo já tinha acabado.
export async function loadAccessibleRoom(roomId, user, now = Date.now()) {
  const room = await Room.findById(roomId);
  if (!room) throw notFound();

  if (user.role !== "admin" && !(await RoomPlayer.isMember(room.id, user.id))) {
    throw notFound();
  }

  return applyTimeout(room, now);
}

// Estado completo da sala que a API devolve.
export async function getRoomState(roomId, user, now = Date.now()) {
  const room = await loadAccessibleRoom(roomId, user, now);
  return buildState(room, now);
}

// O mestre que criou a sala inicia o cronômetro.
export async function startRoom(roomId, adminId, now = Date.now()) {
  await db.transaction(async (trx) => {
    const room = await Room.findById(roomId, { trx, forUpdate: true });
    if (!room) throw notFound();

    if (room.createdBy !== adminId) {
      throw new AppError(403, "Apenas o mestre que criou a sala pode iniciá-la.");
    }

    const playerCount = await RoomPlayer.count(room.id, trx);
    assertAllowed(startDecision({ status: room.status, playerCount }));

    await Room.transition(room.id, ["waiting"], {
      status: "in_progress",
      startedAtMs: now,
      endsAtMs: computeEndsAt(now),
    }, trx);
  });

  return getRoomState(roomId, { id: adminId, role: "admin" }, now);
}

// O mestre cancela a sala. Se o tempo já tinha acabado, vale "tempo esgotado".
export async function cancelRoom(roomId, adminId, now = Date.now()) {
  const outcome = await db.transaction(async (trx) => {
    const room = await Room.findById(roomId, { trx, forUpdate: true });
    if (!room) throw notFound();

    if (room.createdBy !== adminId) {
      throw new AppError(403, "Apenas o mestre que criou a sala pode encerrá-la.");
    }

    if (shouldTimeout(room, now)) {
      await Room.transition(room.id, ["in_progress"], {
        status: "finished",
        finishReason: "timeout",
        finishedAtMs: room.endsAtMs,
      }, trx);
      return "already_finished";
    }

    if (room.status === "finished") return "already_finished";

    await Room.transition(room.id, ["waiting", "in_progress"], {
      status: "finished",
      finishReason: "cancelled",
      finishedAtMs: now,
    }, trx);
    return "cancelled";
  });

  // O erro é lançado só depois da transação, para a mudança por tempo esgotado ser salva.
  if (outcome === "already_finished") {
    throw new AppError(409, "Esta sala já foi encerrada.");
  }

  return getRoomState(roomId, { id: adminId, role: "admin" }, now);
}

// O jogador sai da sala. Só enquanto ela aguarda (depois do início, o histórico precisa dele).
export async function leaveRoom(roomId, user) {
  await db.transaction(async (trx) => {
    const room = await Room.findById(roomId, { trx, forUpdate: true });
    if (!room || !(await RoomPlayer.isMember(room.id, user.id, trx))) throw notFound();

    if (room.status !== "waiting") {
      throw new AppError(409, "Não é possível sair depois que a sala foi iniciada.");
    }

    await RoomPlayer.remove(room.id, user.id, trx);
  });

  return { left: true };
}