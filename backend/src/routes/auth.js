const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();

function authRoutes({ getPool, getJwtSecret, config, logger, dbErrorsTotal }) {
  router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 8) {
      logger.warn({ email }, "Registration rejected: invalid input");
      return res.status(400).json({
        message: "Name, email and a password of at least 8 characters are required"
      });
    }

    try {
      const pool = getPool();
      const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);

      if (existing.rowCount > 0) {
        logger.info({ email }, "Registration rejected: user already exists");
        return res.status(409).json({ message: "User already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await pool.query(
        "INSERT INTO users(name,email,password) VALUES($1,$2,$3)",
        [name.trim(), email.trim().toLowerCase(), passwordHash]
      );

      logger.info({ email: email.trim().toLowerCase() }, "User registered");
      return res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      dbErrorsTotal.inc();
      logger.error({ err: error, email }, "Registration failed");
      return res.status(500).json({ message: "Server error" });
    }
  });

  router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    try {
      const pool = getPool();
      const result = await pool.query(
        "SELECT id, name, email, password FROM users WHERE email=$1",
        [email.trim().toLowerCase()]
      );

      if (result.rowCount === 0) {
        logger.warn({ email }, "Login failed: user not found");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password);

      if (!valid) {
        logger.warn({ email }, "Login failed: invalid password");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const secret = await getJwtSecret();
      const token = jwt.sign(
        { id: user.id, email: user.email },
        secret,
        { expiresIn: config.jwtExpiresIn }
      );

      logger.info({ userId: user.id }, "User login successful");
      return res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      dbErrorsTotal.inc();
      logger.error({ err: error, email }, "Login failed");
      return res.status(500).json({ message: "Server error" });
    }
  });

  return router;
}

module.exports = { authRoutes };
