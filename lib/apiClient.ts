/**
 * Kabadiwala Connect - Centralized Frontend API Client
 *
 * Configured with credentials: "include" to automatically transmit
 * and receive backend HttpOnly JWT cookies across cross-origin requests.
 */

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Resolves the appropriate API base URL:
 * - In production (browser or SSR), always uses the same-origin proxy: '/api/v1'
 * - In browser on non-localhost domains (e.g. Vercel deployment), uses '/api/v1'
 * - In local development (localhost), uses NEXT_PUBLIC_API_BASE_URL or 'http://localhost:5000/api/v1'
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      return '/api/v1';
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return '/api/v1';
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/v1')) {
    cleanEndpoint = cleanEndpoint.substring('/api/v1'.length);
  }
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}${cleanEndpoint}`;

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Ensure browser attaches and stores HttpOnly auth cookies
  };

  let res: Response;
  try {
    res = await fetch(url, config);
  } catch (err: any) {
    throw new ApiError(
      0,
      'Unable to reach backend service. Please check your connection or verify the server is running.'
    );
  }

  let data: any;
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    try {
      data = await res.json();
    } catch (parseErr: any) {
      if (!res.ok) {
        let rawText = '';
        try {
          rawText = await res.text();
        } catch {
          // ignore
        }
        throw new ApiError(res.status, rawText || `Request failed with status ${res.status}`);
      }
      throw new ApiError(res.status, `Failed to parse JSON response from server: ${parseErr?.message || parseErr}`);
    }
  } else {
    const rawText = await res.text();
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  if (!res.ok) {
    const errorMessage =
      data?.message ||
      (typeof data === 'string' && data.length > 0 ? data : `Request failed with status ${res.status}`);
    throw new ApiError(res.status, errorMessage, data?.errors || data);
  }

  if (data === null || data === undefined) {
    if (res.status === 204 || res.status === 205) {
      return { success: true } as unknown as T;
    }
    throw new ApiError(res.status, 'Empty response received from backend service');
  }

  return data as T;
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  },

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  },

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
