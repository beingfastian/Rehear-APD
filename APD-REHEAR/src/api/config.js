/** Base URL for API (empty = same origin; use Vite proxy /api in dev). */
export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}
