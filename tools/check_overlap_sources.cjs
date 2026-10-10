const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const source = JSON.parse(fs.readFileSync(path.join('outputs', 'upload_source_data.json'), 'utf8'));
const newFgIds = new Set(source.bom.map((x) => String(x['FG Part Number']).trim()));
const newComponentIds = new Set(source.components.map((x) => String(x['Component ID']).trim()));

const dbFiles = [
  path.join('data', 'inel-rm.db'),
  ...fs.readdirSync('data')
    .filter((name) => name.endsWith('.db') && name !== 'inel-rm.db')
    .map((name) => path.join('data', name)),
];

function tableExists(db, table) {
  return !!db.prepare("select name from sqlite_master where type='table' and name=?").get(table);
}

function cols(db, table) {
  return db.prepare(`pragma table_info(${table})`).all().map((c) => c.name);
}

function count(db, sql, params = []) {
  try {
    return db.prepare(sql).get(...params)?.c ?? 0;
  } catch {
    return 0;
  }
}

const summary = [];
for (const file of dbFiles) {
  const db = new Database(file, { readonly: true });
  const tables = db.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'").all().map((r) => r.name);
  const item = { file, tables, counts: {} };
  for (const table of tables) item.counts[table] = count(db, `select count(*) c from ${table}`);

  if (tableExists(db, 'fg_products')) {
    const fgCols = cols(db, 'fg_products');
    const idCol = fgCols.includes('part_no') ? 'part_no' : fgCols.includes('partNo') ? 'partNo' : fgCols.includes('id') ? 'id' : null;
    if (idCol) {
      const rows = db.prepare(`select ${idCol} as id from fg_products`).all();
      item.fgOverlap = rows.filter((r) => newFgIds.has(String(r.id).trim())).length;
      item.fgOverlapSample = rows.filter((r) => newFgIds.has(String(r.id).trim())).slice(0, 10).map((r) => r.id);
    }
  }

  if (tableExists(db, 'components')) {
    const componentCols = cols(db, 'components');
    const idCol = componentCols.includes('id') ? 'id' : componentCols.includes('component_id') ? 'component_id' : null;
    if (idCol) {
      const rows = db.prepare(`select ${idCol} as id from components`).all();
      item.componentOverlap = rows.filter((r) => newComponentIds.has(String(r.id).trim())).length;
      item.componentOverlapSample = rows.filter((r) => newComponentIds.has(String(r.id).trim())).slice(0, 10).map((r) => r.id);
    }
  }

  const bomTables = tables.filter((name) => /bom|fg.*component|component.*fg|product.*component|material/i.test(name));
  item.possibleNormTables = [];
  for (const table of bomTables) {
    const tableCols = cols(db, table);
    item.possibleNormTables.push({ table, cols: tableCols, count: item.counts[table] });
  }

  if (tableExists(db, 'fg_components')) {
    const fgComponentCols = cols(db, 'fg_components');
    const fgCol = fgComponentCols.find((c) => ['fg_part_no', 'fgPartNo', 'fg_id', 'fgId', 'part_no', 'partNo', 'product_id', 'productId'].includes(c));
    if (fgCol) {
      const rows = db.prepare(`select ${fgCol} as fg from fg_components`).all();
      item.normFgOverlap = rows.filter((r) => newFgIds.has(String(r.fg).trim())).length;
      item.normFgUniqueOverlap = new Set(rows.filter((r) => newFgIds.has(String(r.fg).trim())).map((r) => String(r.fg).trim())).size;
    }
  }

  summary.push(item);
  db.close();
}

console.log(JSON.stringify({
  newFileCounts: {
    fgProducts: newFgIds.size,
    components: newComponentIds.size,
    bomRows: source.bom.length,
    stockRows: source.stock.length,
  },
  dbChecks: summary,
}, null, 2));
