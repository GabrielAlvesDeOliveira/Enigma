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
import { publishRoomChange, publishAttempt } from "../events/roomEvents.js";

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

export async function getPuzzleForRoom(roomId, key, user, now = Date.now()) {
  const room = await loadAccessibleRoom(roomId, user, now);

  const content = getPublicPuzzle(key);
  if (!content) throw puzzleNotFound();

  if (user.role !== "admin") assertAllowed(answerDecision(room, now));

  const p = progressOf(await RoomProgress.listForRoom(room.id), key);
  return { ...content, status: p.status, solvedBy: p.solvedBy, solvedAt: toIso(p.solvedAtMs) };
}

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
    const room = await Room.findById(roomId, { trx, forUpdate: true });
    if (!room || !(await RoomPlayer.isMember(room.id, user.id, trx))) throw notFound();

    if (shouldTimeout(room, now)) {
      await Room.transition(room.id, ["in_progress"], {
        status: "finished",
        finishReason: "timeout",
        finishedAtMs: room.endsAtMs,
      }, trx);
      return { rejected: new AppError(409, "O tempo da sala acabou.") };
    }

    assertAllowed(answerDecision(room, now));

    const progress = progressOf(await RoomProgress.listForRoom(room.id, trx), key);
    if (progress.status === "solved") {
      throw new AppError(409, "Este enigma já foi resolvido.");
    }

    const correct = validateAnswer(key, answer);
    const attemptId = await PuzzleAttempt.create(
      { roomId: room.id, puzzleKey: key, userId: user.id, answer, isCorrect: correct },
      trx
    );

    let completed = false;

    if (correct) {
      const won = await RoomProgress.markSolved(room.id, key, user.id, now, trx);
      if (won === 0) throw new AppError(409, "Este enigma já foi resolvido.");

      if ((await RoomProgress.countOpen(room.id, trx)) === 0) {
        completed = true;
        await Room.transition(room.id, ["in_progress"], {
          status: "finished",
          finishReason: "completed",
          finishedAtMs: now,
        }, trx);
      }
    }

    return { correct, attemptId, completed };
  });

  if (outcome.rejected) {
    publishRoomChange(roomId, "timeout");
    throw outcome.rejected;
  }

  publishAttempt(roomId, outcome.attemptId);
  if (outcome.correct) {
    publishRoomChange(roomId, outcome.completed ? "completed" : "puzzle_solved");
  }

  return { correct: outcome.correct, room: await getRoomState(roomId, user, now) };
}
