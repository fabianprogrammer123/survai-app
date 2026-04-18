import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Typed JSON error envelope used by every /api/** route.
 * Frontend can switch on `code` for stable behavior across copy changes.
 */
export type ApiErrorBody = {
  error: string;
  code: 'unauthorized' | 'forbidden' | 'not_found' | 'bad_request' | 'internal';
  details?: unknown;
};

export function unauthorized(message = 'Authentication required') {
  return NextResponse.json<ApiErrorBody>(
    { error: message, code: 'unauthorized' },
    { status: 401 }
  );
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json<ApiErrorBody>(
    { error: message, code: 'forbidden' },
    { status: 403 }
  );
}

export function notFound(message = 'Not found') {
  return NextResponse.json<ApiErrorBody>(
    { error: message, code: 'not_found' },
    { status: 404 }
  );
}

export function badRequest(zodError: ZodError) {
  return NextResponse.json<ApiErrorBody>(
    {
      error: 'Invalid request body',
      code: 'bad_request',
      details: zodError.flatten(),
    },
    { status: 422 }
  );
}

export function internal(message = 'Internal server error') {
  return NextResponse.json<ApiErrorBody>(
    { error: message, code: 'internal' },
    { status: 500 }
  );
}
