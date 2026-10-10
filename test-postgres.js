import pg from "pg";
import "dotenv/config";

const { Client } = pg;

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is missing from your .env file.");
    process.exitCode = 1;
    return;
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        NOW() AS server_time;
    `);

    console.log("PostgreSQL connection successful!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("PostgreSQL connection failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

testConnection();