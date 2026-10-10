import db from "../db.js";
import {
  rowToComponent,
  componentToRow,
  rowToFgProduct,
  fgProductToRow,
  rowToProductionRun,
  rowToStockMovement,
  rowToProductionPlan,
} from "./mappers.js";
import { setWorkingDaysCalendar } from "./workingDays.js";

export function getAllComponents() {
  return db
    .prepare("SELECT * FROM components ORDER BY id")
    .all()
    .map(rowToComponent);
}

export function getComponentById(id) {
  return rowToComponent(
    db.prepare("SELECT * FROM components WHERE id = ?").get(id),
  );
}

export function upsertComponent(component) {
  const row = componentToRow(component);
  db.prepare(
    `INSERT INTO components (
    id, desc, component_type, oe_export, material_discipline, cat, product_group, uom, buyer, supplier, vendor, vendor_code, mpn, make, spq, moq, lead_time_weeks, rate,
    open_balance, store_stock_mm01, inspection_stock, store_stock_mm10, wip_stock,
    qr01_stock, ib_pending, inward_qty, eta, stock, updated_at
  ) VALUES (
    @id, @desc, @component_type, @oe_export, @material_discipline, @cat, @product_group, @uom, @buyer, @supplier, @vendor, @vendor_code, @mpn, @make, @spq, @moq, @lead_time_weeks, @rate,
    @open_balance, @store_stock_mm01, @inspection_stock, @store_stock_mm10, @wip_stock,
    @qr01_stock, @ib_pending, @inward_qty, @eta, @stock, datetime('now')
  ) ON CONFLICT(id) DO UPDATE SET
    desc=@desc, component_type=@component_type, oe_export=@oe_export, material_discipline=@material_discipline, cat=@cat, product_group=@product_group, uom=@uom, buyer=@buyer, supplier=@supplier, vendor=@vendor, vendor_code=@vendor_code, mpn=@mpn, make=@make,
    spq=@spq, moq=@moq, lead_time_weeks=@lead_time_weeks, rate=@rate, open_balance=@open_balance,
    store_stock_mm01=@store_stock_mm01, inspection_stock=@inspection_stock,
    store_stock_mm10=@store_stock_mm10, wip_stock=@wip_stock, qr01_stock=@qr01_stock,
    ib_pending=@ib_pending, inward_qty=@inward_qty, eta=@eta, stock=@stock, updated_at=datetime('now')`,
  ).run(row);
  return getComponentById(row.id);
}

export function deleteComponent(id) {
  db.prepare("DELETE FROM components WHERE id = ?").run(id);
}

export function getAllFgProducts() {
  const rows = db.prepare("SELECT * FROM fg_products ORDER BY part_no").all();
  if (rows.length === 0) {
    const runs = db
      .prepare("SELECT * FROM production_runs ORDER BY id DESC")
      .all();
    const latestByPart = new Map();
    runs.forEach((run) => {
      if (latestByPart.has(run.fg_part_no)) return;
      const items = db
        .prepare(
          `SELECT i.*, c.desc AS component_desc
        FROM production_run_items i LEFT JOIN components c ON c.id = i.component_id
        WHERE i.run_id = ?`,
        )
        .all(run.id);
      latestByPart.set(run.fg_part_no, {
        partNo: run.fg_part_no,
        name: run.fg_name || run.fg_part_no,
        // Older confirmed runs did not store a separate FG description.
        // Use the recorded FG name instead of exposing an internal recovery label.
        desc: run.fg_name || run.fg_part_no,
        buyer: "",
        customer: "",
        marketSegment: "",
        monthlyPlans: {},
        items: items.map((item) => ({
          componentId: item.component_id,
          componentDesc: item.component_desc || "",
          norms: Number(item.norms || 0),
        })),
        recovered: true,
      });
    });
    return [...latestByPart.values()].sort((a, b) =>
      a.partNo.localeCompare(b.partNo),
    );
  }
  return rows.map((row) => {
    const bom = db
      .prepare(
        `SELECT b.*, c.desc AS component_desc FROM fg_bom_items b
      LEFT JOIN components c ON c.id = b.component_id WHERE b.fg_part_no = ?`,
      )
      .all(row.part_no);
    const plans = db
      .prepare("SELECT * FROM fg_monthly_plans WHERE fg_part_no = ?")
      .all(row.part_no);
    return rowToFgProduct(row, bom, plans);
  });
}

