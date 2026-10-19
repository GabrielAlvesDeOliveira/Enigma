import { AppError } from "../utils/AppError.js";

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return next(new AppError(403, "Apenas o mestre pode fazer isso."));
  }
  next();
}
