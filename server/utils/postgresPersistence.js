import pg from "pg";
import db from "../db.js";

const enabled =
  process.env.PERSISTENCE_MODE === "postgres-sync" &&
  Boolean(process.env.DATABASE_URL);

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
const identityTables = new Set([
  "fg_bom_items",
  "fg_monthly_plans",
  "production_plans",
  "production_runs",
  "production_run_items",
  "audit_logs",
]);

const pool = enabled
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  : null;

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function sqliteValue(value) {
  return value instanceof Date ? value.toISOString() : value;
}

async function ensurePostgresSchema(client) {
  await client.query(
    "ALTER TABLE production_run_items ADD COLUMN IF NOT EXISTS stock_before DOUBLE PRECISION",
  );
  await client.query(
    "ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS fg_description TEXT DEFAULT ''",
  );
  await client.query("ALTER TABLE components ADD COLUMN IF NOT EXISTS vendor TEXT DEFAULT ''");
  await client.query("ALTER TABLE components ADD COLUMN IF NOT EXISTS oe_export TEXT DEFAULT ''");
  await client.query("ALTER TABLE components ADD COLUMN IF NOT EXISTS vendor_code TEXT DEFAULT ''");
  await client.query("UPDATE components SET vendor = supplier WHERE COALESCE(vendor, '') = ''");
  await client.query("ALTER TABLE fg_products ADD COLUMN IF NOT EXISTS product_group TEXT DEFAULT ''");
  await client.query("ALTER TABLE fg_products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT ''");
}

function hydrateTable(table, rows) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const statement = db.prepare(
    `INSERT INTO ${quoteIdentifier(table)}
      (${columns.map(quoteIdentifier).join(", ")})
      VALUES (${columns.map((column) => `@${column}`).join(", ")})`,
  );
  rows.forEach((row) => {
    statement.run(
      Object.fromEntries(
        columns.map((column) => [column, sqliteValue(row[column])]),
      ),
    );
  });
}

export function isPostgresPersistenceEnabled() {
  return enabled;
}

export async function hydrateSqliteFromPostgres() {
  if (!enabled) return { enabled: false };
  const client = await pool.connect();
  try {
    await ensurePostgresSchema(client);
    const snapshots = new Map();
    for (const table of tables) {
      const result = await client.query(
        `SELECT * FROM ${quoteIdentifier(table)} ORDER BY 1`,
      );
      snapshots.set(table, result.rows);
    }

    db.pragma("foreign_keys = OFF");
    const applySnapshot = db.transaction(() => {
      [...tables].reverse().forEach((table) => {
        db.prepare(`DELETE FROM ${quoteIdentifier(table)}`).run();
      });
      tables.forEach((table) => hydrateTable(table, snapshots.get(table)));
      db.prepare("DELETE FROM sqlite_sequence").run();
      identityTables.forEach((table) => {
        const maximum = db
          .prepare(`SELECT MAX(id) AS value FROM ${quoteIdentifier(table)}`)
          .get()?.value;
        if (maximum) {
          db.prepare(
            "INSERT INTO sqlite_sequence(name, seq) VALUES (?, ?)",
          ).run(table, maximum);
        }
      });
    });
    applySnapshot();
    db.pragma("foreign_keys = ON");

    return {
      enabled: true,
      counts: Object.fromEntries(
        tables.map((table) => [table, snapshots.get(table).length]),
      ),
    };
  } finally {
    client.release();
  }
}

async function insertPostgresRows(client, table, rows) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const batchSize = 200;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values = [];
    const tuples = batch.map((row) => {
      const placeholders = columns.map((column) => {
        const value = row[column];
        values.push(value === "" && column === "receipt_date" ? null : value);
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await client.query(
      `INSERT INTO ${quoteIdentifier(table)}
        (${columns.map(quoteIdentifier).join(", ")})
        VALUES ${tuples.join(", ")}`,
      values,
    );
  }
}

async function writeSnapshot() {
  const snapshots = new Map(
    tables.map((table) => [
      table,
      db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all(),
    ]),
  );
  const client = await pool.connect();
  try {
    await ensurePostgresSchema(client);
    await client.query("BEGIN");
    await client.query(
      `TRUNCATE ${[...tables]
        .reverse()
        .map(quoteIdentifier)
        .join(", ")} RESTART IDENTITY CASCADE`,
    );
    for (const table of tables) {
      await insertPostgresRows(client, table, snapshots.get(table));
    }
    for (const table of identityTables) {
      await client.query(
        `SELECT setval(
          pg_get_serial_sequence($1, 'id'),
          COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table)}), 1),
          EXISTS (SELECT 1 FROM ${quoteIdentifier(table)})
        )`,
        [table],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

let snapshotRunning = false;
let snapshotRequested = false;

export function queuePostgresSnapshot() {
  if (!enabled) return;
  snapshotRequested = true;
  if (snapshotRunning) return;
  snapshotRunning = true;

  setImmediate(async () => {
    try {
      while (snapshotRequested) {
        snapshotRequested = false;
        await writeSnapshot();
        console.log("Supabase persistence snapshot saved");
      }
    } catch (error) {
      console.error("Supabase persistence snapshot failed:", error.message);
    } finally {
      snapshotRunning = false;
      if (snapshotRequested) queuePostgresSnapshot();
    }
  });
}
