import {
  readWorkbookBuffer,
  sheetToRows,
  mapHeaders,
  cell,
} from "./readWorkbook.js";

function toIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Excel date-only cells may arrive a few seconds before local midnight.
    // Round toward the nearest calendar day before extracting the date.
    const rounded = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    const year = rounded.getUTCFullYear();
    const month = String(rounded.getUTCMonth() + 1).padStart(2, "0");
    const day = String(rounded.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  )
    return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseProductionPlanFlat(buffer) {
  const wb = readWorkbookBuffer(buffer);
  const { rows } = sheetToRows(wb);
  const firstHeader = String(rows[0]?.[0] || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const hasHeader =
    Boolean(rows[0]) &&
    (firstHeader.includes("fg") ||
      firstHeader.includes("part") ||
      rows[0].slice(1).some((value) => Boolean(toIsoDate(value))));
  const start = hasHeader ? 1 : 0;
  const map = hasHeader ? mapHeaders(rows[0]) : {};
  const planMap = new Map(),
    errors = [];
  const datedQuantityColumns = hasHeader
    ? rows[0]
        .map((header, index) => ({ index, date: toIsoDate(header) }))
        .filter((column) => column.date)
    : [];

  function addPlan(fgPartNo, fgName, fgDescription, qty, productionDate) {
    const key = `${fgPartNo}|${productionDate}`;
    if (planMap.has(key)) {
      planMap.get(key).qty += qty;
    } else {
      planMap.set(key, { fgPartNo, fgName, fgDescription, qty, productionDate });
    }
  }

  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((v) => v === null || v === "")) continue;
    const fgPartNo = String(
      cell(
        row,
        map,
        "fgpartnumber",
        "fg part number",
        "fgpartnum",
        "fg part num",
        "fgpartno",
        "fg part no",
        "fgid",
        "fg id",
        "partno",
        "part no",
      ) ??
        row[0] ??
        "",
    ).trim();
    const fgName = String(
      cell(row, map, "name", "fgname", "fg name") ??
        (datedQuantityColumns.length ? "" : row[1]) ??
        "",
    ).trim();
    const fgDescription = String(
      cell(row, map, "description", "fgdescription", "fg description", "desc") ??
        (datedQuantityColumns.length ? row[1] : "") ??
        "",
    ).trim();
    if (!fgPartNo) continue;

    if (datedQuantityColumns.length) {
      datedQuantityColumns.forEach(({ index, date }) => {
        const dateQty =
          Number(String(row[index] ?? "").replace(/,/g, "")) || 0;
        if (dateQty > 0) {
          addPlan(fgPartNo, fgName, fgDescription, dateQty, date);
        }
      });
      continue;
    }

    const qty =
      Number(
        String(
          cell(
            row,
            map,
            "productionqty",
            "production quantity",
            "productionquantity",
            "qty",
            "quantity",
            "plan",
          ) ??
            row[2] ??
            row[1] ??
            "",
        ).replace(/,/g, ""),
      ) || 0;
    let dateVal = cell(row, map, "productiondate", "date") ?? row[2];
    if (dateVal instanceof Date) dateVal = dateVal.toISOString().slice(0, 10);
    else dateVal = String(dateVal || "").trim();
    if (!dateVal || dateVal === String(qty))
      dateVal = new Date().toISOString().slice(0, 10);
    if (qty <= 0) {
      errors.push(`Row ${i + 1}: invalid quantity`);
      continue;
    }
    addPlan(fgPartNo, fgName, fgDescription, qty, dateVal);
  }
  return { items: [...planMap.values()], errors };
}
