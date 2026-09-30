const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "devconnect_" });

const httpRequestsTotal = new client.Counter({
  name: "devconnect_http_requests_total",
  help: "Total HTTP requests received",
  labelNames: ["method", "route", "status_code"],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: "devconnect_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

const authFailuresTotal = new client.Counter({
  name: "devconnect_auth_failures_total",
  help: "Authentication failures",
  labelNames: ["reason"],
  registers: [register]
});

const dbErrorsTotal = new client.Counter({
  name: "devconnect_db_errors_total",
  help: "Database operation errors",
  registers: [register]
});

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  authFailuresTotal,
  dbErrorsTotal
};
