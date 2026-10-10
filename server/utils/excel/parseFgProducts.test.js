import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { parseFgProductsFlat } from './parseFgProducts.js';
import { parseFgStockWorkbook } from './parseFgStock.js';

test('FG upload accepts files without a category column and with standard FG ID headers', () => {
  const rows = [
    ['FG ID', 'FG Name', 'Description', 'Buyer', 'Customer', 'Market Segment', 'Component ID', 'Norms'],
    ['FG-1001', 'Pump Assembly', 'Pump Assembly', 'U1', '', '', 'C-1001', 2],
    ['FG-1001', 'Pump Assembly', 'Pump Assembly', 'U1', '', '', 'C-1002', 1.5],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'FG Products');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = parseFgProductsFlat(buffer);

  assert.equal(result.errors.length, 0, `Unexpected parse errors: ${result.errors.join(', ')}`);
  assert.equal(result.fgMap.size, 1);
  assert.equal(result.fgMap.get('FG-1001').items.length, 2);
  assert.equal(result.fgMap.get('FG-1001').fgCategory, '');
});

test('FG upload reads customer name when included alongside BOM rows', () => {
  const rows = [
    ['FG Part Number', 'FG Description', 'Customer Name', 'Material ID', 'Material Description', 'Norms', 'UOM', 'Product Group'],
    ['FG-2001', 'Valve Block', 'Alpha Industries', 'C-1001', 'Steel Block', 2, 'PC', 'Aero'],
    ['FG-2001', 'Valve Block', 'Alpha Industries', 'C-1002', 'Seal Kit', 1, 'PC', 'Aero'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'FG Products');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = parseFgProductsFlat(buffer);

  assert.equal(result.errors.length, 0, `Unexpected parse errors: ${result.errors.join(', ')}`);
  assert.equal(result.fgMap.get('FG-2001').customer, 'Alpha Industries');
  assert.equal(result.fgMap.get('FG-2001').productGroup, 'Aero');
});

test('FG monitoring upload accepts the minimal 5-column sheet without Customer Name', () => {
  const rows = [
    ['Updated On', '05.09.2026'],
    ['Part No', 'Month Plan Qty', 'Stock Norms In days', 'Total Stock', 'Category'],
    ['FG-1001', 150, 30, 900, 'Runner'],
    ['FG-1002', 200, 45, 1000, 'Repeater'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Monitor');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = parseFgStockWorkbook(buffer);

  assert.equal(result.errors.length, 0, `Unexpected parse errors: ${result.errors.join(', ')}`);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].partNo, 'FG-1001');
  assert.equal(result.records[0].customer, '');
});

test('FG monitoring upload defaults to today when the sheet has no explicit date row', () => {
  const rows = [
    ['Part No', 'Month Plan Qty', 'Stock Norms In days', 'Total Stock', 'Category'],
    ['N5010198', 80000, 5, 400, 'Runner'],
    ['N5010320', 24000, 5, 960, 'Runner'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Monitor plan');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = parseFgStockWorkbook(buffer);
  const today = new Date().toISOString().slice(0, 10);

  assert.equal(result.errors.length, 0, `Unexpected parse errors: ${result.errors.join(', ')}`);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].monitorDate, today);
});

test('FG monitoring upload accepts BOM-style date columns with one or many plan days', () => {
  const rows = [
    ['Number', '01.09.2026', '10.09.2026', '01.10.2026'],
    ['FG-1001', 1200, 900, 1300],
    ['FG-1002', 600, 450, 700],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Plan');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = parseFgStockWorkbook(buffer);

  assert.equal(result.errors.length, 0, `Unexpected parse errors: ${result.errors.join(', ')}`);
  assert.equal(result.records.length, 6);

  const fg1001Sep10 = result.records.find((record) => record.partNo === 'FG-1001' && record.monitorDate === '2026-09-10');
  const fg1002Oct1 = result.records.find((record) => record.partNo === 'FG-1002' && record.monitorDate === '2026-10-01');

  assert.ok(fg1001Sep10);
  assert.equal(fg1001Sep10.monthPlanQty, 900);
  assert.ok(fg1002Oct1);
  assert.equal(fg1002Oct1.monthPlanQty, 700);
});

test('FG monitoring upload derives ADR, agreed stock and coverage days automatically', () => {
  const rows = [
    ['Updated On', '01.09.2026'],
    ['Part No', 'Month Plan Qty', 'Stock Norms In days', 'Total Stock', 'Category'],
    ['FG-1001', 1200, 10, 240, 'Runner'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Monitor');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const result = parseFgStockWorkbook(buffer);

  assert.equal(result.errors.length, 0, `Unexpected parse errors: ${result.errors.join(', ')}`);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].adr, 50);
  assert.equal(result.records[0].agreedStock, 500);
  assert.equal(result.records[0].coverageDays, 4.8);
  assert.equal(result.records[0].status, 'Low Stock');
});
