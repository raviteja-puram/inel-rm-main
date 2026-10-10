import pg from "pg";
import "dotenv/config";

const { Client } = pg;

async function setupPostgres() {
if (!process.env.DATABASE_URL) {
console.error("DATABASE_URL is missing from your .env file.");
process.exitCode = 1;
return;
}

const client = new Client({
connectionString: process.env.DATABASE_URL,
connectionTimeoutMillis: 10000,
ssl: {
rejectUnauthorized: false,
},
});

try {
await client.connect();


console.log("Connected to Render PostgreSQL successfully!");

const result = await client.query(`
  SELECT
    current_database() AS database_name,
    current_user AS database_user,
    version() AS postgres_version
`);

console.log("\nDatabase details:");
console.log(result.rows[0]);

const tables = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);

console.log("\nExisting PostgreSQL tables:");

if (tables.rows.length === 0) {
  console.log("No tables found yet.");
} else {
  tables.rows.forEach((row) => {
    console.log(`- ${row.table_name}`);
  });
}


} catch (error) {
console.error("\nPostgreSQL connection/check failed:");
console.error(error.message);
process.exitCode = 1;
} finally {
await client.end().catch(() => {});
}
}

setupPostgres();
