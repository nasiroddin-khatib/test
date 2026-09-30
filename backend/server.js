const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const {
  SecretsManagerClient,
  GetSecretValueCommand
} = require("@aws-sdk/client-secrets-manager");

const { config } = require("./config");
const logger = require("./logger");
const { createDbPool } = require("./db");
const { register, httpRequestsTotal, httpRequestDuration } = require("./metrics");
const { createAuthMiddleware } = require("./middleware/auth");
const { authRoutes } = require("./routes/auth");
const { noteRoutes } = require("./routes/notes");

const app = express();
const secretsClient = new SecretsManagerClient({ region: config.awsRegion });

let pool;
let jwtSecretCache;

async function getJwtSecret() {
  if (jwtSecretCache) return jwtSecretCache;

  if (config.jwtSecret) {
    jwtSecretCache = config.jwtSecret;
    return jwtSecretCache;
  }

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: config.jwtSecretSecretId })
  );

  if (!response.SecretString) throw new Error("JWT secret is empty");

  let value;
  try {
    const parsed = JSON.parse(response.SecretString);
    value = parsed.jwtSecret || parsed.secret || response.SecretString;
  } catch {
    value = response.SecretString;
  }

  if (!value || value.length < 32) {
    throw new Error("JWT secret must be at least 32 characters");
  }

  jwtSecretCache = value;
  return jwtSecretCache;
}

const allowedOrigins = new Set(config.corsOrigins);

app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      logger.warn({ origin }, "CORS request rejected");
      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.use(apiLimiter);

app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: String(res.statusCode)
    });

    httpRequestDuration.observe(
      { method: req.method, route, status_code: String(res.statusCode) },
      durationSeconds
    );

    logger.info(
      {
        requestId: req.id,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationSeconds * 1000),
        userId: req.user?.id
      },
      "HTTP request completed"
    );
  });

  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "devconnect-backend" });
});

app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready", database: "ok" });
  } catch (error) {
    logger.error({ err: error }, "Readiness check failed");
    res.status(503).json({ status: "not_ready", database: "unavailable" });
  }
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api", authRoutes({
  getPool: () => pool,
  getJwtSecret,
  config,
  logger,
  dbErrorsTotal: require("./metrics").dbErrorsTotal
}));

app.use("/api", noteRoutes({
  getPool: () => pool,
  auth: createAuthMiddleware(getJwtSecret),
  logger,
  dbErrorsTotal: require("./metrics").dbErrorsTotal
}));

app.use((err, req, res, next) => {
  logger.error({ err, path: req.path, method: req.method }, "Unhandled application error");
  res.status(500).json({ message: "Internal server error" });
});

async function start() {
  try {
    pool = await createDbPool();
    await getJwtSecret();

    app.listen(config.port, "0.0.0.0", () => {
      logger.info({ port: config.port }, "DevConnect backend started");
    });
  } catch (error) {
    logger.fatal({ err: error }, "Application startup failed");
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received; shutting down");
  if (pool) await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received; shutting down");
  if (pool) await pool.end();
  process.exit(0);
});

start();
