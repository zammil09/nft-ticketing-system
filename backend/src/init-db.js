const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  try {
    await pool.query(schema);
    console.log("✅ تم إنشاء جداول قاعدة البيانات بنجاح");
  } catch (err) {
    console.error("❌ فشل إنشاء الجداول:", err.message);
  } finally {
    await pool.end();
  }
}
initDb();
