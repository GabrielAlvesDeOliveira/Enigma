// Garante que erros de funções async cheguem ao tratador de erros do Express.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
