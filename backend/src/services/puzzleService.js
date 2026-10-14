import db from "../config/db.js";
import * as Room from "../models/Room.js";
import * as RoomPlayer from "../models/RoomPlayer.js";
import * as RoomProgress from "../models/RoomProgress.js";
import * as PuzzleAttempt from "../models/PuzzleAttempt.js";
import { PUZZLE_KEYS, getPuzzle, getPublicPuzzle, validateAnswer } from "./puzzles/index.js";
import { loadAccessibleRoom, getRoomState } from "./roomService.js";
import { answerDecision, shouldTimeout } from "./roomRules.js";
import { toJsonColumn } from "../utils/dbTypes.js";
import { AppError } from "../utils/AppError.js";

const MAX_ANSWER_LENGTH = 2000;

const notFound = () => new AppError(404, "Sala não encontrada.");
const puzzleNotFound = () => new AppError(404, "Enigma não encontrado.");
const toIso = (ms) => (ms == null ? null : new Date(ms).toISOString());

function assertAllowed(decision) {
  if (!decision.allowed) throw new AppError(decision.status, decision.message);
}

function progressOf(progress, key) {
  return progress.find((p) => p.key === key) ?? { key, status: "open", solvedBy: null, solvedAtMs: null };
}

// Lista os 3 enigmas da sala com o status de cada um. Mostra só o título,
// então pode ser consultada mesmo enquanto a sala aguarda.
export async function listPuzzles(roomId, user, now = Date.now()) {
  const room = await loadAccessibleRoom(roomId, user, now);
  const progress = await RoomProgress.listForRoom(room.id);

  return PUZZLE_KEYS.map((key) => {
    const p = progressOf(progress, key);
    return {
      key,
      title: getPublicPuzzle(key).title,
      status: p.status,
      solvedBy: p.solvedBy,
      solvedAt: toIso(p.solvedAtMs),
    };
  });
}

// Conteúdo de um enigma. Os jogadores só o recebem com a sala em andamento;
// o mestre pode ver a qualquer momento. Nunca inclui a resposta.
export async function getPuzzleForRoom(roomId, key, user, now = Date.now()) {
  const room = await loadAccessibleRoom(roomId, user, now);

  const content = getPublicPuzzle(key);
  if (!content) throw puzzleNotFound();

  if (user.role !== "admin") assertAllowed(answerDecision(room, now));

  const p = progressOf(await RoomProgress.listForRoom(room.id), key);
  return { ...content, status: p.status, solvedBy: p.solvedBy, solvedAt: toIso(p.solvedAtMs) };
}

// Envia a resposta de um jogador. Regras:
// - só jogadores da sala, com a sala em andamento e dentro do tempo;
// - enigma já resolvido fica bloqueado para todos (o primeiro acerto vence);
// - toda tentativa é registrada;
// - ao resolver o terceiro enigma, a sala termina como "concluída".
export async function submitAnswer(roomId, key, user, answer, now = Date.now()) {
  if (user.role !== "player") {
    throw new AppError(403, "Apenas jogadores respondem aos enigmas.");
  }
  if (!getPuzzle(key)) throw puzzleNotFound();
  if (answer === undefined || answer === null) throw new AppError(400, "Envie a resposta.");
  if (toJsonColumn(answer).length > MAX_ANSWER_LENGTH) {
    throw new AppError(400, "Resposta grande demais.");
  }

  const outcome = await db.transaction(async (trx) => {
    // A sala fica travada: respostas simultâneas são processadas uma de cada vez.
    const room = await Room.findById(roomId, { trx, forUpdate: true });
    if (!room || !(await RoomPlayer.isMember(room.id, user.id, trx))) throw notFound();

    if (shouldTimeout(room, now)) {
      await Room.transition(room.id, ["in_progress"], {
        status: "finished",
        finishReason: "timeout",
        finishedAtMs: room.endsAtMs,
      }, trx);
      // O erro é lançado depois da transação, para o encerramento ser salvo.
      return { rejected: new AppError(409, "O tempo da sala acabou.") };
    }

    assertAllowed(answerDecision(room, now));

    const progress = progressOf(await RoomProgress.listForRoom(room.id, trx), key);
    if (progress.status === "solved") {
      throw new AppError(409, "Este enigma já foi resolvido.");
    }

    const correct = validateAnswer(key, answer);
    await PuzzleAttempt.create(
      { roomId: room.id, puzzleKey: key, userId: user.id, answer, isCorrect: correct },
      trx
    );

    if (correct) {
      const won = await RoomProgress.markSolved(room.id, key, user.id, now, trx);
      if (won === 0) throw new AppError(409, "Este enigma já foi resolvido.");

      if ((await RoomProgress.countOpen(room.id, trx)) === 0) {
        await Room.transition(room.id, ["in_progress"], {
          status: "finished",
          finishReason: "completed",
          finishedAtMs: now,
        }, trx);
      }
    }

    return { correct };
  });

  if (outcome.rejected) throw outcome.rejected;

  return { correct: outcome.correct, room: await getRoomState(roomId, user, now) };
}