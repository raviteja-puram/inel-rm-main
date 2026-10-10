import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "C:/Users/admin/Downloads/BOM - 12_09_2026.xlsx";
const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);
console.log((await workbook.inspect({ kind: "workbook,sheet,table", maxChars: 12000, tableMaxRows: 12, tableMaxCols: 24 })).ndjson);
for (const sheetName of ["BOM", "Sheet1"]) {
  try {
    const preview = await workbook.render({ sheetName, range: "A1:Z20", scale: 1, format: "png" });
    const fs = await import("node:fs/promises");
    await fs.writeFile(`C:/Durga/inel-rm-main/inel-rm-main/outputs/${sheetName}_input_preview.png`, new Uint8Array(await preview.arrayBuffer()));
    console.log(`rendered ${sheetName}`);
  } catch {}
}
