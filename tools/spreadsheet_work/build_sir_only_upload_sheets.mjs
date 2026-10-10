import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const dataPath = new URL("../../outputs/sir_only_upload_data.json", import.meta.url);
const outputDir = new URL("file:///C:/Users/durga/AppData/Local/Temp/sir_only_upload_sheets/");
const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
await fs.mkdir(fileURLToPath(outputDir), { recursive: true });

const files = [
  {
    name: "01_Components_Sir_MB52.xlsx",
    sheet: "Components",
    headers: ["Component ID", "Name", "Category", "UOM"],
    rows: data.components,
  },
  {
    name: "02_FG_Products_Sir_Only.xlsx",
    sheet: "FG Products",
    headers: ["FG Part Number", "Description", "Name", "Components", "Norms", "Buyer"],
    rows: data.fg_products,
  },
  {
    name: "03_Stock_Update_Sir_MB52.xlsx",
    sheet: "Stock",
    headers: ["Component", "Component ID", "Stock Value"],
    rows: data.stock,
  },
  {
    name: "04_BOM_Production_Plan_Sir.xlsx",
    sheet: "BOM",
    headers: ["FG Part Number", "Name", "Production Quantity"],
    rows: data.bom,
  },
];

function toMatrix(headers, rows) {
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
}

async function writeWorkbook(file) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add(file.sheet);
  sheet.showGridLines = false;
  const values = toMatrix(file.headers, file.rows);
  const lastCol = String.fromCharCode(64 + file.headers.length);
  const rangeAddress = `A1:${lastCol}${values.length}`;
  sheet.getRange(rangeAddress).values = values;
  sheet.getRange(`A1:${lastCol}1`).format = {
    fill: "#1F4E78",
    font: { bold: true, color: "#FFFFFF" },
  };
  sheet.getRange(rangeAddress).format.borders = {
    preset: "inside",
    style: "thin",
    color: "#D9E2F3",
  };
  sheet.getRange(rangeAddress).format.autofitColumns();
  sheet.freezePanes.freezeRows(1);

  const inspect = await workbook.inspect({
    kind: "table",
    sheetId: file.sheet,
    range: `A1:${lastCol}${Math.min(values.length, 6)}`,
    tableMaxRows: 6,
    tableMaxCols: file.headers.length,
    maxChars: 1600,
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
  outputDir: fileURLToPath(outputDir),
  files: files.map((f) => f.name),
  counts: {
    components: data.components.length,
    fgProducts: data.fg_products.length,
    bom: data.bom.length,
    stock: data.stock.length,
  },
}, null, 2));
