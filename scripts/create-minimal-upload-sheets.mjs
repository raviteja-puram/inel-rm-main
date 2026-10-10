import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const outputDir = path.resolve('minimal-upload-sheets');
fs.mkdirSync(outputDir, { recursive: true });

function writeWorkbook(fileName, sheetName, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, path.join(outputDir, fileName));
}

const components = [
  { 'Component ID': 'C1001', Name: 'COPPER WIRE', Category: 'Runner', UOM: 'MTR' },
  { 'Component ID': 'C1002', Name: 'MAGNET', Category: 'Repeater', UOM: 'EA' },
  { 'Component ID': 'C1003', Name: 'ADHESIVE', Category: 'Stranger', UOM: 'KG' },
  { 'Component ID': 'C1004', Name: 'PLASTIC HOUSING', Category: 'NPD', UOM: 'EA' },
];

const fgProducts = [
  {
    'FG Part Number': 'FG1001',
    Description: 'MOTOR ASSEMBLY',
    Name: 'MOTOR ASSEMBLY',
    Components: 'C1001',
    Norms: 2,
    Buyer: 'P.S',
  },
  {
    'FG Part Number': 'FG1001',
    Description: 'MOTOR ASSEMBLY',
    Name: 'MOTOR ASSEMBLY',
    Components: 'C1002',
    Norms: 1,
    Buyer: 'P.S',
  },
  {
    'FG Part Number': 'FG1001',
    Description: 'MOTOR ASSEMBLY',
    Name: 'MOTOR ASSEMBLY',
    Components: 'C1003',
    Norms: 0.5,
    Buyer: 'P.S',
  },
  {
    'FG Part Number': 'FG1002',
    Description: 'CONTROLLER ASSEMBLY',
    Name: 'CONTROLLER ASSEMBLY',
    Components: 'C1001',
    Norms: 1,
    Buyer: 'R.A',
  },
  {
    'FG Part Number': 'FG1002',
    Description: 'CONTROLLER ASSEMBLY',
    Name: 'CONTROLLER ASSEMBLY',
    Components: 'C1004',
    Norms: 2,
    Buyer: 'R.A',
  },
];

const stock = [
  { Component: 'COPPER WIRE', 'Component ID': 'C1001', 'Stock Value': 500 },
  { Component: 'MAGNET', 'Component ID': 'C1002', 'Stock Value': 80 },
  { Component: 'ADHESIVE', 'Component ID': 'C1003', 'Stock Value': 20 },
  { Component: 'PLASTIC HOUSING', 'Component ID': 'C1004', 'Stock Value': 150 },
];

const bom = [
  { 'FG Part Number': 'FG1001', Name: 'MOTOR ASSEMBLY', 'Production Quantity': 50 },
  { 'FG Part Number': 'FG1002', Name: 'CONTROLLER ASSEMBLY', 'Production Quantity': 40 },
];

writeWorkbook('01_MIN_Components_Upload.xlsx', 'Components', components);
writeWorkbook('02_MIN_FG_Products_Upload.xlsx', 'FG Products', fgProducts);
writeWorkbook('03_MIN_Stock_Upload.xlsx', 'Stock', stock);
writeWorkbook('04_MIN_BOM_Upload.xlsx', 'BOM', bom);

console.log(`Created minimal upload sheets in ${outputDir}`);
