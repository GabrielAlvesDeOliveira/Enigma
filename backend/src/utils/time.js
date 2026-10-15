// Converte para milissegundos qualquer formato de data que possa vir do banco
// ou de um cliente, para o resto do código trabalhar sempre com números.
//
// - number: SQLite devolve datas gravadas pelo código assim
// - Date: o PostgreSQL devolve assim
// - "2026-10-14 00:30:09": formato do CURRENT_TIMESTAMP do SQLite (UTC, sem fuso)
// - texto ISO (com Z ou fuso): como as datas costumam viajar em JSON
// Devolve null se o valor estiver vazio ou não for uma data válida.
export function toMillis(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }

  if (typeof value === "string") {
    const text = value.trim();
    const isSqliteFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text);
    const time = Date.parse(isSqliteFormat ? text.replace(" ", "T") + "Z" : text);
    return Number.isNaN(time) ? null : time;
  }

  return null;
}
