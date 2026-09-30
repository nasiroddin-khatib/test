const express = require("express");
const router = express.Router();

function noteRoutes({ getPool, auth, logger, dbErrorsTotal }) {
  router.post("/notes", auth, async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    try {
      const pool = getPool();
      const result = await pool.query(
        "INSERT INTO notes(title,content,user_id) VALUES($1,$2,$3) RETURNING id,title,content,created_at",
        [title.trim(), content.trim(), req.user.id]
      );

      logger.info({ userId: req.user.id, noteId: result.rows[0].id }, "Note created");
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      dbErrorsTotal.inc();
      logger.error({ err: error, userId: req.user.id }, "Create note failed");
      return res.status(500).json({ message: "Server error" });
    }
  });

  router.get("/notes", auth, async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.query(
        "SELECT id,title,content,created_at FROM notes WHERE user_id=$1 ORDER BY created_at DESC",
        [req.user.id]
      );

      logger.info({ userId: req.user.id, count: result.rowCount }, "Notes retrieved");
      return res.json(result.rows);
    } catch (error) {
      dbErrorsTotal.inc();
      logger.error({ err: error, userId: req.user.id }, "Get notes failed");
      return res.status(500).json({ message: "Server error" });
    }
  });

  router.put("/notes/:id", auth, async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    try {
      const pool = getPool();
      const result = await pool.query(
        "UPDATE notes SET title=$1, content=$2 WHERE id=$3 AND user_id=$4 RETURNING id,title,content,created_at",
        [title.trim(), content.trim(), req.params.id, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Note not found" });
      }

      logger.info({ userId: req.user.id, noteId: req.params.id }, "Note updated");
      return res.json(result.rows[0]);
    } catch (error) {
      dbErrorsTotal.inc();
      logger.error({ err: error, userId: req.user.id, noteId: req.params.id }, "Update note failed");
      return res.status(500).json({ message: "Server error" });
    }
  });

  router.delete("/notes/:id", auth, async (req, res) => {
    try {
      const pool = getPool();
      const result = await pool.query(
        "DELETE FROM notes WHERE id=$1 AND user_id=$2",
        [req.params.id, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Note not found" });
      }

      logger.info({ userId: req.user.id, noteId: req.params.id }, "Note deleted");
      return res.json({ message: "Note deleted" });
    } catch (error) {
      dbErrorsTotal.inc();
      logger.error({ err: error, userId: req.user.id, noteId: req.params.id }, "Delete note failed");
      return res.status(500).json({ message: "Server error" });
    }
  });

  return router;
}

module.exports = { noteRoutes };
