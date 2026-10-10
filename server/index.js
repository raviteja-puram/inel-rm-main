import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./routes/api.js";
import "./db.js";
import { startDailyRiskEmailJob } from "./utils/emailScheduler.js";
import {
  hydrateSqliteFromPostgres,
  isPostgresPersistenceEnabled,
  queuePostgresSnapshot,
} from "./utils/postgresPersistence.js";

const app = express();
const PORT = process.env.PORT || 3001;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", (req, res, next) => {
  res.on("finish", () => {
    if (
      ["POST", "PUT", "DELETE"].includes(req.method) &&
      res.statusCode < 400
    ) {
      setImmediate(queuePostgresSnapshot);
    }
  });
  next();
});

if (isPostgresPersistenceEnabled()) {
  const hydrated = await hydrateSqliteFromPostgres();
  console.log(
    `Supabase persistence loaded (${hydrated.counts.components} raw materials)`,
  );
}

app.use("/api", apiRoutes);
app.use(express.static(path.join(root, "dist")));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(root, "dist", "index.html"));
});
startDailyRiskEmailJob();

app.listen(PORT, () => {
  console.log(`INEL RM running on http://localhost:${PORT}`);
});
