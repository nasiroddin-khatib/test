const fs = require("fs");
const path = require("path");
const pino = require("pino");
const { config } = require("./config");

const logDir = path.dirname(config.logFile);
fs.mkdirSync(logDir, { recursive: true });

const destination = pino.destination({
  dest: config.logFile,
  mkdir: true,
  sync: false
});

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    base: {
      service: "devconnect-backend",
      environment: config.nodeEnv
    },
    timestamp: pino.stdTimeFunctions.isoTime
  },
  destination
);

module.exports = logger;
