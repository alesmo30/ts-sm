import type { ZodType, ZodTypeDef } from 'zod';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Input queda sin fijar (a diferencia de ZodSchema<T>, que asume Input = Output):
// schemas con .default() (p.ej. TranscriptTurnSchema.citations) tienen un Input más
// laxo que su Output, y forzarlos a coincidir rompía la inferencia de T en cada llamada.
type ResponseSchema<T> = ZodType<T, ZodTypeDef, unknown>;

export class ApiValidationError extends Error {
  constructor(
    path: string,
    public readonly issues: string[],
  ) {
    super(`Respuesta inválida de ${path}: ${issues.join('; ')}`);
    this.name = 'ApiValidationError';
  }
}

async function request<T>(
  path: string,
  schema: ResponseSchema<T>,
  init?: RequestInit,
  extraHeaders: Record<string, string> = { 'Content-Type': 'application/json' },
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...extraHeaders, ...init?.headers },
  });

  if (!response.ok) {
    // El body de error de Nest trae { message } (ValidationPipe, ServiceUnavailableException,
    // BadGatewayException, …) — vale como diagnóstico accionable para el usuario.
    const errorBody: unknown = await response.json().catch(() => null);
    const message =
      errorBody && typeof errorBody === 'object' && 'message' in errorBody && typeof errorBody.message === 'string'
        ? errorBody.message
        : `${path} respondió ${response.status}`;
    throw new Error(message);
  }

  const body: unknown = await response.json();
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiValidationError(
      path,
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }

  return result.data;
}

export const apiClient = {
  get<T>(path: string, schema: ResponseSchema<T>): Promise<T> {
    return request(path, schema);
  },
  post<T>(path: string, schema: ResponseSchema<T>, body: unknown): Promise<T> {
    return request(path, schema, { method: 'POST', body: JSON.stringify(body) });
  },
  patch<T>(path: string, schema: ResponseSchema<T>, body: unknown): Promise<T> {
    return request(path, schema, { method: 'PATCH', body: JSON.stringify(body) });
  },
  // Sin Content-Type explícito: el navegador fija el boundary de multipart/form-data solo.
  postForm<T>(path: string, schema: ResponseSchema<T>, formData: FormData): Promise<T> {
    return request(path, schema, { method: 'POST', body: formData }, {});
  },
};
