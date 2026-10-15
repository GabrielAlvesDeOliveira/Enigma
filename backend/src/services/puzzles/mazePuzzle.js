import { bfsShortestPath, buildGraph, isValidPath } from "../algorithms/graph.js";

// CONTEÚDO DE EXEMPLO: a equipe pode redesenhar o labirinto.
//
// O labirinto é uma grade de texto. Cada caractere é uma casa:
//   #   parede
//   .   corredor (casa livre)
//   S   início (exatamente um)
//   E   fim (exatamente um)
// O jogador anda de casa em casa (para cima, para baixo, para a esquerda ou para a
// direita), só por casas livres, sem passar duas vezes pela mesma casa.
// Todas as linhas devem ter o mesmo tamanho, e precisa existir um caminho do S até o E.
// O servidor confere isso ao iniciar e avisa com um erro claro se o desenho estiver errado.
const LAYOUT = [
  "###############",
  "#S#.....#.....#",
  "#.###.#.###.###",
  "#.....#...#...#",
  "#########.#.#.#",
  "#.....#...#.#.#",
  "#.###.#.#####.#",
  "#...#.#.#.....#",
  "#.#.###.###.#.#",
  "#.#.........#E#",
  "###############",
];

const FREE_CELLS = new Set([".", "S", "E"]);

// Cada casa é identificada por "linha,coluna" (contando de 0). Ex.: "1,1".
const cellId = (row, col) => `${row},${col}`;

// Lê o desenho, confere se está correto e devolve o que o servidor precisa.
export function readLayout(layout) {
  if (!Array.isArray(layout) || layout.length === 0) {
    throw new Error("O desenho do labirinto está vazio.");
  }

  const rows = layout.length;
  const cols = layout[0].length;
  let start = null;
  let end = null;
  const edges = [];

  for (let row = 0; row < rows; row++) {
    if (typeof layout[row] !== "string" || layout[row].length !== cols) {
      throw new Error(`A linha ${row + 1} do labirinto tem tamanho diferente das outras.`);
    }

    for (let col = 0; col < cols; col++) {
      const char = layout[row][col];

      if (char !== "#" && !FREE_CELLS.has(char)) {
        throw new Error(`Caractere inválido "${char}" na linha ${row + 1}, coluna ${col + 1}.`);
      }
      if (char === "#") continue;

      if (char === "S") {
        if (start) throw new Error("O labirinto tem mais de um início (S).");
        start = cellId(row, col);
      }
      if (char === "E") {
        if (end) throw new Error("O labirinto tem mais de um fim (E).");
        end = cellId(row, col);
      }

      // Liga cada casa livre às vizinhas livres da direita e de baixo.
      if (col + 1 < cols && FREE_CELLS.has(layout[row][col + 1])) {
        edges.push([cellId(row, col), cellId(row, col + 1)]);
      }
      if (row + 1 < rows && FREE_CELLS.has(layout[row + 1][col])) {
        edges.push([cellId(row, col), cellId(row + 1, col)]);
      }
    }
  }

  if (!start) throw new Error("O labirinto não tem início (S).");
  if (!end) throw new Error("O labirinto não tem fim (E).");

  const graph = buildGraph(edges);

  if (!bfsShortestPath(graph, start, end)) {
    throw new Error("O labirinto não tem caminho do início (S) até o fim (E).");
  }

  return { rows, cols, start, end, graph };
}

const maze = readLayout(LAYOUT);

// O menor caminho do início ao fim, calculado com busca em largura (BFS).
// Só para testes e documentação: nunca é enviado ao jogador.
export const solutionPath = bfsShortestPath(maze.graph, maze.start, maze.end);

export default {
  key: "maze",

  // Dados enviados ao frontend. O desenho é público; a solução não.
  getPublicData() {
    return {
      key: "maze",
      title: "Labirinto",
      statement:
        "Encontre o caminho do início (I) até o fim (F). Ande de casa em casa pelos corredores, sem passar duas vezes pela mesma casa.",
      layout: [...LAYOUT],
      rows: maze.rows,
      cols: maze.cols,
      start: maze.start,
      end: maze.end,
    };
  },

  // A resposta é a lista de casas do caminho, de "start" até "end", por exemplo
  // ["1,1", "2,1", "3,1", ...]. O servidor confere cada passo no grafo.
  validate(answer) {
    return isValidPath(maze.graph, answer, maze.start, maze.end);
  },
};
