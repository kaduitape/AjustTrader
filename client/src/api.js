const API_URL = import.meta.env.VITE_API_URL || '/api';

let token = localStorage.getItem('ajuste_token');

export function setToken(value) {
  token = value;
  if (value) localStorage.setItem('ajuste_token', value);
  else localStorage.removeItem('ajuste_token');
}

export function hasToken() { return Boolean(token); }

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) setToken(null);
    throw new Error(body.error || 'Não foi possível concluir a solicitação.');
  }
  return body;
}
