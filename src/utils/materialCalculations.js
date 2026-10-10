function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundQuantity(value) {
  return Math.round(toNumber(value));
}

export function getBomNormUom(component = {}) {
  return String(component.uom || '').trim().toUpperCase() === 'KG'
    ? 'G'
    : String(component.uom || '').trim().toUpperCase();
}

export function getRequiredQuantity(productionQty, norms, component = {}) {
  const rawRequired = toNumber(productionQty) * toNumber(norms);
  return roundQuantity(getBomNormUom(component) === 'G' ? rawRequired / 1000 : rawRequired);
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

export function getRiskFromCoverage(days) {
  return days === '' || days === null || days === undefined ? null : 'safe';
}

export function getStockStatus(required, available) {
  const req = toNumber(required);
  const stock = toNumber(available);
  if (req > 0 && stock <= 0) return 'critical';
  if (req > 0 && stock < req) return 'high';
  return 'safe';
}

export function getComponentUsedIn(componentId, fgProducts = []) {
  return fgProducts
    .filter((fg) =>
      (fg.items || []).some((item) => item.componentId === componentId),
    )
    .map((fg) => ({
      partNo: fg.partNo,
      name: fg.name,
    }));
}

export function getComponentTotalRequirement(componentId, productionRuns = []) {
  return productionRuns.reduce((total, run) => {
    const runTotal = (run.items || []).reduce((sum, item) => {
      return item.componentId === componentId
        ? sum + toNumber(item.required)
        : sum;
    }, 0);
    return total + runTotal;
  }, 0);
}

export function getPlannedComponentRequirement(componentId, fgProducts = [], component = {}) {
  return fgProducts.reduce((total, fg) => {
    const bomItem = (fg.items || []).find((item) => item.componentId === componentId);
    if (!bomItem) return total;
    const fgPlanQty = Object.values(fg.monthlyPlan || {}).reduce(
      (sum, qty) => sum + toNumber(qty),
      0,
    );
    return total + getRequiredQuantity(fgPlanQty, bomItem.norms, component);
  }, 0);
}

export function getMonthlyComponentPlan(componentId, fgProducts = [], component = {}) {
  return fgProducts.reduce((plan, fg) => {
    const bomItem = (fg.items || []).find((item) => item.componentId === componentId);
    if (!bomItem) return plan;

    Object.entries(fg.monthlyPlan || {}).forEach(([month, qty]) => {
      plan[month] = (plan[month] || 0) + getRequiredQuantity(qty, bomItem.norms, component);
    });

    return plan;
  }, {});
}

export function buildProductionRequirementRows(fgProduct, productionQty, components = []) {
  const qty = toNumber(productionQty);
  if (!fgProduct || qty <= 0) return [];

  return (fgProduct.items || []).map((item) => {
    const component = components.find((c) => c.id === item.componentId);
    const rawRequired = qty * toNumber(item.norms);
    const required = getRequiredQuantity(qty, item.norms, component);
    const stock = getComponentTotalStock(component);
    const shortage = roundQuantity(Math.max(0, required - stock));

    return {
      ...item,
      compDesc: component?.desc || item.desc || '',
      componentUom: component?.uom || '',
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
    map.set(row.componentId, (map.get(row.componentId) || 0) + toNumber(row.required));
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

export function getDashboardMetrics(components = [], fgProducts = [], productionRuns = []) {
  const componentRows = components.map((component) => {
    const totalRequirement = getComponentTotalRequirement(
      component.id,
      productionRuns,
    );
    const plannedRequirement = getPlannedComponentRequirement(
      component.id,
      fgProducts,
    );
    const demandRequirement = Math.max(totalRequirement, plannedRequirement);
    const usedIn = getComponentUsedIn(component.id, fgProducts);
    const totalStock = getComponentTotalStock(component);
    const balance = getComponentBalance(component, demandRequirement);
    const risk = getStockStatus(demandRequirement, totalStock);

    return {
      ...component,
      risk,
      usedIn,
      totalRequirement,
      plannedRequirement,
      demandRequirement,
      totalStock,
      balance,
      isLowStock: demandRequirement > 0 && totalStock < demandRequirement,
      isPlanShort: plannedRequirement > 0 && totalStock < plannedRequirement,
    };
  });

  const byRisk = componentRows.reduce(
    (acc, component) => {
      if (acc[component.risk] !== undefined) acc[component.risk] += 1;
      return acc;
    },
    { critical: 0, high: 0, safe: 0 },
  );

  const lowStock = componentRows.filter((component) => component.isLowStock).length;
  const planShort = componentRows.filter((component) => component.isPlanShort).length;

  return {
    totalComponents: components.length,
    totalFgProducts: fgProducts.length,
    criticalComponents: byRisk.critical,
    lowStock,
    planShort,
    safeComponents: byRisk.safe,
    riskDistribution: byRisk,
    componentRows,
    recentActivities: productionRuns.slice(-5).reverse(),
  };
}
