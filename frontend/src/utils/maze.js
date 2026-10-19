export const cellId = (row, col) => `${row},${col}`


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

export function areAdjacent(idA, idB) {
  const [rowA, colA] = idA.split(',').map(Number)
  const [rowB, colB] = idB.split(',').map(Number)
  return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1
}

export function stepFrom(id, [deltaRow, deltaCol], rows, cols) {
  const [row, col] = id.split(',').map(Number)
  const nextRow = row + deltaRow
  const nextCol = col + deltaCol

  if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) return null
  return cellId(nextRow, nextCol)
}
