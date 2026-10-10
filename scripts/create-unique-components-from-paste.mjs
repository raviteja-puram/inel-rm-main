import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const inputPath = 'C:/Users/durga/.codex/attachments/857c6115-7d57-4980-abf2-1e06688677ba/pasted-text.txt';
const outputDir = path.resolve('outputs');
const outputPath = path.join(outputDir, 'Unique_Components_From_Paste.xlsx');

fs.mkdirSync(outputDir, { recursive: true });

function toNumber(value) {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const lines = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter((line) => line.trim());
const rows = lines.slice(1).map((line) => line.split('\t'));
const byComponent = new Map();
let currentCategory = '';

for (const row of rows) {
  const component = String(row[0] ?? '').trim();
  const description = String(row[1] ?? '').trim();
  const monthPlan = toNumber(row[2]);
  const uom = String(row[3] ?? '').trim();
  const categoryRaw = String(row[4] ?? '').trim();

  if (categoryRaw) currentCategory = categoryRaw;
  const productGroup = categoryRaw || currentCategory;

  if (!component) continue;

  if (!byComponent.has(component)) {
    byComponent.set(component, {
      Component: component,
      'Component Description': description,
      'Month plan': 0,
      'Unit Of Measure': uom,
      'Product Group': productGroup,
    });
  }

  const existing = byComponent.get(component);
  existing['Month plan'] += monthPlan;
  if (!existing['Component Description'] && description) existing['Component Description'] = description;
  if (!existing['Unit Of Measure'] && uom) existing['Unit Of Measure'] = uom;
  if (!existing['Product Group'] && productGroup) existing['Product Group'] = productGroup;
}

const outputRows = [...byComponent.values()].sort((a, b) => a.Component.localeCompare(b.Component));

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(outputRows);
ws['!cols'] = [
  { wch: 16 },
  { wch: 42 },
  { wch: 14 },
  { wch: 16 },
  { wch: 18 },
];
XLSX.utils.book_append_sheet(wb, ws, 'Unique Components');
XLSX.writeFile(wb, outputPath);

console.log(JSON.stringify({
  outputPath,
  sourceRows: rows.length,
  uniqueComponents: outputRows.length,
}, null, 2));
