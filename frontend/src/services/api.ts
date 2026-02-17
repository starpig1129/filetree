/**
 * Centralized API service for handling requests with authentication.
 */

const API_BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export async function apiRequest(endpoint: string, options: RequestOptions = {}) {
  const { token, headers: customHeaders, ...rest } = options;
  
  const headers = new Headers(customHeaders);
  
  // SECURE: Automatically include session token if available
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Automatically set Content-Type if body is stringified JSON
  if (rest.body && typeof rest.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
    ...rest,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'An unknown error occurred' }));
    throw new Error(errorData.detail || response.statusText);
  }

  return response.json();
}

/**
 * Helper for POST requests with Form Data (e.g. file uploads via legacy API)
 */
export async function apiPostForm(endpoint: string, formData: FormData, token?: string | null) {
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'An unknown error occurred' }));
    throw new Error(errorData.detail || response.statusText);
  }

  return response.json();
}
