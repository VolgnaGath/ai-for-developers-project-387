const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!rawBaseUrl) {
  throw new Error(
    'VITE_API_BASE_URL is not set. Add it to frontend/.env.local (see .env.example) to point at the backend or Prism mock server.',
  );
}

export const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');
