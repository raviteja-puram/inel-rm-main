import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchComponents,
  fetchFgProducts,
  fetchProductionPlans,
  fetchProductionRuns,
  saveFgProduct,
  deleteFgProductApi,
  uploadFgProducts,
  fetchFgStockMonitoring,
  uploadFgStockMonitoring,
  deleteFgStockSnapshotApi,
} from "../../services/api";
import { getCurrentUser } from "../../services/session";
import AdminSidebar from "../../components/AdminSidebar";
import AdminTopbar from "../../components/AdminTopbar";
import ActionIconButton from "../../components/ActionIconButton";
import {
  getBomNormUom,
  getRequiredQuantity,
} from "../../utils/materialCalculations";
import { buildFgMissingItemsRows, downloadExcelTable } from "../../utils/exportUtils";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";

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

function ProductionDatesCell({ plans }) {
  if (!plans.length)
    return <span className="text-xs text-[#4a5080]">Not planned</span>;

  const formatDate = (value) => {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      weekday: "short",
    });
  };

  return (
    <div className="fg-production-dates">
      <span>{formatDate(plans[0].productionDate)}</span>
      {plans.length > 1 && <small>+{plans.length - 1} more</small>}
      <div className="fg-production-dates-popover" role="tooltip">
        <strong>Planned production dates</strong>
        {plans.map((plan) => (
          <div key={plan.id}>
            <span>{formatDate(plan.productionDate)}</span>
            <b>
              {Number(plan.qty || 0).toLocaleString()} units · {plan.status}
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FG Product Form Modal (with component+norms builder) ──
function FGCalculationModal({ fg, components, planQty, planSources, onClose }) {
  if (!fg) return null;
  const totalPlan = Number(planQty || 0);

  return (
    <div
      className="fg-calculation-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="fg-calculation-modal max-h-[88vh] w-[820px] max-w-[95vw] overflow-hidden">
        <header>
          <div>
            <small>FG calculation details</small>
            <h2>
              {fg.partNo} · {fg.name}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="fg-calculation-summary">
          <div>
            <span>Total confirmed FG quantity</span>
            <strong>{totalPlan.toLocaleString()}</strong>
          </div>
          <div>
            <span>BOM components</span>
            <strong>{(fg.items || []).length}</strong>
          </div>
          <div>
            <span>Calculation</span>
            <strong>Confirmed Qty × Norms</strong>
          </div>
        </div>
        <div className="fg-plan-chips">
          <span>
            <small>Confirmed production</small>
            <b>{Number(planSources?.confirmed || 0).toLocaleString()}</b>
          </span>
          <p>Only confirmed and saved production is shown on this page.</p>
        </div>
        <div className="fg-calculation-table">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Description</th>
                <th>Confirmed Qty</th>
                <th>Norms</th>
                <th>Formula</th>
                <th>Required Qty</th>
              </tr>
            </thead>
            <tbody>
              {(fg.items || []).map((item) => {
                const component = components.find(
                  (entry) => entry.id === item.componentId,
                );
                const required = getRequiredQuantity(
                  totalPlan,
                  item.norms,
                  component,
                );
                const normUom = getBomNormUom(component);
                return (
                  <tr key={item.componentId}>
                    <td>
                      <b>{item.componentId}</b>
                    </td>
                    <td>{component?.desc || item.desc || "—"}</td>
                    <td>{totalPlan.toLocaleString()}</td>
                    <td>
                      {Number(item.norms || 0).toLocaleString()} {normUom}
                    </td>
                    <td>
                      {totalPlan.toLocaleString()} ×{" "}
                      {Number(item.norms || 0).toLocaleString()} {normUom}
                    </td>
                    <td>
                      <strong>
                        {required.toLocaleString()} {component?.uom || ""}
                      </strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FGFormModal({ open, onClose, onSave, editData, components }) {
  const [partNo, setPartNo] = useState(editData?.partNo || "");
  const [name] = useState(editData?.name || "");
  const [desc, setDesc] = useState(editData?.desc || "");
  const [buyer, setBuyer] = useState(editData?.buyer || "");
  const [customer, setCustomer] = useState(editData?.customer || "");
  const [customerCategory, setCustomerCategory] = useState(editData?.customerCategory || "");
  const [marketSegment, setMarketSegment] = useState(
    editData?.marketSegment || "",
  );
  const [productGroup, setProductGroup] = useState(editData?.productGroup || "");
  const [stockNormDays, setStockNormDays] = useState(editData?.stockNormDays || "");
  const [totalStock, setTotalStock] = useState(editData?.totalStock || "");
  const [fgCategory, setFgCategory] = useState(editData?.fgCategory || "");
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [monthlyPlanQty, setMonthlyPlanQty] = useState(editData?.monthlyPlan?.[currentMonth] || "");
  const [items, setItems] = useState(editData?.items || []); // [{componentId, norms}]
  const [selComp, setSelComp] = useState("");
  const [selNorms, setSelNorms] = useState("");
  const isEdit = !!editData;

  if (!open) return null;

  const available = components.filter(
    (c) => !items.find((it) => it.componentId === c.id),
  );
  function addItem() {
    if (!selComp) {
      alert("Select a component");
      return;
    }
    if (!selNorms || parseFloat(selNorms) <= 0) {
      alert("Enter valid norms");
      return;
    }
    const comp = components.find((c) => c.id === selComp);
    setItems((prev) => [
      ...prev,
      {
        componentId: selComp,
        desc: comp?.desc || "",
        norms: parseFloat(selNorms),
      },
    ]);
    setSelComp("");
    setSelNorms("");
  }

  function removeItem(compId) {
    setItems((prev) => prev.filter((it) => it.componentId !== compId));
  }

  function handleSave() {
    if (!partNo.trim()) {
      alert("FG Part Number is required");
      return;
    }
    if (!desc.trim()) {
      alert("Description is required");
      return;
    }
    if (!fgCategory.trim()) {
      alert("Category is required");
      return;
    }
    if (items.length === 0) {
      alert("Add at least one component");
      return;
    }
    onSave({
      partNo: partNo.trim(),
      name: name.trim() || desc.trim(),
      desc: desc.trim(),
      buyer: buyer.trim(),
      customer: customer.trim(),
      customerCategory: customerCategory.trim(),
      marketSegment: marketSegment.trim(),
      productGroup: productGroup.trim(),
      stockNormDays: Number(stockNormDays) || 0,
      totalStock: Number(totalStock) || 0,
      fgCategory: fgCategory.trim(),
      monthlyPlan: { ...(editData?.monthlyPlan || {}), [currentMonth]: Number(monthlyPlanQty) || 0 },
      items,
    });
  }

  const inp =
    "w-full bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#6c63ff] placeholder:text-[#4a5080]";
  const lbl = "text-[#8890b0] text-xs mb-1.5 block";

  return (
    <div
      className="fg-form-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fg-form-modal w-[680px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <div className="fg-form-header flex items-center justify-between px-6 py-5">
          <div>
            <div className="font-bold text-base text-white">
              {isEdit ? "Edit Product" : "Create Product"}
            </div>
            <div className="text-[#4a5080] text-xs mt-0.5">
              Define the fixed component list and norms for this product
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#4a5080] hover:text-white text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>FG PART NUMBER *</label>
              <input
                value={partNo}
                onChange={(e) => setPartNo(e.target.value)}
                readOnly={isEdit}
                placeholder="e.g. N3010182"
                className={`${inp} ${isEdit ? "opacity-50 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className={lbl}>DESCRIPTION *</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. AALD CDI" className={inp} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>BUYER</label>
              <input
                value={buyer}
                onChange={(e) => setBuyer(e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>CUSTOMER NAME</label>
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>CUSTOMER CATEGORY</label>
              <input value={customerCategory} onChange={(e) => setCustomerCategory(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>MARKET SEGMENT</label>
              <input
                value={marketSegment}
                onChange={(e) => setMarketSegment(e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>PRODUCT GROUP</label>
              <input
                value={productGroup}
                onChange={(e) => setProductGroup(e.target.value)}
                placeholder="Enter product group"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>MONTHLY PLAN ({currentMonth})</label>
              <input type="number" min="0" value={monthlyPlanQty} onChange={(e) => setMonthlyPlanQty(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>STOCK NORMS IN DAYS</label>
              <input type="number" min="0" value={stockNormDays} onChange={(e) => setStockNormDays(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>TOTAL STOCK</label>
              <input type="number" min="0" value={totalStock} onChange={(e) => setTotalStock(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>CATEGORY *</label>
              <input value={fgCategory} onChange={(e) => setFgCategory(e.target.value)} placeholder="e.g. Runner" className={inp} />
            </div>
          </div>
          <div className="border-t border-[#1e2235] pt-4">
            <div className="text-[#4a5080] text-xs uppercase tracking-widest mb-3">
              Raw Materials & Norms
            </div>

            <div className="flex items-end gap-2 mb-3">
              <div className="flex-1">
                <label className={lbl}>Component</label>
                <select
                  value={selComp}
                  onChange={(e) => setSelComp(e.target.value)}
                  className={inp}
                >
                  <option value="">Select component...</option>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.desc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className={lbl}>Norms</label>
                <input
                  value={selNorms}
                  onChange={(e) => setSelNorms(e.target.value)}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 3"
                  className={inp}
                />
              </div>
              <button
                onClick={addItem}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#6c63ff] hover:bg-[#5a52e0] rounded-lg transition-colors"
              >
                ＋ Add
              </button>
            </div>

            {items.length > 0 && (
              <div className="bg-[#0d0f1a] border border-[#1e2235] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e2235]">
                      <th className="text-left text-[10px] text-[#4a5080] uppercase tracking-widest px-3 py-2">
                        Component
                      </th>
                      <th className="text-left text-[10px] text-[#4a5080] uppercase tracking-widest px-3 py-2">
                        Description
                      </th>
                      <th className="text-center text-[10px] text-[#4a5080] uppercase tracking-widest px-3 py-2">
                        Norms
                      </th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr
                        key={it.componentId}
                        className="border-b border-[#1a1d35] last:border-b-0"
                      >
                        <td className="px-3 py-2">
                          <span className="bg-[#1a1d35] text-[#6c63ff] text-xs font-mono px-2 py-0.5 rounded">
                            {it.componentId}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#8890b0]">
                          {it.desc}
                        </td>
                        <td className="px-3 py-2 text-center text-sm font-mono font-bold text-white">
                          {it.norms}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => removeItem(it.componentId)}
                            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {items.length === 0 && (
              <div className="text-xs text-[#4a5080] text-center py-4">
                No components added yet
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#8890b0] border border-[#1e2235] rounded-lg hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#6c63ff] hover:bg-[#5a52e0] rounded-lg transition-colors"
          >
            {isEdit ? "Update Product" : "Save Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FGProducts() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [components, setComponents] = useState([]);
  const [fgProducts, setFgProducts] = useState([]);
  const [productionPlans, setProductionPlans] = useState([]);
  const [productionRuns, setProductionRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showStockUpload, setShowStockUpload] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [stockSnapshots, setStockSnapshots] = useState([]);
  const [monitorDate, setMonitorDate] = useState("");
  const [monitorMonth, setMonitorMonth] = useState("");
  const [monitoringSearch, setMonitoringSearch] = useState("");
  const [monitoringStatusFilter, setMonitoringStatusFilter] = useState("all");
  const [monitoringCategoryFilter, setMonitoringCategoryFilter] = useState("all");
  const [selectedMonitoringIds, setSelectedMonitoringIds] = useState([]);
  async function reload() {
    const [comp, fg, plans, runs, snapshots] = await Promise.all([
      fetchComponents(),
      fetchFgProducts(),
      fetchProductionPlans(),
      fetchProductionRuns(),
      fetchFgStockMonitoring(),
    ]);
    setComponents(comp);
    setFgProducts(fg);
    setProductionPlans(plans);
    setProductionRuns(runs);
    setStockSnapshots(snapshots);
    setLoading(false);
  }
  useEffect(() => {
    reload().catch((error) => {
      console.error(error);
      setLoadError(error.message || "FG Products request failed");
      setLoading(false);
    });
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editIndex, setEditIndex] = useState(-1);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [selectedPartNos, setSelectedPartNos] = useState([]);
  const [calculationFg, setCalculationFg] = useState(null);
  const [missingFgItems, setMissingFgItems] = useState([]);
  const [hiddenColumns, setHiddenColumns] = useState(["monthlyPlan", "adr", "stockNormDays", "agreedStock", "totalStock", "fgCategory", "status", "coverageDays"]);

  async function retryLoad() {
    setLoadError("");
    setLoading(true);
    try {
      await reload();
    } catch (error) {
      console.error(error);
      setLoadError(error.message || "FG Products request failed");
      setLoading(false);
    }
  }

  if (loadError)
    return (
      <div className="grid min-h-screen place-items-center bg-[#0d0f1a] px-6 text-center text-[#4a5080]">
        <div>
          <p className="text-lg font-semibold text-white">
            FG Products could not be loaded
          </p>
          <p className="mt-2 text-sm">{loadError}</p>
          <button
            type="button"
            onClick={retryLoad}
            className="mt-5 rounded-xl bg-[#6c63ff] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );

  if (loading)
    return (
      <div className="min-h-screen bg-[#0d0f1a] text-[#4a5080] flex items-center justify-center">
        Loading...
      </div>
    );

  if (!user) {
    navigate("/");
    return null;
  }
  async function handleDeleteMonitoringRow(rowId) {
    if (!window.confirm("Delete this daily FG monitoring row?")) return;
    try {
      const id = Number(rowId);
      if (!Number.isFinite(id)) {
        throw new Error("Invalid monitoring row id");
      }
      await deleteFgStockSnapshotApi(id);
      setStockSnapshots((prev) => prev.filter((row) => Number(row.id) !== id));
      setSelectedMonitoringIds((prev) => prev.filter((item) => Number(item) !== id));
      showToast("Monitoring row deleted", "error");
    } catch (error) {
      alert("Could not delete monitoring row: " + error.message);
    }
  }

  function toggleSelectedMonitoringRow(rowId) {
    const id = Number(rowId);
    setSelectedMonitoringIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleAllVisibleMonitoringRows() {
    const ids = visibleMonitoringRows.map((row) => Number(row.id));
    const allSelected = ids.every((id) => selectedMonitoringIds.includes(id));
    setSelectedMonitoringIds((prev) =>
      allSelected
        ? prev.filter((id) => !ids.includes(Number(id)))
        : Array.from(new Set([...prev, ...ids])),
    );
  }

  async function handleDeleteSelectedMonitoringRows() {
    if (selectedMonitoringIds.length === 0) {
      alert("Select at least one monitoring row to delete");
      return;
    }
    if (!window.confirm(`Delete ${selectedMonitoringIds.length} selected monitoring row(s)?`)) {
      return;
    }
    try {
      await Promise.all(
        selectedMonitoringIds.map((id) => deleteFgStockSnapshotApi(Number(id))),
      );
      setStockSnapshots((prev) =>
        prev.filter((row) => !selectedMonitoringIds.includes(Number(row.id))),
      );
      setSelectedMonitoringIds([]);
      showToast("Selected monitoring rows deleted", "error");
    } catch (error) {
      alert("One or more rows could not be deleted: " + error.message);
    }
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  function openCreate() {
    setEditData(null);
    setEditIndex(-1);
    setShowForm(true);
  }
  function openEdit(i) {
    setEditData(fgProducts[i]);
    setEditIndex(i);
    setShowForm(true);
  }

  async function handleSave(fg) {
    await saveFgProduct(fg);
    await reload();
    showToast(
      fg.name + (editIndex === -1 ? " created" : " updated"),
      "success",
    );
    setShowForm(false);
  }
  async function handleDelete(i) {
    if (!window.confirm(`Delete ${fgProducts[i].name}?`)) return;
    await deleteFgProductApi(fgProducts[i].partNo);
    await reload();
    showToast("Product deleted", "error");
  }

  function toggleSelected(partNo) {
    setSelectedPartNos((prev) =>
      prev.includes(partNo)
        ? prev.filter((item) => item !== partNo)
        : [...prev, partNo],
    );
  }

  function toggleAllVisible(visibleProducts) {
    const visiblePartNos = visibleProducts.map((product) => product.partNo);
    const allSelected = visiblePartNos.every((partNo) =>
      selectedPartNos.includes(partNo),
    );
    setSelectedPartNos((prev) =>
      allSelected
        ? prev.filter((partNo) => !visiblePartNos.includes(partNo))
        : Array.from(new Set([...prev, ...visiblePartNos])),
    );
  }

  async function handleDeleteSelected() {
    if (selectedPartNos.length === 0) {
      alert("Select at least one product to delete");
      return;
    }
    if (
      !window.confirm(`Delete ${selectedPartNos.length} selected product(s)?`)
    )
      return;

    for (const partNo of selectedPartNos) await deleteFgProductApi(partNo);
    await reload();
    setSelectedPartNos([]);
    showToast("Selected products deleted", "error");
  }

  function exportMissingFgItems(rows = []) {
    if (!rows.length) return;
    const exportRows = buildFgMissingItemsRows(rows);
    if (!exportRows.length) return;
    downloadExcelTable(
      "FG Missing Items",
      ["FG Part Number", "Missing Material ID", "Reason"],
      exportRows,
    );
  }

  async function handleFgUpload(file) {
    if (!file) return;
    try {
      const result = await uploadFgProducts(file);
      setMissingFgItems(result.skippedMaterials || []);
      await reload();
      const messages = [];
      if (result.errors?.length)
        messages.push("Errors:\n" + result.errors.join("\n"));
      if (result.warnings?.length) {
        messages.push(
          "Warnings:\n" +
            result.warnings
              .map(
                (warning) =>
                  `${warning.partNo}: This FG looks similar to existing product ${warning.similarTo.partNo} - ${warning.similarTo.name}`,
              )
              .join("\n"),
        );
      }
      if (result.skippedDuplicates) {
        messages.push(
          `${result.skippedDuplicates} repeated FG-material row(s) were skipped.`,
        );
      }
      if (result.skippedPlaceholders) {
        messages.push(
          `${result.skippedPlaceholders} placeholder FG row(s) were skipped.`,
        );
      }
      if (result.skippedMaterials?.length) {
        messages.push(
          "Unknown raw-material links skipped:\n" +
            result.skippedMaterials
              .map(
                (item) =>
                  `${item.fgPartNo}: ${item.materialIds.join(", ")}`,
              )
              .join("\n"),
        );
      }
      showToast(
        result.imported + " FG products imported/updated",
        result.errors?.length ? "error" : "success",
      );
      if (messages.length) alert(messages.join("\n\n"));
      if (result.skippedMaterials?.length) {
        return;
      }
      if (!result.errors?.length) setShowUpload(false);
    } catch (err) {
      alert("FG upload failed: " + err.message);
    }
  }

  async function handleStockUpload(file) {
    if (!file) return;
    try {
      const result = await uploadFgStockMonitoring(file);
      await reload();
      if (result.errors?.length || result.unknownParts?.length) {
        alert([
          result.errors?.length ? `Errors:\n${result.errors.join("\n")}` : "",
          result.unknownParts?.length ? `Unknown FG part numbers (create them first):\n${result.unknownParts.join(", ")}` : "",
        ].filter(Boolean).join("\n\n"));
      }
      showToast(`${result.imported} daily FG stock row(s) imported`, result.errors?.length ? "error" : "success");
      if (!result.errors?.length) setShowStockUpload(false);
    } catch (error) {
      alert("Daily FG plan upload failed: " + error.message);
    }
  }

  const filtered = fgProducts.filter(
    (f) =>
      f.partNo.toLowerCase().includes(search.toLowerCase()) ||
      f.name.toLowerCase().includes(search.toLowerCase()),
  );

  function getPlanSources(fg) {
    const confirmed = productionRuns
      .filter((run) => run.partNo === fg.partNo)
      .reduce((sum, run) => sum + Number(run.qty || 0), 0);
    return { confirmed };
  }

  function getFgPlanQty(fg) {
    return getPlanSources(fg).confirmed;
  }

  const totalConfirmedFgQty = fgProducts.reduce(
    (total, fg) => total + getFgPlanQty(fg),
    0,
  );
  function stockStatus(coverage) {
    if (coverage <= 1) return ["Critical (0 to 1 days)", "text-red-400"];
    if (coverage <= 5) return ["Low Stock (1 to 5 Days)", "text-yellow-300"];
    if (coverage <= 10) return ["OK (6 to 10 Days)", "text-green-400"];
    return ["Excess Stock", "text-blue-400"];
  }

  const monitorDates = [...new Set(stockSnapshots.map((row) => row.monitorDate))].sort().reverse();
  const monitorMonths = [...new Set(stockSnapshots.map((row) => row.monthKey).filter(Boolean))].sort().reverse();
  const activeMonitorDate = monitorDate || monitorDates[0] || "";
  const monitoringRows = stockSnapshots
    .filter((row) => (!activeMonitorDate || row.monitorDate === activeMonitorDate) && (!monitorMonth || row.monthKey === monitorMonth))
    .map((row) => {
      const adr = Number(row.adr || 0);
      const effectiveAdr = adr > 0 ? adr : (Number(row.monthPlanQty || 0) > 0 ? Math.round(Number(row.monthPlanQty || 0) / 24) : 0);
      const agreedStock = Number(row.agreedStock || (effectiveAdr * Number(row.stockNormDays || 0)) || 0);
      const coverage = Number(row.coverageDays ?? (effectiveAdr > 0 ? Number((Number(row.totalStock || 0) / effectiveAdr).toFixed(1)) : 0));
      const fg = fgProducts.find((fgItem) => fgItem.partNo === row.partNo);
      const [statusText, statusTone] = stockStatus(coverage);
      return {
        ...row,
        adr: effectiveAdr,
        agreedStock,
        coverageDays: coverage,
        statusText,
        statusTone,
        fg,
      };
    })
    .filter((row) => row.monthPlanQty > 0);

  const visibleMonitoringRows = monitoringRows.filter((row) => {
    const query = monitoringSearch.trim().toLowerCase();
    const matchesSearch = !query || [row.partNo, row.fg?.name || "", row.fg?.customer || "", row.fg?.productGroup || "", row.fg?.fgCategory || ""].join(" ").toLowerCase().includes(query);
    const matchesStatus = monitoringStatusFilter === "all" || row.statusText === monitoringStatusFilter;
    const categoryValue = row.fg?.productGroup || row.fg?.fgCategory || "Uncategorized";
    const matchesCategory = monitoringCategoryFilter === "all" || categoryValue === monitoringCategoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });
  const monitoringStatusOptions = [...new Set(monitoringRows.map((row) => row.statusText))].sort();
  const monitoringCategoryOptions = [...new Set(monitoringRows.map((row) => row.fg?.productGroup || row.fg?.fgCategory || "Uncategorized"))].sort();

  return (
    <div className="erp-admin fg-page flex h-screen overflow-hidden bg-[#05050a] text-white">
      <AdminSidebar active="products" user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar
          title="FG Products"
          description="Finished goods master, BOM definitions and component relationships"
          user={user}
          actions={
            <>
              <button onClick={() => toggleAllVisible(filtered)}>
                Select Visible
              </button>
              <button onClick={handleDeleteSelected}>
                Delete Selected ({selectedPartNos.length})
              </button>
              <button onClick={() => setShowUpload(true)}>Upload Excel</button>
              <button onClick={() => setShowStockUpload(true)}>Upload Plan</button>
              <button onClick={() => setShowMonitoring(true)}>Show Daily FG Monitoring</button>
              <button onClick={openCreate}>Create Product</button>
            </>
          }
        />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="hidden">
            <div>
              <h2 className="font-semibold text-base text-white">
                Product Master
              </h2>
              <p className="text-[#4a5080] text-xs mt-0.5">
                Define each finished product's fixed component list and norms,
                once. Used by BOM / Production for material calculations.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => toggleAllVisible(filtered)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#8890b0] border border-[#1e2235] rounded-lg hover:text-white hover:border-[#4a5080] transition-colors"
              >
                Select Visible
              </button>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                Delete Selected ({selectedPartNos.length})
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#8890b0] border border-[#1e2235] rounded-lg hover:text-white transition-colors"
              >
                Upload Excel
              </button>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#6c63ff] hover:bg-[#5a52e0] rounded-lg transition-colors"
              >
                ＋ Create Product
              </button>
            </div>
          </div>

          <div className="fg-stat-grid grid grid-cols-4 gap-4 mb-5">
            <div className="fg-stat-card fg-stat-violet">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#6c63ff]" />
                <span className="text-[#4a5080] text-xs uppercase tracking-widest">
                  Total Products
                </span>
              </div>
              <div className="text-3xl font-bold text-[#6c63ff]">
                {fgProducts.length}
              </div>
            </div>
            <div className="fg-stat-card fg-stat-coral">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#3ecfcf]" />
                <span className="text-[#4a5080] text-xs uppercase tracking-widest">
                  Total Component Links
                </span>
              </div>
              <div className="text-3xl font-bold text-[#3ecfcf]">
                {fgProducts.reduce((a, f) => a + f.items.length, 0)}
              </div>
            </div>
            <div className="fg-stat-card fg-stat-mint">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[#4a5080] text-xs uppercase tracking-widest">
                  Available Raw Materials
                </span>
              </div>
              <div className="text-3xl font-bold text-green-400">
                {components.length}
              </div>
            </div>
            <div className="fg-stat-card fg-stat-amber">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" />
                <span className="text-xs uppercase tracking-widest">
                  Total Confirmed FG Qty
                </span>
              </div>
              <div>{totalConfirmedFgQty.toLocaleString()}</div>
            </div>
          </div>

          <div className="fg-table-card overflow-hidden">
            <div className="fg-table-toolbar flex items-center justify-between px-5 py-3.5">
              <div className="font-semibold text-sm text-[#c0c8e8]">
                All Products ({fgProducts.length})
              </div>
              <div className="flex items-center gap-2">
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-lg border border-[#1e2235] bg-[#0d0f1a] px-3 py-1.5 text-xs text-[#8890b0]">Columns</summary>
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-[#1e2235] bg-[#131627] p-3 shadow-xl">
                  {[['customer','Customer Name'],['productGroup','Product Group'],['monthlyPlan','Month Plan Qty'],['adr','ADR'],['stockNormDays','Stock Norms In Days'],['agreedStock','Agreed Stock'],['totalStock','Total Stock'],['fgCategory','Category'],['status','Status'],['coverageDays','No of Days']].map(([key,label]) => <label key={key} className="flex items-center gap-2 py-1 text-xs text-[#c0c8e8]"><input type="checkbox" checked={!hiddenColumns.includes(key)} onChange={() => setHiddenColumns((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />{label}</label>)}
                </div>
              </details>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search part no or name..."
                className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#6c63ff] placeholder:text-[#4a5080] w-60"
              />
              </div>
            </div>
            <div className="overflow-auto max-h-[540px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e2235]">
                    {[
                      "Select",
                      "FG Part No",
                      "FG Name",
                      "Description",
                      ...(!hiddenColumns.includes("productGroup") ? ["Product Group"] : []),
                      ...(!hiddenColumns.includes("customer") ? ["Customer Name"] : []),
                      ...(!hiddenColumns.includes("monthlyPlan") ? ["Monthly Plan"] : []),
                      ...(!hiddenColumns.includes("adr") ? ["ADR"] : []),
                      ...(!hiddenColumns.includes("stockNormDays") ? ["Stock Norms In Days"] : []),
                      ...(!hiddenColumns.includes("agreedStock") ? ["Agreed Stock"] : []),
                      ...(!hiddenColumns.includes("totalStock") ? ["Total Stock"] : []),
                      ...(!hiddenColumns.includes("fgCategory") ? ["FG Category"] : []),
                      ...(!hiddenColumns.includes("status") ? ["Status"] : []),
                      ...(!hiddenColumns.includes("coverageDays") ? ["No of Days"] : []),
                      "Production Date",
                      "Confirmed Qty",
                      "Components",
                      "Calculation",
                      "Actions",
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
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-14 text-center">
                        <div className="text-3xl mb-3">📦</div>
                        <div className="text-sm text-[#4a5080]">
                          {search
                            ? "No results found"
                            : "No products created yet"}
                        </div>
                        <div className="text-xs text-[#2a2d4a] mt-1">
                          {search
                            ? "Try a different search"
                            : "Click Create Product to get started"}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((fg) => {
                      const ai = fgProducts.indexOf(fg);
                      const dateEntries = [
                        ...productionPlans
                          .filter((plan) => plan.fgPartNo === fg.partNo)
                          .map((plan) => ({
                            ...plan,
                            status: "Pending",
                          })),
                        ...productionRuns
                          .filter((run) => run.partNo === fg.partNo)
                          .map((run) => ({
                            id: `run-${run.id}`,
                            productionDate: String(run.date || "").slice(0, 10),
                            qty: run.qty,
                            status: "Confirmed",
                          })),
                      ];
                      const plannedDates = dateEntries.sort((a, b) =>
                        String(a.productionDate).localeCompare(
                          String(b.productionDate),
                        ),
                      );
                      return (
                        <tr
                          key={fg.partNo}
                          className="border-b border-[#1a1d35] hover:bg-[#1a1d35] transition-colors"
                        >
                          <td className="px-5 py-3 text-[#4a5080] text-xs">
                            <input
                              type="checkbox"
                              checked={selectedPartNos.includes(fg.partNo)}
                              onChange={() => toggleSelected(fg.partNo)}
                              className="accent-[#6c63ff]"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <span className="bg-[#1a1d35] text-[#6c63ff] text-xs font-mono px-2 py-1 rounded">
                              {fg.partNo}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm font-semibold text-white">
                            {fg.name}
                          </td>
                          <td className="px-5 py-3 text-xs text-[#8890b0] max-w-[200px] truncate">
                            {fg.desc || fg.name || "—"}
                          </td>
                          {(() => { const plan = Number(fg.monthlyPlan?.[new Date().toISOString().slice(0, 7)] || 0); const adr = Math.round(plan / 25); const norm = Number(fg.stockNormDays || 0); const agreed = adr * norm; const coverage = adr ? Math.round(Number(fg.totalStock || 0) / adr) : 0; const [status, tone] = stockStatus(coverage); return <>{!hiddenColumns.includes("productGroup") && <td className="px-5 py-3 text-xs text-[#8890b0] whitespace-nowrap">{fg.productGroup || "-"}</td>}{!hiddenColumns.includes("customer") && <td className="px-5 py-3 text-xs">{fg.customer || "-"}</td>}{!hiddenColumns.includes("monthlyPlan") && <td className="px-5 py-3 text-xs">{plan.toLocaleString()}</td>}{!hiddenColumns.includes("adr") && <td className="px-5 py-3 text-xs">{adr.toLocaleString()}</td>}{!hiddenColumns.includes("stockNormDays") && <td className="px-5 py-3 text-xs">{norm}</td>}{!hiddenColumns.includes("agreedStock") && <td className="px-5 py-3 text-xs">{agreed.toLocaleString()}</td>}{!hiddenColumns.includes("totalStock") && <td className="px-5 py-3 text-xs">{Number(fg.totalStock || 0).toLocaleString()}</td>}{!hiddenColumns.includes("fgCategory") && <td className="px-5 py-3 text-xs">{fg.fgCategory || "-"}</td>}{!hiddenColumns.includes("status") && <td className={`px-5 py-3 text-xs font-semibold ${tone}`}>{status}</td>}{!hiddenColumns.includes("coverageDays") && <td className="px-5 py-3 text-xs font-semibold">{coverage}</td>}</> })()}
                          <td className="px-5 py-3 min-w-[190px]">
                            <ProductionDatesCell plans={plannedDates} />
                          </td>
                          <td className="px-5 py-3 text-sm font-bold text-[#f3bd82]">
                            {getFgPlanQty(fg).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-sm font-bold text-[#3ecfcf]">
                            {fg.items.length}
                          </td>
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              className="fg-calculation-button"
                              onClick={() => setCalculationFg(fg)}
                            >
                              View calculation
                            </button>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-2">
                              <ActionIconButton
                                type="edit"
                                label={`Edit ${fg.partNo}`}
                                onClick={() => openEdit(ai)}
                              />
                              <ActionIconButton
                                type="delete"
                                label={`Delete ${fg.partNo}`}
                                onClick={() => handleDelete(ai)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <FGFormModal
          key={editData?.partNo || "new-fg-product"}
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          editData={editData}
          components={components}
        />
      )}
      {showUpload && (
        <div
          className="fg-upload-backdrop fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowUpload(false)}
        >
          <div
            className="fg-upload-modal p-6 w-[520px] max-w-[95vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold text-base text-white mb-2">
              Upload FG Products
            </div>
            <div className="text-xs text-[#4a5080] mb-4">
              Format: Customer Name, Part No *, Description *, Product Group, Category *,
              Material ID *, Material Description, Norms *. Existing FG IDs are updated. Similar
              names with different IDs return warnings.
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFgUpload(e.target.files?.[0])}
              className="block w-full text-xs text-[#8890b0]"
            />
            {missingFgItems.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#8b5cf6]/40 bg-[#16182d] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d7c9ff] mb-2">
                  Missing FG items
                </div>
                <div className="mb-3 text-xs text-[#a5add6]">
                  {buildFgMissingItemsRows(missingFgItems).length} material row(s) were skipped because the component master does not contain them.
                </div>
                <button
                  type="button"
                  onClick={() => exportMissingFgItems(missingFgItems)}
                  className="px-3 py-2 text-xs font-semibold text-white bg-[#6c63ff] hover:bg-[#5a52e0] rounded-lg transition-colors"
                >
                  Download missing items
                </button>
              </div>
            )}
            <div className="flex justify-end mt-5">
              <button
                onClick={() => {
                  setMissingFgItems([]);
                  setShowUpload(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-[#8890b0] border border-[#1e2235] rounded-lg hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showStockUpload && (
        <div className="fg-upload-backdrop fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowStockUpload(false)}>
          <div className="fg-upload-modal p-6 w-[560px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold text-base text-white mb-2">Upload Daily FG Plan & Stock</div>
            <p className="text-xs text-[#8890b0] mb-4">Required columns: Customer Name, Part No, Month Plan Qty, Stock Norms In days and Total Stock. The workbook must also contain the monitoring date (for example, “Updated on” as in your reference file). Product Group and Category are imported when included. ADR, Agreed Stock, No of Days and Status are calculated automatically.</p>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => handleStockUpload(e.target.files?.[0])} className="block w-full text-xs text-[#8890b0]" />
            <div className="flex justify-end mt-5"><button onClick={() => setShowStockUpload(false)} className="px-4 py-2 text-xs font-semibold text-[#8890b0] border border-[#1e2235] rounded-lg hover:text-white">Close</button></div>
          </div>
        </div>
      )}
      {showMonitoring && (
        <div className="fg-upload-backdrop fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowMonitoring(false)}>
          <div className="fg-upload-modal p-6 w-[1180px] max-w-[96vw] max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div><div className="font-bold text-base text-white">Daily FG Monitoring</div><p className="text-xs text-[#8890b0] mt-1">Daily plan, FG stock coverage and risk status.</p></div>
              <div className="flex gap-2">
                <select value={monitorDate} onChange={(e) => setMonitorDate(e.target.value)} className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-2 text-xs text-white"><option value="">Latest uploaded day</option>{monitorDates.map((date) => <option key={date} value={date}>{date}</option>)}</select>
                <select value={monitorMonth} onChange={(e) => setMonitorMonth(e.target.value)} className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-2 text-xs text-white"><option value="">All months</option>{monitorMonths.map((month) => <option key={month} value={month}>{month}</option>)}</select>
                <button onClick={() => setShowMonitoring(false)} className="px-3 py-2 text-xs border border-[#1e2235] rounded-lg text-[#8890b0]">Close</button>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input value={monitoringSearch} onChange={(e) => setMonitoringSearch(e.target.value)} placeholder="Search part no, customer, group..." className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-2 text-xs text-white w-64" />
              <select value={monitoringStatusFilter} onChange={(e) => setMonitoringStatusFilter(e.target.value)} className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-2 text-xs text-white"><option value="all">All statuses</option>{monitoringStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
              <select value={monitoringCategoryFilter} onChange={(e) => setMonitoringCategoryFilter(e.target.value)} className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-2 text-xs text-white"><option value="all">All groups</option>{monitoringCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select>
              <button onClick={() => { setMonitoringSearch(""); setMonitoringStatusFilter("all"); setMonitoringCategoryFilter("all"); setSelectedMonitoringIds([]); }} className="px-3 py-2 text-xs border border-[#1e2235] rounded-lg text-[#8890b0]">Clear</button>
              <button onClick={toggleAllVisibleMonitoringRows} className="px-3 py-2 text-xs border border-[#1e2235] rounded-lg text-[#8890b0]">{visibleMonitoringRows.length && visibleMonitoringRows.every((row) => selectedMonitoringIds.includes(Number(row.id))) ? "Unselect Visible" : "Select Visible"}</button>
              <button onClick={handleDeleteSelectedMonitoringRows} className="px-3 py-2 text-xs border border-red-500/40 bg-red-500/10 rounded-lg text-red-300">Delete Selected</button>
            </div>
            <div className="overflow-auto">
              <table className="w-full"><thead><tr className="border-b border-[#1e2235]">{["Select", "Customer Name", "Product Group", "Part No", "Description", "Month Plan Qty", "ADR", "Stock Norms In Days", "Agreed Stock", "Total Stock", "No of Days", "Category", "Status", "Action"].map((h, idx) => <th key={`${h}-${idx}`} className="text-left text-[10px] text-[#4a5080] uppercase px-2 py-3 whitespace-nowrap">{h === "Select" ? <span className="inline-flex items-center gap-2">Select</span> : h}</th>)}</tr></thead><tbody>{visibleMonitoringRows.map((row) => { const adr = Number(row.adr || 0); const agreed = Number(row.agreedStock || (adr * Number(row.stockNormDays || 0)) || 0); const coverage = Number(row.coverageDays ?? (adr > 0 ? Number((Number(row.totalStock || 0) / adr).toFixed(1)) : 0)); const selected = selectedMonitoringIds.includes(Number(row.id)); return <tr key={`${row.monitorDate}-${row.partNo}-${row.id || row.monthPlanQty}`} className="border-b border-[#1a1d35]"><td className="px-2 py-3 text-xs"><input type="checkbox" checked={selected} onChange={() => toggleSelectedMonitoringRow(row.id)} className="accent-[#6c63ff]" /></td><td className="px-2 py-3 text-xs">{row.fg?.customer || "—"}</td><td className="px-2 py-3 text-xs">{row.fg?.productGroup || "—"}</td><td className="px-2 py-3 font-mono text-xs text-[#6c63ff]">{row.partNo}</td><td className="px-2 py-3 text-xs">{row.fg?.desc || row.fg?.name || "—"}</td><td className="px-2 py-3 text-xs">{row.monthPlanQty.toLocaleString()}</td><td className="px-2 py-3 text-xs">{adr.toLocaleString()}</td><td className="px-2 py-3 text-xs">{row.stockNormDays}</td><td className="px-2 py-3 text-xs">{agreed.toLocaleString()}</td><td className="px-2 py-3 text-xs font-semibold">{row.totalStock.toLocaleString()}</td><td className="px-2 py-3 text-xs font-bold text-[#c0c8e8]">{coverage}</td><td className="px-2 py-3 text-xs">{row.fg?.fgCategory || "—"}</td><td className={`px-2 py-3 text-xs font-semibold ${row.statusTone}`}>{row.statusText}</td><td className="px-2 py-3 text-xs"><button onClick={() => handleDeleteMonitoringRow(row.id)} className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20">Delete</button></td></tr> })}{visibleMonitoringRows.length === 0 && <tr><td colSpan={14} className="py-12 text-center text-sm text-[#4a5080]">No planned FG rows match the current search or filter. Upload a daily FG plan workbook or clear the filters.</td></tr>}</tbody></table>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
      <FGCalculationModal
        fg={calculationFg}
        components={components}
        planQty={calculationFg ? getFgPlanQty(calculationFg) : 0}
        planSources={
          calculationFg
            ? getPlanSources(calculationFg)
            : { confirmed: 0 }
        }
        onClose={() => setCalculationFg(null)}
      />
    </div>
  );
}

export default FGProducts;
