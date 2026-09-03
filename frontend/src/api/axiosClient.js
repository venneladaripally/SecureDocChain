import axios from 'axios';

// Single shared axios instance - baseURL comes from .env (Frontend Phase 1),
// so every API call in the app uses this instead of hardcoding the URL.
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  
});

// Runs before every request. If we have a token in localStorage,
// attach it as a Bearer token automatically - so individual API
// calls never have to remember to do this themselves.
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;