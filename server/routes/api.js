import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import {
  getAllComponents,
  getComponentById as getComponent,
  upsertComponent,
  deleteComponent,
  getAllFgProducts,
  upsertFgProduct,
  deleteFgProduct,
  getAllProductionPlans,
  insertProductionPlans,
  clearProductionPlans,
  getProductionPlanById,
  deleteProductionPlan,
  updateProductionPlanPriorities,
  getAllProductionRuns,
  addProductionRun,
  getAllStockMovements,
  getRecentStockMovements,
  addStockMovement,
  clearAllData,
  addAuditLog,
  getRecentAuditLogs,
  getFgStockSnapshots,
  upsertFgStockSnapshot,
  deleteFgStockSnapshot,
  getWorkingDaysCalendar,
  saveWorkingDaysCalendar,
  getEmailRecipients,
  addEmailRecipient,
  updateEmailRecipient,
  deleteEmailRecipient,
  getEmailSettings,
  updateEmailSettings,
  getRecentEmailReportLogs,
} from "../utils/repository.js";
import { findSimilarFgProducts } from "../utils/similarity.js";
import {
  parseComponentsFlat,
  parseComponentsWorkbook,
} from "../utils/excel/parseComponents.js";
import { parseFgProductsFlat } from "../utils/excel/parseFgProducts.js";
import { parseFgStockWorkbook } from "../utils/excel/parseFgStock.js";
import { parseProductionPlanFlat } from "../utils/excel/parseProductionPlan.js";
import { parseStockUpdateFlat } from "../utils/excel/parseStockUpdate.js";
import {
  buildProductionRequirementRows,
  deductComponentStock,
  getDashboardMetrics,
  buildComponentMetrics,
  buildShortageReports,
  buildFgMonitoringTrend,
} from "../utils/calculations.js";
import { getMonthKeyFromDate, getWorkingDaysForMonthKey } from "../utils/workingDays.js";
import { sendRiskEmailNow } from "../utils/emailScheduler.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 },
});
const router = Router();

router.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    if (
      !["POST", "PUT", "DELETE"].includes(req.method) ||
      res.statusCode >= 400
    )
      return;
    const entity = req.path.split("/").filter(Boolean).slice(0, 2).join(" / ");
    const action =
      req.method === "DELETE"
        ? "Deleted"
        : req.path.includes("upload")
          ? "Uploaded"
          : req.path.includes("confirm") || req.path.includes("production-runs")
            ? "Confirmed"
            : req.method === "PUT"  
              ? "Updated"
              : "Created / updated";
    addAuditLog({
      actor: req.get("X-INEL-User") || "system",
      role: req.get("X-INEL-Role") || "",
      action,
      entity,
      detail: `${req.method} ${req.path} · ${Date.now() - startedAt}ms`,
    });
  });
  next();
});

function confirmPendingPlans(plans) {
  const fgProducts = getAllFgProducts();
  let components = getAllComponents();
  const confirmedRuns = [];
  const confirmedPlanIds = [];
  const errors = [];
  let movementCount = 0;

  plans.forEach((plan) => {
    const fg = fgProducts.find((item) => item.partNo === plan.fgPartNo);
    if (!fg) {
      errors.push(`Unknown FG: ${plan.fgPartNo}`);
      return;
    }

    const rows = buildProductionRequirementRows(fg, plan.qty, components);
    const transactionId = `PROD-${crypto.randomUUID()}`;
    const updated = deductComponentStock(components, rows);
    const affectedIds = new Set(rows.map((row) => row.componentId));
    updated
      .filter((component) => affectedIds.has(component.id))
      .forEach((component) => upsertComponent(component));

    rows.forEach((row) => {
      const beforeStock = Number(row.stock || 0);
      const afterStock = Math.max(0, beforeStock - Number(row.required || 0));
      addStockMovement({
        id: crypto.randomUUID(),
        transactionId,
        type: "CONSUMPTION",
        componentId: row.componentId,
        componentDesc: row.compDesc || "",
        qty: row.required,
        beforeStock,
        afterStock,
        bucket: "PRODUCTION",
        receiptDate:
          plan.productionDate || new Date().toISOString().slice(0, 10),
        remarks: `Consumed for ${fg.partNo} - ${fg.name}, qty ${plan.qty}`,
      });
      movementCount += 1;
    });

    const run = addProductionRun({
      partNo: fg.partNo,
      name: fg.name,
      qty: plan.qty,
      date: plan.productionDate || new Date().toISOString(),
      bomId: plan.bomId || "",
      bomName: plan.bomName || "",
      bomDescription: plan.bomDescription || "",
      items: rows,
    });
    confirmedRuns.push(run);
    if (plan.id !== undefined && plan.id !== null) {
      confirmedPlanIds.push(plan.id);
    }
    components = updated;
  });

  return { confirmedRuns, confirmedPlanIds, errors, movementCount };
}

