import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PUZZLE_KEYS,
  getPuzzle,
  getPublicPuzzle,
  validateAnswer,
} from "../src/services/puzzles/index.js";
import { readLayout, solutionPath } from "../src/services/puzzles/mazePuzzle.js";

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

// ---------- Labirinto em grade ----------

const START = solutionPath[0];
const END = solutionPath[solutionPath.length - 1];
const asCell = (id) => id.split(",").map(Number);
const fromCell = (row, col) => `${row},${col}`;

test("labirinto: a solução calculada pelo servidor é aceita", () => {
  assert.ok(solutionPath.length > 10);
  assert.equal(validateAnswer("maze", solutionPath), true);
});

test("labirinto: caminho que não chega ao fim, ou não começa no início, é recusado", () => {
  assert.equal(validateAnswer("maze", solutionPath.slice(0, -1)), false);
  assert.equal(validateAnswer("maze", solutionPath.slice(1)), false);
  assert.equal(validateAnswer("maze", [START]), false);
  assert.equal(validateAnswer("maze", [END, START]), false);
});

test("labirinto: pular casas, andar na diagonal ou atravessar parede é recusado", () => {
  // pula a casa do meio
  assert.equal(validateAnswer("maze", [solutionPath[0], ...solutionPath.slice(2)]), false);

  // diagonal: troca a 3ª casa por uma vizinha na diagonal da anterior
  const [row, col] = asCell(solutionPath[1]);
  assert.equal(validateAnswer("maze", [START, fromCell(row + 1, col + 1), ...solutionPath.slice(3)]), false);

  // parede: a casa (0,0) é parede
  assert.equal(validateAnswer("maze", [START, "0,1", ...solutionPath.slice(2)]), false);
});

test("labirinto: repetir casa é recusado, mesmo voltando ao caminho certo", () => {
  const withLoop = [...solutionPath.slice(0, 3), solutionPath[1], ...solutionPath.slice(2)];
  assert.equal(validateAnswer("maze", withLoop), false);
});

test("labirinto: casas fora da grade, formatos errados e nomes especiais são recusados", () => {
  const invalid = [
    [START, "99,99", END],
    [START, "1,1", END],
    ["1,1,1", END],
    [START, 5, END],
    [[START], [END]],
    solutionPath.join(","),
    "",
    [],
    null,
    undefined,
    {},
    ["constructor", "__proto__"],
    Array(500).fill(START),
  ];

  for (const answer of invalid) {
    assert.equal(validateAnswer("maze", answer), false, JSON.stringify(answer)?.slice(0, 40));
  }
});

test("labirinto: os dados públicos descrevem a grade e não revelam a solução", () => {
  const data = getPublicPuzzle("maze");

  assert.equal(data.rows, data.layout.length);
  assert.equal(data.cols, data.layout[0].length);
  assert.ok(data.layout.every((line) => typeof line === "string" && line.length === data.cols));
  assert.equal(data.layout.join("").split("S").length - 1, 1);
  assert.equal(data.layout.join("").split("E").length - 1, 1);
  assert.equal(data.layout[asCell(data.start)[0]][asCell(data.start)[1]], "S");
  assert.equal(data.layout[asCell(data.end)[0]][asCell(data.end)[1]], "E");
  assert.equal("solution" in data, false);
  assert.equal(JSON.stringify(data).includes(solutionPath.join(",")), false);
});

test("labirinto: editar o desenho de volta não afeta o servidor (cópia)", () => {
  const data = getPublicPuzzle("maze");
  data.layout[1] = "XXXXXXXXXXXXXXX";
  assert.notEqual(getPublicPuzzle("maze").layout[1], "XXXXXXXXXXXXXXX");
});

test("labirinto: o desenho é conferido, com mensagens claras para quem for editar", () => {
  const ok = ["#####", "#S.E#", "#####"];
  assert.equal(readLayout(ok).start, "1,1");
  assert.equal(readLayout(ok).end, "1,3");

  assert.throws(() => readLayout([]), /vazio/);
  assert.throws(() => readLayout("texto"), /vazio/);
  assert.throws(() => readLayout(["#####", "#S.E", "#####"]), /linha 2.*tamanho diferente/);
  assert.throws(() => readLayout(["#####", "#S.X#", "#####"]), /Caractere inválido "X"/);
  assert.throws(() => readLayout(["#####", "#..E#", "#####"]), /não tem início/);
  assert.throws(() => readLayout(["#####", "#S..#", "#####"]), /não tem fim/);
  assert.throws(() => readLayout(["#####", "#SSE#", "#####"]), /mais de um início/);
  assert.throws(() => readLayout(["#####", "#SEE#", "#####"]), /mais de um fim/);
  assert.throws(() => readLayout(["#####", "#S#E#", "#####"]), /não tem caminho/);
});

test("labirinto: o grafo só liga casas livres vizinhas (sem paredes nem diagonais)", () => {
  const { layout } = getPublicPuzzle("maze");
  const { graph } = readLayout(layout);
  const freeCount = layout.join("").replace(/#/g, "").length;

  assert.equal(Object.keys(graph).length, freeCount); // toda casa livre existe, e nenhuma parede
  assert.ok(freeCount > 20);

  for (const [id, neighbors] of Object.entries(graph)) {
    const [row, col] = asCell(id);
    assert.notEqual(layout[row][col], "#", `parede no grafo: ${id}`);

    for (const other of neighbors) {
      const [r, c] = asCell(other);
      assert.notEqual(layout[r][c], "#", `ligação com parede: ${id} -> ${other}`);
      assert.equal(Math.abs(row - r) + Math.abs(col - c), 1, `ligação que não é vizinha: ${id} -> ${other}`);
      assert.ok(graph[other].includes(id), `ligação sem volta: ${id} -> ${other}`);
    }
  }
});

test("labirinto: num corredor simples, só o caminho em linha reta vale", () => {
  const maze = readLayout(["#####", "#S.E#", "#####"]);
  assert.equal(Object.keys(maze.graph).length, 3);
});
