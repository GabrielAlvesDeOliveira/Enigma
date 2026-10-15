import { buildGraph, isValidPath } from "../algorithms/graph.js";

// CONTEÚDO DE EXEMPLO: a equipe pode redesenhar o labirinto.
const START = "entrada";
const END = "saida";
const EDGES = [
  ["entrada", "A"],
  ["entrada", "B"],
  ["A", "C"],
  ["B", "C"],
  ["B", "D"],
  ["C", "E"],
  ["D", "F"],
  ["F", "G"],
  ["E", "saida"],
];

const graph = buildGraph(EDGES);

export default {
  key: "maze",

  getPublicData() {
    return {
      key: "maze",
      title: "Labirinto",
      statement:
        "Encontre um caminho da entrada até a saída, passando de sala em sala.",
      start: START,
      end: END,
      edges: EDGES,
    };
  },

  // A resposta é a lista de salas do caminho escolhido.
  validate(answer) {
    return isValidPath(graph, answer, START, END);
  },
};
