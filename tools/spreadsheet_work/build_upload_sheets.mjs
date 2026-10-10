import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const dataPath = new URL("../../outputs/upload_source_data.json", import.meta.url);
const outputDir = new URL("file:///C:/Users/durga/AppData/Local/Temp/sir_upload_sheets/");
const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
await fs.mkdir(outputDir, { recursive: true });

const files = [
  {
    name: "01_Components_From_MB52.xlsx",
    sheet: "Components",
    headers: ["Component ID", "Name", "Category", "UOM"],
    rows: data.components,
    note: "Unique component/material master from MB52 Data sheet.",
  },
  {
    name: "02_FG_Products_Test_Mapping.xlsx",
    sheet: "FG Products",
    headers: ["FG Part Number", "Description", "Name", "Component ID", "Norms", "Buyer"],
    rows: data.fg_products,
    note: "Real FG list from production plan. Component ID + Norms are generated only for upload-flow testing because source files do not contain FG-to-component norms.",
  },
  {
    name: "03_Stock_Update_From_MB52.xlsx",
    sheet: "Stock",
    headers: ["Component", "Component ID", "Stock Value"],
    rows: data.stock,
    note: "Stock Value = Unrestricted + Transit/Transfer + Quality Inspection + Restricted + Blocked + Returns quantities.",
  },
  {
    name: "04_BOM_Production_Plan_From_Jul26.xlsx",
    sheet: "BOM",
    headers: ["FG Part Number", "Name", "Production Quantity"],
    rows: data.bom,
    note: "Real FG production plan quantity from FINAL WORKING. sheet.",
  },
];

function matrixFor(headers, rows) {
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
}

async function writeWorkbook(file) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add(file.sheet);
  sheet.showGridLines = false;

  const values = matrixFor(file.headers, file.rows);
  const lastCol = String.fromCharCode(64 + file.headers.length);
  sheet.getRange(`A1:${lastCol}${values.length}`).values = values;
  sheet.getRange(`A1:${lastCol}1`).format = {
    fill: "#1F4E78",
    font: { bold: true, color: "#FFFFFF" },
  };
  sheet.getRange(`A1:${lastCol}${values.length}`).format.borders = {
    preset: "inside",
    style: "thin",
    color: "#D9E2F3",
  };
  sheet.getRange(`A1:${lastCol}${values.length}`).format.autofitColumns();
  sheet.getRange(`A1:${lastCol}${values.length}`).format.autofitRows();
  sheet.freezePanes.freezeRows(1);

  const noteRow = values.length + 3;
  sheet.getRange(`A${noteRow}:${lastCol}${noteRow}`).merge();
  sheet.getRange(`A${noteRow}`).values = [[file.note]];
  sheet.getRange(`A${noteRow}`).format = {
    fill: "#FFF2CC",
    font: { bold: true, color: "#7F6000" },
    wrapText: true,
  };

  const inspect = await workbook.inspect({
    kind: "table",
    sheetId: file.sheet,
    range: `A1:${lastCol}${Math.min(values.length, 8)}`,
    tableMaxRows: 8,
    tableMaxCols: file.headers.length,
    maxChars: 2000,
  });
  console.log(`\n${file.name}`);
  console.log(inspect.ndjson);

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(fileURLToPath(new URL(file.name, outputDir)));
}

for (const file of files) {
  await writeWorkbook(file);
}

console.log(JSON.stringify({
  outputDir: outputDir.pathname,
  files: files.map((f) => f.name),
  counts: {
    components: data.components.length,
    fgUploadRows: data.fg_products.length,
    bomRows: data.bom.length,
    stockRows: data.stock.length,
  },
}, null, 2));
