// Conversões para o código não perceber a diferença entre SQLite e PostgreSQL.

// Colunas JSON: o SQLite devolve texto, o PostgreSQL devolve objeto.
// Atenção: guarde sempre um objeto ou array no nível mais alto (por exemplo { value: ... }).
// Um texto simples no nível mais alto seria devolvido já "aberto" pelo PostgreSQL
// e não daria para distinguir de um JSON ainda em formato de texto.
export function parseJson(value) {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

// Ao gravar JSON, sempre envie texto (o PostgreSQL não aceita array do JavaScript).
export const toJsonColumn = (value) => JSON.stringify(value);

// Colunas booleanas: o SQLite devolve 1 ou 0, o PostgreSQL devolve true ou false.
export function toBool(value) {
  return value === true || value === 1 || value === "1" || value === "t" || value === "true";
}
