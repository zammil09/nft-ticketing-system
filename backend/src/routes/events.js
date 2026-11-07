const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "فشل جلب الفعاليات" }); }
});

router.get("/organizer/:address", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events WHERE organizer_address = $1 ORDER BY created_at DESC", [req.params.address.toLowerCase()]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "فشل جلب فعاليات المنظّم" }); }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events WHERE event_id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "الفعالية غير موجودة" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "فشل جلب الفعالية" }); }
});

module.exports = router;
