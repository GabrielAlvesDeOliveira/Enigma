import { test } from "node:test";
import assert from "node:assert/strict";
import {
  caesarEncrypt,
  caesarDecrypt,
  normalizeText,
} from "../src/services/algorithms/cipher.js";
import { nextTermByDifferences } from "../src/services/algorithms/sequence.js";
import {
  buildGraph,
  bfsShortestPath,
  isValidPath,
} from "../src/services/algorithms/graph.js";

// ---------- Cifra de César ----------

test("cifra: cifra e decifra uma frase", () => {
  assert.equal(caesarEncrypt("CHAVE DOURADA", 3), "FKDYH GRXUDGD");
  assert.equal(caesarDecrypt("FKDYH GRXUDGD", 3), "CHAVE DOURADA");
});

test("cifra: volta ao início do alfabeto", () => {
  assert.equal(caesarEncrypt("XYZ", 3), "ABC");
  assert.equal(caesarDecrypt("ABC", 3), "XYZ");
});

test("cifra: aceita deslocamento negativo e maior que 26", () => {
  assert.equal(caesarEncrypt("ABC", -1), "ZAB");
  assert.equal(caesarEncrypt("ABC", 29), "DEF");
});

test("cifra: normaliza acentos e minúsculas", () => {
  assert.equal(normalizeText("  Ação   Rápida "), "ACAO RAPIDA");
});

// ---------- Sequência (diferenças finitas) ----------

test("sequência: padrão quadrático", () => {
  assert.equal(nextTermByDifferences([3, 8, 15, 24, 35]), 48);
});

test("sequência: padrão aritmético", () => {
  assert.equal(nextTermByDifferences([2, 4, 6, 8]), 10);
});

test("sequência: termos insuficientes ou sem padrão polinomial dão erro", () => {
  assert.throws(() => nextTermByDifferences([5]));
  assert.throws(() => nextTermByDifferences([1, 2, 4, 8, 16]));
  assert.throws(() => nextTermByDifferences(["a", "b", "c"]));
});

// ---------- Grafo ----------

const graph = buildGraph([
  ["entrada", "A"],
  ["A", "B"],
  ["B", "saida"],
  ["entrada", "C"],
  ["C", "D"],
  ["Z", "Y"],
]);

test("grafo: BFS encontra o menor caminho", () => {
  assert.deepEqual(bfsShortestPath(graph, "entrada", "saida"), [
    "entrada",
    "A",
    "B",
    "saida",
  ]);
});

test("grafo: BFS devolve null quando não há caminho ou o nó não existe", () => {
  assert.equal(bfsShortestPath(graph, "entrada", "Z"), null);
  assert.equal(bfsShortestPath(graph, "entrada", "inexistente"), null);
});

test("grafo: valida caminho correto", () => {
  assert.equal(
    isValidPath(graph, ["entrada", "A", "B", "saida"], "entrada", "saida"),
    true
  );
});

test("grafo: rejeita caminhos inválidos", () => {
  // pula uma sala (sem conexão direta)
  assert.equal(isValidPath(graph, ["entrada", "B", "saida"], "entrada", "saida"), false);
  // não termina na saída
  assert.equal(isValidPath(graph, ["entrada", "A"], "entrada", "saida"), false);
  // repete sala
  assert.equal(
    isValidPath(graph, ["entrada", "A", "entrada", "A", "B", "saida"], "entrada", "saida"),
    false
  );
  // tipos errados e nomes especiais do JavaScript
  assert.equal(isValidPath(graph, "entrada,saida", "entrada", "saida"), false);
  assert.equal(isValidPath(graph, ["entrada", 1, "saida"], "entrada", "saida"), false);
  assert.equal(
    isValidPath(graph, ["entrada", "constructor", "saida"], "entrada", "saida"),
    false
  );
});