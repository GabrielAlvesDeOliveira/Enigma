import * as puzzleService from "../services/puzzleService.js";
import { parseId } from "../utils/parseId.js";

const roomId = (req) => parseId(req.params.id, "Sala não encontrada.");

export async function list(req, res) {
  const puzzles = await puzzleService.listPuzzles(roomId(req), req.user);
  res.json({ puzzles });
}

export async function show(req, res) {
  const puzzle = await puzzleService.getPuzzleForRoom(roomId(req), req.params.key, req.user);
  res.json({ puzzle });
}

export async function answer(req, res) {
  const result = await puzzleService.submitAnswer(
    roomId(req),
    req.params.key,
    req.user,
    req.body?.answer
  );
  res.json(result);
}