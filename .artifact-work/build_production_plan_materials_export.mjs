import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";
import {
  getAllComponents,
  getAllFgProducts,
  getAllProductionPlans,
} from "../server/utils/repository.js";
import { getRequiredQuantity } from "../server/utils/calculations.js";

const outputDir = "C:/Durga/inel-rm-main/inel-rm-main/outputs";
const outputPath = `${outputDir}/production_plan_material_descriptions.xlsx`;
const components = getAllComponents();
const products = getAllFgProducts();
const plans = getAllProductionPlans();
const componentById = new Map(components.map((component) => [component.id, component]));
const fgByPartNo = new Map(products.map((product) => [product.partNo, product]));

const rows = plans
  .slice()
  .sort((a, b) => String(a.productionDate || "").localeCompare(String(b.productionDate || "")) || Number(a.priorityRank || 0) - Number(b.priorityRank || 0))
  .flatMap((plan) => {
    const fg = fgByPartNo.get(plan.fgPartNo);
    return (fg?.items || []).map((item) => {
      const component = componentById.get(item.componentId);
      return [
        plan.productionDate || "",
        Number(plan.priorityRank || 0),
        fg?.partNo || plan.fgPartNo || "",
        fg?.name || fg?.desc || plan.fgDescription || "",
        Number(plan.qty || 0),
        item.componentId || "",
        component?.desc || item.desc || "",
        component?.uom || "",
        Number(item.norms || 0),
        getRequiredQuantity(plan.qty, item.norms, component),
        Number(component?.stock || 0),
      ];
    });
  });

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Summary");
const detail = workbook.worksheets.add("Plan Materials");

summary.getRange("A1:D1").merge();
summary.getRange("A1").values = [["Production Plan Material Descriptions"]];
summary.getRange("A2:D2").merge();
summary.getRange("A2").values = [["Current uploaded production-plan BOM materials from INEL RM."]];
summary.getRange("A4:B8").values = [
  ["Metric", "Value"],
  ["Production plan rows", plans.length],
  ["FG products in plan", new Set(plans.map((plan) => plan.fgPartNo)).size],
  ["Material requirement rows", rows.length],
  ["Generated on", new Date().toISOString().slice(0, 10)],
];

const headers = [
  "Production Date",
  "Priority",
  "FG Part Number",
  "FG Description",
  "Planned FG Qty",
  "Material Part Number",
  "Material Description",
  "UOM",
  "BOM Norm per FG",
  "Required Material Qty",
  "Available RM Stock",
];
detail.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
if (rows.length) detail.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
detail.tables.add(`A1:K${Math.max(rows.length + 1, 2)}`, true, "ProductionPlanMaterials");

for (const sheet of [summary, detail]) {
  sheet.showGridLines = false;
  sheet.getUsedRange().format.font = { name: "Arial", size: 10, color: "#1F2937" };
}
summary.getRange("A1:D1").format = { fill: "#1F4E78", font: { name: "Arial", size: 15, bold: true, color: "#FFFFFF" }, verticalAlignment: "center" };
summary.getRange("A2:D2").format = { font: { name: "Arial", size: 10, italic: true, color: "#4B5563" } };
summary.getRange("A4:B4").format = { fill: "#1F4E78", font: { name: "Arial", bold: true, color: "#FFFFFF" } };
summary.getRange("A4:B8").format.borders = { preset: "outside", style: "thin", color: "#B8C4D0" };
summary.getRange("A1:D1").format.rowHeight = 26;
summary.getRange("A1:A8").format.columnWidth = 28;
summary.getRange("B1:B8").format.columnWidth = 20;
summary.getRange("A1:D8").format.wrapText = true;

detail.getRange(`A1:K1`).format = { fill: "#1F4E78", font: { name: "Arial", bold: true, color: "#FFFFFF" }, verticalAlignment: "center", wrapText: true };
detail.getRange(`A1:K${Math.max(rows.length + 1, 2)}`).format.verticalAlignment = "center";
detail.getRange(`A2:A${Math.max(rows.length + 1, 2)}`).format.numberFormat = "yyyy-mm-dd";
detail.getRange(`B2:B${Math.max(rows.length + 1, 2)}`).format.numberFormat = "0";
detail.getRange(`E2:E${Math.max(rows.length + 1, 2)}`).format.numberFormat = "#,##0";
detail.getRange(`I2:K${Math.max(rows.length + 1, 2)}`).format.numberFormat = "#,##0.###";
detail.freezePanes.freezeRows(1);
const widths = [14, 10, 18, 32, 16, 22, 42, 10, 18, 22, 20];
widths.forEach((width, index) => { detail.getRangeByIndexes(0, index, Math.max(rows.length + 1, 2), 1).format.columnWidth = width; });
detail.getRange(`A1:K${Math.max(rows.length + 1, 2)}`).format.wrapText = true;
detail.getRange(`A1:K1`).format.rowHeight = 30;

await fs.mkdir(outputDir, { recursive: true });
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 50 }, summary: "formula error scan" });
if (errors.ndjson.includes("#REF!") || errors.ndjson.includes("#DIV/0!")) throw new Error(errors.ndjson);
const check = await workbook.inspect({ kind: "table", range: "Plan Materials!A1:K12", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 11 });
console.log(check.ndjson);
const preview = await workbook.render({ sheetName: "Plan Materials", range: "A1:K18", scale: 1.2, format: "png" });
await fs.writeFile(`${outputDir}/production_plan_material_descriptions_preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
