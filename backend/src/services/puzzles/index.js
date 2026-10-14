import cipher from "./cipherPuzzle.js";
import sequence from "./sequencePuzzle.js";
import maze from "./mazePuzzle.js";

const puzzles = { cipher, sequence, maze };

export const PUZZLE_KEYS = Object.keys(puzzles);

export function getPuzzle(key) {
  return Object.hasOwn(puzzles, key) ? puzzles[key] : null;
}

// Dados que podem ser enviados ao frontend (sem respostas).
export function getPublicPuzzle(key) {
  const puzzle = getPuzzle(key);
  return puzzle ? puzzle.getPublicData() : null;
}

// Valida a resposta de um jogador para um enigma.
export function validateAnswer(key, answer) {
  const puzzle = getPuzzle(key);
  return puzzle ? puzzle.validate(answer) : false;
}