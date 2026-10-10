import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "inel-rm.db");
const db = new Database(dbPath, { readonly: true });

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

console.log("\nINEL-RM SQLite Database Report\n");

for (const table of tables) {
try {
const result = db
.prepare(`SELECT COUNT(*) AS total FROM "${table}"`)
.get();


console.log(`${table}: ${result.total} records`);


} catch (error) {
console.log(`${table}: Unable to read - ${error.message}`);
}
}

db.close();
