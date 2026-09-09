export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const Errors = {
  unauthorized: (message = "Credenciais invalidas") => new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Acesso negado") => new AppError(403, "FORBIDDEN", message),
  notFound: (message = "Recurso nao encontrado") => new AppError(404, "NOT_FOUND", message),
  conflict: (message = "Conflito de dados") => new AppError(409, "CONFLICT", message),
  badRequest: (message = "Requisicao invalida") => new AppError(400, "BAD_REQUEST", message),
  unprocessable: (message = "Nao foi possivel processar a solicitacao") =>
    new AppError(422, "UNPROCESSABLE", message),
  tooManyRequests: (message = "Muitas tentativas, tente novamente mais tarde") =>
    new AppError(429, "TOO_MANY_REQUESTS", message),
};
