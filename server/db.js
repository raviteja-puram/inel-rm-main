import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { setWorkingDaysCalendar } from "./utils/workingDays.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "inel-rm.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);
setWorkingDaysCalendar(
  db.prepare("SELECT month_key AS monthKey, working_days AS workingDays FROM working_days_calendar").all(),
);
const componentColumns = db
  .prepare("PRAGMA table_info(components)")
  .all()
  .map((column) => column.name);
if (!componentColumns.includes("component_type")) {
  db.prepare(
    "ALTER TABLE components ADD COLUMN component_type TEXT DEFAULT ''",
  ).run();
}
if (!componentColumns.includes("oe_export")) {
  db.prepare("ALTER TABLE components ADD COLUMN oe_export TEXT DEFAULT ''").run();
}
if (!componentColumns.includes("material_discipline")) {
  db.prepare(
    "ALTER TABLE components ADD COLUMN material_discipline TEXT DEFAULT ''",
  ).run();
}
if (!componentColumns.includes("product_group")) {
  db.prepare(
    "ALTER TABLE components ADD COLUMN product_group TEXT DEFAULT ''",
  ).run();
}
if (!componentColumns.includes("vendor")) {
  db.prepare("ALTER TABLE components ADD COLUMN vendor TEXT DEFAULT ''").run();
  db.prepare("UPDATE components SET vendor = supplier WHERE vendor = ''").run();
}
if (!componentColumns.includes("vendor_code")) {
  db.prepare("ALTER TABLE components ADD COLUMN vendor_code TEXT DEFAULT ''").run();
}
const fgProductColumns = db
  .prepare("PRAGMA table_info(fg_products)")
  .all()
  .map((column) => column.name);
if (!fgProductColumns.includes("product_group")) {
  db.prepare("ALTER TABLE fg_products ADD COLUMN product_group TEXT DEFAULT ''").run();
}
if (!fgProductColumns.includes("product_type")) {
  db.prepare("ALTER TABLE fg_products ADD COLUMN product_type TEXT DEFAULT ''").run();
}
for (const [column, definition] of [
  ["customer_category", "TEXT DEFAULT ''"],
  ["stock_norm_days", "REAL DEFAULT 0"],
  ["total_stock", "REAL DEFAULT 0"],
  ["fg_category", "TEXT DEFAULT ''"],
]) {
  if (!fgProductColumns.includes(column)) {
    db.prepare(`ALTER TABLE fg_products ADD COLUMN ${column} ${definition}`).run();
  }
}
const stockMovementColumns = db
  .prepare("PRAGMA table_info(stock_movements)")
  .all()
  .map((column) => column.name);
if (!stockMovementColumns.includes("transaction_id")) {
  db.prepare(
    "ALTER TABLE stock_movements ADD COLUMN transaction_id TEXT DEFAULT ''",
  ).run();
}
if (!stockMovementColumns.includes("before_stock")) {
  db.prepare(
    "ALTER TABLE stock_movements ADD COLUMN before_stock REAL DEFAULT NULL",
  ).run();
}
if (!stockMovementColumns.includes("after_stock")) {
  db.prepare(
    "ALTER TABLE stock_movements ADD COLUMN after_stock REAL DEFAULT NULL",
  ).run();
}

for (const table of ["production_plans", "production_runs"]) {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((column) => column.name);
  for (const column of ["bom_id", "bom_name", "bom_description"]) {
    if (!columns.includes(column)) {
      db.prepare(
        `ALTER TABLE ${table} ADD COLUMN ${column} TEXT DEFAULT ''`,
      ).run();
    }
  }
}
const productionPlanColumns = db
  .prepare("PRAGMA table_info(production_plans)")
  .all()
  .map((column) => column.name);
if (!productionPlanColumns.includes("fg_description")) {
  db.prepare(
    "ALTER TABLE production_plans ADD COLUMN fg_description TEXT DEFAULT ''",
  ).run();
}
if (!productionPlanColumns.includes("priority_order")) {
  db.prepare(
    "ALTER TABLE production_plans ADD COLUMN priority_order INTEGER DEFAULT 0",
  ).run();
}
const productionRunItemColumns = db
  .prepare("PRAGMA table_info(production_run_items)")
  .all()
  .map((column) => column.name);
if (!productionRunItemColumns.includes("stock_before")) {
  db.prepare(
    "ALTER TABLE production_run_items ADD COLUMN stock_before REAL DEFAULT NULL",
  ).run();
}

export default db;
