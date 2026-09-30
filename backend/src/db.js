const fs = require("fs");
const { Pool } = require("pg");
const {
  SecretsManagerClient,
  GetSecretValueCommand
} = require("@aws-sdk/client-secrets-manager");
const { config } = require("./config");
const logger = require("./logger");

const secretsClient = new SecretsManagerClient({ region: config.awsRegion });

async function loadSecret(secretId) {
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );

  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} does not contain SecretString`);
  }

  return JSON.parse(response.SecretString);
}

function buildSslConfig() {
  const ssl = { rejectUnauthorized: true };

  if (config.rdsCaCertPath) {
    ssl.ca = fs.readFileSync(config.rdsCaCertPath, "utf8");
  }

  return ssl;
}

async function createDbPool() {
  const secret = await loadSecret(config.dbSecretId);

  const pool = new Pool({
    host: secret.host,
    port: Number(secret.port || 5432),
    user: secret.username,
    password: secret.password,
    database: secret.dbname,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    ssl: buildSslConfig()
  });

  pool.on("error", error => {
    logger.error({ err: error }, "Unexpected PostgreSQL pool error");
  });

  await pool.query("SELECT 1");
  logger.info({ host: secret.host, database: secret.dbname }, "Database connectivity verified");

  return pool;
}

module.exports = { createDbPool };
