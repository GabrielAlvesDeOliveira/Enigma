export function nextTermByDifferences(terms) {
  if (!Array.isArray(terms) || !terms.every(Number.isFinite)) {
    throw new Error("A sequência precisa ser uma lista de números.");
  }

  const levels = [terms.slice()];

  while (true) {
    const last = levels[levels.length - 1];

    if (last.length < 2) {
      throw new Error("Termos insuficientes para confirmar o padrão.");
    }

    if (last.every((value) => value === last[0])) break;

    levels.push(last.slice(1).map((value, i) => value - last[i]));
  }

  let increment = levels[levels.length - 1][0];

  for (let i = levels.length - 2; i >= 0; i--) {
    const row = levels[i];
    increment = row[row.length - 1] + increment;
  }

  return increment;
}