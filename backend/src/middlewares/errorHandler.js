import { AppError } from "../utils/AppError.js";

// Rota que não existe.
export function notFound(req, res, next) {
  next(new AppError(404, "Rota não encontrada."));
}

// Tratador único de erros: toda resposta de erro tem o formato { error: "mensagem" }.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  // JSON malformado enviado pelo cliente.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido." });
  }

  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
}
