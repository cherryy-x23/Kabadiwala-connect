import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Target backend Render service URL (fallback to production Render URL)
const BACKEND_BASE_URL = (
  process.env.BACKEND_API_URL ||
  process.env.BACKEND_URL ||
  'https://kabadiwala-connect-api-rqt7.onrender.com'
).replace(/\/$/, '');

// Hop-by-hop headers that should not be forwarded
const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'upgrade',
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'alt-svc',
  'connection',
  'content-encoding', // fetch automatically decompresses; forwarding this corrupts client decoding
  'content-length',   // decompressed body length differs from upstream compressed length
  'keep-alive',
  'set-cookie',       // handled explicitly with domain stripping and Lax rewrite
  'transfer-encoding',
  'upgrade',
]);

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

async function handleProxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const pathSegment = path && path.length > 0 ? path.join('/') : '';
  const search = request.nextUrl.search || '';
  const targetUrl = `${BACKEND_BASE_URL}/api/v1${pathSegment ? `/${pathSegment}` : ''}${search}`;

  // Build forward headers
  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Strip hop-by-hop headers and accept-encoding so upstream doesn't send compressed payload
    // whose encoding headers would conflict with Node's automatic fetch decompression
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(lower) && lower !== 'accept-encoding') {
      forwardHeaders.set(key, value);
    }
  });

  // Explicitly forward incoming client cookies to the backend
  const clientCookies = request.headers.get('cookie');
  if (clientCookies) {
    forwardHeaders.set('cookie', clientCookies);
  }

  // Preserve request origin or supply Vercel origin if needed
  const clientOrigin = request.headers.get('origin');
  if (clientOrigin) {
    forwardHeaders.set('origin', clientOrigin);
  }

  // Preserve binary/multipart/json request bodies
  let bodyBuffer: ArrayBuffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
    try {
      bodyBuffer = await request.arrayBuffer();
    } catch {
      bodyBuffer = undefined;
    }
  }

  // Handle OPTIONS preflight locally or forward
  if (request.method === 'OPTIONS') {
    const optionsHeaders = new Headers();
    optionsHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    optionsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cookie');
    optionsHeaders.set('Access-Control-Allow-Credentials', 'true');
    if (clientOrigin) {
      optionsHeaders.set('Access-Control-Allow-Origin', clientOrigin);
    }
    return new Response(null, { status: 200, headers: optionsHeaders });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? Buffer.from(bodyBuffer) : undefined,
      redirect: 'manual',
    });
  } catch (err: any) {
    console.error(`[API Proxy Error] Failed to reach backend at ${targetUrl}:`, err?.message || err);
    return NextResponse.json(
      {
        success: false,
        message: 'Backend service unreachable through proxy. Please check network connection.',
        error: err?.message,
      },
      { status: 502 }
    );
  }

  // Prepare response headers
  const responseHeaders = new Headers();
  backendRes.headers.forEach((val, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_RESPONSE_HEADERS.has(lower)) {
      responseHeaders.set(key, val);
    }
  });

  // Extract and rewrite Set-Cookie headers so session cookies become first-party
  // to the Vercel frontend origin
  const rawSetCookies: string[] = [];
  if (typeof (backendRes.headers as any).getSetCookie === 'function') {
    rawSetCookies.push(...(backendRes.headers as any).getSetCookie());
  } else {
    const single = backendRes.headers.get('set-cookie');
    if (single) {
      rawSetCookies.push(single);
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';

  for (const cookieStr of rawSetCookies) {
    // Strip out any backend Domain attribute so the browser attaches the cookie
    // directly to the first-party frontend origin (e.g. vercel.app or localhost)
    let sanitized = cookieStr.replace(/;\s*Domain=[^;]+/gi, '');

    // Ensure SameSite is Lax for first-party browser navigation (or keep if compatible)
    if (/SameSite=None/i.test(sanitized)) {
      // In same-origin context, Lax provides first-party protection while allowing top-level navigation
      sanitized = sanitized.replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
    } else if (!/SameSite=/i.test(sanitized)) {
      sanitized += '; SameSite=Lax';
    }

    // Ensure HttpOnly is kept
    if (!/HttpOnly/i.test(sanitized)) {
      sanitized += '; HttpOnly';
    }

    // Ensure Path=/ is kept
    if (!/Path=/i.test(sanitized)) {
      sanitized += '; Path=/';
    }

    // Ensure Secure in production
    if (isProduction && !/Secure/i.test(sanitized)) {
      sanitized += '; Secure';
    }

    responseHeaders.append('Set-Cookie', sanitized);
  }

  // Read response body buffer
  if (backendRes.status === 204 || backendRes.status === 304) {
    return new Response(null, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  }

  const responseBody = await backendRes.arrayBuffer();
  return new Response(responseBody, {
    status: backendRes.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context);
}
