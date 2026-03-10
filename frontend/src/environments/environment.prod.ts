export const environment = {
  production: true,
  apiUrl: '/api-backend',  // nginx proxies /api-backend/ → backend:8000/
  wsUrl: '',               // empty → WebSocket URL = ws://{window.location.host}/api-backend/...
};
