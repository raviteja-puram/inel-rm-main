import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const inputPath = 'C:/Users/durga/.codex/attachments/0c6c3fd3-45b7-4c1d-b5df-db30c5f6093d/pasted-text.txt';
const outputDir = path.resolve('outputs');
const outputPath = path.join(outputDir, 'Unique_Stock_Components.xlsx');

fs.mkdirSync(outputDir, { recursive: true });

function parseStock(value) {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const lines = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter((line) => line.trim());
const rows = lines.slice(1).map((line) => line.split('\t'));
const byComponent = new Map();

for (const row of rows) {
  const component = String(row[0] ?? '').trim();
  if (!component || byComponent.has(component)) continue;

  byComponent.set(component, {
    Component: component,
    'Component Description': String(row[1] ?? '').trim(),
    'Total stock': parseStock(row[2]),
  });
}

const outputRows = [...byComponent.values()].sort((a, b) => a.Component.localeCompare(b.Component));

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(outputRows);
ws['!cols'] = [{ wch: 16 }, { wch: 44 }, { wch: 14 }];
XLSX.utils.book_append_sheet(wb, ws, 'Unique Stock');
XLSX.writeFile(wb, outputPath);

console.log(JSON.stringify({
  outputPath,
  sourceRows: rows.length,
  uniqueComponents: outputRows.length,
}, null, 2));
