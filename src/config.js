// API Configuration
// Uses environment variable in production, falls back to Railway backend

export const API_URL = import.meta.env.VITE_API_URL || 'https://stratify-backend-production-3ebd.up.railway.app';
export const API_BASE_URL = `${API_URL}/api`;
