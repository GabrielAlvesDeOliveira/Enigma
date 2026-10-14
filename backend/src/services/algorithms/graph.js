// Monta uma lista de adjacência (grafo não direcionado) a partir das arestas.
// Exemplo: [["A", "B"], ["B", "C"]] vira { A: ["B"], B: ["A", "C"], C: ["B"] }
export function buildGraph(edges) {
    const graph = Object.create(null);
  
    for (const [a, b] of edges) {
      (graph[a] ??= []).push(b);
      (graph[b] ??= []).push(a);
    }
  
    return graph;
  }
  
  // Busca em largura (BFS): devolve o menor caminho de start até end,
  // ou null se não existir caminho.
  export function bfsShortestPath(graph, start, end) {
    if (!(start in graph) || !(end in graph)) return null;
  
    const previous = Object.create(null);
    previous[start] = null;
    const queue = [start];
  
    while (queue.length > 0) {
      const current = queue.shift();
  
      if (current === end) {
        const path = [];
        for (let node = end; node !== null; node = previous[node]) {
          path.unshift(node);
        }
        return path;
      }
  
      for (const neighbor of graph[current]) {
        if (!(neighbor in previous)) {
          previous[neighbor] = current;
          queue.push(neighbor);
        }
      }
    }
  
    return null;
  }
  
  // Confere se o caminho enviado pelo jogador é válido: começa na entrada,
  // termina na saída, não repete salas e só usa conexões que existem.
  export function isValidPath(graph, path, start, end) {
    if (!Array.isArray(path) || path.length < 2) return false;
    if (!path.every((node) => typeof node === "string")) return false;
    if (path.length > Object.keys(graph).length) return false;
    if (path[0] !== start || path[path.length - 1] !== end) return false;
    if (new Set(path).size !== path.length) return false;
  
    for (let i = 0; i < path.length - 1; i++) {
      const neighbors = graph[path[i]];
      if (!neighbors || !neighbors.includes(path[i + 1])) return false;
    }
  
    return true;
  }