router.get("/health", (_req, res) => res.json({ ok: true }));

router.delete("/admin/all-data", (_req, res) => {
  clearAllData();
  res.json({
    ok: true,
    message: "All demo data deleted",
    counts: {
      components: getAllComponents().length,
      fgProducts: getAllFgProducts().length,
      fgBomItems: 0,
      fgMonthlyPlans: 0,
      productionPlans: getAllProductionPlans().length,
      productionRuns: getAllProductionRuns().length,
      productionRunItems: 0,
      stockMovements: getAllStockMovements().length,
    },
  });
});

router.get("/components", (_req, res) => res.json(getAllComponents()));
router.post("/components", (req, res) => {
  upsertComponent(req.body);
  res.json(getAllComponents());
});
router.put("/components/:id", (req, res) => {
  upsertComponent({ ...req.body, id: req.params.id });
  res.json(getComponent(req.params.id));
});
router.delete("/components/:id", (req, res) => {
  deleteComponent(req.params.id);
  res.json({ ok: true });
});

router.post("/uploads/components", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const parsed =
    req.query.mode === "workbook"
      ? parseComponentsWorkbook(req.file.buffer)
      : parseComponentsFlat(req.file.buffer);
  const warnings = [];
  parsed.items.forEach((item) => upsertComponent(item));
  res.json({
    imported: parsed.items.length,
    errors: parsed.errors,
    warnings,
    components: getAllComponents(),
  });
});

router.get("/fg-products", (_req, res) => res.json(getAllFgProducts()));
router.post("/fg-products", (req, res) => {
  upsertFgProduct(req.body, true);
  res.json(getAllFgProducts());
});
router.delete("/fg-products/:partNo", (req, res) => {
  deleteFgProduct(req.params.partNo);
  res.json({ ok: true });
});
router.get("/fg-stock-monitoring", (_req, res) => res.json(getFgStockSnapshots()));
router.get("/working-days", (_req, res) => res.json(getWorkingDaysCalendar()));
router.put("/working-days", (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const errors = [];
  const valid = entries.filter((entry) => {
    const monthKey = String(entry.monthKey || "");
    const days = Number(entry.workingDays);
    if (!/^\w{3}\s\d{4}$/.test(monthKey) || !Number.isInteger(days) || days < 1 || days > 31) {
      errors.push(`Invalid working-days entry: ${monthKey || "missing month"}`);
      return false;
    }
    return true;
  });
  if (errors.length) return res.status(400).json({ error: errors[0] });
  res.json(saveWorkingDaysCalendar(valid));
});

router.post("/uploads/fg-products", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const {
    fgMap,
    errors,
    skippedDuplicates = 0,
    skippedPlaceholders = 0,
  } = parseFgProductsFlat(req.file.buffer);
  const existing = getAllFgProducts();
  const warnings = [],
    imported = [],
    skippedMaterials = [];
  for (const fg of fgMap.values()) {
    const missing = fg.items.filter((it) => !getComponent(it.componentId));
    if (missing.length) {
      skippedMaterials.push({
        fgPartNo: fg.partNo,
        materialIds: missing.map((item) => item.componentId),
      });
      fg.items = fg.items.filter((item) => getComponent(item.componentId));
    }
    const similar = findSimilarFgProducts(
      fg.name,
      existing.filter((e) => e.partNo !== fg.partNo),
    );
    if (similar.length)
      warnings.push({
        partNo: fg.partNo,
        name: fg.name,
        similarTo: similar[0],
      });
    upsertFgProduct(fg, true);
    imported.push(fg.partNo);
  }
  res.json({
    imported: imported.length,
    errors,
    warnings,
    skippedDuplicates,
    skippedPlaceholders,
    skippedMaterials,
    fgProducts: getAllFgProducts(),
  });
});