export function getFgProductByPartNo(partNo) {
  const row = db
    .prepare("SELECT * FROM fg_products WHERE part_no = ?")
    .get(partNo);
  if (!row) return null;
  const bom = db
    .prepare(
      `SELECT b.*, c.desc AS component_desc FROM fg_bom_items b
    LEFT JOIN components c ON c.id = b.component_id WHERE b.fg_part_no = ?`,
    )
    .all(partNo);
  const plans = db
    .prepare("SELECT * FROM fg_monthly_plans WHERE fg_part_no = ?")
    .all(partNo);
  return rowToFgProduct(row, bom, plans);
}

export function upsertFgProduct(fg, replaceBom = true) {
  const row = fgProductToRow(fg);
  db.prepare(
    `INSERT INTO fg_products (part_no, name, desc, buyer, customer, market_segment, product_group, product_type, customer_category, stock_norm_days, total_stock, fg_category, updated_at)
    VALUES (@part_no, @name, @desc, @buyer, @customer, @market_segment, @product_group, @product_type, @customer_category, @stock_norm_days, @total_stock, @fg_category, datetime('now'))
    ON CONFLICT(part_no) DO UPDATE SET name=@name, desc=@desc, buyer=@buyer, customer=@customer,
    market_segment=@market_segment, product_group=@product_group, product_type=@product_type, customer_category=@customer_category, stock_norm_days=@stock_norm_days, total_stock=@total_stock, fg_category=@fg_category, updated_at=datetime('now')`,
  ).run(row);
  if (replaceBom && Array.isArray(fg.items)) {
    db.prepare("DELETE FROM fg_bom_items WHERE fg_part_no = ?").run(
      row.part_no,
    );
    const ins = db.prepare(
      "INSERT INTO fg_bom_items (fg_part_no, component_id, norms) VALUES (?, ?, ?)",
    );
    fg.items.forEach((item) =>
      ins.run(row.part_no, item.componentId, Number(item.norms) || 0),
    );
  }
  if (fg.monthlyPlan) {
    const insPlan =
      db.prepare(`INSERT INTO fg_monthly_plans (fg_part_no, month_key, qty) VALUES (?, ?, ?)
      ON CONFLICT(fg_part_no, month_key) DO UPDATE SET qty=excluded.qty`);
    Object.entries(fg.monthlyPlan).forEach(([month, qty]) =>
      insPlan.run(row.part_no, month, Number(qty) || 0),
    );
  }
  return getFgProductByPartNo(row.part_no);
}

export function deleteFgProduct(partNo) {
  db.prepare("DELETE FROM fg_products WHERE part_no = ?").run(partNo);
}

export function upsertFgStockSnapshot(snapshot) {
  db.prepare(
    `INSERT INTO fg_stock_snapshots (monitor_date, fg_part_no, month_key, month_plan_qty, adr, stock_norm_days, total_stock)
     VALUES (@monitorDate, @partNo, @monthKey, @monthPlanQty, @adr, @stockNormDays, @totalStock)
     ON CONFLICT(monitor_date, fg_part_no) DO UPDATE SET month_key=excluded.month_key,
     month_plan_qty=excluded.month_plan_qty, adr=excluded.adr, stock_norm_days=excluded.stock_norm_days, total_stock=excluded.total_stock`,
  ).run(snapshot);
}

export function deleteFgStockSnapshot(id) {
  db.prepare("DELETE FROM fg_stock_snapshots WHERE id = ?").run(id);
}

export function getFgStockSnapshots() {
  return db.prepare("SELECT * FROM fg_stock_snapshots ORDER BY monitor_date DESC, fg_part_no").all().map((row) => ({
    id: row.id,
    monitorDate: row.monitor_date,
    partNo: row.fg_part_no,
    monthKey: row.month_key || "",
    monthPlanQty: Number(row.month_plan_qty) || 0,
    adr: Number(row.adr) || 0,
    stockNormDays: Number(row.stock_norm_days) || 0,
    totalStock: Number(row.total_stock) || 0,
  }));
}

