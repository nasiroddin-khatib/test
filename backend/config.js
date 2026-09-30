const path = require("path");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  awsRegion: process.env.AWS_REGION || "ap-south-1",
  dbSecretId: required("DB_SECRET_ID"),
  jwtSecret: process.env.JWT_SECRET || "",
  jwtSecretSecretId: process.env.JWT_SECRET_SECRET_ID || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean),
  logFile: process.env.LOG_FILE || "./logs/app.log",
  rdsCaCertPath: process.env.RDS_CA_CERT_PATH || ""
};

if (!config.jwtSecret && !config.jwtSecretSecretId) {
  throw new Error("Set JWT_SECRET or JWT_SECRET_SECRET_ID; no hardcoded JWT fallback is allowed");
}

module.exports = { config };
