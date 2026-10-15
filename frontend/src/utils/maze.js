// Apoio ao labirinto. As "edges" são pares de salas conectadas, por exemplo
// [['entrada', 'A'], ['A', 'C']]. As conexões valem nos dois sentidos.

// Mapa: sala -> lista de salas vizinhas.
export function buildAdjacency(edges) {
  const adjacency = new Map()

  for (const [a, b] of edges) {
    if (!adjacency.has(a)) adjacency.set(a, [])
    if (!adjacency.has(b)) adjacency.set(b, [])
    adjacency.get(a).push(b)
    adjacency.get(b).push(a)
  }

  return adjacency
}

// Todas as salas, na ordem em que aparecem nas conexões.
export function listNodes(edges) {
  const nodes = []

  for (const edge of edges) {
    for (const node of edge) {
      if (!nodes.includes(node)) nodes.push(node)
    }
  }

  return nodes
}