router.post("/uploads/fg-stock-monitoring", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const { records, errors } = parseFgStockWorkbook(req.file.buffer);
  const known = new Map(getAllFgProducts().map((fg) => [fg.partNo, fg]));
  const unknownParts = [];
  records.forEach((record) => {
    const existing = known.get(record.partNo);
    if (!existing) return void unknownParts.push(record.partNo);
    const updated = {
      ...existing,
      name: record.name || existing.name,
      customer: record.customer || existing.customer,
      customerCategory: record.customerCategory || existing.customerCategory,
      productGroup: record.productGroup || existing.productGroup,
      fgCategory: record.fgCategory || existing.fgCategory,
      stockNormDays: record.stockNormDays || existing.stockNormDays,
      totalStock: record.totalStock,
      monthlyPlan: record.monthKey ? { ...existing.monthlyPlan, [record.monthKey]: record.monthPlanQty } : existing.monthlyPlan,
    };
    upsertFgProduct(updated, false);
    upsertFgStockSnapshot(record);  
  });
  res.json({ imported: records.length - unknownParts.length, errors, unknownParts: [...new Set(unknownParts)] });
});

router.get("/production-plans", (_req, res) =>
  res.json(getAllProductionPlans()),
);
router.post("/uploads/production-plan", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const { items, errors } = parseProductionPlanFlat(req.file.buffer);
  const components = getAllComponents();
  const fgProducts = getAllFgProducts();
  const preview = [];
  const validPlans = [];
  const unmappedFgMap = new Map();
  const skippedFgMap = new Map();
  let unknownFgRows = 0;
  items.forEach((plan) => {
    const fg = fgProducts.find((f) => f.partNo === plan.fgPartNo);
    if (!fg) {
      unknownFgRows += 1;
      errors.push(`Unknown FG: ${plan.fgPartNo}`);
      const current = skippedFgMap.get(plan.fgPartNo) || {
        partNo: plan.fgPartNo,
        name: plan.fgName || "",
        dates: new Set(),
        planRows: 0,
      };
      current.dates.add(plan.productionDate);
      current.planRows += 1;
      skippedFgMap.set(plan.fgPartNo, current);
      return;
    }
    if (!Array.isArray(fg.items) || fg.items.length === 0) {
      const current = unmappedFgMap.get(fg.partNo) || {
        partNo: fg.partNo,
        name: fg.name || "",
        dates: new Set(),
        planRows: 0,
      };
      current.dates.add(plan.productionDate);
      current.planRows += 1;
      unmappedFgMap.set(fg.partNo, current);
      return;
    }
    validPlans.push(plan);
    const rows = buildProductionRequirementRows(fg, plan.qty, components).map(
      (r) => ({
        ...r,
        productionDate: plan.productionDate,
        fgPartNo: plan.fgPartNo,
        fgName: fg.name,
      }),
    );
    preview.push(...rows);
  });
  res.json({
    plans: validPlans,
    preview,
    errors,
    skipped: unknownFgRows,
    skippedFgs: [...skippedFgMap.values()].map((fg) => ({
      ...fg,
      dates: [...fg.dates].sort(),
    })),
    unmappedFgs: [...unmappedFgMap.values()].map((fg) => ({
      ...fg,
      dates: [...fg.dates].sort(),
    })),
    fgMasterCount: fgProducts.length,
  });
});

