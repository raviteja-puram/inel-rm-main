import pg from "pg";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const { Client } = pg;

async function createPostgresTables() {
if (!process.env.DATABASE_URL) {
throw new Error("DATABASE_URL is missing from your .env file.");
}

const schemaPath = path.resolve(
"server",
"schema.postgres.sql"
);

if (!fs.existsSync(schemaPath)) {
throw new Error(`Schema file not found: ${schemaPath}`);
}

const schema = fs.readFileSync(schemaPath, "utf8");

const client = new Client({
connectionString: process.env.DATABASE_URL,
connectionTimeoutMillis: 10000,
ssl: {
rejectUnauthorized: false,
},
});

try {
await client.connect();

console.log("Connected to Render PostgreSQL.");
console.log("Creating PostgreSQL tables...");

await client.query("BEGIN");

try {
  await client.query(schema);
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

console.log("Schema executed successfully!");

const result = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);

console.log("\nTables now available in PostgreSQL:");

for (const row of result.rows) {
  console.log(`- ${row.table_name}`);
}

} catch (error) {
console.error("\nFailed to create PostgreSQL tables:");
console.error(error.message);
process.exitCode = 1;
} finally {
await client.end().catch(() => {});
}
}

createPostgresTables();
