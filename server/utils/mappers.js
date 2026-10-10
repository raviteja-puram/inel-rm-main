export function rowToComponent(row) {
  if (!row) return null;
  return {
    id: row.id,
    desc: row.desc,
    componentType: row.component_type || "",
    oeExport: row.oe_export || "",
    materialDiscipline: row.material_discipline || "",
    cat: row.cat,
    productGroup: row.product_group || "",
    uom: row.uom,
    buyer: row.buyer,
    vendor: row.vendor || row.supplier || "",
    vendorCode: row.vendor_code || "",
    mpn: row.mpn,
    make: row.make,
    spq: row.spq,
    moq: row.moq,
    leadTimeWeeks: row.lead_time_weeks,
    rate: row.rate,
    openBalance: row.open_balance,
    storeStockMm01: row.store_stock_mm01,
    inspectionStock: row.inspection_stock,
    storeStockMm10: row.store_stock_mm10,
    wipStock: row.wip_stock,
    qr01Stock: row.qr01_stock,
    ibPending: row.ib_pending,
    inwardQty: row.inward_qty,
    eta: row.eta,
    stock: row.stock,
  };
}

export function componentToRow(c) {
  return {
    id: String(c.id || "").trim(),
    desc: String(c.desc || "").trim(),
    component_type: String(c.componentType || "").trim(),
    oe_export: String(c.oeExport || "").trim(),
    material_discipline: String(c.materialDiscipline || "").trim(),
    cat: String(c.cat || "").trim(),
    product_group: String(c.productGroup || "").trim(),
    uom: String(c.uom || "").trim(),
    buyer: String(c.buyer || "").trim(),
    // Keep supplier populated for old database snapshots and upload files.
    supplier: String(c.vendor ?? c.supplier ?? "").trim(),
    vendor: String(c.vendor ?? c.supplier ?? "").trim(),
    vendor_code: String(c.vendorCode || "").trim(),
    mpn: String(c.mpn || "").trim(),
    make: String(c.make || "").trim(),
    spq: Number(c.spq) || 0,
    moq: Number(c.moq) || 0,
    lead_time_weeks: Number(c.leadTimeWeeks) || 0,
    rate: Number(c.rate) || 0,
    open_balance: Number(c.openBalance) || 0,
    store_stock_mm01: Number(c.storeStockMm01) || 0,
    inspection_stock: Number(c.inspectionStock) || 0,
    store_stock_mm10: Number(c.storeStockMm10) || 0,
    wip_stock: Number(c.wipStock) || 0,
    qr01_stock: Number(c.qr01Stock) || 0,
    ib_pending: Number(c.ibPending) || 0,
    inward_qty: Number(c.inwardQty) || 0,
    eta: String(c.eta || "").trim(),
    stock: Number(c.stock) || 0,
  };
}

export function rowToFgProduct(row, bomItems = [], monthlyPlans = []) {
  if (!row) return null;
  const monthlyPlan = {};
  monthlyPlans.forEach((p) => {
    monthlyPlan[p.month_key] = p.qty;
  });
  return {
    partNo: row.part_no,
    name: row.name,
    desc: row.desc,
    buyer: row.buyer,
    customer: row.customer,
    marketSegment: row.market_segment,
    productGroup: row.product_group || "",
    productType: row.product_type || "",
    customerCategory: row.customer_category || "",
    stockNormDays: Number(row.stock_norm_days) || 0,
    totalStock: Number(row.total_stock) || 0,
    fgCategory: row.fg_category || "",
    items: bomItems.map((b) => ({
      componentId: b.component_id,
      desc: b.component_desc || "",
      norms: b.norms,
    })),
    monthlyPlan,
  };
}

export function fgProductToRow(fg) {
  return {
    part_no: String(fg.partNo || "").trim(),
    name: String(fg.name || "").trim(),
    desc: String(fg.desc || "").trim(),
    buyer: String(fg.buyer || "").trim(),
    customer: String(fg.customer || "").trim(),
    market_segment: String(fg.marketSegment || "").trim(),
    product_group: String(fg.productGroup || "").trim(),
    product_type: String(fg.productType || "").trim(),
    customer_category: String(fg.customerCategory || "").trim(),
    stock_norm_days: Number(fg.stockNormDays) || 0,
    total_stock: Number(fg.totalStock) || 0,
    fg_category: String(fg.fgCategory || "").trim(),
  };
}

export function rowToProductionRun(row, items = []) {
  return {
    id: row.id,
    partNo: row.fg_part_no,
    name: row.fg_name,
    qty: row.qty,
    date: row.run_date,
    bomId: row.bom_id || "",
    bomName: row.bom_name || "",
    bomDescription: row.bom_description || "",
    items: items.map((i) => ({
      componentId: i.component_id,
      componentDesc: i.component_desc || "",
      componentUom: i.component_uom || "",
      norms: i.norms,
      required: i.required,
      stock: i.stock_before,
    })),
  };
}

export function rowToStockMovement(row) {
  return {
    id: row.id,
    transactionId: row.transaction_id || "",
    type: row.type,
    componentId: row.component_id,
    componentDesc: row.component_desc,
    qty: row.qty,
    beforeStock: row.before_stock,
    afterStock: row.after_stock,
    bucket: row.bucket,
    vendor: row.vendor,
    invoiceNo: row.invoice_no,
    receiptDate: row.receipt_date,
    remarks: row.remarks,
    createdAt: row.created_at,
  };
}

export function rowToProductionPlan(row) {
  return {
    id: row.id,
    fgPartNo: row.fg_part_no,
    fgDescription: row.fg_description || "",
    qty: row.qty,
    productionDate: row.production_date,
    bomId: row.bom_id || "",
    bomName: row.bom_name || "",
    bomDescription: row.bom_description || "",
    priorityOrder: Number(row.priority_order || 0),
  };
}
