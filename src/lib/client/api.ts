'use client';

import { errorMessageFor } from '@/lib/shared/error-messages';

interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Mensagem amigável em pt-BR para exibir no formulário. */
  get friendlyMessage(): string {
    return errorMessageFor(this.code, this.message);
  }
}

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = (value as { error?: unknown }).error;
  if (typeof candidate !== 'object' || candidate === null) return false;
  const error = candidate as { code?: unknown; message?: unknown };
  return typeof error.code === 'string' && typeof error.message === 'string';
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorEnvelope(payload)) {
      throw new ApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
    }
    throw new ApiError(`Falha na requisição (HTTP ${response.status}).`, `HTTP_${response.status}`, response.status);
  }

  return payload as T;
}

export function getJson<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'GET' });
}

export function postJson<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

export function patchJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteJson<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'DELETE' });
}
