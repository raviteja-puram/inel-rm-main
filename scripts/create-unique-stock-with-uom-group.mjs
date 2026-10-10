import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const componentMetaPath = 'C:/Users/durga/.codex/attachments/857c6115-7d57-4980-abf2-1e06688677ba/pasted-text.txt';
const stockPath = 'C:/Users/durga/.codex/attachments/0c6c3fd3-45b7-4c1d-b5df-db30c5f6093d/pasted-text.txt';
const outputDir = path.resolve('outputs');
const outputPath = path.join(outputDir, 'Unique_Stock_Components_With_UOM_Product_Group.xlsx');

fs.mkdirSync(outputDir, { recursive: true });

function parseNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function parseTsv(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(1)
    .map((line) => line.split('\t'));
}

const metaByComponent = new Map();
let currentProductGroup = '';

for (const row of parseTsv(componentMetaPath)) {
  const component = String(row[0] ?? '').trim();
  if (!component) continue;

  const productGroupRaw = String(row[4] ?? '').trim();
  if (productGroupRaw) currentProductGroup = productGroupRaw;

  if (!metaByComponent.has(component)) {
    metaByComponent.set(component, {
      uom: String(row[3] ?? '').trim(),
      productGroup: productGroupRaw || currentProductGroup,
    });
  }
}

const byComponent = new Map();

for (const row of parseTsv(stockPath)) {
  const component = String(row[0] ?? '').trim();
  if (!component || byComponent.has(component)) continue;

  const meta = metaByComponent.get(component) || {};
  byComponent.set(component, {
    Component: component,
    'Component Description': String(row[1] ?? '').trim(),
    'Total stock': parseNumber(row[2]),
    'Unit Of Measure': meta.uom || '',
    'Product Group': meta.productGroup || '',
  });
}

const outputRows = [...byComponent.values()].sort((a, b) => a.Component.localeCompare(b.Component));
const missingMeta = outputRows.filter((row) => !row['Unit Of Measure'] && !row['Product Group']).length;

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(outputRows);
ws['!cols'] = [{ wch: 16 }, { wch: 44 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
XLSX.utils.book_append_sheet(wb, ws, 'Unique Stock');
XLSX.writeFile(wb, outputPath);

console.log(JSON.stringify({
  outputPath,
  uniqueComponents: outputRows.length,
  missingMeta,
}, null, 2));
