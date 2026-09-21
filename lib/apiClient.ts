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

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';

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
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

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
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMessage =
      data?.message ||
      (typeof data === 'string' && data.length > 0 ? data : `Request failed with status ${res.status}`);
    throw new ApiError(res.status, errorMessage, data?.errors || data);
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
