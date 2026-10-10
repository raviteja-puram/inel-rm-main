import "dotenv/config";
import { checkPostgresConnection } from "../server/postgres.js";

try {
  const result = await checkPostgresConnection();

  console.log("✅ PostgreSQL connection successful!");
  console.log("Database server time:", result.server_time);
  process.exitCode = 0;
} catch (error) {
  console.error("❌ PostgreSQL connection failed.");
  console.error("Error:", error.message);
  process.exitCode = 1;
}