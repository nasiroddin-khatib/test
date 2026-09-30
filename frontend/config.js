/*
  This file is deployment configuration, not a secret.
  Generate/update it during deployment instead of hardcoding an IP in app.js.

  For an ALB/reverse-proxy setup, use:
    apiBaseUrl: "/api"
  and route /api/* to the backend target group.

  For a separate backend origin, set:
    apiBaseUrl: "https://api.example.com"
*/
window.DEVCONNECT_CONFIG = {
  apiBaseUrl: "/api"
};
