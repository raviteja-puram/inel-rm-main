import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const tables = [
"components",
"fg_products",
"fg_stock_snapshots",
"working_days_calendar",
"fg_bom_items",
"fg_monthly_plans",
"production_plans",
"production_runs",
"production_run_items",
"stock_movements",
"audit_logs",
];

const client = new Client({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false },
});

try {
await client.connect();
console.log("\nRender PostgreSQL Database Report\n");

for (const table of tables) {
const result = await client.query(
`SELECT COUNT(*)::int AS total FROM "${table}"`
);

console.log(`${table}: ${result.rows[0].total} records`);


}
} catch (error) {
console.error("PostgreSQL check failed:", error.message);
} finally {
await client.end();
}
