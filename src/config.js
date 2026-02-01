// API Configuration
// Uses environment variable in production, falls back to Railway backend

export const API_URL = import.meta.env.VITE_API_URL || 'https://atlas-api-production-5944.up.railway.app';
export const API_BASE_URL = `${API_URL}/api`;
