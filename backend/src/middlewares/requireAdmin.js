import { AppError } from "../utils/AppError.js";

// Deve ser usado depois do authenticate. Só deixa passar o mestre (admin).
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return next(new AppError(403, "Apenas o mestre pode fazer isso."));
  }
  next();
}
