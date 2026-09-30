const jwt = require("jsonwebtoken");
const logger = require("../logger");
const { authFailuresTotal } = require("../metrics");

function createAuthMiddleware(getJwtSecret) {
  return async function auth(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      authFailuresTotal.inc({ reason: "missing_or_malformed_header" });
      logger.warn({ ip: req.ip, path: req.path }, "Authentication failed: missing bearer token");
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = header.slice("Bearer ".length);

    try {
      const secret = await getJwtSecret();
      req.user = jwt.verify(token, secret);
      next();
    } catch (error) {
      authFailuresTotal.inc({ reason: "invalid_token" });
      logger.warn({ err: error, ip: req.ip, path: req.path }, "Authentication failed: invalid token");
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}

module.exports = { createAuthMiddleware };
