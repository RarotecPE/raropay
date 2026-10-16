export * from './types';
export * from './uuid';
export * from './sanitizer';
export * from './tokens';
export * from './hash';
export * from './queue';
export * from './client';

/**
 * Extrai IP e User-Agent de um Request HTTP de forma segura.
 */
export function getRequestContext(request?: Request | null): { ip: string | null; userAgent: string | null } {
  if (!request) {
    return { ip: null, userAgent: null };
  }
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : null;
  const userAgent = request.headers.get('user-agent');
  return { ip, userAgent };
}

