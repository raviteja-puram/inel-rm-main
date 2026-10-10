import { readWorkbookBuffer, mapHeaders, normalizeHeader } from "./readWorkbook.js";
import { getMonthKeyFromDate, getWorkingDaysForMonthKey } from "../workingDays.js";
import XLSX from "xlsx";

const number = (value) => Number(String(value ?? "").replace(/,/g, "")) || 0;
const text = (value) => String(value ?? "").trim();

function parseDateValue(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const textValue = String(value).trim();
  if (!textValue) return null;

  const match = textValue.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const iso = new Date(textValue);
  if (!Number.isNaN(iso.getTime())) return iso;

  return null;
}

function trackMonitoringDate(name, rows) {
  for (const row of rows.slice(0, 6)) {
    for (let index = 0; index < row.length; index += 1) {
      const cellValue = row[index];
      const label = normalizeHeader(cellValue);
      if (!label || !/(updatedon|monitoringdate|date)/.test(label)) continue;
      const candidate = row[index + 1];
      const parsed = parseDateValue(candidate);
      if (parsed) return parsed.toISOString().slice(0, 10);
    }
  }

  const month = rows[0]?.find((cell) => /[a-z]{3}-\d{2}/i.test(text(cell)));
  const match = text(name).match(/^(\d{2})(\d{2})$/);
  if (month && match) {
    const parsed = new Date(`20${text(month).slice(-2)}-${text(month).slice(0, 3)}-${match[1]}`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function buildFgStockRecord({
  monitorDate,
  partNo,
  plan,
  stockNormDays,
  totalStock,
  row,
  sheetName,
  rowNumber,
  get,
}) {
  const monthKey = getMonthKeyFromDate(monitorDate) || monitorDate.slice(0, 7);
  const workingDays = getWorkingDaysForMonthKey(monthKey) || 24;
  const suppliedAdr = number(get(row, "ADR"));
  const adr = suppliedAdr > 0 ? suppliedAdr : (plan > 0 && workingDays > 0 ? Math.round(plan / workingDays) : 0);
  const agreedStock = adr * stockNormDays;
  const coverageDays = adr > 0 ? Number((totalStock / adr).toFixed(1)) : 0;
  const status = coverageDays <= 1 ? "Critical" : coverageDays <= 5 ? "Low Stock" : coverageDays <= 10 ? "OK" : "Excess";

  return {
    monitorDate,
    partNo,
    monthKey,
    monthPlanQty: plan,
    adr,
    agreedStock,
    coverageDays,
    status,
    stockNormDays,
    totalStock,
    name: text(get(row, "FG Name", "Name", "Description")),
    customer: text(get(row, "Customer Name", "Customer")),
    customerCategory: text(get(row, "Catageory", "Customer Category")),
    productGroup: text(get(row, "Group", "Product Group")),
    fgCategory: text(get(row, "Category")),
    sheetName,
    rowNumber,
  };
}

export function parseFgStockWorkbook(buffer) {
  const wb = readWorkbookBuffer(buffer);
  const records = [], errors = [];
  for (const sheetName of wb.SheetNames) {
    const rows = wb.Sheets[sheetName]
      ? XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null })
      : [];
    if (!rows.length) continue;

    const standardizedHeaderIndex = rows.findIndex((row) => row.some((cell) => ["partno", "fgpartno", "fgpartnumber"].includes(normalizeHeader(cell))));
    const dateHeaderIndex = rows.findIndex((row) => row.some((cell) => parseDateValue(cell)));
    const headerIndex = standardizedHeaderIndex >= 0 ? standardizedHeaderIndex : dateHeaderIndex;
    if (headerIndex < 0) continue;

    const headerRow = rows[headerIndex] || [];
    const headers = mapHeaders(headerRow);
    const get = (row, ...keys) => {
      for (const key of keys) {
        const index = headers[normalizeHeader(key)];
        if (index !== undefined && row[index] !== null && row[index] !== "") return row[index];
      }
      return "";
    };

    const requiredHeaders = ["Part No", "Month Plan Qty", "Stock Norms In days", "Total Stock"];
    const hasRequiredHeaders = requiredHeaders.every((header) => headers[normalizeHeader(header)] !== undefined);
    const dateColumns = headerRow
      .map((cell, index) => ({ cell, index, date: parseDateValue(cell) }))
      .filter(({ date }) => date);

    if (hasRequiredHeaders) {
      const monitorDate = trackMonitoringDate(sheetName, rows);
      for (let index = headerIndex + 1; index < rows.length; index++) {
        const row = rows[index];
        const partNo = text(get(row, "Part No", "FG Part No", "FG Part Number"));
        if (!partNo) continue;
        const planValue = get(row, "Month Plan Qty", "Monthly Plan", "Plan Qty");
        const totalStockValue = get(row, "Total Stock");
        const plan = number(planValue);
        const totalStock = number(totalStockValue);
        const stockNormValue = get(row, "Stock Norms In days", "Stock Norm Days");
        const stockNormDays = number(stockNormValue);
        if (text(planValue) === "" || text(stockNormValue) === "" || text(totalStockValue) === "") {
          errors.push(`${sheetName} row ${index + 1}: Part No, Month Plan Qty, Stock Norms In Days, and Total Stock are required`);
          continue;
        }
        records.push(buildFgStockRecord({
          monitorDate,
          partNo,
          plan,
          stockNormDays,
          totalStock,
          row,
          sheetName,
          rowNumber: index + 1,
          get,
        }));
      }
      continue;
    }

    if (dateColumns.length) {
      const partNoIndex = headerRow.findIndex((cell) => ["partno", "fgpartno", "fgpartnumber", "number", "id"].includes(normalizeHeader(cell)));
      const stockNormIndex = headerRow.findIndex((cell) => ["stocknormsindays", "stocknormdays", "stocknorms", "norms", "stocknorm"].includes(normalizeHeader(cell)));
      const totalStockIndex = headerRow.findIndex((cell) => ["totalstock", "stock", "currentstock", "availablestock"].includes(normalizeHeader(cell)));
      const monitorDateSource = trackMonitoringDate(sheetName, rows);
      for (let index = headerIndex + 1; index < rows.length; index++) {
        const row = rows[index];
        if (!row || row.every((cell) => cell === null || cell === "")) continue;
        const partNo = text(partNoIndex >= 0 ? row[partNoIndex] : row[0]);
        if (!partNo) continue;

        const stockNormDays = stockNormIndex >= 0 ? number(row[stockNormIndex]) : 0;
        const totalStock = totalStockIndex >= 0 ? number(row[totalStockIndex]) : 0;

        for (const { index: dateIndex, date } of dateColumns) {
          const plan = number(row[dateIndex]);
          if (!plan) continue;
          const monitorDate = date.toISOString().slice(0, 10);
          const rowEntry = buildFgStockRecord({
            monitorDate,
            partNo,
            plan,
            stockNormDays,
            totalStock,
            row,
            sheetName,
            rowNumber: index + 1,
            get,
          });
          records.push(rowEntry);
        }
      }
      continue;
    }

    errors.push(`${sheetName}: missing required columns for FG stock upload`);
  }
  return { records, errors };
}
