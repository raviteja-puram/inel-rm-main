import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { getAllFgProducts } from "../server/utils/repository.js";

const sourcePath = "C:/Users/admin/Downloads/BOM - 12_09_2026.xlsx";
const outputDir = "C:/Durga/inel-rm-main/inel-rm-main/outputs";
const outputPath = `${outputDir}/BOM - 12_09_2026 with FG descriptions.xlsx`;
const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Sheet1");
const sourceRange = sheet.getUsedRange();
const originalRows = sourceRange.values;
const fgByPartNo = new Map(getAllFgProducts().map((fg) => [String(fg.partNo).trim(), fg]));
const missing = [];
const enrichedRows = originalRows.map((row, index) => {
  if (index === 0) return [row[0], "FG Description", ...row.slice(1)];
  const partNo = String(row[0] || "").trim();
  const fg = fgByPartNo.get(partNo);
  const description = fg?.desc || fg?.name || "";
  if (partNo && !description) missing.push(partNo);
  return [row[0], description, ...row.slice(1)];
});

for (const table of sheet.tables.items) table.delete();
sourceRange.clear({ applyTo: "all" });
sheet.getRangeByIndexes(0, 0, enrichedRows.length, enrichedRows[0].length).values = enrichedRows;
const table = sheet.tables.add(`A1:J${enrichedRows.length}`, true, "ProductionPlanWithDescriptions");
table.style = "TableStyleMedium2";
sheet.freezePanes.freezeRows(1);
sheet.getRange(`A1:J1`).format = { fill: "#1F4E78", font: { name: "Arial", bold: true, color: "#FFFFFF" }, verticalAlignment: "center", wrapText: true };
sheet.getRange(`A1:J${enrichedRows.length}`).format.font = { name: "Arial", size: 10, color: "#1F2937" };
sheet.getRange(`A1:J${enrichedRows.length}`).format.verticalAlignment = "center";
sheet.getRange(`A1:J${enrichedRows.length}`).format.wrapText = true;
sheet.getRange(`A1:J1`).format.rowHeight = 28;
const widths = [20, 38, 13, 13, 13, 13, 13, 13, 13, 13];
widths.forEach((width, index) => {
  sheet.getRangeByIndexes(0, index, enrichedRows.length, 1).format.columnWidth = width;
});

await fs.mkdir(outputDir, { recursive: true });
const check = await workbook.inspect({ kind: "table", range: "Sheet1!A1:J12", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 10 });
console.log(check.ndjson);
console.log(JSON.stringify({ matched: enrichedRows.length - 1 - missing.length, missing }, null, 2));
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 50 }, summary: "final formula error scan" });
if (errors.ndjson.includes("#REF!") || errors.ndjson.includes("#DIV/0!")) throw new Error(errors.ndjson);
const preview = await workbook.render({ sheetName: "Sheet1", range: "A1:J18", scale: 1.2, format: "png" });
await fs.writeFile(`${outputDir}/BOM_with_FG_descriptions_preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
