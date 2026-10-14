import { AppError } from "./AppError.js";

const STATUSES = ["waiting", "in_progress", "finished"];
const REASONS = ["completed", "timeout", "cancelled"];
const DAY_MS = 24 * 60 * 60 * 1000;

const invalid = (name) => new AppError(400, `Parâmetro inválido: ${name}.`);

function text(query, name) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw invalid(name); // repetido na URL vira array
  return value;
}

function integer(query, name, { min, max, fallback }) {
  const value = text(query, name);
  if (value === undefined) return fallback;
  if (!/^\d{1,6}$/.test(value)) throw invalid(name);
  const number = Number(value);
  if (number < min || number > max) throw invalid(name);
  return number;
}

function oneOf(query, name, allowed) {
  const value = text(query, name);
  if (value === undefined) return null;
  if (!allowed.includes(value)) throw invalid(name);
  return value;
}

// Aceita apenas datas reais no formato AAAA-MM-DD (dia em UTC).
function day(query, name) {
  const value = text(query, name);
  if (value === undefined) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())
      || date.toISOString().slice(0, 10) !== value) {
    throw invalid(name);
  }
  return date.getTime();
}

// Lê e valida os parâmetros da URL das listagens (?page=1&status=finished ...).
// O dia final ("to") entra inteiro: devolvemos o início do dia seguinte como limite exclusivo.
export function parseHistoryFilters(query = {}) {
  const guided = oneOf(query, "guided", ["true", "false"]);
  const fromMs = day(query, "from");
  const toDay = day(query, "to");
  const toMs = toDay === null ? null : toDay + DAY_MS;

  if (fromMs !== null && toMs !== null && toMs <= fromMs) {
    throw new AppError(400, "Intervalo de datas inválido.");
  }

  return {
    page: integer(query, "page", { min: 1, max: 100000, fallback: 1 }),
    pageSize: integer(query, "pageSize", { min: 1, max: 50, fallback: 20 }),
    status: oneOf(query, "status", STATUSES),
    finishReason: oneOf(query, "reason", REASONS),
    guided: guided === "true",
    fromMs,
    toMs,
  };
}