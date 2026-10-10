import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
throw new Error("DATABASE_URL is missing from environment variables.");
}

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false },
max: 5,
});

pool.on("error", (error) => {
console.error("Unexpected PostgreSQL connection error:", error.message);
});

export async function query(text, params = []) {
return pool.query(text, params);
}

export async function checkPostgresConnection() {
const result = await pool.query("SELECT NOW() AS server_time");
return result.rows[0];
}

export default pool;
