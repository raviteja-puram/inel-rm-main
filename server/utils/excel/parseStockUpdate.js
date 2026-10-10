import { readWorkbookBuffer, sheetToRows, mapHeaders, cell } from './readWorkbook.js';

function numericValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

export function parseStockUpdateFlat(buffer) {
  const wb = readWorkbookBuffer(buffer);
  const { rows } = sheetToRows(wb);
  const hasHeader = rows[0] && isNaN(Number(rows[0][1]));
  const start = hasHeader ? 1 : 0;
  const map = hasHeader ? mapHeaders(rows[0]) : {};
  const idAliases = ['componentid', 'component id', 'id', 'number', 'componentnumber'];
  const hasBucketColumns = !hasHeader || [
    'mm01', 'storestockmm01', 'mm10', 'storestockmm10', 'wip', 'pp00',
    'qr01', 'inspection', 'qad', 'plannedinward', 'inward',
  ].some((key) => map[key.replace(/[^a-z0-9]+/gi, '').toLowerCase()] !== undefined);
  const hasRecognizedHeader = !hasHeader || [
    'stockdelta', 'stock delta', 'receivedqty', 'received qty', 'receiptqty', 'receipt qty',
    'updatestock', 'update stock', 'addstock', 'add stock',
    'stockvalue', 'stock value', 'stock', 'stocks', 'totalstock', 'total stock', 'mm01', 'storestockmm01',
    'mm10', 'storestockmm10', 'wip', 'pp00', 'qr01', 'inspection', 'qad',
    'ibpending', 'plannedinward', 'inward',
    'number', 'componentnumber',
  ].some((key) => map[key.replace(/[^a-z0-9]+/gi, '').toLowerCase()] !== undefined);
  const items = [], errors = [], seenIds = new Set();
  if (!hasRecognizedHeader) {
    return {
      items: [],
      errors: ['Missing stock column. Use Total Stock to replace, Update Stock to add, or IB Pending to update pending inbound stock.'],
    };
  }
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((v) => v === null || v === '')) continue;
    const id = String(cell(row, map, ...idAliases) ?? row[0] ?? '').trim();
    if (!id) { errors.push(`Row ${i+1}: missing Component ID`); continue; }
    const idKey = id.toUpperCase();
    if (seenIds.has(idKey)) {
      errors.push(`Row ${i+1}: duplicate Component ID ${id} skipped`);
      continue;
    }
    const stockDelta = numericValue(cell(
      row,
      map,
      'stockdelta',
      'stock delta',
      'receivedqty',
      'received qty',
      'receiptqty',
      'receipt qty',
      'updatestock',
      'update stock',
      'addstock',
      'add stock',
    ));
    const rawIbPending = cell(row, map, 'ibpending', 'ib pending');
    const ibPending = numericValue(rawIbPending);
    const hasIbPending = ibPending !== null;
    if (stockDelta !== null && stockDelta > 0) {
      seenIds.add(idKey);
      items.push({ id, stockDelta, ...(hasIbPending ? { ibPending } : {}) });
      continue;
    }
    const rawStockValue =
      cell(
        row,
        map,
        'stockvalue',
        'stock value',
        'stock',
        'stocks',
        'totalstock',
        'total stock',
      ) ?? (hasHeader ? null : row[2] ?? row[1]);
    const stockValue = numericValue(rawStockValue);
    if (
      rawStockValue !== null &&
      rawStockValue !== '' &&
      stockValue !== null
    ) {
      seenIds.add(idKey);
      items.push({ id, stock: stockValue, ...(hasIbPending ? { ibPending } : {}) });
      continue;
    }
    if (!hasBucketColumns) {
      if (hasIbPending) {
        seenIds.add(idKey);
        items.push({ id, ibPending });
      } else {
        errors.push(`Row ${i+1}: missing Stock Value or IB Pending`);
      }
      continue;
    }
    const multiBucketUpdate = {
      id,
      storeStockMm01: Number(cell(row, map, 'mm01', 'storestockmm01') ?? (hasHeader ? null : row[1])) || 0,
      storeStockMm10: Number(cell(row, map, 'mm10', 'storestockmm10') ?? (hasHeader ? null : row[2])) || 0,
      wipStock: Number(cell(row, map, 'wip', 'pp00') ?? (hasHeader ? null : row[3])) || 0,
      qr01Stock: Number(cell(row, map, 'qr01') ?? (hasHeader ? null : row[4])) || 0,
      inspectionStock: Number(cell(row, map, 'inspection', 'qad') ?? (hasHeader ? null : row[5])) || 0,
      ibPending: numericValue(cell(row, map, 'ibpending', 'ib pending') ?? (hasHeader ? null : row[6])) || 0,
      inwardQty: Number(cell(row, map, 'plannedinward', 'inward') ?? (hasHeader ? null : row[7])) || 0,
    };
    const total = multiBucketUpdate.storeStockMm01 + multiBucketUpdate.storeStockMm10
      + multiBucketUpdate.wipStock + multiBucketUpdate.qr01Stock
      + multiBucketUpdate.inspectionStock;
    if (total === 0 && !hasIbPending) {
      errors.push(`Row ${i+1}: missing Stock Value or IB Pending`);
      continue;
    }
    seenIds.add(idKey);
    items.push({
      ...multiBucketUpdate,
      stock: total,
      ...(hasIbPending ? { ibPending } : {}),
    });
  }
  return { items, errors };
}
