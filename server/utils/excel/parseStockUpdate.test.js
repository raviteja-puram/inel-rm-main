import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { parseStockUpdateFlat } from './parseStockUpdate.js';

function workbookBuffer(rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Stock');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

test('stock import uses a formula cell cached value, not its formula definition', () => {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Component ID', 'Total Stock'],
    ['RM-001', 5],
  ]);
  worksheet.B2 = { t: 'n', f: '2+3', v: 5 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');

  const result = parseStockUpdateFlat(
    XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  );

  assert.deepEqual(result.items, [{ id: 'RM-001', stock: 5 }]);
});

test('stock import accepts IB Pending by itself without changing total stock', () => {
  const result = parseStockUpdateFlat(
    workbookBuffer([
      ['Component ID', 'IB Pending'],
      ['RM-001', 18],
    ]),
  );

  assert.deepEqual(result.items, [{ id: 'RM-001', ibPending: 18 }]);
});

test('stock import preserves IB Pending when it is supplied with total stock', () => {
  const result = parseStockUpdateFlat(
    workbookBuffer([
      ['Component ID', 'Total Stock', 'IB Pending'],
      ['RM-001', 25, 7],
    ]),
  );

  assert.deepEqual(result.items, [{ id: 'RM-001', stock: 25, ibPending: 7 }]);
});

test('stock import accepts Number header used in the stock upload sheet', () => {
  const result = parseStockUpdateFlat(
    workbookBuffer([
      ['Number', 'Total Stock', 'IB Pending'],
      ['N1010351', 128100, 10],
      ['N1050143', 914400, 10],
    ]),
  );

  assert.deepEqual(result.items, [
    { id: 'N1010351', stock: 128100, ibPending: 10 },
    { id: 'N1050143', stock: 914400, ibPending: 10 },
  ]);
});
