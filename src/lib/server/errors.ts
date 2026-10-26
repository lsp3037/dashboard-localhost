import 'server-only';

export type AppErrorCode =
  | 'ALREADY_EXISTS'
  | 'ALREADY_RUNNING'
  | 'INVALID_BODY'
  | 'INTERNAL_ERROR'
  | 'KILL_FAILED'
  | 'MAX_RUNNING'
  | 'NOT_A_PROJECT'
  | 'NOT_FOUND'
  | 'NOT_RUNNING'
  | 'NO_SCRIPT'
  | 'PATH_NOT_ALLOWED'
  | 'PORT_IN_USE'
  | 'PROJECT_MISSING'
  | 'PROJECT_NOT_FOUND'
  | 'RUNNING'
  | 'RUN_NOT_FOUND'
  | 'SCAN_FAILED'
  | 'SCRIPT_NOT_ALLOWED'
  | 'SPAWN_FAILED';

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

  get statusCode(): number {
    return this.status;
  }
}

/** Alias para compatibilidade com testes e módulos legados. */
export class HubHttpError extends AppError {}

/**
 * `instanceof` sozinho não basta: com Turbopack o mesmo módulo pode ser carregado em
 * grafos diferentes (rota × manager), e o erro cruza a fronteira como instância de outra
 * cópia da classe. O duck-typing abaixo mantém o status/código do envelope estável.
 */
export function isAppError(value: unknown): value is AppError {
  if (value instanceof AppError) return true;
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };

  return (
    candidate.name === 'AppError' &&
    typeof candidate.code === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.message === 'string'
  );
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

/* ------------------------------------------------------------------------- *
 * Controle de processos (§6.9)
 * ------------------------------------------------------------------------- */

export function alreadyRunning(message = 'Projeto já está rodando.', details?: unknown): AppError {
  return new AppError('ALREADY_RUNNING', message, 409, details);
}

export function notRunning(message = 'Nenhum processo ativo para este projeto.', details?: unknown): AppError {
  return new AppError('NOT_RUNNING', message, 409, details);
}

export function portInUse(message = 'Porta ocupada por processo externo.', details?: unknown): AppError {
  return new AppError('PORT_IN_USE', message, 409, details);
}

export function noScript(
  message = 'Nenhum script executável (dev/start/preview) neste projeto.',
  details?: unknown,
): AppError {
  return new AppError('NO_SCRIPT', message, 422, details);
}

export function spawnFailed(message = 'Falha ao iniciar processo.', details?: unknown): AppError {
  return new AppError('SPAWN_FAILED', message, 500, details);
}

export function killFailed(message = 'Não foi possível encerrar o processo.', details?: unknown): AppError {
  return new AppError('KILL_FAILED', message, 500, details);
}

export function projectMissing(message = 'Pasta do projeto não encontrada.', details?: unknown): AppError {
  return new AppError('PROJECT_MISSING', message, 409, details);
}

export function projectNotFound(message = 'Projeto não encontrado.', details?: unknown): AppError {
  return new AppError('PROJECT_NOT_FOUND', message, 404, details);
}

/** `DELETE ?hard=1` com run ativo: remover a linha derrubaria a auditoria do processo vivo. */
export function projectRunning(
  message = 'Projeto com execução ativa; pare antes de remover.',
  details?: unknown,
): AppError {
  return new AppError('RUNNING', message, 409, details);
}

export function runNotFound(message = 'Run não encontrado.', details?: unknown): AppError {
  return new AppError('RUN_NOT_FOUND', message, 404, details);
}

export function maxRunning(message = 'Limite de execuções simultâneas atingido.', details?: unknown): AppError {
  return new AppError('MAX_RUNNING', message, 409, details);
}
