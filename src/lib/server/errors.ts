import 'server-only';

export type AppErrorCode =
  | 'ALREADY_EXISTS'
  | 'INVALID_BODY'
  | 'INTERNAL_ERROR'
  | 'NOT_A_PROJECT'
  | 'NOT_FOUND'
  | 'PATH_NOT_ALLOWED'
  | 'SCAN_FAILED'
  | 'SCRIPT_NOT_ALLOWED';

/**
 * Erro de aplicação: carrega o código estável do envelope (§4.1) e o status HTTP.
 * Qualquer outro erro é tratado como 500 e nunca vaza detalhes para o cliente.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: AppErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function notFound(message = 'Registro não encontrado.', details?: unknown): AppError {
  return new AppError('NOT_FOUND', message, 404, details);
}

export function pathNotAllowed(message = 'Caminho fora das raízes permitidas.', details?: unknown): AppError {
  return new AppError('PATH_NOT_ALLOWED', message, 403, details);
}

export function invalidBody(message = 'Corpo da requisição inválido.', details?: unknown): AppError {
  return new AppError('INVALID_BODY', message, 400, details);
}

export function alreadyExists(message = 'Registro já cadastrado.', details?: unknown): AppError {
  return new AppError('ALREADY_EXISTS', message, 409, details);
}

export function internal(message = 'Erro interno do servidor.', details?: unknown): AppError {
  return new AppError('INTERNAL_ERROR', message, 500, details);
}

export function notAProject(message = 'Caminho não contém package.json nem .git.', details?: unknown): AppError {
  return new AppError('NOT_A_PROJECT', message, 400, details);
}

export function scriptNotAllowed(message = 'Script não permitido para este projeto.', details?: unknown): AppError {
  return new AppError('SCRIPT_NOT_ALLOWED', message, 422, details);
}

export function scanFailed(message = 'Falha ao escanear as raízes de projetos.', details?: unknown): AppError {
  return new AppError('SCAN_FAILED', message, 500, details);
}
