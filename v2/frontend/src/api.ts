export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: Record<string, unknown>) { super(message); }
}
let csrf = '';
export const setCsrf = (token: string) => { csrf = token; };

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, credentials: 'include',
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' ? { 'x-csrf-token': csrf } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, json.error?.code ?? 'ERROR', json.error?.message ?? 'The request failed.', json.error?.details);
  return json.data as T;
}
