import axios from 'axios';

// All API calls go through Next.js rewrite proxy → panel backend.
// Auth is handled by httpOnly cookie 'panel_auth' — no localStorage.

const api = axios.create({
  baseURL: '',    // relative URLs — proxied by Next.js
  withCredentials: true, // sends panel_auth cookie automatically
  timeout: 30000,
});

// Attach sessionCode from 401 response body so AuthContext can distinguish reasons
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      err.sessionCode = err.response?.data?.code; // SESSION_KICKED | SESSION_EXPIRED
    }
    return Promise.reject(err);
  }
);

export default api;
