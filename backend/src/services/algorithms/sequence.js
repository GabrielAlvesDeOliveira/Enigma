// Calcula o próximo termo de uma sequência numérica usando a tabela de
// diferenças finitas. Funciona para padrões aritméticos, quadráticos,
// cúbicos etc. (sequências polinomiais).
//
// Exemplo: 3, 8, 15, 24, 35
//   nível 0: 3  8  15  24  35
//   nível 1:   5   7   9  11
//   nível 2:     2   2   2      (constante, o padrão foi confirmado)
// Subindo a tabela: 11 + 2 = 13 e 35 + 13 = 48.
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

    // Nível constante com pelo menos 2 valores: padrão confirmado.
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
