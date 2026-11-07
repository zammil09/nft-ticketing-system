const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { startIndexer } = require("./indexer");
const usersRoutes = require("./routes/users");
const eventsRoutes = require("./routes/events");
const ticketsRoutes = require("./routes/tickets");
const dashboardRoutes = require("./routes/dashboard");
const emailRoutes = require("./routes/email");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api/users", usersRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/email", emailRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 API شغّالة على http://localhost:${PORT}`);
  startIndexer();
});
