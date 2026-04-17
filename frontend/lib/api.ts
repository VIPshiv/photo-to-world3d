const DEFAULT_API_BASE_URL = 'http://localhost:3001';

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
    /\/$/,
    '',
  );
}

export function apiUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}