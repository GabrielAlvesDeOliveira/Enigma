import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PUZZLE_KEYS,
  getPuzzle,
  getPublicPuzzle,
  validateAnswer,
} from "../src/services/puzzles/index.js";

test("existem 3 enigmas com a estrutura esperada", () => {
  assert.equal(PUZZLE_KEYS.length, 3);

  for (const key of PUZZLE_KEYS) {
    const puzzle = getPuzzle(key);
    assert.equal(puzzle.key, key);
    assert.equal(typeof puzzle.getPublicData, "function");
    assert.equal(typeof puzzle.validate, "function");
  }
});

test("chave desconhecida ou especial do JavaScript não existe", () => {
  assert.equal(getPuzzle("nao-existe"), null);
  assert.equal(getPuzzle("constructor"), null);
  assert.equal(validateAnswer("nao-existe", "x"), false);
});

test("dados públicos não vazam respostas", () => {
  for (const key of PUZZLE_KEYS) {
    const data = getPublicPuzzle(key);
    const json = JSON.stringify(data).toLowerCase();

    assert.equal("answer" in data, false);
    assert.equal(json.includes("shift"), false);
    assert.equal(json.includes("dourada"), false);
  }
});

test("cifra: aceita a resposta certa com variações de escrita", () => {
  assert.equal(validateAnswer("cipher", "CHAVE DOURADA"), true);
  assert.equal(validateAnswer("cipher", "  chave   dourada "), true);
});

test("cifra: rejeita resposta errada ou de tipo errado", () => {
  assert.equal(validateAnswer("cipher", "CHAVE PRATEADA"), false);
  assert.equal(validateAnswer("cipher", ""), false);
  assert.equal(validateAnswer("cipher", 42), false);
  assert.equal(validateAnswer("cipher", null), false);
});

test("sequência: aceita número ou texto com o termo certo", () => {
  assert.equal(validateAnswer("sequence", 48), true);
  assert.equal(validateAnswer("sequence", "48"), true);
  assert.equal(validateAnswer("sequence", " 48 "), true);
});

test("sequência: rejeita respostas erradas ou de tipo errado", () => {
  assert.equal(validateAnswer("sequence", 47), false);
  assert.equal(validateAnswer("sequence", ""), false);
  assert.equal(validateAnswer("sequence", "abc"), false);
  assert.equal(validateAnswer("sequence", [48]), false);
  assert.equal(validateAnswer("sequence", null), false);
});

test("labirinto: aceita caminhos válidos", () => {
  assert.equal(validateAnswer("maze", ["entrada", "A", "C", "E", "saida"]), true);
  assert.equal(validateAnswer("maze", ["entrada", "B", "C", "E", "saida"]), true);
});

test("labirinto: rejeita caminhos inválidos", () => {
  // beco sem saída
  assert.equal(validateAnswer("maze", ["entrada", "B", "D", "F", "G"]), false);
  // salas sem conexão
  assert.equal(validateAnswer("maze", ["entrada", "C", "E", "saida"]), false);
  // formato errado
  assert.equal(validateAnswer("maze", "entrada,A,C,E,saida"), false);
  assert.equal(validateAnswer("maze", []), false);
});