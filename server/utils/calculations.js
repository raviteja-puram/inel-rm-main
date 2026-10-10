import {
  getWorkingDaysForMonthKey,
  getMonthKeyFromDate,
  getIsoMonthKey,
} from "./workingDays.js";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Business rule: BOM norms for raw materials stocked in KG are entered in
// grams. All inventory calculations must compare like-for-like, in KG.
export function getBomNormUom(component = {}) {
  return String(component.uom || "").trim().toUpperCase() === "KG"
    ? "G"
    : String(component.uom || "").trim().toUpperCase();
}

export function getRequiredQuantity(productionQty, norms, component = {}) {
  const rawRequired = toNumber(productionQty) * toNumber(norms);
  return Math.round(
    getBomNormUom(component) === "G" ? rawRequired / 1000 : rawRequired,
  );
}

function getUniqueFgList(fgParts = []) {
  const seen = new Set();
  return fgParts.filter((fg) => {
    const key = `${fg.partNo}|${fg.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getComponentTotalStock(component = {}) {
  return toNumber(component.stock);
}

export function getComponentBalance(component, totalRequirement) {
  return (
    getComponentTotalStock(component) +
    toNumber(component.inwardQty) +
    toNumber(component.ibPending) -
    toNumber(totalRequirement)
  );
}

export function getStockStatus(required, available) {
  const req = toNumber(required),
    stock = toNumber(available);
  if (req > 0 && stock <= 0) return "critical";
  if (req > 0 && stock < req) return "high";
  return "safe";
}

export function getRiskFromCoverage(days) {
  return days === "" || days === null || days === undefined ? null : "safe";
}

export function getCombinedRisk(demand, stock) {
  return getStockStatus(demand, stock);
}

export function getComponentUsedIn(componentId, fgProducts = []) {
  return fgProducts
    .filter((fg) =>
      (fg.items || []).some((item) => item.componentId === componentId),
    )
    .map((fg) => ({ partNo: fg.partNo, name: fg.name, buyer: fg.buyer }));
}

export function getComponentTotalRequirement(componentId, productionRuns = []) {
  return productionRuns.reduce(
    (total, run) =>
      total +
      (run.items || []).reduce(
        (sum, item) =>
          item.componentId === componentId
            ? sum + toNumber(item.required)
            : sum,
        0,
      ),
    0,
  );
}

export function getPlannedComponentRequirement(
  componentId,
  fgProducts = [],
  component = {},
) {
  return fgProducts.reduce((total, fg) => {
    const bomItem = (fg.items || []).find(
      (item) => item.componentId === componentId,
    );
    if (!bomItem) return total;
    const fgPlanQty = Object.values(fg.monthlyPlan || {}).reduce(
      (sum, qty) => sum + toNumber(qty),
      0,
    );
    return total + getRequiredQuantity(fgPlanQty, bomItem.norms, component);
  }, 0);
}

export function getProductionPlanRequirement(
  componentId,
  fgProducts = [],
  productionPlans = [],
  monthKey = null,
  component = {},
) {
  return productionPlans.reduce((total, plan) => {
    const fg = fgProducts.find((f) => f.partNo === plan.fgPartNo);
    if (!fg) return total;
    if (monthKey) {
      const planMonth = getMonthKeyFromDate(plan.productionDate);
      if (planMonth !== monthKey) return total;
    }
    const bomItem = (fg.items || []).find(
      (item) => item.componentId === componentId,
    );
    if (!bomItem) return total;
    return total + getRequiredQuantity(plan.qty, bomItem.norms, component);
  }, 0);
}

export function getMonthlyComponentPlan(
  componentId,
  fgProducts = [],
  component = {},
) {
  return fgProducts.reduce((plan, fg) => {
    const bomItem = (fg.items || []).find(
      (item) => item.componentId === componentId,
    );
    if (!bomItem) return plan;
    Object.entries(fg.monthlyPlan || {}).forEach(([month, qty]) => {
      plan[month] =
        (plan[month] || 0) +
        getRequiredQuantity(qty, bomItem.norms, component);
    });
    return plan;
  }, {});
}

export function getMonthlyDemandForComponent(
  componentId,
  fgProducts,
  productionPlans,
  monthKey,
  component = {},
) {
  const fromMonthlyPlan =
    getMonthlyComponentPlan(componentId, fgProducts, component)[monthKey] || 0;
  const fromProdPlans = getProductionPlanRequirement(
    componentId,
    fgProducts,
    productionPlans,
    monthKey,
    component,
  );
  return Math.max(fromMonthlyPlan, fromProdPlans);
}

export function getCoverageDays(
  componentId,
  component,
  fgProducts,
  productionPlans,
  monthKey,
) {
  const totalStock = getComponentTotalStock(component);
  const monthlyDemand = getMonthlyDemandForComponent(
    componentId,
    fgProducts,
    productionPlans,
    monthKey,
    component,
  );
  if (monthlyDemand <= 0) return null;
  const workingDays = getWorkingDaysForMonthKey(monthKey);
  const dailyConsumption = monthlyDemand / workingDays;
  if (dailyConsumption <= 0) return null;
  return Math.round((totalStock / dailyConsumption) * 10) / 10;
}

export function buildProductionRequirementRows(
  fgProduct,
  productionQty,
  components = [],
) {
  const qty = toNumber(productionQty);
  if (!fgProduct || qty <= 0) return [];
  return (fgProduct.items || []).map((item) => {
    const component = components.find((c) => c.id === item.componentId);
    const rawRequired = qty * toNumber(item.norms);
    const required = getRequiredQuantity(qty, item.norms, component);
    const stock = getComponentTotalStock(component);
    const shortage = Math.round(Math.max(0, required - stock));
    return {
      ...item,
      compDesc: component?.desc || item.desc || "",
      componentUom: component?.uom || "",
      normUom: getBomNormUom(component),
      rawRequired,
      stock,
      required,
      shortage,
      status: getStockStatus(required, stock),
    };
  });
}

export function deductComponentStock(components = [], requirementRows = []) {
  const requiredByComponent = requirementRows.reduce((map, row) => {
    map.set(
      row.componentId,
      (map.get(row.componentId) || 0) + toNumber(row.required),
    );
    return map;
  }, new Map());
  return components.map((component) => {
    const required = requiredByComponent.get(component.id) || 0;
    if (!required) return component;
    return {
      ...component,
      stock: Math.max(0, toNumber(component.stock) - required),
    };
  });
}

export function buildComponentMetrics(
  components,
  fgProducts,
  productionRuns,
  productionPlans,
  monthKey,
) {
  const requestedIsoMonth = getIsoMonthKey(monthKey);
  const planMonths = productionPlans
    .map((plan) => getMonthKeyFromDate(plan.productionDate))
    .filter(Boolean);
  const effectiveMonthKey = monthKey || planMonths.sort().at(-1) || null;
  const effectiveIsoMonth = effectiveMonthKey
    ? getIsoMonthKey(effectiveMonthKey)
    : "";
  const confirmedByComponent = new Map();
  const plannedByComponent = new Map();
  const planBasedByComponent = new Map();
  const monthlyPlanByComponent = new Map();
  const productionPlanMonthByComponent = new Map();
  const usedInByComponent = new Map();
  const fgByPartNo = new Map(fgProducts.map((fg) => [fg.partNo, fg]));
  const componentById = new Map(components.map((component) => [component.id, component]));

  productionRuns.forEach((run) => {
    (run.items || []).forEach((item) => {
      confirmedByComponent.set(
        item.componentId,
        (confirmedByComponent.get(item.componentId) || 0) +
          toNumber(item.required),
      );
    });
  });

  fgProducts.forEach((fg) => {
    const totalPlanQty = Object.values(fg.monthlyPlan || {}).reduce(
      (sum, qty) => sum + toNumber(qty),
      0,
    );
    const selectedMonthQty = toNumber(
      fg.monthlyPlan?.[monthKey] ?? fg.monthlyPlan?.[requestedIsoMonth],
    );
    (fg.items || []).forEach((item) => {
      const componentId = item.componentId;
      const component = componentById.get(componentId);
      plannedByComponent.set(
        componentId,
        (plannedByComponent.get(componentId) || 0) +
          getRequiredQuantity(totalPlanQty, item.norms, component),
      );
      monthlyPlanByComponent.set(
        componentId,
        (monthlyPlanByComponent.get(componentId) || 0) +
          getRequiredQuantity(selectedMonthQty, item.norms, component),
      );
      const usedIn = usedInByComponent.get(componentId) || [];
      usedIn.push({ partNo: fg.partNo, name: fg.name, buyer: fg.buyer });
      usedInByComponent.set(componentId, usedIn);
    });
  });

  productionPlans.forEach((plan) => {
    const fg = fgByPartNo.get(plan.fgPartNo);
    if (!fg) return;
    const isSelectedMonth =
      effectiveMonthKey &&
      getMonthKeyFromDate(plan.productionDate) === effectiveMonthKey;
    (fg.items || []).forEach((item) => {
      const requirement = getRequiredQuantity(
        plan.qty,
        item.norms,
        componentById.get(item.componentId),
      );
      planBasedByComponent.set(
        item.componentId,
        (planBasedByComponent.get(item.componentId) || 0) + requirement,
      );
      if (isSelectedMonth) {
        productionPlanMonthByComponent.set(
          item.componentId,
          (productionPlanMonthByComponent.get(item.componentId) || 0) +
            requirement,
        );
      }
    });
  });

  const workingDays = getWorkingDaysForMonthKey(effectiveMonthKey);
  return components.map((component) => {
    const confirmedRequirement = confirmedByComponent.get(component.id) || 0;
    const plannedRequirement = plannedByComponent.get(component.id) || 0;
    const planBasedRequirement = planBasedByComponent.get(component.id) || 0;
    // Confirmed runs have already deducted their consumed quantity from stock.
    // Live risk and shortage must therefore use pending production plans only;
    // including confirmed demand here would count the same consumption twice.
    const demandRequirement = planBasedRequirement;
    const monthlyDemand = Math.max(
      monthlyPlanByComponent.get(component.id) || 0,
      productionPlanMonthByComponent.get(component.id) || 0,
    );
    const totalStock = getComponentTotalStock(component);
    const balance = getComponentBalance(component, demandRequirement);
    const dailyConsumption = monthlyDemand > 0 ? monthlyDemand / workingDays : 0;
    const coverageDays =
      dailyConsumption > 0
        ? Math.round((totalStock / dailyConsumption) * 10) / 10
        : null;
    const risk = getCombinedRisk(demandRequirement, totalStock, coverageDays);
    const shortage = Math.max(0, demandRequirement - totalStock);
    return {
      ...component,
      risk,
      usedIn: usedInByComponent.get(component.id) || [],
      totalRequirement: confirmedRequirement,
      plannedRequirement,
      planBasedRequirement,
      demandRequirement,
      monthlyDemand,
      totalStock,
      balance,
      coverageDays,
      dailyConsumption,
      shortage,
      isLowStock: demandRequirement > 0 && totalStock < demandRequirement,
      coverageMonth: effectiveIsoMonth || requestedIsoMonth,
    };
  });
}

export function buildFgMonitoringTrend(fgStockSnapshots = [], fgProducts = []) {
  const fgByPartNo = new Map(fgProducts.map((fg) => [fg.partNo, fg]));
  const fgTrendByDate = new Map();

  fgStockSnapshots.forEach((snapshot) => {
    const snapshotMonth = /^\d{4}-\d{2}$/.test(String(snapshot.monthKey || ""))
      ? getMonthKeyFromDate(`${snapshot.monthKey}-01`)
      : snapshot.monthKey || getMonthKeyFromDate(snapshot.monitorDate);
    const workingDays = getWorkingDaysForMonthKey(snapshotMonth);
    const monthPlanQty = Number(snapshot.monthPlanQty || 0);
    const adr = monthPlanQty > 0 && workingDays > 0
      ? Math.round(monthPlanQty / workingDays)
      : Number(snapshot.adr || 0);
    const coverageDays = adr > 0 ? Number(snapshot.totalStock || 0) / adr : 0;
    const category =
      String(fgByPartNo.get(snapshot.partNo)?.fgCategory || "Other").trim() ||
      "Other";
    const row = fgTrendByDate.get(snapshot.monitorDate) || {
      date: snapshot.monitorDate,
      critical: 0,
      lowStock: 0,
      safe: 0,
      excess: 0,
      actual: 0,
      target: 0,
      runner: 0,
      repeater: 0,
      stranger: 0,
      partNumbers: [],
      criticalPartNumbers: [],
      criticalFgs: [],
      lowStockPartNumbers: [],
      safePartNumbers: [],
      excessPartNumbers: [],
    };

    if (!row.partNumbers.includes(snapshot.partNo)) {
      row.partNumbers.push(snapshot.partNo);
    }

    if (coverageDays <= 1) {
      row.critical += 1;
      row.criticalPartNumbers.push(snapshot.partNo);
      const fg = fgByPartNo.get(snapshot.partNo);
      row.criticalFgs.push({
        partNo: snapshot.partNo,
        description: fg?.desc || fg?.name || "",
      });
    } else if (coverageDays <= 5) {
      row.lowStock += 1;
      row.lowStockPartNumbers.push(snapshot.partNo);
    } else if (coverageDays <= 10) {
      row.safe += 1;
      row.safePartNumbers.push(snapshot.partNo);
    } else {
      row.excess += 1;
      row.excessPartNumbers.push(snapshot.partNo);
    }

    row.actual += 1;
    if (category.toLowerCase() === "runner") row.runner += 1;
    else if (category.toLowerCase() === "repeater") row.repeater += 1;
    else if (category.toLowerCase() === "stranger") row.stranger += 1;

    fgTrendByDate.set(snapshot.monitorDate, row);
  });

  return [...fgTrendByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export function getDashboardMetrics(
  components,
  fgProducts,
  productionRuns,
  productionPlans = [],
  monthKey = null,
) {
  const mk =
    monthKey || getMonthKeyFromDate(new Date().toISOString().slice(0, 10));
  const componentRows = buildComponentMetrics(
    components,
    fgProducts,
    productionRuns,
    productionPlans,
    mk,
  );
  const byRisk = componentRows.reduce(
    (acc, c) => {
      if (acc[c.risk] !== undefined) acc[c.risk] += 1;
      return acc;
    },
    { critical: 0, high: 0, safe: 0 },
  );
  return {
    totalComponents: components.length,
    totalFgProducts: fgProducts.length,
    criticalComponents: byRisk.critical,
    lowStock: componentRows.filter((c) => c.isLowStock).length,
    safeComponents: byRisk.safe,
    riskDistribution: byRisk,
    componentRows,
    recentActivities: productionRuns.slice(-5).reverse(),
    monthKey: mk,
  };
}

export function buildShortageReports(
  components,
  fgProducts,
  productionPlans = [],
  productionRuns = [],
) {
  const daily = {};
  const componentById = new Map(
    components.map((component) => [component.id, component]),
  );
  const fgByPartNo = new Map(fgProducts.map((fg) => [fg.partNo, fg]));
  // Legacy/imported data can contain a plan even after that same production
  // has been confirmed as a run. Count it once, using the confirmed run's
  // captured stock position.
  const confirmedRunKeys = new Set(
    productionRuns.map(
      (run) =>
        `${run.partNo}|${String(run.date || "").slice(0, 10)}|${toNumber(run.qty)}`,
    ),
  );
  function addRequirement({
    date,
    fgPartNo,
    fgName,
    fgBuyer = "",
    componentId,
    norms,
    productionQty,
    required,
    stockOverride,
  }) {
    if (!date) return;
    if (!daily[date]) daily[date] = {};
    const comp = componentById.get(componentId);
    const key = componentId;
    if (!daily[date][key]) {
      const historicalStock = Number(stockOverride);
      const stock = Number.isFinite(historicalStock)
        ? historicalStock
        : getComponentTotalStock(comp);
      daily[date][key] = {
        date,
        fgPartNo: "",
        fgName: "",
        fgBuyer: "",
        componentId,
        componentDesc: comp?.desc || "",
        buyer: comp?.buyer || "",
        componentType: comp?.componentType || "",
        category: comp?.cat || "",
        required: 0,
        stock,
        shortage: 0,
        fgParts: [],
        fgUsages: [],
      };
    } else if (Number.isFinite(Number(stockOverride))) {
      // A confirmed run stores the stock immediately before consumption.
      // The highest before-stock value on that date represents its opening stock.
      daily[date][key].stock = Math.max(
        Number(daily[date][key].stock || 0),
        Number(stockOverride),
      );
    }
    daily[date][key].required += toNumber(required);
    daily[date][key].fgParts.push({
      partNo: fgPartNo,
      name: fgName,
      buyer: fgBuyer,
    });
    daily[date][key].fgUsages.push({
      partNo: fgPartNo,
      name: fgName,
      buyer: fgBuyer,
      norms: toNumber(norms),
      productionQty: toNumber(productionQty),
      required: toNumber(required),
    });
  }

  productionPlans.forEach((plan) => {
    const date = plan.productionDate?.slice(0, 10);
    const confirmedKey = `${plan.fgPartNo}|${date}|${toNumber(plan.qty)}`;
    if (confirmedRunKeys.has(confirmedKey)) return;
    const fg = fgByPartNo.get(plan.fgPartNo);
    if (!fg) return;
    (fg.items || []).forEach((item) => {
      addRequirement({
        date,
        fgPartNo: fg.partNo,
        fgName: fg.name,
        fgBuyer: fg.buyer,
        componentId: item.componentId,
        norms: item.norms,
        productionQty: plan.qty,
        required: getRequiredQuantity(
          plan.qty,
          item.norms,
          componentById.get(item.componentId),
        ),
      });
    });
  });

  productionRuns.forEach((run) => {
    const date = run.date?.slice(0, 10);
    (run.items || []).forEach((item) => {
      addRequirement({
        date,
        fgPartNo: run.partNo,
        fgName: run.name,
        componentId: item.componentId,
        norms: item.norms,
        productionQty: run.qty,
        // Recalculate historic runs from the stored norm so older records
        // created before the KG/gram rule are corrected too.
        required: getRequiredQuantity(
          run.qty,
          item.norms,
          componentById.get(item.componentId),
        ),
        stockOverride: item.stock,
      });
    });
  });
  const dailyRows = Object.fromEntries(
    Object.entries(daily).map(([date, byComponent]) => [
      date,
      Object.values(byComponent).map((row) => ({
        ...row,
        fgPartNo: getUniqueFgList(row.fgParts)
          .map((fg) => fg.partNo)
          .join(", "),
        fgName: getUniqueFgList(row.fgParts)
          .map((fg) => fg.name)
          .join(", "),
        fgBuyer: getUniqueFgList(row.fgParts)
          .map((fg) => fg.buyer)
          .filter(Boolean)
          .join(", "),
        fgList: getUniqueFgList(row.fgParts)
          .map((fg) => `${fg.partNo} - ${fg.name}`)
          .join("|"),
        fgBreakdown: row.fgUsages
          .map(
            (fg) =>
              `${fg.partNo} - ${fg.name}: ${fg.productionQty} x ${fg.norms} = ${fg.required}`,
          )
          .join(" | "),
        shortage: Math.max(0, row.required - row.stock),
      })),
    ]),
  );
  const monthly = {};
  const monthFirstDate = {};
  Object.entries(dailyRows)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .forEach(([date, rows]) => {
    const mk = getMonthKeyFromDate(date);
    if (!monthly[mk]) monthly[mk] = {};
    if (!monthFirstDate[mk] || date < monthFirstDate[mk]) {
      monthFirstDate[mk] = date;
    }
    rows.forEach((row) => {
      const key = row.componentId;
      if (!monthly[mk][key])
        monthly[mk][key] = {
          ...row,
          month: mk,
          required: 0,
          shortage: 0,
          fgParts: [],
          fgUsages: [],
        };
      monthly[mk][key].required += row.required;
      monthly[mk][key].fgParts.push(...(row.fgParts || []));
      monthly[mk][key].fgUsages.push(...(row.fgUsages || []));
    });
  });
  const remainingStock = new Map(
    components.map((component) => [
      component.id,
      getComponentTotalStock(component),
    ]),
  );
  const orderedMonths = Object.keys(monthly).sort((monthA, monthB) =>
    monthFirstDate[monthA].localeCompare(monthFirstDate[monthB]),
  );
  const monthlyRows = Object.fromEntries(
    orderedMonths.map((m) => {
      const v = monthly[m];
      return [
      m,
      Object.values(v).map((row) => ({
        ...(() => {
          const openingStock = remainingStock.get(row.componentId) || 0;
          const shortage = Math.max(0, row.required - openingStock);
          const closingStock = Math.max(0, openingStock - row.required);
          remainingStock.set(row.componentId, closingStock);
          return {
            ...row,
            stock: openingStock,
            openingStock,
            closingStock,
            fgPartNo: getUniqueFgList(row.fgParts)
              .map((fg) => fg.partNo)
              .join(", "),
            fgName: getUniqueFgList(row.fgParts)
              .map((fg) => fg.name)
              .join(", "),
            fgBuyer: getUniqueFgList(row.fgParts)
              .map((fg) => fg.buyer)
              .filter(Boolean)
              .join(", "),
            fgList: getUniqueFgList(row.fgParts)
              .map((fg) => `${fg.partNo} - ${fg.name}`)
              .join("|"),
            shortage,
          };
        })(),
      })),
    ];
    }),
  );
  const dailySummary = Object.entries(dailyRows)
    .map(([date, rows]) => ({
      date,
      shortage: rows.reduce((sum, row) => sum + row.shortage, 0),
      required: rows.reduce((sum, row) => sum + row.required, 0),
      components: rows.filter((row) => row.shortage > 0).length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthlySummary = Object.entries(monthlyRows)
    .map(([month, rows]) => ({
      month,
      shortage: rows.reduce((sum, row) => sum + row.shortage, 0),
      required: rows.reduce((sum, row) => sum + row.required, 0),
      components: rows.filter((row) => row.shortage > 0).length,
    }))
    .sort((a, b) =>
      monthFirstDate[a.month].localeCompare(monthFirstDate[b.month]),
    );
  return {
    daily: dailyRows,
    dailySummary,
    monthly: monthlyRows,
    monthlySummary,
  };
}
