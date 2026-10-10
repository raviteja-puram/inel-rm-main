import { readWorkbookBuffer, sheetToRows, mapHeaders, cell } from './readWorkbook.js';

export function parseFgProductsFlat(buffer) {
  const wb = readWorkbookBuffer(buffer);
  const { rows } = sheetToRows(wb);
  if (!rows.length) return { fgMap: new Map(), errors: [] };
  const hasHeader = rows[0]?.some((h) => String(h || '').toLowerCase().includes('fg')
    || String(h || '').toLowerCase().includes('component'));
  const start = hasHeader ? 1 : 0;
  const map = hasHeader ? mapHeaders(rows[0]) : {};
  const fgMap = new Map(), errors = [];
  const customerAliases = ['customername', 'customer name', 'customer', 'customerid'];
  let skippedDuplicates = 0;
  let skippedPlaceholders = 0;
  let currentPartNo = "";
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((v) => v === null || v === '')) continue;
    const rowPartNo = String(cell(
      row,
      map,
      'fgpartnumber',
      'fg part number',
      'fgpartnum',
      'fg part num',
      'fgpartno',
      'fg part no',
      'fgid',
      'fg id',
      'partno',
      'part no',
      'productid',
      'product id',
    ) ?? row[0] ?? '').trim();
    const desc = String(
      cell(row, map, 'description', 'desc', 'fgdescription', 'fg description') ?? row[1] ?? row[2] ?? '',
    ).trim();
    const name = String(cell(row, map, 'name', 'fgname', 'fg name') || desc || row[2] || row[1] || '').trim();
    if (rowPartNo) {
      if (/^(empty|tbd|tb\d)/i.test(rowPartNo)) {
        currentPartNo = "";
        skippedPlaceholders += 1;
        continue;
      }
      currentPartNo = rowPartNo;
      if (!fgMap.has(currentPartNo)) {
        const fgCategory = String(
          cell(row, map, 'fgcategory', 'fg category', 'category', 'productcategory', 'product category') ?? '',
        ).trim();
        if (!desc) {
          errors.push(`Row ${i+1}: missing Description`);
          currentPartNo = "";
          continue;
        }
        const customer = String(cell(row, map, ...customerAliases) ?? '').trim();
        fgMap.set(currentPartNo, {
          partNo: currentPartNo, name,
          desc,
          buyer: String(cell(row, map, 'buyer', 'buyercontroller', 'buyer controller') ?? row[5] ?? '').trim(),
          customer,
          customerCategory: String(cell(row, map, 'customercategory', 'customer category', 'catageory') ?? '').trim(),
          marketSegment: String(cell(row, map, 'marketsegment', 'market segment', 'segment') ?? '').trim(),
          productGroup: String(cell(row, map, 'productgroup', 'product group') ?? '').trim(),
          fgCategory,
          items: [], monthlyPlan: {},
        });
      }
    }
    const partNo = currentPartNo;
    const componentId = String(
      cell(
        row,
        map,
        'componentid',
        'component id',
        'materialid',
        'material id',
        'components',
        'component',
        'componentpartnumber',
        'component part number',
        'rawmaterial',
        'raw material',
      ) ?? (hasHeader ? '' : row[3] ?? row[6] ?? row[5]) ?? '',
    ).trim();
    const norms = Number(
      cell(row, map, 'norms', 'norm', 'normsperunit', 'norm per unit') ?? row[4] ?? row[7] ?? row[6],
    ) || 0;
    if (!partNo) continue;
    if (!componentId || norms <= 0) {
      errors.push(`Row ${i+1}: Material ID and Norms are required`);
      continue;
    }
    const fg = fgMap.get(partNo);
    const existing = fg.items.find(
      (x) => x.componentId.toUpperCase() === componentId.toUpperCase(),
    );
    if (existing) {
      skippedDuplicates += 1;
    } else {
      fg.items.push({ componentId, norms });
    }
  }
  return { fgMap, errors, skippedDuplicates, skippedPlaceholders };
}
