export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ||
  (import.meta.env.PROD
    ? 'https://bookstore-api-xquk.onrender.com'
    : 'http://localhost:3000');