router.post("/production-plans/confirm", (req, res) => {
  const input = req.body.plans || [];
  const fgById = new Map(
    getAllFgProducts().map((fg) => [fg.partNo, fg]),
  );
  const validInput = input.filter((plan) => {
    const fg = fgById.get(plan.fgPartNo);
    return fg && Array.isArray(fg.items) && fg.items.length > 0;
  });
  const skipped = input
    .filter((plan) => !fgById.has(plan.fgPartNo))
    .map((plan) => plan.fgPartNo);
  const skippedUnmapped = input
    .filter((plan) => {
      const fg = fgById.get(plan.fgPartNo);
      return fg && (!Array.isArray(fg.items) || fg.items.length === 0);
    })
    .map((plan) => plan.fgPartNo);
  const fallbackBomId = `BOM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const plans = validInput.map((plan) => ({
    ...plan,
    bomId: String(plan.bomId || fallbackBomId),
    fgDescription: String(plan.fgDescription || "").trim(),
    bomName: String(plan.bomName || "").trim(),
    bomDescription: String(plan.bomDescription || "").trim(),
  }));
  if (plans.length) insertProductionPlans(plans);
  res.json({
    ok: true,
    imported: plans.length,
    skipped,
    skippedUnmapped,
    productionPlans: getAllProductionPlans(),
  });
});

router.put("/production-plans/priorities", (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!ids.length) {
    return res.status(400).json({ error: "At least one plan ID is required" });
  }
  res.json({
    ok: true,
    productionPlans: updateProductionPlanPriorities(ids),
  });
});

router.post("/production-plans/confirm-production", (req, res) => {
  const plans = getAllProductionPlans();
  const requestedIds = Array.isArray(req.body?.ids)
    ? req.body.ids.map(Number)
    : [];
  const planById = new Map(plans.map((plan) => [Number(plan.id), plan]));
  const orderedPlans = requestedIds.length
    ? [
        ...requestedIds.map((id) => planById.get(id)).filter(Boolean),
        ...plans.filter((plan) => !requestedIds.includes(Number(plan.id))),
      ]
    : plans;
  const { confirmedRuns, confirmedPlanIds, errors, movementCount } =
    confirmPendingPlans(orderedPlans);

  confirmedPlanIds.forEach(deleteProductionPlan);

  res.json({
    ok: true,
    confirmed: confirmedRuns.length,
    movementCount,
    errors,
    runs: getAllProductionRuns(),
    components: getAllComponents(),
    productionPlans: getAllProductionPlans(),
    stockMovements: getAllStockMovements(),
  });
});

router.post("/production-plans/:id/confirm-production", (req, res) => {
  const plan = getProductionPlanById(req.params.id);
  if (!plan)
    return res.status(404).json({ error: "Production plan not found" });
  const priorityPlan = getAllProductionPlans()[0];
  if (priorityPlan && Number(priorityPlan.id) !== Number(plan.id)) {
    return res.status(409).json({
      error: `BOM priority is ${priorityPlan.fgPartNo} on ${priorityPlan.productionDate}. Confirm or remove that dated BOM first.`,
      priorityPlan,
    });
  }
  const { confirmedRuns, errors, movementCount } = confirmPendingPlans([plan]);
  if (confirmedRuns.length > 0) deleteProductionPlan(plan.id);
  res.json({
    ok: true,
    confirmed: confirmedRuns.length,
    movementCount,
    errors,
    runs: getAllProductionRuns(),
    components: getAllComponents(),
    productionPlans: getAllProductionPlans(),
    stockMovements: getAllStockMovements(),
  });
});

router.delete("/production-plans/:id", (req, res) => {
  const plan = getProductionPlanById(req.params.id);
  if (!plan)
    return res.status(404).json({ error: "Production plan not found" });
  deleteProductionPlan(plan.id);
  res.json({ ok: true, productionPlans: getAllProductionPlans() });
});

router.delete("/production-plans", (_req, res) => {
  clearProductionPlans();
  res.json({ ok: true, productionPlans: [] });
});

router.get("/production-runs", (_req, res) => res.json(getAllProductionRuns()));
router.post("/production-runs", (req, res) => {
  const { fg, qty, rows } = req.body;
  const transactionId = `PROD-${crypto.randomUUID()}`;
  const updated = deductComponentStock(getAllComponents(), rows);
  const affectedIds = new Set(rows.map((row) => row.componentId));
  updated
    .filter((component) => affectedIds.has(component.id))
    .forEach((component) => upsertComponent(component));
  rows.forEach((row) =>
    addStockMovement({
      id: crypto.randomUUID(),
      transactionId,
      type: "CONSUMPTION",
      componentId: row.componentId,
      componentDesc: row.compDesc || "",
      qty: row.required,
      bucket: "PRODUCTION",
      beforeStock: Number(row.stock || 0),
      afterStock: Math.max(
        0,
        Number(row.stock || 0) - Number(row.required || 0),
      ),
      receiptDate: new Date().toISOString().slice(0, 10),
      remarks: `Consumed for ${fg.partNo} - ${fg.name}, qty ${qty}`,
    }),
  );
  const run = addProductionRun({
    partNo: fg.partNo,
    name: fg.name,
    qty,
    date: new Date().toISOString(),
    items: rows,
  });
  res.json({ run, components: getAllComponents() });
});

router.get("/stock/movements", (_req, res) => res.json(getAllStockMovements()));
router.post("/stock/inward", (req, res) => {
  const { componentId, qty, vendor, invoiceNo, receiptDate, remarks } =
    req.body;
  const updateMode = req.body.mode === "replace" ? "replace" : "add";
  const items =
    Array.isArray(req.body.items) && req.body.items.length
      ? req.body.items
      : [{ componentId, qty }];
  const transactionId = `GRN-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const receiptItems = [];
  items.forEach((item) => {
    const comp = getComponent(item.componentId);
    if (!comp) throw new Error(`Component not found: ${item.componentId}`);
    const itemQty = Number(item.qty || 0);
    const beforeStock = Number(comp.stock || 0);
    const afterStock =
      updateMode === "replace" ? itemQty : beforeStock + itemQty;
    upsertComponent({ ...comp, stock: afterStock });
    addStockMovement({
      id: crypto.randomUUID(),
      transactionId,
      type: updateMode === "replace" ? "STOCK_REPLACE" : "INWARD",
      componentId: item.componentId,
      componentDesc: comp.desc,
      qty: itemQty,
      beforeStock,
      afterStock,
      bucket: "Total stock",
      vendor: vendor || "",
      invoiceNo: invoiceNo || "",
      receiptDate: receiptDate || new Date().toISOString().slice(0, 10),
      remarks:
        remarks ||
        (updateMode === "replace"
          ? "Manual total stock replacement"
          : "Manual stock addition"),
    });
    receiptItems.push({
      componentId: item.componentId,
      componentDesc: comp.desc,
      qty: itemQty,
    });
  });
  res.json({
    transactionId,
    mode: updateMode,
    receiptItems,
    components: getAllComponents(),
    movements: getAllStockMovements(),
  });
});

