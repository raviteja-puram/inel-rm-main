import XLSX from 'xlsx';

export function readWorkbookBuffer(buffer) {
  // Imports retain cached cell values only; formulas and presentation metadata
  // are never brought into the application data.
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellFormula: false,
    cellStyles: false,
    cellNF: false,
    cellHTML: false,
  });
  return wb;
}

export function sheetToRows(wb, sheetName = null) {
  const name = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[name];
  return {
    name,
    rows: XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      raw: true,
    }),
  };
}

export function normalizeHeader(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
}

export function mapHeaders(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => { if (h) map[normalizeHeader(h)] = i; });
  return map;
}

export function cell(row, map, ...keys) {
  for (const key of keys) {
    const idx = map[normalizeHeader(key)];
    if (idx !== undefined && row[idx] !== null && row[idx] !== '') return row[idx];
  }
  return null;
}
