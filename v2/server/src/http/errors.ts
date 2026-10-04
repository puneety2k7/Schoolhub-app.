export class AppError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: Record<string, unknown>) {
    super(message);
  }
}
export const badRequest = (message: string, details?: Record<string, unknown>) => new AppError(400, 'VALIDATION_FAILED', message, details);
export const unauthenticated = () => new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
export const forbidden = (message = 'Access is denied.', details?: Record<string, unknown>) => new AppError(403, 'AUTHORIZATION_DENIED', message, details);
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (code: string, message: string, details?: Record<string, unknown>) => new AppError(409, code, message, details);