router.post("/uploads/stock", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const { items, errors } = parseStockUpdateFlat(req.file.buffer);
  const notFound = [];
  let added = 0;
  let replaced = 0;
  let ibPendingUpdated = 0;
  const transactionId = `BULK-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  items.forEach((u) => {
    const existing = getComponent(u.id);
    if (!existing) {
      notFound.push(u.id);
      return;
    }
    const stockDelta = Number(u.stockDelta || 0);
    const stockValue = Number(u.stock);
    const hasStockValue = Number.isFinite(stockValue);
    const movementQty =
      stockDelta > 0 ? stockDelta : hasStockValue ? stockValue : 0;
    const beforeStock = Number(existing.stock || 0);
    const updated =
      stockDelta > 0
        ? { ...existing, ...u, stock: beforeStock + stockDelta }
        : { ...existing, ...u, stock: hasStockValue ? stockValue : beforeStock };
    if (stockDelta > 0) added += 1;
    else if (hasStockValue) replaced += 1;
    if (Object.hasOwn(u, "ibPending")) ibPendingUpdated += 1;
    upsertComponent(updated);
    if (stockDelta > 0 || hasStockValue) {
      addStockMovement({
        id: crypto.randomUUID(),
        transactionId,
        type: "BULK_UPDATE",
        componentId: u.id,
        componentDesc: existing.desc,
        qty: movementQty,
        beforeStock,
        afterStock: Number(updated.stock || 0),
        bucket: "Total stock",
        receiptDate: new Date().toISOString().slice(0, 10),
        remarks:
          stockDelta > 0
            ? "Bulk total stock added from sheet"
            : "Bulk total stock set from sheet",
      });
    }
  });
  res.json({
    updated: items.length - notFound.length,
    added,
    replaced,
    ibPendingUpdated,
    notFound,
    errors,
    components: getAllComponents(),
  });
});

router.get("/dashboard", (req, res) => {
  const monthKey =
    req.query.month ||
    getMonthKeyFromDate(new Date().toISOString().slice(0, 10));
  const components = getAllComponents();
  const fgProducts = getAllFgProducts();
  const productionRuns = getAllProductionRuns();
  const productionPlans = getAllProductionPlans();
  const fgStockSnapshots = getFgStockSnapshots();
  const metrics = getDashboardMetrics(
    components,
    fgProducts,
    productionRuns,
    productionPlans,
    monthKey,
  );
  const shortages = buildShortageReports(
    components,
    fgProducts,
    productionPlans,
  );
  const dashboardShortages = {
    daily: Object.fromEntries(
      Object.entries(shortages.daily).map(([date, rows]) => [
        date,
        rows.map(
          ({
            componentId,
            componentDesc,
            required,
            stock,
            shortage,
            fgPartNo,
            fgName,
          }) => ({
            componentId,
            componentDesc,
            required,
            stock,
            shortage,
            fgPartNo,
            fgName,
          }),
        ),
      ]),
    ),
    monthly: Object.fromEntries(
      Object.entries(shortages.monthly).map(([month, rows]) => [
        month,
        rows.map(
          ({
            componentId,
            componentDesc,
            required,
            stock,
            openingStock,
            closingStock,
            shortage,
          }) => ({
            componentId,
            componentDesc,
            required,
            stock,
            openingStock,
            closingStock,
            shortage,
          }),
        ),
      ]),
    ),
    dailySummary: shortages.dailySummary,
    monthlySummary: shortages.monthlySummary,
  };
  const expiringSoon = components.filter((component) => {
    const eta = component.eta ? new Date(component.eta) : null;
    if (!eta || Number.isNaN(eta.getTime())) return false;
    const days = (eta.getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;
  const fgMonitoringTrend = buildFgMonitoringTrend(fgStockSnapshots, fgProducts);
  res.json({
    ...metrics,
    workingDays: getWorkingDaysForMonthKey(monthKey),
    componentRows: metrics.componentRows.map(
      ({ id, desc, coverageDays, monthlyDemand, totalStock }) => ({
        id,
        desc,
        coverageDays,
        monthlyDemand,
        totalStock,
      }),
    ),
    shortages: dashboardShortages,
    recentMovements: getRecentStockMovements(8),
    auditLogs: getRecentAuditLogs(30),
    pendingBomItems: productionPlans.length,
    expiringSoon,
    fgMonitoringTrend,
  });
});

router.get("/reports", (req, res) => {
  const monthKey =
    req.query.month ||
    getMonthKeyFromDate(new Date().toISOString().slice(0, 10));
  const components = getAllComponents();
  const fgProducts = getAllFgProducts();
  const productionRuns = getAllProductionRuns();
  if (req.query.scope === "audit") {
    return res.json({
      productionRuns,
      stockMovements: getAllStockMovements(),
    });
  }
  const productionPlans = getAllProductionPlans();
  let rows = buildComponentMetrics(
    components,
    fgProducts,
    productionRuns,
    productionPlans,
    monthKey,
  );
  if (req.query.risk) rows = rows.filter((r) => r.risk === req.query.risk);
  if (req.query.buyer)
    rows = rows.filter((r) =>
      r.buyer?.toLowerCase().includes(req.query.buyer.toLowerCase()),
    );
  if (req.query.category)
    rows = rows.filter((r) => r.cat === req.query.category);
  if (req.query.componentId)
    rows = rows.filter((r) => r.id === req.query.componentId);
  if (req.query.fg) {
    rows = rows.filter((r) => r.usedIn?.some((u) => u.partNo === req.query.fg));
  }
  const shortages = buildShortageReports(
    components,
    fgProducts,
    productionPlans,
    productionRuns,
  );

// router. get =("/reports/sumk")

  const allMetrics = getDashboardMetrics(
    components,
    fgProducts,
    productionRuns,
    productionPlans,
    monthKey,
  );
  res.json({
    monthKey,
    rows,
    shortages,
    productionPlans,
    productionRuns,
    stockMovements: getAllStockMovements(),
    summary: allMetrics,
  });
});

router.post("/reports/email-now", async (_req, res) => {
  try {
    const result = await sendRiskEmailNow();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/email/recipients", (_req, res) => {
  res.json(getEmailRecipients());
});

router.post("/email/recipients", (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        error: "Name and email are required.",
      });
    }

    const recipient = addEmailRecipient({
      name,
      email,
      role,
    });

    res.status(201).json(recipient);
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
});

router.put("/email/recipients/:id", (req, res) => {
  try {
    const recipient = updateEmailRecipient(
      Number(req.params.id),
      req.body,
    );

    res.json(recipient);
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
});

router.delete("/email/recipients/:id", (req, res) => {
  try {
    deleteEmailRecipient(Number(req.params.id));

    res.json({
      ok: true,
    });
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
});

router.get("/email/settings", (_req, res) => {
  res.json(getEmailSettings());
});

router.put("/email/settings", (req, res) => {
  try {
    const settings = updateEmailSettings(req.body);

    res.json(settings);
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
});

router.get("/email/logs", (req, res) => {
  const limit = Number(req.query.limit) || 30;

  res.json(getRecentEmailReportLogs(limit));
});

export default router;
