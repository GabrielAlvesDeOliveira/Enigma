// Erro "esperado" da aplicação, com o código HTTP que deve ser devolvido.
export class AppError extends Error {
    constructor(status, message) {
      super(message);
      this.name = "AppError";
      this.status = status;
    }
  }