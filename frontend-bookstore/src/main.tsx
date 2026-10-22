import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/i18n'
import App from './App.tsx'
import { API_BASE_URL } from './config/api';

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  const [resource, config] = args;
  
  let url = '';
  if (typeof resource === 'string') url = resource;
  else if (resource instanceof URL) url = resource.toString();
  else if (resource instanceof Request) url = resource.url;

  let response = await originalFetch(...args);

  // If 401 and not a login/refresh request itself
  if (response.status === 401 && url.startsWith(`${API_BASE_URL}`) && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (refreshToken) {
      try {
        const refreshRes = await originalFetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('token', data.access_token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }

          // Retry the original request with the new token
          const newConfig = { ...(config || {}) } as RequestInit;
          const headers = new Headers(newConfig.headers || {});
          headers.set('Authorization', `Bearer ${data.access_token}`);
          newConfig.headers = headers;

          // Note: If the original request was a Request object, this simple retry might fail if body was consumed.
          // For our simple app using fetch(url, config), this works perfectly.
          response = await originalFetch(resource, newConfig);
        } else {
          // Refresh token invalid or expired
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          // Dispatch event to force logout in React state if needed, or just reload
          window.location.href = '/login';
        }
      } catch (err) {
        console.error('Lỗi khi refresh token:', err);
      }
    }
  }

  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
