import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const outputDir = path.resolve('mixed-demo-upload-sheets');
fs.mkdirSync(outputDir, { recursive: true });

function writeWorkbook(fileName, sheetName, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, path.join(outputDir, fileName));
}

const components = [
  { 'Component ID': 'C2001', Name: 'ZERO STOCK IC', Category: 'Runner', UOM: 'EA' },
  { 'Component ID': 'C2002', Name: 'LOW STOCK MAGNET', Category: 'Repeater', UOM: 'EA' },
  { 'Component ID': 'C2003', Name: 'WATCH COPPER WIRE', Category: 'Runner', UOM: 'MTR' },
  { 'Component ID': 'C2004', Name: 'SAFE PLASTIC HOUSING', Category: 'NPD', UOM: 'EA' },
  { 'Component ID': 'C2005', Name: 'SAFE PRODUCT LABEL', Category: 'Stranger', UOM: 'EA' },
  { 'Component ID': 'C2006', Name: 'LOW STOCK ADHESIVE', Category: 'Repeater', UOM: 'KG' },
];

const fgProducts = [
  {
    'FG Part Number': 'FG2001',
    Description: 'PUMP ASSEMBLY',
    Name: 'PUMP ASSEMBLY',
    Components: 'C2001',
    Norms: 1,
    Buyer: 'P.S',
  },
  {
    'FG Part Number': 'FG2001',
    Description: 'PUMP ASSEMBLY',
    Name: 'PUMP ASSEMBLY',
    Components: 'C2002',
    Norms: 2,
    Buyer: 'P.S',
  },
  {
    'FG Part Number': 'FG2001',
    Description: 'PUMP ASSEMBLY',
    Name: 'PUMP ASSEMBLY',
    Components: 'C2003',
    Norms: 1,
    Buyer: 'P.S',
  },
  {
    'FG Part Number': 'FG2001',
    Description: 'PUMP ASSEMBLY',
    Name: 'PUMP ASSEMBLY',
    Components: 'C2004',
    Norms: 1,
    Buyer: 'P.S',
  },
  {
    'FG Part Number': 'FG2002',
    Description: 'CONTROL ASSEMBLY',
    Name: 'CONTROL ASSEMBLY',
    Components: 'C2005',
    Norms: 1,
    Buyer: 'R.A',
  },
  {
    'FG Part Number': 'FG2002',
    Description: 'CONTROL ASSEMBLY',
    Name: 'CONTROL ASSEMBLY',
    Components: 'C2006',
    Norms: 0.5,
    Buyer: 'R.A',
  },
  {
    'FG Part Number': 'FG2003',
    Description: 'SPARE KIT',
    Name: 'SPARE KIT',
    Components: 'C2004',
    Norms: 0.2,
    Buyer: 'P.S',
  },
];

const stock = [
  { Component: 'ZERO STOCK IC', 'Component ID': 'C2001', 'Stock Value': 0 },
  { Component: 'LOW STOCK MAGNET', 'Component ID': 'C2002', 'Stock Value': 120 },
  { Component: 'WATCH COPPER WIRE', 'Component ID': 'C2003', 'Stock Value': 180 },
  { Component: 'SAFE PLASTIC HOUSING', 'Component ID': 'C2004', 'Stock Value': 500 },
  { Component: 'SAFE PRODUCT LABEL', 'Component ID': 'C2005', 'Stock Value': 1000 },
  { Component: 'LOW STOCK ADHESIVE', 'Component ID': 'C2006', 'Stock Value': 10 },
];

const bom = [
  { 'FG Part Number': 'FG2001', Name: 'PUMP ASSEMBLY', 'Production Quantity': 100, 'Production Date': '2026-07-04' },
  { 'FG Part Number': 'FG2002', Name: 'CONTROL ASSEMBLY', 'Production Quantity': 50, 'Production Date': '2026-07-05' },
  { 'FG Part Number': 'FG2003', Name: 'SPARE KIT', 'Production Quantity': 25, 'Production Date': '2026-07-08' },
];

writeWorkbook('01_MIX_Components_Upload.xlsx', 'Components', components);
writeWorkbook('02_MIX_FG_Products_Upload.xlsx', 'FG Products', fgProducts);
writeWorkbook('03_MIX_Stock_Upload.xlsx', 'Stock', stock);
writeWorkbook('04_MIX_BOM_Upload.xlsx', 'BOM', bom);

console.log(`Created mixed demo upload sheets in ${outputDir}`);
