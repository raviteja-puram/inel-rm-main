import Database from "better-sqlite3";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlitePath = path.join(root, "data", "inel-rm.db");
const schemaPath = path.join(root, "server", "schema.postgres.sql");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}
if (!fs.existsSync(sqlitePath)) {
  throw new Error(`SQLite database not found: ${sqlitePath}`);
}

const sqlite = new Database(sqlitePath, { readonly: true });
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = [
  "components",
  "fg_products",
  "fg_bom_items",
  "fg_monthly_plans",
  "production_plans",
  "production_runs",
  "production_run_items",
  "stock_movements",
  "audit_logs",
];
const primaryKeys = {
  components: ["id"],
  fg_products: ["part_no"],
  fg_bom_items: ["id"],
  fg_monthly_plans: ["id"],
  production_plans: ["id"],
  production_runs: ["id"],
  production_run_items: ["id"],
  stock_movements: ["id"],
  audit_logs: ["id"],
};
const nullableDateColumns = new Set(["stock_movements.receipt_date"]);
const identityTables = new Set([
  "fg_bom_items",
  "fg_monthly_plans",
  "production_plans",
  "production_runs",
  "production_run_items",
  "audit_logs",
]);

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function copyTable(client, table) {
  const rows = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all();
  if (!rows.length) return 0;

  const columns = Object.keys(rows[0]);
  const keys = primaryKeys[table];
  const updates = columns.filter((column) => !keys.includes(column));
  const conflict = updates.length
    ? `DO UPDATE SET ${updates
        .map(
          (column) =>
            `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`,
        )
        .join(", ")}`
    : "DO NOTHING";
  const batchSize = 200;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values = [];
    const tuples = batch.map((row) => {
      const placeholders = columns.map((column) => {
        const value = row[column];
        values.push(
          nullableDateColumns.has(`${table}.${column}`) && !value
            ? null
            : value,
        );
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const sql = `INSERT INTO ${quoteIdentifier(table)}
      (${columns.map(quoteIdentifier).join(", ")})
      VALUES ${tuples.join(", ")}
      ON CONFLICT (${keys.map(quoteIdentifier).join(", ")}) ${conflict}`;
    await client.query(sql, values);
  }
  return rows.length;
}

async function syncIdentity(client, table) {
  if (!identityTables.has(table)) return;
  await client.query(
    `SELECT setval(
      pg_get_serial_sequence($1, 'id'),
      COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table)}), 1),
      EXISTS (SELECT 1 FROM ${quoteIdentifier(table)})
    )`,
    [table],
  );
}

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(fs.readFileSync(schemaPath, "utf8"));
  for (const table of tables) {
    const count = await copyTable(client, table);
    await syncIdentity(client, table);
    console.log(`${table}: ${count} row(s) copied`);
  }
  await client.query("COMMIT");
  console.log("SQLite to Supabase migration completed");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  sqlite.close();
  await pool.end();
}
