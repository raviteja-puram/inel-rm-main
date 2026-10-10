import test from "node:test";
import assert from "node:assert/strict";
import {
  buildComponentMetrics,
  buildProductionRequirementRows,
  buildShortageReports,
  buildFgMonitoringTrend,
  deductComponentStock,
} from "./calculations.js";
import { setWorkingDaysCalendar } from "./workingDays.js";

const components = [
  { id: "C1", desc: "Component 1", stock: 5, inwardQty: 0, ibPending: 0 },
  { id: "C2", desc: "Component 2", stock: 20, inwardQty: 0, ibPending: 0 },
];
const fgProducts = [
  {
    partNo: "FG1",
    name: "Finished Good 1",
    buyer: "Buyer",
    monthlyPlan: { "2026-08": 10 },
    items: [
      { componentId: "C1", norms: 2 },
      { componentId: "C2", norms: 1 },
    ],
  },
];

test("component metrics preserve pending-plan demand and monthly-plan coverage", () => {
  const rows = buildComponentMetrics(
    components,
    fgProducts,
    [],
    [{ fgPartNo: "FG1", qty: 3, productionDate: "2026-08-05" }],
    "2026-08",
  );
  const c1 = rows.find((row) => row.id === "C1");
  assert.equal(c1.plannedRequirement, 20);
  assert.equal(c1.planBasedRequirement, 6);
  assert.equal(c1.monthlyDemand, 20);
  assert.equal(c1.shortage, 1);
  assert.equal(c1.risk, "high");
  assert.deepEqual(c1.usedIn, [
    { partNo: "FG1", name: "Finished Good 1", buyer: "Buyer" },
  ]);
});

test("selected month is used instead of silently falling back to a different plan month", () => {
  setWorkingDaysCalendar([{ monthKey: "Nov 2026", workingDays: 5 }]);
  const rows = buildComponentMetrics(
    [{ id: "C1", desc: "Component 1", stock: 26000, inwardQty: 0, ibPending: 0 }],
    [{
      partNo: "FG1",
      name: "Finished Good 1",
      buyer: "Buyer",
      monthlyPlan: {},
      items: [{ componentId: "C1", norms: 1 }],
    }],
    [],
    [{ fgPartNo: "FG1", qty: 1000, productionDate: "2026-10-15" }],
    "Nov 2026",
  );
  const c1 = rows.find((row) => row.id === "C1");
  assert.equal(c1.monthlyDemand, 0);
  assert.equal(c1.coverageDays, null);
});

test("saved working days recalculate BOM daily demand and coverage for an existing plan", () => {
  const inputs = [
    { id: "C1", desc: "Component 1", stock: 50, inwardQty: 0, ibPending: 0 },
  ];
  const plans = [{ fgPartNo: "FG1", qty: 10, productionDate: "2026-08-05" }];

  setWorkingDaysCalendar([{ monthKey: "Aug 2026", workingDays: 20 }]);
  let row = buildComponentMetrics(inputs, fgProducts, [], plans, "Aug 2026")[0];
  assert.equal(row.monthlyDemand, 20);
  assert.equal(row.dailyConsumption, 1);
  assert.equal(row.coverageDays, 50);

  setWorkingDaysCalendar([{ monthKey: "Aug 2026", workingDays: 10 }]);
  row = buildComponentMetrics(inputs, fgProducts, [], plans, "Aug 2026")[0];
  assert.equal(row.monthlyDemand, 20);
  assert.equal(row.dailyConsumption, 2);
  assert.equal(row.coverageDays, 25);
});

test("stock deduction aggregates duplicate material requirements", () => {
  const updated = deductComponentStock(components, [
    { componentId: "C1", required: 2 },
    { componentId: "C1", required: 4 },
  ]);
  assert.equal(updated.find((row) => row.id === "C1").stock, 0);
  assert.equal(updated.find((row) => row.id === "C2").stock, 20);
});

test("KG-stocked materials convert gram BOM norms before shortage checks", () => {
  const kgComponent = { id: "WIRE", uom: "KG", stock: 369.126 };
  const rows = buildProductionRequirementRows(
    { items: [{ componentId: "WIRE", norms: 103.09 }] },
    1500,
    [kgComponent],
  );
  assert.equal(rows[0].normUom, "G");
  assert.equal(rows[0].required, 155);
  assert.equal(rows[0].shortage, 0);
  assert.equal(rows[0].status, "safe");
});

test("shortage reports use captured pre-production stock for confirmed runs", () => {
  const reports = buildShortageReports(components, fgProducts, [], [
    {
      partNo: "FG1",
      name: "Finished Good 1",
      qty: 4,
      date: "2026-08-05T10:00:00.000Z",
      items: [
        { componentId: "C1", norms: 2, required: 8, stock: 10 },
      ],
    },
  ]);
  assert.equal(reports.daily["2026-08-05"][0].stock, 10);
  assert.equal(reports.daily["2026-08-05"][0].shortage, 0);
});

test("shortage reports do not double-count a plan already confirmed as a run", () => {
  const reports = buildShortageReports(
    components,
    fgProducts,
    [{ fgPartNo: "FG1", qty: 4, productionDate: "2026-08-05" }],
    [
      {
        partNo: "FG1",
        name: "Finished Good 1",
        qty: 4,
        date: "2026-08-05T10:00:00.000Z",
        items: [{ componentId: "C1", norms: 2, required: 8, stock: 10 }],
      },
    ],
  );
  assert.equal(reports.daily["2026-08-05"][0].required, 8);
});

test("FG monitoring trend counts all coverage bands", () => {
  const trend = buildFgMonitoringTrend(
    [
      { monitorDate: "2026-08-01", partNo: "FG1", totalStock: 4, adr: 4 },
      { monitorDate: "2026-08-01", partNo: "FG2", totalStock: 8, adr: 2 },
      { monitorDate: "2026-08-01", partNo: "FG3", totalStock: 30, adr: 5 },
      { monitorDate: "2026-08-01", partNo: "FG4", totalStock: 120, adr: 5 },
    ],
    [
      { partNo: "FG1", fgCategory: "Runner" },
      { partNo: "FG2", fgCategory: "Repeater" },
      { partNo: "FG3", fgCategory: "Stranger" },
      { partNo: "FG4", fgCategory: "Other" },
    ],
  );

  assert.equal(trend.length, 1);
  assert.equal(trend[0].critical, 1);
  assert.equal(trend[0].lowStock, 1);
  assert.equal(trend[0].safe, 1);
  assert.equal(trend[0].excess, 1);
  assert.deepEqual(trend[0].criticalPartNumbers, ["FG1"]);
  assert.deepEqual(trend[0].criticalFgs, [
    { partNo: "FG1", description: "" },
  ]);
  assert.deepEqual(trend[0].lowStockPartNumbers, ["FG2"]);
});
