export function parseJson(value) {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

export const toJsonColumn = (value) => JSON.stringify(value);

export function toBool(value) {
  return value === true || value === 1 || value === "1" || value === "t" || value === "true";
}