export function getWorkingDaysCalendar() {
  return db.prepare("SELECT month_key AS monthKey, working_days AS workingDays FROM working_days_calendar ORDER BY month_key").all();
}

export function saveWorkingDaysCalendar(entries) {
  const upsert = db.prepare(`INSERT INTO working_days_calendar (month_key, working_days, updated_at)
    VALUES (?, ?, datetime('now')) ON CONFLICT(month_key) DO UPDATE SET working_days=excluded.working_days, updated_at=datetime('now')`);
  const save = db.transaction((items) => items.forEach((entry) => upsert.run(entry.monthKey, entry.workingDays)));
  save(entries);
  const calendar = getWorkingDaysCalendar();
  setWorkingDaysCalendar(calendar);
  return calendar;
}

export function getAllProductionPlans() {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .prepare("SELECT * FROM production_plans ORDER BY production_date, id")
    .all()
    .map(rowToProductionPlan)
    .sort((a, b) => {
      const distanceA = Math.abs(
        new Date(`${a.productionDate}T00:00:00Z`) -
          new Date(`${today}T00:00:00Z`),
      );
      const distanceB = Math.abs(
        new Date(`${b.productionDate}T00:00:00Z`) -
          new Date(`${today}T00:00:00Z`),
      );
      if (distanceA !== distanceB) return distanceA - distanceB;
      const byDate = String(a.productionDate).localeCompare(
        String(b.productionDate),
      );
      if (byDate) return byDate;
      const orderA = Number(a.priorityOrder || 0);
      const orderB = Number(b.priorityOrder || 0);
      if (orderA && orderB && orderA !== orderB) return orderA - orderB;
      if (orderA && !orderB) return -1;
      if (!orderA && orderB) return 1;
      return Number(a.id) - Number(b.id);
    })
    .map((plan, index) => ({ ...plan, priorityRank: index + 1 }));
}

export function getProductionPlanById(id) {
  return rowToProductionPlan(
    db.prepare("SELECT * FROM production_plans WHERE id = ?").get(id),
  );
}

