import test from "node:test";
import assert from "node:assert/strict";
import { buildFgMissingItemsRows, buildMissingFgUploadRows } from "./exportUtils.js";

test("FG missing material export flattens per-FG material gaps into review rows", () => {
  const rows = buildFgMissingItemsRows([
    {
      fgPartNo: "FG-100",
      materialIds: ["MAT-A", "MAT-B", "MAT-A"],
    },
    {
      fgPartNo: "FG-200",
      materialIds: ["MAT-C"],
    },
  ]);

  assert.deepEqual(rows, [
    {
      "FG Part Number": "FG-100",
      "Missing Material ID": "MAT-A",
      "Reason": "Material not found in component master",
    },
    {
      "FG Part Number": "FG-100",
      "Missing Material ID": "MAT-B",
      "Reason": "Material not found in component master",
    },
    {
      "FG Part Number": "FG-200",
      "Missing Material ID": "MAT-C",
      "Reason": "Material not found in component master",
    },
  ]);
});

test("BOM upload preview export includes unknown FG errors even without a structured skip list", () => {
  const rows = buildMissingFgUploadRows({
    errors: ["Unknown FG: FG-300", "Unknown FG: FG-300"],
    unmappedFgs: [{ partNo: "FG-111", name: "Demo FG", dates: ["2026-08-05"], planRows: 2 }],
  });

  assert.deepEqual(rows, [
    {
      "FG Part Number": "FG-111",
      "FG Name": "Demo FG",
      "Production Dates": "2026-08-05",
      "Skipped Plan Rows": 2,
      "Reason": "No raw materials mapped",
    },
    {
      "FG Part Number": "FG-300",
      "FG Name": "",
      "Production Dates": "",
      "Skipped Plan Rows": 1,
      "Reason": "FG not found in FG master",
    },
  ]);
});
