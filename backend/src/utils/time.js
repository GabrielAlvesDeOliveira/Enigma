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