export function insertProductionPlans(plans) {
  const ins = db.prepare(
    `INSERT INTO production_plans
      (fg_part_no, fg_description, qty, production_date, bom_id, bom_name, bom_description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const findExisting = db.prepare(
    `SELECT id, qty FROM production_plans
     WHERE fg_part_no = ? AND production_date = ? AND bom_id = ?
     ORDER BY id LIMIT 1`,
  );
  const addQty = db.prepare(
    "UPDATE production_plans SET qty = ?, fg_description = COALESCE(NULLIF(?, ''), fg_description) WHERE id = ?",
  );
  const tx = db.transaction((rows) =>
    rows.forEach((p) => {
      const existing = findExisting.get(
        p.fgPartNo,
        p.productionDate,
        p.bomId || "",
      );
      if (existing) {
        addQty.run(
          Number(existing.qty || 0) + Number(p.qty || 0),
          p.fgDescription || "",
          existing.id,
        );
      } else {
        ins.run(
          p.fgPartNo,
          p.fgDescription || "",
          p.qty,
          p.productionDate,
          p.bomId || "",
          p.bomName || "",
          p.bomDescription || "",
        );
      }
    }),
  );
  tx(plans);
  return getAllProductionPlans();
}

export function clearProductionPlans() {
  db.prepare("DELETE FROM production_plans").run();
}

export function deleteProductionPlan(id) {
  db.prepare("DELETE FROM production_plans WHERE id = ?").run(id);
}

export function updateProductionPlanPriorities(ids) {
  const update = db.prepare(
    "UPDATE production_plans SET priority_order = ? WHERE id = ?",
  );
  const tx = db.transaction((orderedIds) => {
    orderedIds.forEach((id, index) => update.run(index + 1, Number(id)));
  });
  tx(ids);
  return getAllProductionPlans();
}

export function getAllProductionRuns() {
  const runs = db.prepare("SELECT * FROM production_runs ORDER BY id").all();
  return runs.map((row) => {
    const items = db
      .prepare(
        `SELECT i.*, c.desc AS component_desc, c.uom AS component_uom
      FROM production_run_items i LEFT JOIN components c ON c.id = i.component_id
      WHERE i.run_id = ?`,
      )
      .all(row.id);
    return rowToProductionRun(row, items);
  });
}

export function addProductionRun(run) {
  const result = db
    .prepare(
      `INSERT INTO production_runs
        (fg_part_no, fg_name, qty, run_date, bom_id, bom_name, bom_description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      run.partNo,
      run.name || "",
      run.qty,
      run.date || new Date().toISOString(),
      run.bomId || "",
      run.bomName || "",
      run.bomDescription || "",
    );
  const runId = result.lastInsertRowid;
  const insItem = db.prepare(
    "INSERT INTO production_run_items (run_id, component_id, norms, required, stock_before) VALUES (?, ?, ?, ?, ?)",
  );
  (run.items || []).forEach((item) =>
    insItem.run(
      runId,
      item.componentId,
      item.norms || 0,
      item.required || 0,
      Number.isFinite(Number(item.stock)) ? Number(item.stock) : null,
    ),
  );
  return rowToProductionRun(
    db.prepare("SELECT * FROM production_runs WHERE id = ?").get(runId),
    db
      .prepare(
        `SELECT i.*, c.desc AS component_desc, c.uom AS component_uom
      FROM production_run_items i LEFT JOIN components c ON c.id = i.component_id
      WHERE i.run_id = ?`,
      )
      .all(runId),
  );
}

export function getAllStockMovements() {
  return db
    .prepare("SELECT * FROM stock_movements ORDER BY created_at")
    .all()
    .map(rowToStockMovement);
}

export function getRecentStockMovements(limit = 8) {
  return db
    .prepare("SELECT * FROM stock_movements ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(Math.max(0, Number(limit) || 0))
    .map(rowToStockMovement);
}

export function addStockMovement(movement) {
  db.prepare(
    `INSERT INTO stock_movements (
    id, transaction_id, type, component_id, component_desc, qty, before_stock, after_stock,
    bucket, vendor, invoice_no, receipt_date, remarks
  ) VALUES (
    @id, @transactionId, @type, @componentId, @componentDesc, @qty, @beforeStock, @afterStock,
    @bucket, @vendor, @invoiceNo, @receiptDate, @remarks
  )`,
  ).run({
    id: movement.id,
    transactionId: movement.transactionId || movement.id,
    type: movement.type,
    componentId: movement.componentId,
    componentDesc: movement.componentDesc || "",
    qty: movement.qty || 0,
    bucket: movement.bucket || "",
    beforeStock: Number.isFinite(Number(movement.beforeStock))
      ? Number(movement.beforeStock)
      : null,
    afterStock: Number.isFinite(Number(movement.afterStock))
      ? Number(movement.afterStock)
      : null,
    vendor: movement.vendor || "",
    invoiceNo: movement.invoiceNo || "",
    receiptDate: movement.receiptDate || "",
    remarks: movement.remarks || "",
  });
  return movement;
}

export function bulkUpdateComponentStock(updates) {
  const tx = db.transaction((rows) => {
    rows.forEach((u) => {
      const existing = getComponentById(u.id);
      if (!existing) throw new Error(`Component not found: ${u.id}`);
      upsertComponent({ ...existing, ...u });
    });
  });
  tx(updates);
  return getAllComponents();
}

export function saveComponentsList(components) {
  const tx = db.transaction((rows) => rows.forEach((c) => upsertComponent(c)));
  tx(components);
  return getAllComponents();
}

export function clearAllData() {
  const tables = [
    "production_run_items",
    "production_runs",
    "stock_movements",
    "production_plans",
    "fg_monthly_plans",
    "fg_bom_items",
    "fg_products",
    "components",
  ];
  const tx = db.transaction(() => {
    db.exec("PRAGMA foreign_keys = OFF");
    tables.forEach((table) => db.prepare(`DELETE FROM ${table}`).run());
    db.prepare("DELETE FROM sqlite_sequence").run();
    db.exec("PRAGMA foreign_keys = ON");
  });
  tx();
  return { ok: true };
}

export function addAuditLog({ actor, role, action, entity, detail }) {
  db.prepare(
    "INSERT INTO audit_logs (actor, role, action, entity, detail) VALUES (?, ?, ?, ?, ?)",
  ).run(actor || "system", role || "", action, entity || "", detail || "");
}

export function getRecentAuditLogs(limit = 30) {
  return db
    .prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?")
    .all(Number(limit) || 30)
    .map((row) => ({
      id: row.id,
      actor: row.actor,
      role: row.role,
      action: row.action,
      entity: row.entity,
      detail: row.detail,
      createdAt: row.created_at,
    }));
}

export function getEmailRecipients() {
  return db
    .prepare(
      `SELECT *
       FROM email_recipients
       ORDER BY name`
    )
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role || "",
      enabled: Boolean(row.enabled),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}

export function addEmailRecipient({ name, email, role }) {
  const result = db
    .prepare(
      `INSERT INTO email_recipients
       (name, email, role)
       VALUES (?, ?, ?)`
    )
    .run(
      name,
      email,
      role || "",
    );

  return db
    .prepare("SELECT * FROM email_recipients WHERE id = ?")
    .get(result.lastInsertRowid);
}

export function updateEmailRecipient(id, { name, email, role, enabled }) {
  db.prepare(
    `UPDATE email_recipients
     SET name = ?,
         email = ?,
         role = ?,
         enabled = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name,
    email,
    role || "",
    enabled ? 1 : 0,
    id,
  );

  return db
    .prepare("SELECT * FROM email_recipients WHERE id = ?")
    .get(id);
}

export function deleteEmailRecipient(id) {
  db.prepare(
    "DELETE FROM email_recipients WHERE id = ?"
  ).run(id);
}

export function getEmailSettings() {
  let settings = db
    .prepare(
      "SELECT * FROM email_settings ORDER BY id LIMIT 1"
    )
    .get();

  // Create default settings if none exist.
  if (!settings) {
    const result = db
      .prepare(
        `INSERT INTO email_settings
         (enabled, send_time, report_type)
         VALUES (?, ?, ?)`
      )
      .run(1, "17:30", "daily_inventory");

    settings = db
      .prepare(
        "SELECT * FROM email_settings WHERE id = ?"
      )
      .get(result.lastInsertRowid);
  }

  return {
    id: settings.id,
    enabled: Boolean(settings.enabled),
    sendTime: settings.send_time,
    reportType: settings.report_type,
    updatedAt: settings.updated_at,
  };
}

export function updateEmailSettings({
  enabled,
  sendTime,
  reportType,
}) {
  const existing = getEmailSettings();

  db.prepare(
    `UPDATE email_settings
     SET enabled = ?,
         send_time = ?,
         report_type = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    enabled ? 1 : 0,
    sendTime || "17:30",
    reportType || "daily_inventory",
    existing.id,
  );

  return getEmailSettings();
}

export function createEmailReportLog({
  reportDate,
  sentAt,
  status,
  recipientCount,
  errorMessage,
}) {
  const result = db
    .prepare(
      `INSERT INTO email_report_logs
       (
         report_date,
         sent_at,
         status,
         recipient_count,
         error_message
       )
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      reportDate,
      sentAt || null,
      status,
      recipientCount || 0,
      errorMessage || null,
    );

  return db
    .prepare(
      "SELECT * FROM email_report_logs WHERE id = ?"
    )
    .get(result.lastInsertRowid);
}

export function getRecentEmailReportLogs(limit = 30) {
  return db
    .prepare(
      `SELECT *
       FROM email_report_logs
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(Number(limit) || 30)
    .map((row) => ({
      id: row.id,
      reportDate: row.report_date,
      sentAt: row.sent_at,
      status: row.status,
      recipientCount: row.recipient_count,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
}
export function hasSuccessfulEmailReport(reportDate) {
  const row = db
    .prepare(
      `SELECT 1
       FROM email_report_logs
       WHERE report_date = ?
         AND status = 'SENT'
       LIMIT 1`
    )
    .get(reportDate);

  return Boolean(row);
}
