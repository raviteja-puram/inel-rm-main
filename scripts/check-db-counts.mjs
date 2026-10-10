import db from '../server/db.js';

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((row) => row.name);

const counts = Object.fromEntries(
  tables.map((table) => [table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]),
);

const sequences = db
  .prepare("SELECT name, seq FROM sqlite_sequence ORDER BY name")
  .all();

console.log(JSON.stringify({ counts, sequences }, null, 2));
