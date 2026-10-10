import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchComponents,
  fetchFgProducts,
  previewProductionPlan,
  confirmProductionPlans,
  confirmUploadedProductionPlans,
  confirmProductionPlan,
  deleteProductionPlan,
  clearProductionPlans,
  fetchProductionPlans,
  fetchProductionRuns,
  fetchStockMovements,
  updateProductionPlanPriorities,
} from "../../services/api";
import { getCurrentUser } from "../../services/session";
import { getPermissions } from "../../services/permissions";
import AdminSidebar from "../../components/AdminSidebar";
import AdminTopbar from "../../components/AdminTopbar";
import ActionIconButton from "../../components/ActionIconButton";
import {
  buildProductionRequirementRows,
  getComponentTotalStock,
} from "../../utils/materialCalculations";
import { buildMissingFgUploadRows, downloadExcelTable } from "../../utils/exportUtils";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";

function getRiskStyle(r) {
  return (
    {
      critical: { chip: "border border-red-200 bg-red-50 text-red-700" },
      high: { chip: "border border-amber-200 bg-amber-50 text-amber-700" },
      safe: {
        chip: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      },
    }[r] || { chip: "border border-slate-200 bg-slate-50 text-slate-600" }
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const colors = {
    success: "border-green-800 text-green-400",
    error: "border-red-800 text-red-400",
    info: "border-[#6c63ff] text-[#6c63ff]",
  };
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 bg-[#131627] border px-4 py-3 rounded-xl text-sm font-medium shadow-2xl ${colors[toast.type] || colors.info}`}
    >
      {toast.msg}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPlanDate(value) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AccordionSection({ title, subtitle, open, onToggle, children }) {
  return (
    <div className="bg-[#131627] border border-[#1e2235] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#171a2d] transition-colors"
      >
        <div>
          <div className="font-semibold text-sm text-[#c0c8e8]">{title}</div>
          {subtitle && (
            <div className="text-xs text-[#4a5080] mt-1">{subtitle}</div>
          )}
        </div>
        <span className="text-[#8890b0] text-lg leading-none">
          {open ? "-" : "+"}
        </span>
      </button>
      {open && <div className="border-t border-[#1e2235] p-5">{children}</div>}
    </div>
  );
}

function PlannedRequirementDetails({ plan, calculation }) {
  const rows = calculation?.rows || [];
  const shortageCount = rows.filter((row) => row.shortage > 0).length;

  return (
    <div className="m-3 rounded-xl border border-[#2a2d4a] bg-[#0d0f1a] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            Requirement — {calculation?.product?.name || plan.fgPartNo}
          </div>
          <div className="mt-1 text-xs text-[#8890b0]">
            {plan.productionDate || "No date"} · Priority #{plan.priorityRank} ·
            stock shown after higher-priority plans
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["Planned FG Qty", Number(plan.qty || 0), "text-[#6c63ff]"],
            ["Components", rows.length, "text-[#3ecfcf]"],
            ["Insufficient", shortageCount, "text-red-400"],
            ["Sufficient", rows.length - shortageCount, "text-green-400"],
          ].map(([label, value, color]) => (
            <div
              key={label}
              className="min-w-[112px] rounded-lg border border-[#1e2235] bg-[#131627] px-3 py-2"
            >
              <div className="text-[10px] uppercase tracking-widest text-[#4a5080]">
                {label}
              </div>
              <div className={`mt-1 text-lg font-bold ${color}`}>
                {Number(value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-[#1e2235]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2235] bg-[#131627]">
                {[
                  "#",
                  "Component ID",
                  "Description",
                  "Norms (per unit)",
                  "Production Qty",
                  "Required Total",
                  "Priority Stock",
                  "Remaining Stock",
                  "Shortage",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#4a5080]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const riskStyle = getRiskStyle(row.status);
                return (
                  <tr
                    key={`${plan.id}-${row.componentId}`}
                    className="border-b border-[#1a1d35] last:border-b-0"
                  >
                    <td className="px-4 py-3 text-xs text-[#4a5080]">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-[#1a1d35] px-2 py-1 font-mono text-xs text-[#6c63ff]">
                        {row.componentId}
                      </span>
                    </td>
                    <td
                      className="max-w-[210px] truncate px-4 py-3 text-xs text-[#8890b0]"
                      title={row.compDesc}
                    >
                      {row.compDesc || "-"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm font-bold text-white">
                      {Number(row.norms || 0).toLocaleString()} {row.normUom || ""}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-[#8890b0]">
                      {Number(plan.qty || 0).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#8890b0]">
                      {Number(plan.qty || 0).toLocaleString()} ×{" "}
                      {Number(row.norms || 0).toLocaleString()} {row.normUom || ""} ={" "}
                      <strong className="text-[#3ecfcf]">
                        {Number(row.required || 0).toLocaleString()} {row.componentUom || ""}
                      </strong>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-[#3ecfcf]">
                      {Number(row.stock || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-[#7edcc4]">
                      {Math.max(
                        0,
                        Number(row.stock || 0) - Number(row.required || 0),
                      ).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-bold">
                      <span
                        className={
                          row.shortage > 0 ? "text-red-400" : "text-green-400"
                        }
                      >
                        {row.shortage > 0
                          ? Number(row.shortage).toLocaleString()
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${riskStyle.chip}`}
                      >
                        {row.shortage > 0 ? "SHORTAGE" : "OK"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-300">
          No BOM component norms are available for this FG.
        </div>
      )}
    </div>
  );
}

function ConfirmationSummaryModal({ summary, onClose }) {
  if (!summary) return null;
  const shortageCount = summary.rows.filter((row) => row.shortage > 0).length;

  return (
    <div
      className="bom-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
      onClick={onClose}
    >
      <div
        className="bom-detail-modal bg-[#131627] border border-[#1e2235] rounded-2xl w-full max-w-5xl max-h-[86vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#1e2235] flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-bold text-white">
              Production Confirmed
            </div>
            <div className="text-xs text-[#8890b0] mt-1">
              {summary.fgPartNo} - {summary.fgName} | Qty{" "}
              {summary.qty.toLocaleString()} | {formatDateTime(summary.date)}
            </div>
            <div className="text-xs text-[#4a5080] mt-1">
              Updated {summary.rows.length} component stocks. Shortage before
              production: {shortageCount}.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-[#1e2235] text-xs text-[#8890b0] hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2235]">
                {[
                  "Component ID",
                  "Description",
                  "Before Stock",
                  "Consumed",
                  "After Stock",
                  "Shortage Before",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs text-[#4a5080] uppercase tracking-widest px-5 py-3 font-semibold whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.componentId} className="border-b border-[#1a1d35]">
                  <td className="px-5 py-3">
                    <span className="bg-[#1a1d35] text-[#6c63ff] text-xs font-mono px-2 py-1 rounded">
                      {row.componentId}
                    </span>
                  </td>
                  <td
                    className="px-5 py-3 text-xs text-[#8890b0] max-w-[240px] truncate"
                    title={row.compDesc}
                  >
                    {row.compDesc}
                  </td>
                  <td className="px-5 py-3 text-sm font-bold font-mono text-[#3ecfcf]">
                    {row.beforeStock.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-sm font-bold font-mono text-orange-400">
                    -{row.consumed.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-sm font-bold font-mono text-green-400">
                    {row.afterStock.toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    {row.shortage > 0 ? (
                      <span className="text-red-400 font-bold font-mono text-sm">
                        {row.shortage.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-green-400 font-mono text-sm">
                        0
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BOMMaster() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const permissions = getPermissions(user);

  const [fgProducts, setFgProducts] = useState([]);
  const [components, setComponents] = useState([]);
  const [productionPlans, setProductionPlans] = useState([]);
  const [productionRuns, setProductionRuns] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [showPlanUpload, setShowPlanUpload] = useState(false);
  const [selectedPlanDate, setSelectedPlanDate] = useState("");
  const [openSections, setOpenSections] = useState({
    plans: true,
    runs: false,
    movements: false,
  });
  useEffect(() => {
    Promise.all([
      fetchComponents(),
      fetchFgProducts(),
      fetchProductionPlans(),
      fetchProductionRuns(),
      fetchStockMovements(),
    ])
      .then(([comp, fg, plans, runs, movements]) => {
        setComponents(comp);
        setFgProducts(fg);
        setProductionPlans(plans);
        setSelectedPlanDate((current) => {
          if (current || !plans.length) return current;
          return [...new Set(plans.map((plan) => plan.productionDate))]
            .filter(Boolean)
            .sort()[0] || "";
        });
        setProductionRuns(runs);
        setStockMovements(movements);
      })
      .catch(console.error);
  }, []);

  const [selectedFG, setSelectedFG] = useState("");
  const [fgSearch, setFgSearch] = useState("");
  const [fgOptionsOpen, setFgOptionsOpen] = useState(false);
  const [productionDate, setProductionDate] = useState("");
  const [qty, setQty] = useState("");
  const [bomName, setBomName] = useState("");
  const [bomDescription, setBomDescription] = useState("");
  const [uploadBomName, setUploadBomName] = useState("");
  const [uploadBomDescription, setUploadBomDescription] = useState("");
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [productionHistory, setProductionHistory] = useState(null);
  const [confirmationSummary, setConfirmationSummary] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmingPlans, setConfirmingPlans] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [draggedPlanId, setDraggedPlanId] = useState(null);
  const [manualPriorityDates, setManualPriorityDates] = useState(() => new Set());

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  const fg = fgProducts.find((f) => f.partNo === selectedFG);
  const prodQty = parseInt(qty) || 0;
  const filteredFgProducts = fgProducts.filter((product) => {
    const query = fgSearch.trim().toLowerCase();
    return (
      !query ||
      String(product.partNo || "").toLowerCase().includes(query) ||
      String(product.name || "").toLowerCase().includes(query) ||
      String(product.desc || "").toLowerCase().includes(query)
    );
  });

  // Build live requirement rows from FG's fixed BOM + live component stock
  const rows = buildProductionRequirementRows(fg, prodQty, components);

  const totalShort = rows.filter((r) => r.shortage > 0).length;

  const autoPrioritizedPlans = useMemo(() => {
    const readiness = (plan) => {
      const product = fgProducts.find(
        (item) => item.partNo === plan.fgPartNo,
      );
      const requirementRows = buildProductionRequirementRows(
        product,
        plan.qty,
        components,
      ).filter((row) => Number(row.required || 0) > 0);
      if (!requirementRows.length) {
        return { coverage: 0, shortages: Number.MAX_SAFE_INTEGER };
      }
      const coverage =
        requirementRows.reduce(
          (sum, row) =>
            sum +
            Math.min(
              1,
              Number(row.stock || 0) / Number(row.required || 1),
            ),
          0,
        ) / requirementRows.length;
      const shortages = requirementRows.filter(
        (row) => Number(row.stock || 0) < Number(row.required || 0),
      ).length;
      return { coverage, shortages };
    };

    const groups = new Map();
    productionPlans.forEach((plan) => {
      const plans = groups.get(plan.productionDate) || [];
      plans.push(plan);
      groups.set(plan.productionDate, plans);
    });
    return [...groups.values()].flatMap((plans) => {
      const hasSavedPriority = plans.some(
        (plan) => Number(plan.priorityOrder || 0) > 0,
      );
      if (
        manualPriorityDates.has(plans[0]?.productionDate) ||
        hasSavedPriority
      ) {
        return [...plans].sort((a, b) => {
          const orderA = Number(a.priorityOrder || 0);
          const orderB = Number(b.priorityOrder || 0);
          if (orderA && orderB) return orderA - orderB;
          if (orderA) return -1;
          if (orderB) return 1;
          return Number(a.id) - Number(b.id);
        });
      }
      return [...plans].sort((a, b) => {
        const scoreA = readiness(a);
        const scoreB = readiness(b);
        if (scoreA.coverage !== scoreB.coverage) {
          return scoreB.coverage - scoreA.coverage;
        }
        if (scoreA.shortages !== scoreB.shortages) {
          return scoreA.shortages - scoreB.shortages;
        }
        return Number(a.id) - Number(b.id);
      });
    });
  }, [components, fgProducts, manualPriorityDates, productionPlans]);

  const plannedCalculations = useMemo(() => {
    const remainingStock = new Map(
      components.map((component) => [
        component.id,
        getComponentTotalStock(component),
      ]),
    );

    return autoPrioritizedPlans.reduce((result, plan) => {
      const product = fgProducts.find(
        (item) => item.partNo === plan.fgPartNo,
      );
      const stockSnapshot = components.map((component) => ({
        ...component,
        stock: remainingStock.get(component.id) || 0,
      }));
      const planRows = buildProductionRequirementRows(
        product,
        plan.qty,
        stockSnapshot,
      );

      planRows.forEach((row) => {
        remainingStock.set(
          row.componentId,
          Math.max(0, Number(row.stock || 0) - Number(row.required || 0)),
        );
      });
      result.set(plan.id, { product, rows: planRows });
      return result;
    }, new Map());
  }, [autoPrioritizedPlans, components, fgProducts]);

  const selectedDatePlans = autoPrioritizedPlans.filter(
    (plan) => plan.productionDate === selectedPlanDate,
  );
  const selectedPriorityConflict = useMemo(() => {
    const usageByComponent = new Map();

    selectedDatePlans.forEach((plan) => {
      (plannedCalculations.get(plan.id)?.rows || []).forEach((row) => {
        const componentId = String(row.componentId || "").trim();
        if (!componentId) return;
        const usage = usageByComponent.get(componentId) || {
          planIds: new Set(),
          hasShortage: false,
        };
        usage.planIds.add(Number(plan.id));
        if (Number(row.shortage || 0) > 0) usage.hasShortage = true;
        usageByComponent.set(componentId, usage);
      });
    });

    const affectedPlanIds = new Set();
    let sharedShortageCount = 0;
    usageByComponent.forEach((usage) => {
      if (usage.hasShortage && usage.planIds.size > 1) {
        sharedShortageCount += 1;
        usage.planIds.forEach((planId) => affectedPlanIds.add(planId));
      }
    });

    return { affectedPlanIds, sharedShortageCount };
  }, [plannedCalculations, selectedDatePlans]);
  const selectedPriorityPlans = selectedDatePlans.filter((plan) =>
    selectedPriorityConflict.affectedPlanIds.has(Number(plan.id)),
  );
  const showSelectedPriorityQueue = selectedPriorityPlans.length > 1;
  const planDateGroups = useMemo(() => {
    const groups = new Map();
    productionPlans.forEach((plan) => {
      const current = groups.get(plan.productionDate) || {
        date: plan.productionDate,
        count: 0,
        qty: 0,
      };
      current.count += 1;
      current.qty += Number(plan.qty || 0);
      groups.set(plan.productionDate, current);
    });
    return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [productionPlans]);
  const visibleProductionPlans = selectedPlanDate
    ? productionPlans.filter(
        (plan) => plan.productionDate === selectedPlanDate,
      )
    : [];

  async function moveSelectedDatePlan(draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return;
    const ordered = [...selectedPriorityPlans];
    const fromIndex = ordered.findIndex(
      (plan) => Number(plan.id) === Number(draggedId),
    );
    const toIndex = ordered.findIndex(
      (plan) => Number(plan.id) === Number(targetId),
    );
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    try {
      const result = await updateProductionPlanPriorities(
        ordered.map((plan) => plan.id),
      );
      setManualPriorityDates((current) => {
        const next = new Set(current);
        next.add(selectedPlanDate);
        return next;
      });
      setProductionPlans(result.productionPlans || []);
      showToast(
        `${formatPlanDate(selectedPlanDate)} FG production priority updated`,
        "success",
      );
    } catch (error) {
      showToast(error.message || "Unable to update priority", "error");
    } finally {
      setDraggedPlanId(null);
    }
  }

  const productionHistoryByDate = useMemo(() => {
    const groups = new Map();
    productionRuns.forEach((run) => {
      const date = String(run.date || "").slice(0, 10) || "Unknown";
      const current = groups.get(date) || { date, runs: 0, qty: 0 };
      current.runs += 1;
      current.qty += Number(run.qty || 0);
      groups.set(date, current);
    });
    return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [productionRuns]);

  const visibleProductionRuns =
    selectedHistoryDate === "all"
      ? productionRuns
      : selectedHistoryDate
        ? productionRuns.filter(
          (run) =>
            String(run.date || "").slice(0, 10) === selectedHistoryDate,
          )
        : [];

  if (!user) {
    navigate("/");
    return null;
  }

  function handleSelectFG(partNo) {
    setSelectedFG(partNo);
    const product = fgProducts.find((item) => item.partNo === partNo);
    setFgSearch(
      product ? `${product.partNo} - ${product.name || "Unnamed FG"}` : "",
    );
    setFgOptionsOpen(false);
    setQty("");
    setConfirmed(false);
    setProductionHistory(null);
  }

  function handleQtyChange(val) {
    setQty(val);
    setConfirmed(false);
    setProductionHistory(null);
  }

  async function handleConfirmProduction() {
    if (!fg || prodQty <= 0 || !productionDate) {
      alert("Select a customer, product, production date and valid quantity");
      return;
    }
    if (
      !window.confirm(
        `Add dated BOM for ${prodQty.toLocaleString()} units of ${fg.name} on ${productionDate}?\n\nThis creates a pending plan only. Stock will not be deducted until confirmation.`,
      )
    )
      return;
    const result = await confirmProductionPlans([
      {
        fgPartNo: fg.partNo,
        fgName: fg.name,
        qty: prodQty,
        productionDate,
        customer: fg.customer || "",
        bomName: bomName.trim(),
        bomDescription: bomDescription.trim(),
      },
    ]);
    setProductionPlans(result.productionPlans || []);
    setOpenSections((current) => ({ ...current, plans: true }));
    showToast(`Dated BOM added for ${fg.name}`, "success");
    setBomName("");
    setBomDescription("");
  }

  async function handleConfirmUploadedPlans() {
    if (!productionPlans.length) {
      alert("No uploaded production plans to confirm");
      return;
    }
    const totalQty = productionPlans.reduce(
      (sum, plan) => sum + Number(plan.qty || 0),
      0,
    );
    if (
      !window.confirm(
        `Confirm ${productionPlans.length} uploaded production plan(s)?\n\nTotal production qty: ${totalQty.toLocaleString()}\nThis will deduct stock and add production history.`,
      )
    )
      return;

    setConfirmingPlans(true);
    try {
      const result = await confirmUploadedProductionPlans(
        autoPrioritizedPlans.map((plan) => plan.id),
      );
      setComponents(result.components || []);
      setProductionPlans(result.productionPlans || []);
      setProductionRuns(result.runs || []);
      setStockMovements(result.stockMovements || []);
      setOpenSections((current) => ({
        ...current,
        plans: true,
        runs: true,
        movements: true,
      }));
      if (result.errors?.length) {
        alert(
          `Confirmed ${result.confirmed || 0} plans with errors:\n${result.errors.join("\n")}`,
        );
      }
      showToast(
        `Confirmed ${result.confirmed || 0} production plan(s)`,
        "success",
      );
    } catch (err) {
      alert(err.message || "Production confirmation failed");
    } finally {
      setConfirmingPlans(false);
    }
  }

  async function handleConfirmPlan(plan) {
    const product = fgProducts.find((item) => item.partNo === plan.fgPartNo);
    if (
      !window.confirm(
        `Confirm production for ${plan.fgPartNo} - ${product?.name || ""}?\n\nQty: ${Number(plan.qty || 0).toLocaleString()}\nThis will deduct stock and add production history.`,
      )
    )
      return;
    setConfirmingPlans(true);
    try {
      const result = await confirmProductionPlan(plan.id);
      setComponents(result.components || []);
      setProductionPlans(result.productionPlans || []);
      setProductionRuns(result.runs || []);
      setStockMovements(result.stockMovements || []);
      setOpenSections((current) => ({
        ...current,
        plans: true,
        runs: true,
        movements: true,
      }));
      showToast(`Confirmed ${plan.fgPartNo}`, "success");
    } catch (err) {
      alert(err.message || "Production confirmation failed");
    } finally {
      setConfirmingPlans(false);
    }
  }

  async function handleDeletePlan(plan) {
    const product = fgProducts.find((item) => item.partNo === plan.fgPartNo);
    if (
      !window.confirm(
        `Delete pending plan ${plan.fgPartNo} - ${product?.name || ""}?`,
      )
    )
      return;
    const result = await deleteProductionPlan(plan.id);
    const remainingPlans = result.productionPlans || [];
    setProductionPlans(remainingPlans);
    if (
      selectedPlanDate &&
      !remainingPlans.some(
        (item) => item.productionDate === selectedPlanDate,
      )
    ) {
      setSelectedPlanDate(
        [...new Set(remainingPlans.map((item) => item.productionDate))]
          .filter(Boolean)
          .sort()[0] || "",
      );
    }
    showToast(`Deleted pending plan ${plan.fgPartNo}`, "error");
  }

  async function handleClearPlans() {
    if (!productionPlans.length) return;
    if (
      !window.confirm(
        `Clear all ${productionPlans.length} pending production plan(s)?\n\nThis will not delete stock, components, FG products, or production history.`,
      )
    )
      return;
    await clearProductionPlans();
    setProductionPlans([]);
    setSelectedPlanDate("");
    showToast("Pending production plans cleared", "error");
  }

  function toggleSection(section) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  async function handlePlanFile(file) {
    if (!file) return;
    try {
      setUploadingPlan(true);
      const result = await previewProductionPlan(file);
      if (!result.plans?.length && !result.unmappedFgs?.length) {
        setUploadPreview(null);
        showToast(
          Number(result.fgMasterCount || 0) === 0
            ? "FG master is empty. Upload FG Products before uploading a production plan."
            : `${result.skipped || 0} plan row(s) use unknown FG IDs. Upload those FGs first.`,
          "error",
        );
        return;
      }
      const dates = new Map();
      result.plans.forEach((plan) => {
        const current = dates.get(plan.productionDate) || {
          date: plan.productionDate,
          fgCount: 0,
          qty: 0,
        };
        current.fgCount += 1;
        current.qty += Number(plan.qty || 0);
        dates.set(plan.productionDate, current);
      });
      setUploadPreview({
        ...result,
        fileName: file.name,
        dateGroups: [...dates.values()].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      });
    } catch (error) {
      setUploadPreview(null);
      showToast(error.message || "Unable to read this Excel file", "error");
    } finally {
      setUploadingPlan(false);
    }
  }

  function exportUnmappedFgs() {
    const staged = buildMissingFgUploadRows(uploadPreview || {});
    if (!staged.length) return;
    downloadExcelTable(
      "Missing FG Upload Items",
      ["FG Part Number", "FG Name", "Production Dates", "Skipped Plan Rows", "Reason"],
      staged,
    );
  }

  async function importPreviewedPlans() {
    if (!uploadPreview?.plans?.length) return;
    try {
      setUploadingPlan(true);
      const bomId = `BOM-${Date.now().toString(36).toUpperCase()}`;
      await confirmProductionPlans(
        uploadPreview.plans.map((plan) => ({
          ...plan,
          bomId,
          bomName: uploadBomName.trim(),
          bomDescription: uploadBomDescription.trim(),
        })),
      );
      const refreshedPlans = await fetchProductionPlans();
      setProductionPlans(refreshedPlans);
      setSelectedPlanDate(uploadPreview.dateGroups[0]?.date || "");
      setOpenSections((current) => ({ ...current, plans: true }));
      showToast(
        `${uploadPreview.plans.length} FG plans imported across ${uploadPreview.dateGroups.length} date(s)`,
        "success",
      );
      setShowPlanUpload(false);
      setUploadPreview(null);
      setUploadBomName("");
      setUploadBomDescription("");
    } catch (error) {
      showToast(error.message || "Production plan import failed", "error");
    } finally {
      setUploadingPlan(false);
    }
  }

  const inp =
    "w-full bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#6c63ff] placeholder:text-[#4a5080]";
  const lbl = "text-[#8890b0] text-xs mb-1.5 block";

  return (
    <div className="erp-admin bom-page flex h-screen overflow-hidden bg-[#05050a] text-white">
      <AdminSidebar active="bom" user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar
          title="BOM & Production"
          description="Production planning, BOM requirements and material consumption"
          user={user}
          actions={
            permissions.canManageProduction ? (
              <button
                onClick={() => setShowPlanUpload(true)}
                className="erp-primary-action"
              >
                Upload Production Plan
              </button>
            ) : null
          }
        />

        <div className="bom-content flex-1 overflow-y-auto p-6">
          {/* Selector card */}
          <div className="bom-planner-card mb-4 rounded-xl border border-[#1e2235] bg-[#131627] p-4">
            <div className="grid grid-cols-[minmax(260px,1.5fr)_160px_140px_minmax(160px,.8fr)_minmax(190px,1fr)] items-end gap-3">
              <div className="relative">
                <label className={lbl}>FG PRODUCT</label>
                <input
                  value={fgSearch}
                  onFocus={() => setFgOptionsOpen(true)}
                  onBlur={() =>
                    window.setTimeout(() => setFgOptionsOpen(false), 140)
                  }
                  onChange={(event) => {
                    setFgSearch(event.target.value);
                    setSelectedFG("");
                    setQty("");
                    setFgOptionsOpen(true);
                  }}
                  placeholder="Type FG ID or name..."
                  autoComplete="off"
                  className={inp}
                />
                {fgOptionsOpen && !selectedFG && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#111116] p-1.5 shadow-2xl">
                    {filteredFgProducts.length ? (
                      filteredFgProducts.map((product) => (
                        <button
                          type="button"
                          key={product.partNo}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectFG(product.partNo)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#a66cf1]/15"
                        >
                          <span className="font-mono text-[10px] font-bold text-[#c99cff]">
                            {product.partNo}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[10px] text-[#bbb4c2]">
                            {product.name || product.desc || "Unnamed FG"}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-5 text-center text-[10px] text-[#777183]">
                        No matching FG products
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className={lbl}>PRODUCTION DATE</label>
                <input
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                  type="date"
                  className={inp}
                  disabled={!fg}
                />
              </div>
              <div>
                <label className={lbl}>PRODUCTION QUANTITY</label>
                <input
                  value={qty}
                  onChange={(e) => handleQtyChange(e.target.value)}
                  type="number"
                  min="1"
                  placeholder="e.g. 2000"
                  className={inp}
                  disabled={!fg}
                />
              </div>
              <div>
                <label className={lbl}>BOM NAME (OPTIONAL)</label>
                <input
                  value={bomName}
                  onChange={(e) => setBomName(e.target.value)}
                  placeholder="e.g. July first production"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>NOTE (OPTIONAL)</label>
                <input
                  value={bomDescription}
                  onChange={(e) => setBomDescription(e.target.value)}
                  placeholder="Short production note"
                  className={inp}
                />
              </div>
            </div>
            {fg && (
              <div className="mt-3 flex items-center gap-2 text-[10px] text-[#81798a]">
                <span className="rounded-md bg-[#a66cf1]/12 px-2 py-1 font-mono font-semibold text-[#c99cff]">
                  {fg.partNo}
                </span>
                <span className="truncate">{fg.name}</span>
                <span>·</span>
                <span>{fg.items.length} raw materials linked</span>
              </div>
            )}
          </div>

          {fg && prodQty > 0 && (
            <>
              {/* Summary cards */}
              <div className="bom-summary-grid grid grid-cols-4 gap-4 mb-5">
                <div className="bg-[#131627] border border-[#1e2235] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#6c63ff]" />
                    <span className="text-[#4a5080] text-xs uppercase tracking-widest">
                      Production Qty
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {prodQty.toLocaleString()}
                  </div>
                  <div className="text-[#4a5080] text-xs mt-1">
                    units of {fg.name}
                  </div>
                </div>
                <div className="bg-[#131627] border border-[#1e2235] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#3ecfcf]" />
                    <span className="text-[#4a5080] text-xs uppercase tracking-widest">
                      Raw Materials
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-[#3ecfcf]">
                    {rows.length}
                  </div>
                  <div className="text-[#4a5080] text-xs mt-1">
                    components needed
                  </div>
                </div>
                <div className="bg-[#131627] border border-[#1e2235] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-[#4a5080] text-xs uppercase tracking-widest">
                      Stock Short
                    </span>
                  </div>
                  <div
                    className={`text-3xl font-bold ${totalShort > 0 ? "text-red-400" : "text-green-400"}`}
                  >
                    {totalShort}
                  </div>
                  <div className="text-[#4a5080] text-xs mt-1">
                    components insufficient
                  </div>
                </div>
                <div className="bg-[#131627] border border-[#1e2235] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-[#4a5080] text-xs uppercase tracking-widest">
                      Stock OK
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-green-400">
                    {rows.length - totalShort}
                  </div>
                  <div className="text-[#4a5080] text-xs mt-1">
                    components sufficient
                  </div>
                </div>
              </div>

              {/* Requirement table */}
              <div className="bom-requirement-card bg-[#131627] border border-[#1e2235] rounded-xl overflow-hidden mb-5">
                <div className="px-5 py-3.5 border-b border-[#1e2235] flex items-center justify-between">
                  <div className="font-semibold text-sm text-[#c0c8e8]">
                    Requirement — {fg.name}
                    {confirmed && (
                      <span className="ml-3 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Stock deducted
                      </span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e2235]">
                        {[
                          "#",
                          "Component ID",
                          "Description",
                          "Norms (per unit)",
                          "Production Qty",
                          "Required Total",
                          "Stock Available",
                          "Shortage",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left text-xs text-[#4a5080] uppercase tracking-widest px-5 py-3 font-semibold whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const rs = getRiskStyle(r.status);
                        return (
                          <tr
                            key={r.componentId}
                            className="border-b border-[#1a1d35] hover:bg-[#1a1d35] transition-colors"
                          >
                            <td className="px-5 py-3 text-[#4a5080] text-xs">
                              {i + 1}
                            </td>
                            <td className="px-5 py-3">
                              <span className="bg-[#1a1d35] text-[#6c63ff] text-xs font-mono px-2 py-1 rounded">
                                {r.componentId}
                              </span>
                            </td>
                            <td
                              className="px-5 py-3 text-xs text-[#8890b0] max-w-[180px] truncate"
                              title={r.compDesc}
                            >
                              {r.compDesc}
                            </td>
                            <td className="px-5 py-3 text-sm font-bold font-mono text-white text-center">
                              {r.norms} {r.normUom || ""}
                            </td>
                            <td className="px-5 py-3 text-xs font-mono text-[#8890b0] text-center">
                              {prodQty.toLocaleString()}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1 text-xs font-mono">
                                <span className="text-[#4a5080]">
                                  {prodQty.toLocaleString()}
                                </span>
                                <span className="text-[#4a5080]">×</span>
                                <span className="text-[#8890b0]">
                                  {r.norms} {r.normUom || ""}
                                </span>
                                <span className="text-[#4a5080]">=</span>
                                <span className="text-[#3ecfcf] font-bold text-sm">
                                  {r.required.toLocaleString()} {r.componentUom || ""}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-sm font-bold font-mono text-[#3ecfcf]">
                              {r.stock.toLocaleString()}
                            </td>
                            <td className="px-5 py-3">
                              {r.shortage > 0 ? (
                                <span className="text-red-400 font-bold font-mono text-sm">
                                  −{r.shortage.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-green-400 font-mono text-sm">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`text-xs px-3 py-1 rounded-full font-semibold ${rs.chip}`}
                              >
                                {r.status === "critical"
                                  ? "CRITICAL"
                                  : r.status === "high"
                                    ? "SHORTAGE"
                                    : "OK"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {productionHistory && (
                <div className="bg-[#131627] border border-[#1e2235] rounded-xl overflow-hidden mb-5">
                  <div className="px-5 py-3.5 border-b border-[#1e2235] flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-[#c0c8e8]">
                        Production Stock History
                      </div>
                      <div className="text-xs text-[#4a5080] mt-1">
                        {productionHistory.fgPartNo} -{" "}
                        {productionHistory.fgName} | Qty{" "}
                        {productionHistory.qty.toLocaleString()}
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Stock deducted
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1e2235]">
                          {[
                            "Component ID",
                            "Description",
                            "Before Stock",
                            "Consumed",
                            "After Stock",
                            "Shortage Before",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left text-xs text-[#4a5080] uppercase tracking-widest px-5 py-3 font-semibold whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {productionHistory.rows.map((r) => (
                          <tr
                            key={r.componentId}
                            className="border-b border-[#1a1d35] hover:bg-[#1a1d35] transition-colors"
                          >
                            <td className="px-5 py-3">
                              <span className="bg-[#1a1d35] text-[#6c63ff] text-xs font-mono px-2 py-1 rounded">
                                {r.componentId}
                              </span>
                            </td>
                            <td
                              className="px-5 py-3 text-xs text-[#8890b0] max-w-[220px] truncate"
                              title={r.compDesc}
                            >
                              {r.compDesc}
                            </td>
                            <td className="px-5 py-3 text-sm font-bold font-mono text-[#3ecfcf]">
                              {r.beforeStock.toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-sm font-bold font-mono text-orange-400">
                              -{r.consumed.toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-sm font-bold font-mono text-green-400">
                              {r.afterStock.toLocaleString()}
                            </td>
                            <td className="px-5 py-3">
                              {r.shortage > 0 ? (
                                <span className="text-red-400 font-bold font-mono text-sm">
                                  {r.shortage.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-green-400 font-mono text-sm">
                                  0
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleConfirmProduction}
                  disabled={confirmed}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg transition-colors ${
                    confirmed
                      ? "cursor-not-allowed border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "bg-[#639922] hover:bg-[#4e7a1a] text-white"
                  }`}
                >
                  Add Dated BOM
                </button>
              </div>
            </>
          )}

          <div className="mt-5 space-y-3">
            <AccordionSection
              title="Production plans"
              subtitle={
                productionPlans.length
                  ? `${planDateGroups.length} production dates · ${productionPlans.length} FG plans`
                  : "No pending production plans"
              }
              open={openSections.plans}
              onToggle={() => toggleSection("plans")}
            >
              {productionPlans.length > 0 && (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[linear-gradient(120deg,rgba(166,108,241,.10),rgba(17,16,21,.92)_42%)] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      ["Dates", planDateGroups.length],
                      ["FG plans", productionPlans.length],
                      [
                        "Total qty",
                        productionPlans
                          .reduce(
                            (sum, plan) => sum + Number(plan.qty || 0),
                            0,
                          )
                          .toLocaleString(),
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 rounded-xl border border-white/[.08] bg-black/20 px-3 py-2"
                      >
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#777183]">
                          {label}
                        </span>
                        <strong className="text-sm text-[#eee9f2]">
                          {value}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearPlans}
                      disabled={confirmingPlans}
                      className="rounded-xl border border-[#ff6878]/20 bg-[#ff6878]/[.07] px-3.5 py-2.5 text-[10px] font-semibold text-[#ff9ca6] transition hover:border-[#ff6878]/40 hover:bg-[#ff6878]/[.12] disabled:opacity-40"
                    >
                      Clear pending
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmUploadedPlans}
                      disabled={confirmingPlans}
                      className="rounded-xl bg-[linear-gradient(135deg,#8e54df,#c65ddc)] px-5 py-2.5 text-[10px] font-bold text-white shadow-lg shadow-purple-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {confirmingPlans ? "Confirming…" : "Confirm all plans"}
                    </button>
                  </div>
                </div>
              )}
              {planDateGroups.length > 0 && (
                <div className="mb-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold text-[#e5dfea]">
                        Choose a production date
                      </div>
                      <div className="mt-0.5 text-[9px] text-[#716b7c]">
                        Open a date to view its FG calculations
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
                    {planDateGroups.map((group) => (
                      <button
                        type="button"
                        key={group.date}
                        aria-pressed={selectedPlanDate === group.date}
                        onClick={() => setSelectedPlanDate(group.date)}
                        className={`group relative overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-all duration-200 ${
                          selectedPlanDate === group.date
                            ? "scale-[1.02] border-[#d5afff] bg-[linear-gradient(135deg,rgba(142,84,223,.72),rgba(198,93,220,.42))] ring-2 ring-[#b884ff]/35 shadow-[0_12px_32px_rgba(126,63,184,.34)]"
                            : "border-white/[.08] bg-[#151419] hover:-translate-y-0.5 hover:border-[#b884ff]/35 hover:bg-[#1b1820]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={`truncate text-[9px] font-semibold uppercase tracking-wider ${
                              selectedPlanDate === group.date
                                ? "text-white"
                                : "text-[#a39baa]"
                            }`}
                          >
                            {formatPlanDate(group.date)}
                          </div>
                          {selectedPlanDate === group.date && (
                            <span className="shrink-0 rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[8px] font-bold tracking-wider text-white">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <div>
                            <strong className="text-lg leading-none text-white">
                              {group.count}
                            </strong>
                            <span className="ml-1 text-[9px] text-[#88818f]">
                              FGs
                            </span>
                          </div>
                          <span className="font-mono text-[9px] font-semibold text-[#7edcc4]">
                            {group.qty.toLocaleString()}
                          </span>
                        </div>
                        <div className="hidden">
                          FG plans · {group.qty.toLocaleString()} total qty
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {showSelectedPriorityQueue && (
                <div className="mb-5 rounded-2xl border border-[#f2b86b]/35 bg-[linear-gradient(135deg,rgba(242,184,107,.13),rgba(239,104,124,.06))] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-[#ffd39b]">
                        {formatPlanDate(selectedPlanDate)} needs prioritisation
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[#a9a1b4]">
                        Available stock cannot fully cover this date’s FGs.
                        Drag the rows into the order in which stock should be
                        allocated.
                      </div>
                    </div>
                    <span className="rounded-full border border-[#f2b86b]/30 bg-[#f2b86b]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ffd39b]">
                      {selectedPriorityPlans.length} competing FGs
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-[#c5a97f]">
                    {selectedPriorityConflict.sharedShortageCount} shared
                    shortage raw material
                    {selectedPriorityConflict.sharedShortageCount === 1
                      ? ""
                      : "s"}
                  </div>
                  <div className="mt-4 space-y-2">
                    {selectedPriorityPlans.map((plan, index) => {
                      const product = fgProducts.find(
                        (item) => item.partNo === plan.fgPartNo,
                      );
                      const shortageCount = (
                        plannedCalculations.get(plan.id)?.rows || []
                      ).filter((row) => Number(row.shortage || 0) > 0).length;
                      return (
                        <div
                          key={plan.id}
                          draggable
                          onDragStart={() => setDraggedPlanId(plan.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() =>
                            moveSelectedDatePlan(draggedPlanId, plan.id)
                          }
                          onDragEnd={() => setDraggedPlanId(null)}
                          className={`grid cursor-grab grid-cols-[34px_minmax(120px,.7fr)_minmax(180px,1.5fr)_110px_120px] items-center gap-3 rounded-xl border px-4 py-3 transition active:cursor-grabbing ${
                            Number(draggedPlanId) === Number(plan.id)
                              ? "border-[#b884ff] bg-[#b884ff]/15 opacity-60"
                              : "border-white/10 bg-[#121117] hover:border-[#f2b86b]/40 hover:bg-[#1b1820]"
                          }`}
                        >
                          <span className="text-center text-lg text-[#80798a]">
                            ⋮⋮
                          </span>
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-[#777183]">
                              Priority {index + 1}
                            </div>
                            <div className="mt-1 font-mono text-xs font-bold text-[#c7adff]">
                              {plan.fgPartNo}
                            </div>
                          </div>
                          <div className="truncate text-xs font-semibold text-[#ece8f0]">
                            {plan.fgDescription || product?.desc || product?.name || "-"}
                          </div>
                          <div className="text-right font-mono text-xs font-bold text-[#7edcc4]">
                            {Number(plan.qty || 0).toLocaleString()}
                          </div>
                          <div className="text-right">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${
                                shortageCount
                                  ? "bg-[#ff6878]/12 text-[#ff8d99]"
                                  : "bg-[#62d59d]/12 text-[#86e3b7]"
                              }`}
                            >
                              {shortageCount
                                ? `${shortageCount} shortages`
                                : "Stock covered"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {selectedPlanDate && productionPlans.length ? (
                <div className="overflow-x-auto">
                  {selectedPlanDate && (
                    <div className="mb-2 flex min-w-max items-center gap-2 rounded-xl border border-[#b884ff]/25 bg-[#b884ff]/[.08] px-4 py-2.5">
                      <span className="h-2 w-2 rounded-full bg-[#c99cff] shadow-[0_0_10px_rgba(201,156,255,.8)]" />
                      <span className="text-[10px] text-[#9f97a9]">
                        Showing plans for
                      </span>
                      <strong className="text-[11px] text-[#e6d3ff]">
                        {formatPlanDate(selectedPlanDate)}
                      </strong>
                      <span className="rounded-full bg-white/[.07] px-2 py-0.5 text-[9px] font-semibold text-[#c4bdca]">
                        {visibleProductionPlans.length} FGs
                      </span>
                    </div>
                  )}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e2235]">
                        {[
                          "Priority",
                          "FG Part No",
                          "FG Name",
                          "Production Qty",
                          "Plan Date",
                          "Calculation",
                          "Actions",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left text-xs text-[#4a5080] uppercase tracking-widest px-4 py-3 font-semibold"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProductionPlans.map((plan) => {
                        const product = fgProducts.find(
                          (item) => item.partNo === plan.fgPartNo,
                        );
                        return (
                          <Fragment key={plan.id}>
                            <tr className="border-b border-[#1a1d35]">
                              <td className="px-4 py-3">
                                <span
                                  className={
                                    plan.priorityRank === 1
                                      ? "rounded-full bg-[#6c63ff] px-2.5 py-1 text-[10px] font-bold text-white"
                                      : "rounded-full bg-[#1a1d35] px-2.5 py-1 text-[10px] font-bold text-[#8890b0]"
                                  }
                                >
                                  #{plan.priorityRank}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs font-mono text-[#6c63ff]">
                                {plan.fgPartNo}
                              </td>
                              <td className="px-4 py-3 text-xs text-[#8890b0]">
                                {plan.fgDescription || product?.desc || product?.name || "-"}
                              </td>
                              <td className="px-4 py-3 text-sm font-mono font-bold text-[#3ecfcf]">
                                {Number(plan.qty || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-xs text-[#8890b0]">
                                {plan.productionDate || "-"}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedPlanId((current) =>
                                      current === plan.id ? null : plan.id,
                                    )
                                  }
                                  className="whitespace-nowrap rounded-lg border border-[#3d3a67] bg-[#211e38] px-3 py-2 text-xs font-semibold text-[#b9b4ff] transition-colors hover:bg-[#2b2750]"
                                >
                                  {expandedPlanId === plan.id
                                    ? "Hide calculation"
                                    : "View calculation"}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <ActionIconButton
                                    type="confirm"
                                    label={`Confirm ${plan.fgPartNo}`}
                                    onClick={() => handleConfirmPlan(plan)}
                                    disabled={
                                      confirmingPlans ||
                                      plan.priorityRank !== 1
                                    }
                                  />
                                  <ActionIconButton
                                    type="delete"
                                    label={`Delete ${plan.fgPartNo}`}
                                    onClick={() => handleDeletePlan(plan)}
                                    disabled={confirmingPlans}
                                  />
                                </div>
                              </td>
                            </tr>
                            {expandedPlanId === plan.id && (
                              <tr className="border-b border-[#1a1d35]">
                                <td colSpan={7} className="p-0">
                                  <PlannedRequirementDetails
                                    plan={plan}
                                    calculation={plannedCalculations.get(plan.id)}
                                  />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : !productionPlans.length ? (
                <div className="text-sm text-[#4a5080]">
                  No BOM production plan uploaded yet.
                </div>
              ) : null}
            </AccordionSection>

            {permissions.canViewHistory && (
              <AccordionSection
                title="Production Confirmation History"
                subtitle={`${productionRuns.length} confirmed production entries`}
                open={openSections.runs}
                onToggle={() => toggleSection("runs")}
              >
                {productionRuns.length ? (
                  <div>
                    <div className="bom-history-date-cards">
                      <button
                        type="button"
                        className={
                          selectedHistoryDate === "all" ? "is-active" : ""
                        }
                        onClick={() =>
                          setSelectedHistoryDate((current) =>
                            current === "all" ? null : "all",
                          )
                        }
                      >
                        <small>All dates</small>
                        <strong>{productionRuns.length}</strong>
                        <span>confirmed runs</span>
                      </button>
                      {productionHistoryByDate.map((group) => (
                        <button
                          type="button"
                          key={group.date}
                          className={
                            selectedHistoryDate === group.date
                              ? "is-active"
                              : ""
                          }
                          onClick={() =>
                            setSelectedHistoryDate((current) =>
                              current === group.date ? null : group.date,
                            )
                          }
                        >
                          <small>
                            {new Date(
                              `${group.date}T00:00:00`,
                            ).toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </small>
                          <strong>{group.qty.toLocaleString()}</strong>
                          <span>{group.runs} production runs</span>
                        </button>
                      ))}
                    </div>
                    {selectedHistoryDate && (
                      <>
                    <div className="bom-history-selection">
                      <span>
                        {selectedHistoryDate === "all"
                          ? "All confirmed production"
                          : new Date(
                              `${selectedHistoryDate}T00:00:00`,
                            ).toLocaleDateString("en-GB", {
                              weekday: "long",
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                      </span>
                      <b>{visibleProductionRuns.length} entries</b>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1e2235]">
                          {[
                            "Run ID",
                            "Date / Time",
                            "FG Part No",
                            "Name",
                            "Qty",
                            "Components",
                            "",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left text-xs text-[#4a5080] uppercase tracking-widest px-4 py-3 font-semibold whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleProductionRuns
                          .slice()
                          .reverse()
                          .map((run) => (
                            <tr
                              key={run.id}
                              onClick={() => setSelectedRun(run)}
                              className="border-b border-[#1a1d35] cursor-pointer hover:bg-blue-50"
                            >
                              <td className="px-4 py-3 text-xs font-bold text-[#6c63ff]">
                                PRD-{String(run.id).padStart(6, "0")}
                              </td>
                              <td className="px-4 py-3 text-xs text-[#8890b0] whitespace-nowrap">
                                {formatDateTime(run.date)}
                              </td>
                              <td className="px-4 py-3 text-xs font-mono text-[#6c63ff]">
                                {run.partNo}
                              </td>
                              <td className="px-4 py-3 text-xs text-[#8890b0]">
                                {run.name || "-"}
                              </td>
                              <td className="px-4 py-3 text-sm font-mono font-bold text-[#3ecfcf]">
                                {Number(run.qty || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-xs text-[#8890b0]">
                                {run.items?.length || 0}
                              </td>
                              <td className="px-4 py-3 text-slate-300">›</td>
                            </tr>
                          ))}
                      </tbody>
                      </table>
                    </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-[#4a5080]">
                    No production confirmed yet.
                  </div>
                )}
              </AccordionSection>
            )}

            <div className="hidden">
              <AccordionSection
                title="Stock Movement History"
                subtitle={`${stockMovements.length} stock movement rows from upload and production`}
                open={openSections.movements}
                onToggle={() => toggleSection("movements")}
              >
                {stockMovements.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1e2235]">
                          {[
                            "Date / Time",
                            "Type",
                            "Component",
                            "Description",
                            "Qty",
                            "Remarks",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left text-xs text-[#4a5080] uppercase tracking-widest px-4 py-3 font-semibold whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stockMovements
                          .slice(-20)
                          .reverse()
                          .map((movement) => (
                            <tr
                              key={movement.id}
                              className="border-b border-[#1a1d35]"
                            >
                              <td className="px-4 py-3 text-xs text-[#8890b0] whitespace-nowrap">
                                {formatDateTime(
                                  movement.createdAt || movement.receiptDate,
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs uppercase text-[#8890b0]">
                                {movement.type}
                              </td>
                              <td className="px-4 py-3 text-xs font-mono text-[#6c63ff]">
                                {movement.componentId}
                              </td>
                              <td
                                className="px-4 py-3 text-xs text-[#8890b0] max-w-[260px] truncate"
                                title={movement.componentDesc}
                              >
                                {movement.componentDesc || "-"}
                              </td>
                              <td className="px-4 py-3 text-sm font-mono font-bold text-[#3ecfcf]">
                                {Number(movement.qty || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-xs text-[#8890b0]">
                                {movement.remarks || "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-[#4a5080]">
                    No stock movement recorded yet.
                  </div>
                )}
              </AccordionSection>
            </div>
          </div>
        </div>
      </div>

      {showPlanUpload && (
        <div
          className="bom-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => {
            setShowPlanUpload(false);
            setUploadPreview(null);
          }}
        >
          <section
            className="bom-upload-modal max-h-[88vh] w-[760px] max-w-[94vw] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="font-bold">Upload Production Plan</div>
                <div className="mt-1 text-xs text-[#8e889d]">
                  Create multiple dated BOM plans from Excel
                </div>
              </div>
              <button
                type="button"
                className="bom-modal-close"
                onClick={() => {
                  setShowPlanUpload(false);
                  setUploadPreview(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {!uploadPreview && (
              <div className="my-5 rounded-2xl border border-[#b884ff]/20 bg-[#b884ff]/[.07] p-4">
                <div className="text-xs font-semibold text-[#d9c7f5]">
                  One Excel can contain many production dates
                </div>
                <div className="mt-2 text-[11px] leading-5 text-[#aaa2b5]">
                  Keep FG Part Number and Description first, followed by date columns such as
                  25/07/2026, 10/08/2026 and 15/08/2026. Enter the planned
                  quantity under each date. Blank and zero cells are ignored.
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className={lbl}>BOM NAME (OPTIONAL)</label>
                <input
                  className={inp}
                  value={uploadBomName}
                  onChange={(e) => setUploadBomName(e.target.value)}
                  placeholder="e.g. July bulk production"
                />
              </div>
              <div>
                <label className={lbl}>DESCRIPTION (OPTIONAL)</label>
                <textarea
                  className={`${inp} min-h-20 resize-none`}
                  value={uploadBomDescription}
                  onChange={(e) => setUploadBomDescription(e.target.value)}
                  placeholder="Add a short note about this upload"
                />
              </div>
            </div>
            <input
              className="bom-file-input"
              type="file"
              accept=".xlsx,.xls"
              disabled={uploadingPlan}
              onChange={(event) => handlePlanFile(event.target.files?.[0])}
            />
            {uploadingPlan && !uploadPreview && (
              <div className="mt-4 rounded-xl border border-white/10 bg-[#0d0c11] px-4 py-3 text-xs text-[#c9bdd4]">
                Reading dates and validating FG plans…
              </div>
            )}
            {uploadPreview && (
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Ready to import
                    </div>
                    <div className="mt-1 max-w-[480px] truncate text-[11px] text-[#8e8798]">
                      {uploadPreview.fileName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadPreview(null)}
                    className="rounded-lg border border-white/10 bg-[#17161b] px-3 py-2 text-[10px] font-semibold text-[#c4bdca]"
                  >
                    Choose another file
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    ["Production dates", uploadPreview.dateGroups.length],
                    ["FG plans", uploadPreview.plans.length],
                    [
                      "Total quantity",
                      uploadPreview.plans
                        .reduce(
                          (sum, plan) => sum + Number(plan.qty || 0),
                          0,
                        )
                        .toLocaleString(),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/10 bg-[#111015] p-3"
                    >
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-[#80798a]">
                        {label}
                      </div>
                      <div className="mt-2 text-xl font-bold text-white">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 max-h-[230px] space-y-2 overflow-y-auto pr-1">
                  {uploadPreview.dateGroups.map((group) => (
                    <div
                      key={group.date}
                      className="grid grid-cols-[minmax(180px,1fr)_100px_140px] items-center gap-3 rounded-xl border border-white/10 bg-[#121117] px-4 py-3"
                    >
                      <div className="text-xs font-semibold text-[#e8e2ec]">
                        {formatPlanDate(group.date)}
                      </div>
                      <div className="text-right text-[11px] text-[#bca5df]">
                        {group.fgCount} FG plans
                      </div>
                      <div className="text-right font-mono text-xs font-bold text-[#7edcc4]">
                        {group.qty.toLocaleString()} qty
                      </div>
                    </div>
                  ))}
                </div>

                {(uploadPreview.skipped > 0 ||
                  uploadPreview.errors?.length > 0) && (
                  <div className="mt-4 rounded-xl border border-[#f2b86b]/25 bg-[#f2b86b]/[.08] px-4 py-3 text-[11px] leading-5 text-[#e8c794]">
                    {uploadPreview.skipped > 0 &&
                      `${uploadPreview.skipped} unknown FG row(s) will be skipped. `}
                    {uploadPreview.errors?.length > 0 &&
                      `${uploadPreview.errors.length} invalid or empty row(s) were ignored.`}
                    {(uploadPreview.skipped > 0 || uploadPreview.unmappedFgs?.length > 0) && (
                      <button
                        type="button"
                        onClick={exportUnmappedFgs}
                        className="mt-3 block rounded-lg border border-[#ff8b96]/25 bg-[#ff6878]/10 px-3 py-2 text-[10px] font-semibold text-[#ffadb5]"
                      >
                        Download missing items
                      </button>
                    )}
                  </div>
                )}

                {uploadPreview.unmappedFgs?.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[#ff6878]/25 bg-[#ff6878]/[.07]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#ff6878]/15 px-4 py-3">
                      <div>
                        <div className="text-xs font-semibold text-[#ff9aa4]">
                          FGs without raw-material mapping
                        </div>
                        <div className="mt-1 text-[10px] text-[#a99ca4]">
                          These FGs will not be added to the production BOM.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={exportUnmappedFgs}
                        className="rounded-lg border border-[#ff8b96]/25 bg-[#ff6878]/10 px-3 py-2 text-[10px] font-semibold text-[#ffadb5]"
                      >
                        Download missing items
                      </button>
                    </div>
                    <div className="max-h-[150px] overflow-y-auto">
                      {uploadPreview.unmappedFgs.map((fg) => (
                        <div
                          key={fg.partNo}
                          className="grid grid-cols-[130px_minmax(180px,1fr)_auto] items-center gap-3 border-b border-white/5 px-4 py-2.5 text-[10px] last:border-b-0"
                        >
                          <strong className="font-mono text-[#ffc0c6]">
                            {fg.partNo}
                          </strong>
                          <span className="truncate text-[#c7bec9]">
                            {fg.name || "Unnamed FG"}
                          </span>
                          <span className="text-[#887f8b]">
                            {fg.planRows} plan row
                            {fg.planRows === 1 ? "" : "s"} skipped
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlanUpload(false);
                      setUploadPreview(null);
                    }}
                    className="rounded-xl border border-white/10 bg-[#17161b] px-5 py-3 text-xs font-semibold text-[#bbb4c2]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={uploadingPlan || !uploadPreview.plans.length}
                    onClick={importPreviewedPlans}
                    className="rounded-xl bg-[linear-gradient(135deg,#8e54df,#c65ddc)] px-6 py-3 text-xs font-bold text-white shadow-lg shadow-purple-950/30 disabled:opacity-50"
                  >
                    {uploadingPlan
                      ? "Importing…"
                      : `Import ${uploadPreview.plans.length} plans`}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      <ConfirmationSummaryModal
        summary={confirmationSummary}
        onClose={() => setConfirmationSummary(null)}
      />
      {selectedRun && (
        <div
          className="bom-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
          onClick={(e) => e.target === e.currentTarget && setSelectedRun(null)}
        >
          <div className="bom-detail-modal bom-run-modal w-[960px] max-w-[95vw] max-h-[86vh] overflow-hidden">
            <div className="bom-run-modal-header flex justify-between">
              <div>
                <div className="bom-run-id">
                  PRD-{String(selectedRun.id).padStart(6, "0")}
                </div>
                <div className="bom-run-title">
                  {selectedRun.partNo} · {selectedRun.name}
                </div>
                <div className="bom-run-subtitle">
                  Confirmed {formatDateTime(selectedRun.date)} · FG quantity{" "}
                  {Number(selectedRun.qty || 0).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setSelectedRun(null)}
                className="bom-modal-close"
                aria-label="Close production details"
              >
                ×
              </button>
            </div>
            <div className="bom-run-summary">
              <div>
                <span>FG quantity</span>
                <strong>{Number(selectedRun.qty || 0).toLocaleString()}</strong>
              </div>
              <div>
                <span>Raw materials</span>
                <strong>{selectedRun.items?.length || 0}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong className="is-confirmed">Confirmed</strong>
              </div>
            </div>
            <div className="bom-run-table-wrap">
              <table className="w-full">
                <thead>
                  <tr>
                    {[
                      "Raw Material ID",
                      "Description",
                      "Norm / Unit",
                      "Calculation",
                      "Consumed Quantity",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selectedRun.items || []).map((item, i) => (
                    <tr
                      key={item.componentId || i}
                      className=""
                    >
                      <td className="bom-run-material-id">
                        {item.componentId}
                      </td>
                      <td className="bom-run-description">
                        {item.componentDesc || item.desc || "—"}
                      </td>
                      <td>
                        {Number(item.norms || 0).toLocaleString()}
                      </td>
                      <td className="bom-run-calculation">
                        {Number(selectedRun.qty || 0).toLocaleString()} ×{" "}
                        {Number(item.norms || 0).toLocaleString()} ={" "}
                        {Number(item.required || 0).toLocaleString()}
                      </td>
                      <td className="bom-run-consumed">
                        {Number(item.required || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!selectedRun.items?.length && (
                <div className="bom-run-empty">
                  No raw materials were recorded for this production run.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
}

export default BOMMaster;
