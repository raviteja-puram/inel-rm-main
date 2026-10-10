import { readWorkbookBuffer, sheetToRows, mapHeaders, cell } from './readWorkbook.js';

const VALID_CATS = ['Runner', 'Repeater', 'Stranger', 'NPD'];
const VALID_UOMS = ['EA', 'KG', 'M', 'MTR', 'G', 'ML', 'SET', 'L', 'NOS'];
const MATERIAL_TYPES = ['ROH', 'HALB', 'ZAST', 'FERT', 'VERP', 'UNBW'];

function normCat(v) {
  const t = String(v || '').trim();
  return VALID_CATS.find((c) => c.toUpperCase() === t.toUpperCase()) || t;
}
function normUom(v) {
  const t = String(v || '').trim();
  return VALID_UOMS.find((u) => u.toUpperCase() === t.toUpperCase()) || '';
}

function looksLikeVendorCode(value) {
  return /^\d{4,}$/.test(String(value || '').trim());
}

export function parseComponentsFlat(buffer) {
  const wb = readWorkbookBuffer(buffer);
  const { rows } = sheetToRows(wb);
  if (!rows.length) return { items: [], errors: ['Empty sheet'] };
  const hasHeader = rows[0] && isNaN(Number(rows[0][0]));
  const start = hasHeader ? 1 : 0;
  const map = hasHeader ? mapHeaders(rows[0]) : {};
  const items = [], errors = [], seenIds = new Set();
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((v) => v === null || v === '')) continue;
    const id = String(cell(row, map, 'partnumber', 'part number', 'componentid', 'component id', 'componentsmaterialsnumber', 'components materials number', 'materialnumber', 'material number', 'materialsid', 'materials id', 'id') ?? (hasHeader ? '' : row[0]) ?? '').trim();
    const desc = String(cell(row, map, 'name', 'componentname', 'component name', 'componentsmaterialsdescription', 'components materials description', 'materialsdescription', 'materials description', 'description', 'desc') ?? (hasHeader ? '' : row[1]) ?? '').trim();
    const rawUom = String(cell(row, map, 'uom', 'unitofmeasure', 'unit of measure') ?? (hasHeader ? '' : row[4]) ?? '').trim();
    const vendorNameCell = String(cell(row, map, 'vendorname', 'vendor name', 'vendor', 'supplier') ?? '').trim();
    const vendorCodeCell = String(cell(row, map, 'vendorcode', 'vendor code', 'suppliercode', 'supplier code') ?? '').trim();
    // Some legacy sheets have Vendor Name and Vendor Code labels reversed.
    const rawVendor = looksLikeVendorCode(vendorNameCell) && !looksLikeVendorCode(vendorCodeCell)
      ? vendorCodeCell
      : vendorNameCell;
    const vendorCode = looksLikeVendorCode(vendorNameCell) && !looksLikeVendorCode(vendorCodeCell)
      ? vendorNameCell
      : vendorCodeCell;
    const misplacedMaterialType = MATERIAL_TYPES.find(
      (type) => type === rawUom.toUpperCase(),
    );
    const componentType = String(
      cell(
        row,
        map,
        'componenttype',
        'component type',
        'type',
        'materialtype',
        'material type',
        'material type / category',
      ) ??
        misplacedMaterialType ??
        (hasHeader ? '' : row[2]) ??
        '',
    ).trim();
    const cat = normCat(
      cell(row, map, 'applicationcategory', 'application category', 'category', 'cat') ??
        (hasHeader ? '' : row[3]) ??
        '',
    );
    const productGroup = String(
      cell(row, map, 'productgroup', 'product group') ?? '',
    ).trim();
    const materialDiscipline = String(
      cell(
        row,
        map,
        'materialdiscipline',
        'material discipline',
        'materialdisipline',
        'material disipline',
        'electricalmechanical',
        'electrical / mechanical',
        'engineeringcategory',
        'engineering category',
      ) ?? '',
    ).trim();
    const oeExport = String(cell(row, map, 'oeexport', 'oe / export', 'oe export') ?? '').trim();
    const uom = normUom(rawUom);
    const vendor =
      rawVendor ||
      (rawUom && !uom && !misplacedMaterialType ? rawUom : '');
    if (!id) { errors.push(`Row ${i+1}: missing Part Number`); continue; }
    const idKey = id.toUpperCase();
    if (seenIds.has(idKey)) {
      errors.push(`Row ${i+1}: duplicate Part Number ${id} skipped`);
      continue;
    }
    if (!desc) { errors.push(`Row ${i+1}: missing Description`); continue; }
    seenIds.add(idKey);
    items.push({
      id, desc, componentType, materialDiscipline, oeExport, cat, productGroup, uom,
      buyer: String(cell(row, map, 'buyer', 'buyercontroller') ?? '').trim(),
      vendor,
      vendorCode,
      mpn: String(cell(row, map, 'mpn') ?? '').trim(),
      make: String(cell(row, map, 'make') ?? '').trim(),
      spq: Number(cell(row, map, 'spq')) || 0,
      moq: Number(cell(row, map, 'moq')) || 0,
      leadTimeWeeks: Number(cell(row, map, 'leadtime', 'leadtimeweeks')) || 0,
      rate: Number(cell(row, map, 'rate')) || 0,
      openBalance: Number(cell(row, map, 'openingbalance', 'openbalance')) || 0,
      storeStockMm01: Number(cell(row, map, 'mm01', 'storestockmm01')) || Number(hasHeader ? 0 : row[5]) || 0,
      storeStockMm10: Number(cell(row, map, 'mm10', 'storestockmm10')) || 0,
      inspectionStock: Number(cell(row, map, 'inspection', 'qad')) || 0,
      wipStock: Number(cell(row, map, 'wip', 'pp00')) || 0,
      qr01Stock: Number(cell(row, map, 'qr01')) || 0,
      ibPending: Number(cell(row, map, 'ibpending')) || 0,
      inwardQty: Number(cell(row, map, 'plannedinward', 'inward')) || 0,
      eta: String(cell(row, map, 'eta', 'remarks') ?? '').trim(),
      stock: Number(cell(row, map, 'stock')) || 0,
    });
  }
  return { items, errors };
}

export function parseComponentsWorkbook(buffer) {
  const wb = readWorkbookBuffer(buffer);
  if (wb.SheetNames.includes('ETA')) return parseEtaSheet(wb);
  return parseComponentsFlat(buffer);
}

function parseEtaSheet(wb) {
  const { rows } = sheetToRows(wb, 'ETA');
  const items = [], errors = [], seenIds = new Set();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[6]) continue;
    const id = String(row[6]).trim();
    const desc = String(row[8] || '').trim();
    if (!id) continue;
    const idKey = id.toUpperCase();
    if (seenIds.has(idKey)) {
      errors.push(`Row ${i+1}: duplicate Part Number ${id} skipped`);
      continue;
    }
    seenIds.add(idKey);
    items.push({
      id, desc, cat: '', uom: String(row[13] || '').trim(),
      buyer: String(row[21] || '').trim(),
      storeStockMm01: Number(row[14]) || 0,
      inspectionStock: Number(row[15]) || 0,
      storeStockMm10: Number(row[16]) || 0,
      wipStock: Number(row[17]) || 0,
      qr01Stock: Number(row[18]) || 0,
      ibPending: Number(row[22]) || 0,
      inwardQty: Number(row[25]) || 0,
      stock: 0,
    });
  }
  return { items, errors };
}
