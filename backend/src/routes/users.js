const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/", async (req, res) => {
  const { wallet_address, name, email, role } = req.body;
  if (!wallet_address) return res.status(400).json({ error: "wallet_address مطلوب" });
  try {
    const result = await pool.query(
      `INSERT INTO users (wallet_address, name, email, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (wallet_address) DO UPDATE SET name = COALESCE($2, users.name), email = COALESCE($3, users.email), role = COALESCE($4, users.role)
       RETURNING *`,
      [wallet_address.toLowerCase(), name || null, email || null, role || "user"]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: "فشل حفظ بيانات المستخدم" }); }
});

router.get("/:wallet", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE wallet_address = $1", [req.params.wallet.toLowerCase()]);
    if (result.rows.length === 0) return res.status(404).json({ error: "المستخدم غير موجود" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "فشل جلب بيانات المستخدم" }); }
});

module.exports = router;
