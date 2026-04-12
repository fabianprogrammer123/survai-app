import { NextRequest } from 'next/server';

/**
 * Deprecated SSE streaming endpoint.
 * The template-based architecture uses simple request/response.
 * This route now redirects to the standard /api/ai/chat endpoint.
 */
export async function POST(req: NextRequest) {
  // Forward to the non-streaming route
  const url = new URL('/api/ai/chat', req.url);
  const body = await req.text();

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  return new Response(res.body, {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
  });
}
