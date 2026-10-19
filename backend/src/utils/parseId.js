import { AppError } from "./AppError.js";

const MAX_ID = 2147483647;

export function parseId(value, message = "Recurso não encontrado.") {
  const text = String(value);
  if (!/^[1-9]\d{0,9}$/.test(text) || Number(text) > MAX_ID) {
    throw new AppError(404, message);
  }
  return Number(text);
}