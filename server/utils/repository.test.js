import test from 'node:test';
import assert from 'node:assert/strict';

import {
  upsertFgProduct,
  upsertFgStockSnapshot,
  getFgStockSnapshots,
  deleteFgStockSnapshot,
} from './repository.js';

test('deleting a monitoring row removes it from fg_stock_snapshots', () => {
  const partNo = 'FG-DELETE-TEST';
  const date = '2099-12-31';

  upsertFgProduct({
    partNo,
    name: 'Delete Test FG',
    desc: 'Delete Test FG',
    buyer: '',
    customer: '',
    customerCategory: '',
    marketSegment: '',
    productGroup: '',
    productType: '',
    stockNormDays: 0,
    totalStock: 0,
    fgCategory: '',
    monthlyPlan: {},
    items: [{ componentId: 'X-TEST-ONLY', norms: 1 }],
  }, false);

  upsertFgStockSnapshot({
    monitorDate: date,
    partNo,
    monthKey: '2026-12',
    monthPlanQty: 1200,
    adr: 50,
    stockNormDays: 10,
    totalStock: 500,
  });

  const inserted = getFgStockSnapshots().find(
    (row) => row.partNo === partNo && row.monitorDate === date,
  );

  assert.ok(inserted, 'snapshot should have been created');
  deleteFgStockSnapshot(inserted.id);

  const remaining = getFgStockSnapshots().find(
    (row) => row.partNo === partNo && row.monitorDate === date,
  );

  assert.equal(remaining, undefined);
});
