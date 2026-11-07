const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/organizer/:address", async (req, res) => {
  const address = req.params.address.toLowerCase();
  try {
    const events = await pool.query("SELECT * FROM events WHERE organizer_address = $1", [address]);
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(t.purchase_price_units), 0) AS total_revenue_units,
              COUNT(t.token_id) AS total_tickets_sold,
              COUNT(t.token_id) FILTER (WHERE t.checked_in) AS total_checked_in
       FROM tickets t JOIN events e ON e.event_id = t.event_id WHERE e.organizer_address = $1`,
      [address]
    );
    res.json({ events: events.rows, totalEvents: events.rows.length, ...revenueResult.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: "فشل جلب إحصائيات الداشبورد" }); }
});

module.exports = router;
