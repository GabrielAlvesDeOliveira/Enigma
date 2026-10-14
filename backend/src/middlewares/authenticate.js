import { verifyToken } from "../services/authService.js";
import { AppError } from "../utils/AppError.js";

// Exige login. Lê o cabeçalho "Authorization: Bearer <token>"
// e deixa os dados do usuário em req.user.
export function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "Faça login para continuar."));
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}