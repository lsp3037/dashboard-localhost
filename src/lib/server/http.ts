import 'server-only';

import type { ZodType } from 'zod';

import { invalidBody, internal, isAppError } from '@/lib/server/errors';

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ValidationIssueDTO {
  path: string[];
  message: string;
  code: string;
}

const JSON_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

/** Resposta de sucesso: JSON UTF-8, sem cache. */
export function jsonOk<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/** Resposta sem corpo (204) para remoções definitivas. */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Serializa um erro no envelope `{ error: { code, message, details } }`.
 * Erros desconhecidos viram 500 genérico: detalhes internos ficam só no log do servidor.
 */
export function jsonError(error: unknown): Response {
  const appError = isAppError(error) ? error : internal();

  if (!isAppError(error)) {
    console.error('[hub] erro não tratado:', error);
  }

  const payload: ErrorEnvelope = {
    error: {
      code: appError.code,
      message: appError.message,
    },
  };

  if (appError.details !== undefined) {
    payload.error.details = appError.details;
  }

  return new Response(JSON.stringify(payload), { status: appError.status, headers: JSON_HEADERS });
}

function toIssues(issues: readonly { path: readonly PropertyKey[]; message: string; code: string }[]): ValidationIssueDTO[] {
  return issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Lê e valida o corpo JSON com Zod.
 * Corpo vazio é tratado como `{}` (permite body opcional); JSON inválido ou fora do schema → 400 INVALID_BODY.
 */
export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: string;

  try {
    raw = await request.text();
  } catch {
    throw invalidBody('Não foi possível ler o corpo da requisição.');
  }

  let parsedJson: unknown = {};

  if (raw.trim().length > 0) {
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      throw invalidBody('JSON inválido no corpo da requisição.', {
        issues: [{ path: [], message: 'JSON inválido', code: 'invalid_json' }],
      });
    }
  }

  const result = schema.safeParse(parsedJson);

  if (!result.success) {
    throw invalidBody('Corpo da requisição inválido.', { issues: toIssues(result.error.issues) });
  }

  return result.data;
}
