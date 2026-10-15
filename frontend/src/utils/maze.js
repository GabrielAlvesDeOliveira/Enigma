// Apoio ao labirinto em grade. O desenho vem do servidor como uma lista de textos,
// um por linha: "#" é parede, "." é corredor, "S" é o início e "E" é o fim.
// Cada casa tem um identificador "linha,coluna" (contando de 0), o mesmo usado
// na resposta enviada ao servidor. Ex.: "1,1".

export const cellId = (row, col) => `${row},${col}`

// Transforma o desenho em uma matriz de casas:
//   [{ id, row, col, open, kind }]  onde kind é "wall", "start", "end" ou "floor".
export function parseLayout(layout) {
  return layout.map((line, row) =>
    [...line].map((char, col) => ({
      id: cellId(row, col),
      row,
      col,
      open: char !== '#',
      kind: char === 'S' ? 'start' : char === 'E' ? 'end' : char === '#' ? 'wall' : 'floor',
    })),
  )
}

// Duas casas são vizinhas se estão lado a lado (sem diagonal).
export function areAdjacent(idA, idB) {
  const [rowA, colA] = idA.split(',').map(Number)
  const [rowB, colB] = idB.split(',').map(Number)
  return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1
}

// Casa vizinha na direção indicada ([-1, 0] é para cima, [0, 1] é para a direita...).
// Devolve null se a direção sai da grade.
export function stepFrom(id, [deltaRow, deltaCol], rows, cols) {
  const [row, col] = id.split(',').map(Number)
  const nextRow = row + deltaRow
  const nextCol = col + deltaCol

  if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) return null
  return cellId(nextRow, nextCol)
}
