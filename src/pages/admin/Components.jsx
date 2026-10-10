import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchComponents,
  fetchFgProducts,
  fetchProductionPlans,
  fetchProductionRuns,
  fetchReports,
  saveComponent,
  deleteComponentApi,
  uploadComponents,
} from "../../services/api";
import { getCurrentUser } from "../../services/session";
import AdminSidebar from "../../components/AdminSidebar";
import AdminTopbar from "../../components/AdminTopbar";
import ActionIconButton from "../../components/ActionIconButton";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import {
  getComponentTotalRequirement,
  getPlannedComponentRequirement,
  getComponentUsedIn,
  getComponentTotalStock,
  getRequiredQuantity,
  getStockStatus,
} from "../../utils/materialCalculations";
import ExportModal from "../../components/ExportModal";
import { downloadExcelTable, downloadPdfTable } from "../../utils/exportUtils";
// import readXlsxFile from 'read-excel-file/web-worker';

const VALID_CATS = ["Runner", "Repeater", "Stranger", "NPD"];
const MATERIAL_DISCIPLINES = ["Electrical", "Mechanical"];
const VALID_UOMS = ["EA", "KG", "MTR", "NOS"];
const MONTHS = [
  "Jan 2026",
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
  "May 2026",
  "Jun 2026",
];

function getRiskLabel(r) {
  return { critical: "CRITICAL", high: "HIGH RISK", safe: "SAFE" }[r] || "—";
}

function getRiskStyle(r) {
  return (
    {
      critical: {
        chip: "border border-red-200 bg-red-50 text-red-700",
        dot: "#ef4444",
        text: "text-red-600",
        bar: "#ef4444",
      },
      high: {
        chip: "border border-amber-200 bg-amber-50 text-amber-700",
        dot: "#f59e0b",
        text: "text-amber-600",
        bar: "#f59e0b",
      },
      safe: {
        chip: "border border-emerald-200 bg-emerald-50 text-emerald-700",
        dot: "#10b981",
        text: "text-emerald-600",
        bar: "#10b981",
      },
    }[r] || {
      chip: "border border-slate-200 bg-slate-50 text-slate-600",
      dot: "#64748b",
      text: "text-slate-500",
      bar: "#64748b",
    }
  );
}

function RiskChip({ risk }) {
  const s = getRiskStyle(risk);
  return (
    <span
      className={`inline-flex min-w-[80px] items-center justify-center whitespace-nowrap text-xs px-3 py-1 rounded-full font-semibold leading-none ${s.chip}`}
    >
      {getRiskLabel(risk)}
    </span>
  );
}

// FG feasibility is calculated in production-plan order.  As each FG consumes
// a component's available stock, a later FG correctly shows the remaining
// material shortage instead of reusing the same RM stock twice.
function buildFgShortageRows(productionPlans = [], fgProducts = [], components = []) {
  const fgByPartNo = new Map(fgProducts.map((fg) => [fg.partNo, fg]));
  const grouped = new Map();

  // The RM shortage report is date-wise: every date starts from the current
  // opening stock. Keep the exact same rule here, while allocating stock among
  // FGs on that date by their uploaded production priority.
  const plansByDate = productionPlans
    .filter((plan) => Number(plan.qty || 0) > 0)
    .reduce((byDate, plan) => {
      const date = plan.productionDate || "";
      byDate.set(date, [...(byDate.get(date) || []), plan]);
      return byDate;
    }, new Map());

  [...plansByDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .forEach(([, plans]) => {
      const available = new Map(components.map((component) => [component.id, Number(component.stock || 0)]));
      [...plans]
        .sort((a, b) => Number(a.priorityRank || 0) - Number(b.priorityRank || 0))
        .forEach((plan) => {
      const fg = fgByPartNo.get(plan.fgPartNo);
      if (!fg) return;
      const key = `${plan.productionDate || ""}|${fg.partNo}`;
      const row = grouped.get(key) || {
        key,
        date: plan.productionDate || "",
        month: String(plan.productionDate || "").slice(0, 7),
        partNo: fg.partNo,
        name: fg.name || fg.desc || "",
        requiredQty: 0,
        shortage: 0,
        materials: [],
      };
      row.requiredQty += Number(plan.qty || 0);
      (fg.items || []).forEach((item) => {
        const component = components.find((entry) => entry.id === item.componentId);
        const required = getRequiredQuantity(plan.qty, item.norms, component);
        const stock = Math.max(0, Number(available.get(item.componentId) || 0));
        const shortage = Math.max(0, required - stock);
        available.set(item.componentId, Math.max(0, stock - required));
        row.shortage += shortage;
        row.materials.push({
          id: item.componentId,
          desc: component?.desc || item.desc || "",
          required,
          shortage,
          uom: component?.uom || "",
        });
      });
      grouped.set(key, row);
        });
    });

  return [...grouped.values()].map((row) => ({
    ...row,
    status: row.shortage > 0 ? "high" : "safe",
    materialUsed: row.materials
      .map((item) => `${item.id}${item.desc ? ` - ${item.desc}` : ""} (${item.required.toLocaleString()}${item.uom ? ` ${item.uom}` : ""})`)
      .join(" | "),
  }));
}

function FgList({ value, onMore, fgUsages = [], componentUom }) {
  if (!value) return <span className="text-xs text-[#4a5080]">-</span>;
  const rows = String(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    <div className="fg-list-cell relative flex min-w-[260px] max-w-[360px] flex-col gap-1">
      {rows.slice(0, 3).map((item) => (
        <button
          type="button"
          key={item}
          onClick={onMore}
          className="fg-list-trigger truncate text-left text-xs leading-relaxed"
          title={item}
        >
          {item}
        </button>
      ))}
      {rows.length > 3 && (
        <button
          type="button"
          onClick={onMore}
          className="text-left text-[11px] text-[#6c63ff] hover:text-white"
        >
          +{rows.length - 3} more
        </button>
      )}
      <div className="fg-hover-popover" role="tooltip">
        <strong>Component requirement by FG</strong>
        {rows.map((item) => {
          const partNo = item.split(" - ")[0].trim();
          const required = fgUsages
            .filter((usage) => usage.partNo === partNo)
            .reduce((sum, usage) => sum + Number(usage.required || 0), 0);
          return (
            <div key={item}>
              <span>{item}</span>
              <b>
                {required.toLocaleString()} {componentUom || "units"}
              </b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FgListModal({
  title,
  value,
  componentId,
  componentUom,
  fgProducts,
  fgUsages,
  onClose,
}) {
  if (!value) return null;
  const rows = String(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    <div
      className="fg-list-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fg-list-modal w-[620px] max-w-[94vw] max-h-[82vh] overflow-hidden">
        <div className="fg-list-header flex items-center justify-between px-6 py-5">
          <div>
            <div className="font-bold text-base text-white">{title}</div>
            <div className="fg-list-count text-xs mt-1">
              {rows.length} FG products
            </div>
          </div>
          <button
            onClick={onClose}
            className="fg-list-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="fg-list-content p-5 overflow-y-auto max-h-[68vh] space-y-2">
          {rows.map((row) => {
            const fg = fgProducts.find(
              (product) =>
                row === product.partNo || row.startsWith(`${product.partNo} -`),
            );
            const matchingUsages = (fgUsages || []).filter(
              (usage) => usage.partNo === fg?.partNo,
            );
            const required = matchingUsages.reduce(
              (sum, usage) => sum + Number(usage.required || 0),
              0,
            );
            const norms = fg?.items?.find(
              (item) => item.componentId === componentId,
            )?.norms;
            const displayQty = matchingUsages.length ? required : norms;
            return (
              <div
                key={row}
                className="fg-list-row flex items-center justify-between gap-5 rounded-xl px-4 py-3 text-xs"
              >
                <span>{row}</span>
                <span className="fg-usage-value">
                  <strong>
                    {displayQty === undefined || displayQty === null
                      ? "—"
                      : Number(displayQty).toLocaleString()}
                  </strong>
                  <small>
                    {componentUom === "EA"
                      ? "EA (Each)"
                      : componentUom || "units"}{" "}
                    required
                  </small>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
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

function FormModal({ open, onClose, onSave, editData, allComponents }) {
  const [id, setId] = useState(editData?.id || "");
  const [desc, setDesc] = useState(editData?.desc || "");
  const [componentType, setComponentType] = useState(
    editData?.componentType || "",
  );
  const [oeExport, setOeExport] = useState(editData?.oeExport || "");
  const [materialDiscipline, setMaterialDiscipline] = useState(
    editData?.materialDiscipline || "",
  );
  const [cat, setCat] = useState(editData?.cat || "");
  const [productGroup, setProductGroup] = useState(
    editData?.productGroup || "",
  );
  const [uom, setUom] = useState(editData?.uom || "");
  const [vendor, setVendor] = useState(editData?.vendor || "");
  const [vendorCode, setVendorCode] = useState(editData?.vendorCode || "");
  const [idError, setIdError] = useState("");
  const isEdit = !!editData;

  if (!open) return null;

  function checkId(val) {
    setId(val);
    if (!isEdit && allComponents.find((c) => c.id === val.trim()))
      setIdError("⚠ This ID already exists");
    else setIdError("");
  }

  function handleSave() {
    if (!id.trim()) {
      alert("Unique ID is required");
      return;
    }
    if (!desc.trim()) {
      alert("Description is required");
      return;
    }
    if (!cat) {
      alert("Application Category is required");
      return;
    }
    if (!materialDiscipline) {
      alert("Material Discipline is required");
      return;
    }
    if (!uom) {
      alert("UOM is required");
      return;
    }
    if (!isEdit && allComponents.find((c) => c.id === id.trim())) {
      alert("Part Number already exists");
      return;
    }
    onSave({
      ...(editData || {}),
      id: id.trim(),
      desc: desc.trim(),
      componentType: componentType.trim(),
      oeExport: oeExport.trim(),
      materialDiscipline,
      cat,
      productGroup: productGroup.trim(),
      uom,
      vendor: vendor.trim(),
      vendorCode: vendorCode.trim(),
      stock: Number(editData?.stock || 0),
    });
  }

  const inp =
    "w-full bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#6c63ff] placeholder:text-[#4a5080]";
  const lbl = "text-[#8890b0] text-xs mb-1.5 block";

  return (
    <div
      className="component-form-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="component-form-modal w-[540px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <div className="component-form-header flex items-center justify-between px-6 py-5">
          <div>
            <div className="font-bold text-base text-white">
              {isEdit ? "Edit Component" : "Create Component"}
            </div>
            <div className="text-[#4a5080] text-xs mt-0.5">
              Fields marked * are required
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
              <label className={lbl}>PART NUMBER *</label>
              <input
                value={id}
                onChange={(e) => checkId(e.target.value)}
                readOnly={isEdit}
                placeholder="e.g. N1010037"
                className={`${inp} ${isEdit ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              {idError && (
                <span className="text-orange-400 text-xs mt-1 block">
                  {idError}
                </span>
              )}
            </div>
            <div>
              <label className={lbl}>DESCRIPTION *</label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. TRANSISTOR BC 847B"
                className={inp}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>MATERIAL TYPE / CATEGORY</label>
              <input
                value={componentType}
                onChange={(e) => setComponentType(e.target.value)}
                placeholder="e.g. ROH"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>OE / EXPORT</label>
              <input
                value={oeExport}
                onChange={(e) => setOeExport(e.target.value)}
                placeholder="e.g. OE or EXPORT"
                className={inp}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>APPLICATION CATEGORY *</label>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className={inp}
              >
                <option value="">Select application category</option>
                {VALID_CATS.map((application) => (
                  <option key={application} value={application}>
                    {application}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>MATERIAL DISCIPLINE *</label>
              <select
                value={materialDiscipline}
                onChange={(e) => setMaterialDiscipline(e.target.value)}
                className={inp}
              >
                <option value="">Select discipline</option>
                {MATERIAL_DISCIPLINES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <label className={lbl}>UOM *</label>
              <select
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                className={inp}
              >
                <option value="">Select UOM</option>
                {VALID_UOMS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>VENDOR</label>
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Enter vendor"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>VENDOR CODE</label>
              <input
                value={vendorCode}
                onChange={(e) => setVendorCode(e.target.value)}
                placeholder="Enter vendor code"
                className={inp}
              />
            </div>
          </div>
          {/*
          <div className="border-t border-[#1e2235] pt-4">
            <div className="text-[#4a5080] text-xs uppercase tracking-widest mb-3">
              Stock Management
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#0d0f1a] border border-[#1e2235] rounded-lg py-2.5 text-center font-mono text-sm font-bold text-[#3ecfcf]">
                {stock.toLocaleString()}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => applyStock("-")}
                  className="w-9 h-9 flex items-center justify-center bg-[#0d0f1a] border border-[#1e2235] rounded-lg text-[#8890b0] hover:border-red-700 hover:text-red-400 transition-colors text-lg"
                >
                  −
                </button>
                <input
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  type="number"
                  min="0"
                  placeholder="qty"
                  className="flex-1 bg-[#0d0f1a] border border-[#1e2235] rounded-lg py-2 px-3 text-sm text-center font-mono text-white focus:outline-none focus:border-[#6c63ff]"
                />
                <button
                  onClick={() => applyStock("+")}
                  className="w-9 h-9 flex items-center justify-center bg-[#0d0f1a] border border-[#1e2235] rounded-lg text-[#8890b0] hover:border-green-700 hover:text-green-400 transition-colors text-lg"
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-[#4a5080] text-xs mt-2">
              Enter qty and click + to add or − to subtract stock.
            </div>
          </div>
          <div className="border-t border-[#1e2235] pt-4">
            <div className="text-[#4a5080] text-xs uppercase tracking-widest mb-3">
              Workbook Manual Inputs
            </div>
            <div className="grid grid-cols-2 gap-4">
              {MANUAL_COMPONENT_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className={lbl}>{field.label}</label>
                  <input
                    value={extraFields[field.key] ?? ""}
                    onChange={(e) =>
                      updateExtraField(field.key, e.target.value)
                    }
                    type={field.type}
                    min={field.type === "number" ? "0" : undefined}
                    step={field.type === "number" ? "0.01" : undefined}
                    placeholder={field.source}
                    className={inp}
                  />
                </div>
              ))}
            </div>
          </div>
          */}
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
            {isEdit ? "Update Component" : "Save Component"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ open, onClose, onImport }) {
  const [errors, setErrors] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  if (!open) return null;

  // Load SheetJS from CDN at runtime — no npm needed, no vulnerabilities
  async function processFile(file) {
    if (!file) return;
    if (!file.name.match(/\.xlsx?$/i)) {
      setErrors(["Please upload a .xlsx file (Excel 2007 or newer)."]);
      return;
    }
    setErrors([]);
    setLoading(true);
    try {
      const result = await onImport(file);
      setErrors([...(result.errors || []), ...(result.warnings || [])]);
    } catch (err) {
      setErrors([
        `Error uploading file: ${err.message}`,
        "Make sure it is a valid .xlsx Excel file.",
      ]);
    }
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#131627] border border-[#1e2235] rounded-2xl w-[500px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e2235]">
          <div>
            <div className="font-bold text-base text-white">Upload Excel</div>
            <div className="text-[#4a5080] text-xs mt-0.5">
              Prepare your file in the format below
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#4a5080] hover:text-white text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="bg-[#0d0f1a] border border-[#1e2235] rounded-xl p-4 mb-4">
            <div className="text-[#6c63ff] text-xs font-semibold uppercase tracking-widest mb-3">
              Required Column Order
            </div>
            <div className="space-y-2">
              {[
                ["A", "Part Number", true],
                ["B", "Description", true],
                ["C", "Material Discipline (Electrical / Mechanical)", false],
                ["D", `UOM (${VALID_UOMS.join(" / ")})`, true],
                ["E", "Material Type / Category", false],
                ["F", "OE / EXPORT", false],
                ["G", `Application Category (${VALID_CATS.join(" / ")})`, false],
                ["H", "Product Group", false],
                ["I", "Vendor Code", false],
                ["J", "Vendor Name", false],
              ].map(([col, name, req]) => (
                <div key={col} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#4a5080] w-4">
                    {col}
                  </span>
                  <span className="text-xs text-[#c0c8e8] flex-1">{name}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${req ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                  >
                    {req ? "Required" : "Optional"}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-[#4a5080] text-xs mt-3">
              Header names are recognized even when the sheet has an S.no column.
            </div>
          </div>

          <div
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              processFile(e.dataTransfer.files[0]);
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? "border-[#6c63ff] bg-[#6c63ff]/5" : "border-[#2a2d4a] hover:border-[#4a5080]"}`}
          >
            {loading ? (
              <>
                <div className="text-2xl mb-2 animate-spin">...</div>
                <div className="text-sm text-[#6c63ff]">Reading file...</div>
              </>
            ) : (
              <>
                <div className="text-3xl mb-3">Excel Upload</div>
                <div className="text-sm font-medium text-[#6c63ff]">
                  Click to select or drag and drop
                </div>
                <div className="text-xs text-[#4a5080] mt-2">
                  Accepts .xlsx files only
                </div>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => processFile(e.target.files[0])}
          />

          {errors.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-xs font-semibold text-red-400 mb-2">
                ⚠ Issues Found
              </div>
              {errors.map((e, i) => (
                <div key={i} className="text-xs text-red-400 mb-1">
                  • {e}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end px-6 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#8890b0] border border-[#1e2235] rounded-lg hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
function MonthlyDemandPage({
  components,
  onBack,
  getDemandRequirement,
  getComponentRisk,
}) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-[#131627] border border-[#1e2235] text-[#8890b0] rounded-lg text-xs hover:text-white transition-colors"
        >
          ← Back
        </button>
        <div>
          <h2 className="font-bold text-lg text-white">
            Monthly Demand Overview
          </h2>
          <p className="text-[#4a5080] text-xs mt-0.5">
            Stock consumption and coverage by month
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {MONTHS.map((m) => {
          const total = components.reduce(
            (sum, component) => sum + getComponentTotalStock(component),
            0,
          );
          const critical = components.filter((component) => {
            const demandRequirement = getDemandRequirement(component.id);
            return (
              demandRequirement > 0 &&
              getStockStatus(
                demandRequirement,
                getComponentTotalStock(component),
              ) === "critical"
            );
          }).length;
          return (
            <div
              key={m}
              className="bg-[#131627] border border-[#1e2235] rounded-xl p-4"
            >
              <div className="text-[#4a5080] text-xs uppercase tracking-widest mb-3">
                {m}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8890b0] text-xs">
                    Total Components
                  </span>
                  <span className="text-white text-sm font-bold">
                    {components.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8890b0] text-xs">Total Stock</span>
                  <span className="text-[#3ecfcf] text-sm font-bold font-mono">
                    {total.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8890b0] text-xs">Critical</span>
                  <span className="text-red-400 text-sm font-bold">
                    {critical}
                  </span>
                </div>
              </div>
              <div className="mt-3 bg-[#1e2235] rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${components.length ? (1 - critical / components.length) * 100 : 100}%`,
                    background: critical > 0 ? "#e24b4a" : "#639922",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="bg-[#131627] border border-[#1e2235] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1e2235]">
          <div className="font-semibold text-sm text-[#c0c8e8]">
            Component Stock by Month
          </div>
        </div>
        <div
          className="overflow-x-auto"
          style={{ maxHeight: "400px", overflowY: "auto" }}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2235]">
                {[
                  "Part Number",
                  "Description",
                  "Required Qty",
                  "Stock Available",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs text-[#4a5080] uppercase tracking-widest px-5 py-3 font-semibold sticky top-0 bg-[#131627]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {components.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-[#4a5080] text-sm"
                  >
                    No data yet
                  </td>
                </tr>
              ) : (
                components.map((c, i) => {
                  const demandRequirement = getDemandRequirement(c.id);
                  const totalStock = getComponentTotalStock(c);
                  const calculatedRisk = getComponentRisk(c);

                  return (
                    <tr
                      key={i}
                      className="border-b border-[#1a1d35] hover:bg-[#1a1d35] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="bg-[#1a1d35] text-[#6c63ff] text-xs font-mono px-2 py-1 rounded">
                          {c.id}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#8890b0] max-w-[200px] truncate">
                        {c.desc}
                      </td>
                      <td className="px-5 py-3">
                        {demandRequirement > 0 ? (
                          <span
                            className={`text-sm font-bold font-mono ${demandRequirement > totalStock ? "text-red-400" : "text-[#6c63ff]"}`}
                          >
                            {demandRequirement.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-[#4a5080]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm font-bold font-mono text-[#3ecfcf]">
                        {totalStock.toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <RiskChip risk={calculatedRisk} />
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
  );
}

function Components() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const [components, setComponents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editIndex, setEditIndex] = useState(-1);
  const [search, setSearch] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [productGroupFilter, setProductGroupFilter] = useState("all");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [uomFilter, setUomFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState(
    () => new URLSearchParams(location.search).get("risk") || "all",
  );
  const [page, setPage] = useState("components");
  const [toast, setToast] = useState(null);
  const [resettingFilters, setResettingFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [fgProducts, setFgProducts] = useState([]);
  const [productionPlans, setProductionPlans] = useState([]);
  const [shortageView, setShortageView] = useState("rm");
  const [productionRuns, setProductionRuns] = useState([]);
  const [componentMetrics, setComponentMetrics] = useState({});
  const [reportsData, setReportsData] = useState(null);
  const [shortageDate, setShortageDate] = useState("");
  const [shortageMonth, setShortageMonth] = useState("");
  const [shortageOnly, setShortageOnly] = useState(false);
  const [fgModal, setFgModal] = useState(null);
  const [exportJob, setExportJob] = useState(null);
  // Start with the complete master view. Users choose what to hide.
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  async function reloadAll() {
    const [comp, fg, plans, runs, reports] = await Promise.all([
      fetchComponents(),
      fetchFgProducts(),
      fetchProductionPlans(),
      fetchProductionRuns(),
      fetchReports({}),
    ]);
    setComponents(comp);
    setFgProducts(fg);
    setProductionPlans(plans);
    setProductionRuns(runs);
    setReportsData(reports);
    setComponentMetrics(
      Object.fromEntries((reports.rows || []).map((row) => [row.id, row])),
    );
    setShortageDate(
      (prev) => prev || reports.shortages?.dailySummary?.[0]?.date || "",
    );
    setLoading(false);
  }
  useEffect(() => {
    reloadAll().catch(console.error);
  }, []);
  useEffect(() => {
    const requestedRisk = new URLSearchParams(location.search).get("risk");
    const nextRisk = ["critical", "high", "safe"].includes(requestedRisk)
      ? requestedRisk
      : "all";
    setRiskFilter(nextRisk);
    if (requestedRisk) {
      setPage("components");
      setSearch("");
      setShortageOnly(false);
      setShortageDate("");
      setShortageMonth("");
    }
  }, [location.search]);

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
    setEditData(components[i]);
    setEditIndex(i);
    setShowForm(true);
  }

  async function handleSave(comp) {
    setComponents((prev) => {
      const updated =
        editIndex === -1
          ? [...prev, comp]
          : prev.map((c, i) => (i === editIndex ? comp : c));

      return updated;
    });
    showToast(
      `${comp.id} ${editIndex === -1 ? "added" : "updated"}`,
      "success",
    );
    await saveComponent(comp);
    await reloadAll();
    setShowForm(false);
  }
  async function handleDelete(i) {
    if (!window.confirm(`Delete ${components[i].id}?`)) return;
    await deleteComponentApi(components[i].id);
    await reloadAll();
    showToast("Component deleted", "error");
  }
  async function handleDeleteAll() {
    if (!window.confirm("Delete all components?")) return;
    for (const comp of components) await deleteComponentApi(comp.id);
    await reloadAll();
    showToast("All components deleted", "success");
  }

  function toggleSelected(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleAllVisible(visibleComponents) {
    const visibleIds = visibleComponents.map((component) => component.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...prev, ...visibleIds])),
    );
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) {
      alert("Select at least one component to delete");
      return;
    }
    if (
      !window.confirm(`Delete ${selectedIds.length} selected component(s)?`)
    )
      return;
    for (const id of selectedIds) await deleteComponentApi(id);
    await reloadAll();
    setSelectedIds([]);
    showToast("Selected components deleted", "error");
  }

  async function handleImport(file) {
    const result = await uploadComponents(file);
    await reloadAll();
    showToast(result.imported + " components imported/updated", "success");
    if (!result.errors?.length) setShowUpload(false);
    return result;
  }

  function getComponentRisk(component) {
    const metric = componentMetrics[component.id];
    if (metric?.risk) return metric.risk;
    const demandRequirement = Math.max(
      getPlannedComponentRequirement(component.id, fgProducts, component),
      getComponentTotalRequirement(component.id, productionRuns),
    );
    return getStockStatus(demandRequirement, getComponentTotalStock(component));
  }

  const shortageDates =
    reportsData?.shortages?.dailySummary?.map((row) => row.date) || [];
  const shortageMonths =
    reportsData?.shortages?.monthlySummary?.map((row) => row.month) || [];
  const shortageScope = shortageDate ? "date" : shortageMonth ? "month" : "";
  const selectedShortageRows = shortageDate
    ? reportsData?.shortages?.daily?.[shortageDate] || []
    : shortageMonth
      ? reportsData?.shortages?.monthly?.[shortageMonth] || []
      : [];
  const shortageByComponent = Object.fromEntries(
    selectedShortageRows.map((row) => [row.componentId, row]),
  );
  const fgShortageRows = buildFgShortageRows(productionPlans, fgProducts, components);
  const fgCounts = fgShortageRows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { critical: 0, high: 0, safe: 0 },
  );
  const filteredFgShortageRows = fgShortageRows.filter((row) => {
    const matchesDate = !shortageDate || row.date === shortageDate;
    const matchesMonth = !shortageMonth || row.month === shortageMonth;
    const text = `${row.partNo} ${row.name} ${row.materialUsed}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesRisk = riskFilter === "all" || row.status === riskFilter;
    const matchesShortage = !shortageOnly || row.shortage > 0;
    return matchesDate && matchesMonth && matchesSearch && matchesRisk && matchesShortage;
  });
  const uniqueColumnValues = (key) =>
    Array.from(
      new Set(
        components
          .map((component) => String(component[key] || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const columnFilters = {
    "Material Discipline": {
      key: "materialDiscipline",
      value: disciplineFilter,
      setValue: setDisciplineFilter,
      options: MATERIAL_DISCIPLINES,
      allLabel: "All disciplines",
    },
    "Product Group": {
      key: "productGroup",
      value: productGroupFilter,
      setValue: setProductGroupFilter,
      options: uniqueColumnValues("productGroup"),
      allLabel: "All groups",
    },
    "Application Category": {
      key: "cat",
      value: applicationFilter,
      setValue: setApplicationFilter,
      options: uniqueColumnValues("cat"),
      allLabel: "All applications",
    },
    UOM: {
      key: "uom",
      value: uomFilter,
      setValue: setUomFilter,
      options: uniqueColumnValues("uom"),
      allLabel: "All UOM",
    },
    Vendor: {
      key: "vendor",
      value: supplierFilter,
      setValue: setSupplierFilter,
      options: uniqueColumnValues("vendor"),
      allLabel: "All vendors",
    },
  };
  const matchesColumnFilter = (value, selected) => {
    if (selected === "all") return true;
    if (selected === "__blank__") return !String(value || "").trim();
    return String(value || "").trim() === selected;
  };

  const filtered = components.filter((c) => {
    const shortageRow = shortageByComponent[c.id];
    const matchesSelectedPlan =
      !shortageScope || Boolean(shortageRow);
    const matchesSearch =
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.desc.toLowerCase().includes(search.toLowerCase());
    const matchesRisk =
      riskFilter === "all" ||
      (shortageScope && shortageRow
        ? getStockStatus(shortageRow.required, shortageRow.stock)
        : getComponentRisk(c)) === riskFilter;
    const matchesShortage =
      !shortageOnly || Number(shortageRow?.shortage || 0) > 0;
    const matchesProductGroup = matchesColumnFilter(
      c.productGroup,
      productGroupFilter,
    );
    const matchesDiscipline = matchesColumnFilter(
      c.materialDiscipline,
      disciplineFilter,
    );
    const matchesApplication = matchesColumnFilter(c.cat, applicationFilter);
    const matchesUom = matchesColumnFilter(c.uom, uomFilter);
    const matchesSupplier = matchesColumnFilter(c.vendor, supplierFilter);
    return (
      matchesSelectedPlan &&
      matchesSearch &&
      matchesRisk &&
      matchesShortage &&
      matchesDiscipline &&
      matchesProductGroup &&
      matchesApplication &&
      matchesUom &&
      matchesSupplier
    );
  });
  const counts = shortageScope
    ? selectedShortageRows.reduce(
        (acc, row) => {
          const status = getStockStatus(row.required, row.stock);
          acc[status] += 1;
          return acc;
        },
        { critical: 0, high: 0, safe: 0 },
      )
    : components.reduce(
        (acc, component) => {
          const metric = componentMetrics[component.id];
          if (metric?.risk && acc[metric.risk] !== undefined) {
            acc[metric.risk] += 1;
            return acc;
          }
          const demandRequirement = getPlannedComponentRequirement(
            component.id,
            fgProducts,
            component,
          );
          const status = getStockStatus(
            demandRequirement,
            getComponentTotalStock(component),
          );
          if (acc[status] !== undefined) acc[status] += 1;
          return acc;
        },
        { critical: 0, high: 0, safe: 0 },
      );
  const statCards = [
    {
      label: "Critical",
      risk: "critical",
      count: (shortageView === "fg" ? fgCounts : counts).critical,
      sub: "No stock for demand",
      dot: "#e24b4a",
      cls: "text-red-600",
    },
    {
      label: "High Risk",
      risk: "high",
      count: (shortageView === "fg" ? fgCounts : counts).high,
      sub: "Stock below demand",
      dot: "#ef9f27",
      cls: "text-amber-600",
    },
    {
      label: "Safe",
      risk: "safe",
      count: (shortageView === "fg" ? fgCounts : counts).safe,
      sub: "Enough stock",
      dot: "#639922",
      cls: "text-emerald-600",
    },
  ];

  function exportFgShortage() {
    setExportJob({
      title: "FG Production Plan Shortage",
      headers: ["Production Date", "FG Part Number", "FG Description", "Material Used", "Need Qty", "Material Shortage", "Status"],
      rows: filteredFgShortageRows.map((row) => ({
        "Production Date": row.date,
        "FG Part Number": row.partNo,
        "FG Description": row.name,
        "Material Used": row.materialUsed,
        "Need Qty": row.requiredQty,
        "Material Shortage": row.shortage,
        Status: getRiskLabel(row.status),
      })),
    });
  }

  function getTotalRequirement(compId) {
    return getComponentTotalRequirement(compId, productionRuns);
  }

  function getPlannedRequirement(compId) {
    return getPlannedComponentRequirement(
      compId,
      fgProducts,
      components.find((component) => component.id === compId),
    );
  }

  function getDemandRequirement(compId) {
    const metric = componentMetrics[compId];
    if (metric) return metric.demandRequirement || 0;
    return Math.max(getPlannedRequirement(compId), getTotalRequirement(compId));
  }

  function getUsedIn(compId) {
    return getComponentUsedIn(compId, fgProducts);
  }

  function getExportRows() {
    return filtered.map((c) => {
      const shortageRow = shortageByComponent[c.id];
      const usedIn = getUsedIn(c.id);
      const demandRequirement = shortageScope
        ? Number(shortageRow?.required || 0)
        : getDemandRequirement(c.id);
      const totalStock = getComponentTotalStock(c);
      const shortageQty = Math.max(
        0,
        shortageScope && shortageRow
          ? Number(shortageRow.shortage || 0)
          : demandRequirement - totalStock,
      );
      const coverageDays = componentMetrics[c.id]?.coverageDays;
      const calculatedRisk =
        componentMetrics[c.id]?.risk ||
        getStockStatus(demandRequirement, totalStock);
      const usedInText =
        shortageScope && shortageRow
          ? shortageRow.fgList || shortageRow.fgPartNo || ""
          : usedIn.map((fg) => `${fg.partNo} - ${fg.name}`).join(" | ");

      return {
        "Part Number": c.id,
        Description: c.desc,
        "Product Group": c.productGroup || "",
        "Application Category": c.cat,
        "Material Discipline": c.materialDiscipline || "",
        UOM: c.uom,
        Vendor: c.vendor || "",
        "Vendor Code": c.vendorCode || "",
        "Used In": usedInText,
        Requirement: demandRequirement,
        "Total Stock": totalStock,
        "IB Pending": Number(c.ibPending || 0),
        Shortage: shortageQty,
        "Coverage Days": coverageDays ?? "",
        Status: getRiskLabel(calculatedRisk),
      };
    });
  }

  function exportRawMaterials() {
    setExportJob({
      title: "Components Filtered",
      headers: [
        "Part Number",
        "Description",
        "Product Group",
        "Application Category",
        "Material Discipline",
        "UOM",
        "Vendor",
        "Vendor Code",
        "Used In",
        "Requirement",
        "Total Stock",
        "IB Pending",
        "Shortage",
        "Coverage Days",
        "Status",
      ],
      rows: getExportRows(),
    });
  }

  function resetFilters() {
    setResettingFilters(true);
    setSearch("");
    setShortageDate("");
    setShortageMonth("");
    setShortageOnly(false);
    setRiskFilter("all");
    setDisciplineFilter("all");
    setProductGroupFilter("all");
    setApplicationFilter("all");
    setUomFilter("all");
    setSupplierFilter("all");
    navigate(location.pathname, { replace: true });
    showToast("All filters reset", "success");
    window.setTimeout(() => setResettingFilters(false), 350);
  }

  function toggleColumn(key) {
    setHiddenColumns((current) =>
      current.includes(key)
        ? current.filter((column) => column !== key)
        : [...current, key],
    );
  }

  const columnOptions = [
    ["materialDiscipline", "Material Discipline"],
    ["uom", "UOM"],
    ["materialType", "Material Type / Category"],
    ["oeExport", "OE / Export"],
    ["applicationCategory", "Application Category"],
    ["productGroup", "Product Group"],
    ["vendorCode", "Vendor Code"],
    ["vendorName", "Vendor Name"],
    ["usedIn", "Used In"],
    ["requirement", "Required Qty"],
    ["totalStock", "Total Stock"],
    ["ibPending", "IB Pending"],
    ["shortage", "Shortage"],
    ["coverageDays", "Coverage Days"],
  ];

  function closeExport() {
    setExportJob(null);
  }

  function handleExport(format) {
    if (!exportJob?.rows?.length) {
      alert("No rows to export");
      return;
    }
    if (format === "excel")
      downloadExcelTable(exportJob.title, exportJob.headers, exportJob.rows);
    else downloadPdfTable(exportJob.title, exportJob.headers, exportJob.rows);
    closeExport();
  }

  return (
    <div className="erp-admin rm-page flex h-screen overflow-hidden bg-[#05050a] text-white">
      {/* SIDEBAR */}
      <AdminSidebar active="components" user={user} />

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar
          title="Raw Materials"
          description="Component master, stock position and material risk"
          user={user}
          actions={
            page === "components" ? (
              <>
                <button onClick={() => toggleAllVisible(filtered)}>
                  Select Visible
                </button>
                <button onClick={handleDeleteSelected}>
                  Delete Selected ({selectedIds.length})
                </button>
                <button onClick={handleDeleteAll}>Delete All</button>
                <button onClick={() => setShowUpload(true)}>
                  Upload Excel
                </button>
                <button onClick={openCreate}>Create Component</button>
              </>
            ) : null
          }
        />

        <div className="flex-1 overflow-y-auto p-6">
          {page === "demand" ? (
            <MonthlyDemandPage
              components={components}
              onBack={() => setPage("components")}
              getDemandRequirement={getDemandRequirement}
              getComponentRisk={getComponentRisk}
            />
          ) : (
            <>
              {/* STAT CARDS */}
              <div className="grid grid-cols-4 gap-4 mb-5">
                {page === "removed-demand" && (
                <div className="bg-[#131627] border border-[#1e2235] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#6c63ff]" />
                    <span className="text-[#4a5080] text-xs uppercase tracking-widest">
                      Demand
                    </span>
                  </div>
                  <div className="text-xs text-[#8890b0] mb-3 leading-relaxed">
                    Monthly stock trends
                  </div>
                  <button
                    onClick={() => setPage("demand")}
                    className="w-full text-xs text-[#6c63ff] border border-[#2a2d4a] rounded-lg py-1.5 hover:bg-[#6c63ff]/10 transition-all"
                  >
                    View →
                  </button>
                </div>
                )}
                {statCards.map((card) => (
                  <div
                    key={card.label}
                    onClick={() => setRiskFilter(card.risk)}
                    className={`bg-[#131627] border rounded-xl p-4 cursor-pointer transition-colors ${riskFilter === card.risk ? "border-[#6c63ff]" : "border-[#1e2235] hover:border-[#4a5080]"}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: card.dot }}
                      />
                      <span className="text-[#4a5080] text-xs uppercase tracking-widest">
                        {card.label}
                      </span>
                    </div>
                    <div className={`text-4xl font-bold ${card.cls}`}>
                      {card.count}
                    </div>
                    <div className="text-[#4a5080] text-xs mt-1">
                      {card.sub}
                    </div>
                  </div>
                ))}
                <div className="bg-[#131627] border border-[#1e2235] rounded-xl p-4">
                  <div className="text-[#4a5080] text-xs uppercase tracking-widest mb-3">
                    Shortage View
                  </div>
                  <div className="flex rounded-lg overflow-hidden border border-[#2a2d4a]">
                    <button
                      type="button"
                      onClick={() => setShortageView("rm")}
                      className={`flex-1 py-2 text-xs font-semibold transition ${shortageView === "rm" ? "bg-[#6c63ff] text-white" : "text-[#8890b0] hover:bg-white/5"}`}
                    >
                      RM
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShortageView("fg"); setShortageDate(""); setShortageMonth(""); }}
                      className={`flex-1 py-2 text-xs font-semibold transition ${shortageView === "fg" ? "bg-[#6c63ff] text-white" : "text-[#8890b0] hover:bg-white/5"}`}
                    >
                      FG
                    </button>
                  </div>
                  <div className="text-[#4a5080] text-[10px] mt-2">Switch shortage calculation</div>
                </div>
              </div>

              {/* TABLE */}
              {shortageView === "fg" ? (
                <div className="bg-[#131627] border border-[#1e2235] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2235]">
                    <div>
                      <div className="font-semibold text-sm text-[#c0c8e8]">FG Production Plan Shortage ({filteredFgShortageRows.length} / {fgShortageRows.length})</div>
                      <div className="text-[11px] text-[#4a5080] mt-1">FGs from the uploaded production plan; material stock is allocated by production date.</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={exportFgShortage} className="text-xs text-[#6c63ff] border border-[#2a2d4a] rounded-lg px-3 py-1.5 hover:bg-[#6c63ff]/10 whitespace-nowrap">Download</button>
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search FG or material..." className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#6c63ff]" />
                      <select value={shortageDate} onChange={(event) => { setShortageDate(event.target.value); setShortageMonth(""); }} className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-1.5 text-xs text-white">
                        <option value="">All dates</option>{[...new Set(fgShortageRows.map((row) => row.date).filter(Boolean))].sort().map((date) => <option key={date} value={date}>{date}</option>)}
                      </select>
                      <select value={shortageMonth} onChange={(event) => { setShortageMonth(event.target.value); setShortageDate(""); }} className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-1.5 text-xs text-white">
                        <option value="">All months</option>{[...new Set(fgShortageRows.map((row) => row.month).filter(Boolean))].sort().map((month) => <option key={month} value={month}>{month}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-[#8890b0] whitespace-nowrap"><input type="checkbox" checked={shortageOnly} onChange={(event) => setShortageOnly(event.target.checked)} className="accent-[#6c63ff]" /> Shortage only</label>
                    </div>
                  </div>
                  <div className="overflow-auto max-h-[calc(100vh-340px)]">
                    <table className="w-full">
                      <thead><tr className="border-b border-[#1e2235]">{["Production Date", "FG Part Number", "FG Description", "Material Used", "Need Qty", "Material Shortage", "Status"].map((header) => <th key={header} className="text-left text-xs text-[#4a5080] uppercase tracking-widest px-5 py-3 font-semibold whitespace-nowrap sticky top-0 bg-[#131627]">{header}</th>)}</tr></thead>
                      <tbody>{filteredFgShortageRows.length === 0 ? <tr><td colSpan={7} className="py-14 text-center text-sm text-[#4a5080]">No FG production-plan rows match this filter.</td></tr> : filteredFgShortageRows.map((row) => <tr key={row.key} className={`rm-risk-row rm-risk-row-${row.status} border-b border-[#1a1d35]`}><td className="px-5 py-3 text-xs text-[#8890b0] whitespace-nowrap">{row.date || "—"}</td><td className="px-5 py-3"><span className="bg-[#1a1d35] text-[#6c63ff] text-xs font-mono px-2 py-1 rounded">{row.partNo}</span></td><td className="px-5 py-3 text-xs text-[#8890b0]">{row.name || "—"}</td><td className="px-5 py-3 text-xs text-[#8890b0] min-w-[300px] max-w-[480px]">{row.materialUsed || "—"}</td><td className="px-5 py-3 text-sm font-bold font-mono text-[#6c63ff]">{row.requiredQty.toLocaleString()}</td><td className={`px-5 py-3 text-sm font-bold font-mono ${row.shortage > 0 ? "text-red-400" : "text-green-400"}`}>{row.shortage.toLocaleString()}</td><td className="px-5 py-3"><RiskChip risk={row.status} /></td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              ) : (
              <div className="bg-[#131627] border border-[#1e2235] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2235]">
                  <div className="font-semibold text-sm text-[#c0c8e8]">
                    All Raw Materials ({filtered.length} / {components.length})
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={exportRawMaterials}
                      className="text-xs text-[#6c63ff] border border-[#2a2d4a] rounded-lg px-3 py-1.5 hover:bg-[#6c63ff]/10 whitespace-nowrap"
                    >
                      Download
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowColumnMenu((open) => !open)}
                        title={showColumnMenu ? "Close column visibility" : "Show or hide columns"}
                        aria-label={showColumnMenu ? "Close column visibility" : "Show or hide columns"}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-[#2a2d4a] text-[#c0c8e8] hover:bg-white/5"
                      >
                        {showColumnMenu ? (
                          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m3 3 18 18" />
                            <path d="M10.6 10.7a3 3 0 0 0 4.2 4.2" />
                            <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9.3 5.1 10 8-.2.8-.8 2-1.7 3.2" />
                            <path d="M6.2 6.2C4.3 7.6 2.8 9.8 2 12c.7 2.9 4.5 8 10 8 1.8 0 3.4-.5 4.8-1.3" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                            <circle cx="12" cy="12" r="2.5" />
                          </svg>
                        )}
                      </button>
                      {showColumnMenu && (
                        <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-[#2a2d4a] bg-[#131627] p-3 shadow-2xl">
                          <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#8890b0]">
                            Show columns
                          </div>
                          <div className="max-h-72 space-y-1 overflow-y-auto">
                            {columnOptions.map(([key, label]) => (
                              <label
                                key={key}
                                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-xs text-[#c0c8e8] hover:bg-white/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={!hiddenColumns.includes(key)}
                                  onChange={() => toggleColumn(key)}
                                  className="accent-[#6c63ff]"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search ID or description..."
                      className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#6c63ff] placeholder:text-[#4a5080] w-56"
                    />
                    <select
                      value={shortageDate}
                      onChange={(e) => {
                        setShortageDate(e.target.value);
                        if (e.target.value) setShortageMonth("");
                      }}
                      className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#6c63ff]"
                    >
                      <option value="">All dates</option>
                      {shortageDates.map((date) => (
                        <option key={date} value={date}>
                          {date}
                        </option>
                      ))}
                    </select>
                    <select
                      value={shortageMonth}
                      onChange={(e) => {
                        setShortageMonth(e.target.value);
                        if (e.target.value) setShortageDate("");
                      }}
                      className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#6c63ff]"
                    >
                      <option value="">All months</option>
                      {shortageMonths.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-[#8890b0] whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={shortageOnly}
                        onChange={(e) => setShortageOnly(e.target.checked)}
                        className="accent-[#6c63ff]"
                      />
                      Shortage only
                    </label>
                    <select
                      value={riskFilter}
                      onChange={(e) => setRiskFilter(e.target.value)}
                      className="bg-[#0d0f1a] border border-[#1e2235] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#6c63ff]"
                    >
                      <option value="all">All Status</option>
                      <option value="critical">Critical</option>
                      <option value="high">High Risk</option>
                      <option value="safe">Safe</option>
                    </select>
                    <button
                      type="button"
                      onClick={resetFilters}
                      title="Reset all filters"
                      aria-label="Reset all filters"
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-all duration-300 active:scale-90 ${
                        resettingFilters
                          ? "rotate-180 border-[#c99cff] bg-[#352246] text-white"
                          : "border-[#2a2d4a] bg-[#0d0f1a] text-[#9c94a8] hover:border-[#a66cf1]/50 hover:bg-[#241a31] hover:text-[#d8baff]"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 11a8 8 0 1 0-2.34 5.66" />
                        <path d="M20 4v7h-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  className="overflow-x-auto"
                  style={{ maxHeight: "460px", overflowY: "auto" }}
                >
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e2235]">
                        {[
                          ["select", "Select", true],
                          ["partNumber", "Part Number", true],
                          ["description", "Description", true],
                          ["materialDiscipline", "Material Discipline"],
                          ["uom", "UOM"],
                          ["materialType", "Material Type / Category"],
                          ["oeExport", "OE / EXPORT"],
                          ["applicationCategory", "Application Category"],
                          ["productGroup", "Product Group"],
                          ["vendorCode", "Vendor Code"],
                          ["vendorName", "Vendor Name"],
                          ["usedIn", "Used In"],
                          [
                            "requirement",
                            shortageScope === "date"
                              ? "Required Qty"
                              : shortageScope === "month"
                                ? "Monthly Required Qty"
                                : "Required Qty",
                          ],
                          ["totalStock", "Total Stock"],
                          ["ibPending", "IB Pending"],
                          ["shortage", "Shortage"],
                          ["coverageDays", "Coverage Days"],
                          ["status", "Status", true],
                          ["actions", "Actions", true],
                        ]
                          .filter(([key, , fixed]) =>
                            fixed || !hiddenColumns.includes(key),
                          )
                          .map(([key, h]) => {
                          const filter = columnFilters[h];
                          return (
                            <th
                              key={key}
                              className="text-left text-xs text-[#4a5080] uppercase tracking-widest px-5 py-3 font-semibold whitespace-nowrap sticky top-0 bg-[#131627] z-10"
                            >
                              {filter ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <span>{h}</span>
                                  <span
                                    className={`relative grid h-6 w-6 place-items-center rounded-md transition ${
                                      filter.value === "all"
                                        ? "text-[#777184] hover:bg-white/5 hover:text-[#c3bdca]"
                                        : "bg-[#a66cf1]/15 text-[#c99cff]"
                                    }`}
                                    title={
                                      filter.value === "all"
                                        ? `Filter ${h}`
                                        : `${h}: ${filter.value}`
                                    }
                                  >
                                    <svg
                                      viewBox="0 0 20 20"
                                      width="13"
                                      height="13"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <path d="m6 8 4 4 4-4" />
                                    </svg>
                                    <select
                                      value={filter.value}
                                      onChange={(event) =>
                                        filter.setValue(event.target.value)
                                      }
                                      aria-label={`Filter ${h}`}
                                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    >
                                      <option value="all">
                                        {filter.allLabel}
                                      </option>
                                      <option value="__blank__">(Blank)</option>
                                      {filter.options.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </span>
                                </div>
                              ) : (
                                h
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-14 text-center">
                            <div className="text-3xl mb-3">🗂</div>
                            <div className="text-sm text-[#4a5080]">
                              {search
                                ? "No components match your search"
                                : "No components added yet"}
                            </div>
                            <div className="text-xs text-[#2a2d4a] mt-1">
                              {search
                                ? "Try a different search term"
                                : "Click Create Component or Upload Excel to get started"}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filtered.map((c) => {
                          const ai = components.indexOf(c);
                          const shortageRow = shortageByComponent[c.id];
                          const usedIn = getUsedIn(c.id);
                          const visibleFgValue =
                            shortageScope && shortageRow
                              ? shortageRow.fgList || shortageRow.fgPartNo
                              : usedIn
                                  .map((fg) => `${fg.partNo} - ${fg.name}`)
                                  .join("|");
                          const visibleFgUsages =
                            shortageScope && shortageRow
                              ? shortageRow.fgUsages || []
                              : usedIn.map((usedFg) => {
                                  const fg = fgProducts.find(
                                    (item) => item.partNo === usedFg.partNo,
                                  );
                                  const norms =
                                    fg?.items?.find(
                                      (item) => item.componentId === c.id,
                                    )?.norms || 0;
                                  const productionQty = Object.values(
                                    fg?.monthlyPlan || {},
                                  ).reduce(
                                    (sum, qty) => sum + Number(qty || 0),
                                    0,
                                  );
                                  return {
                                    partNo: usedFg.partNo,
                                    required: getRequiredQuantity(
                                      productionQty,
                                      norms,
                                      c,
                                    ),
                                  };
                                });
                          const demandRequirement = shortageScope
                            ? Number(shortageRow?.required || 0)
                            : getDemandRequirement(c.id);
                          const totalStock = getComponentTotalStock(c);
                          const shortageQty = Math.max(
                            0,
                            shortageScope && shortageRow
                              ? Number(shortageRow.shortage || 0)
                              : demandRequirement - totalStock,
                          );
                          const coverageDays =
                            componentMetrics[c.id]?.coverageDays;
                          const calculatedRisk =
                            shortageScope && shortageRow
                              ? getStockStatus(
                                  shortageRow.required,
                                  shortageRow.stock,
                                )
                              : componentMetrics[c.id]?.risk ||
                                getStockStatus(demandRequirement, totalStock);
                          return (
                            <tr
                              key={c.id}
                              className={`rm-risk-row rm-risk-row-${calculatedRisk} border-b border-[#1a1d35] transition-colors`}
                            >
                              <td className="px-5 py-3 text-[#4a5080] text-xs">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(c.id)}
                                  onChange={() => toggleSelected(c.id)}
                                  className="accent-[#6c63ff]"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <span className="bg-[#1a1d35] text-[#6c63ff] text-xs font-mono px-2 py-1 rounded">
                                  {c.id}
                                </span>
                              </td>
                              <td
                                className="px-5 py-3 text-xs text-[#8890b0] max-w-[180px] truncate"
                                title={c.desc}
                              >
                                {c.desc}
                              </td>
                              <td className={hiddenColumns.includes("materialDiscipline") ? "hidden" : "px-5 py-3 text-xs font-semibold text-[#bca5df] whitespace-nowrap"}>
                                {c.materialDiscipline || "-"}
                              </td>
                              <td className={hiddenColumns.includes("uom") ? "hidden" : "px-5 py-3 text-xs font-mono text-[#4a5080]"}>
                                {c.uom || "-"}
                              </td>
                              <td className={hiddenColumns.includes("materialType") ? "hidden" : "px-5 py-3 text-xs text-[#8890b0] whitespace-nowrap"}>
                                {c.componentType || "-"}
                              </td>
                              <td className={hiddenColumns.includes("oeExport") ? "hidden" : "px-5 py-3 text-xs text-[#8890b0] whitespace-nowrap"}>
                                {c.oeExport || "-"}
                              </td>
                              <td className={hiddenColumns.includes("applicationCategory") ? "hidden" : "px-5 py-3 text-xs text-[#8890b0] whitespace-nowrap"}>
                                {c.cat || "-"}
                              </td>
                              <td className={hiddenColumns.includes("productGroup") ? "hidden" : "px-5 py-3 text-xs text-[#8890b0]"}>
                                {c.productGroup || "-"}
                              </td>
                              <td
                                className={hiddenColumns.includes("vendorCode") ? "hidden" : "px-5 py-3 text-xs text-[#8890b0] max-w-[140px] truncate"}
                                title={c.vendorCode || ""}
                              >
                                {c.vendorCode || "-"}
                              </td>
                              <td
                                className={hiddenColumns.includes("vendorName") ? "hidden" : "px-5 py-3 text-xs text-[#8890b0] max-w-[160px] truncate"}
                                title={c.vendor || ""}
                              >
                                {c.vendor || "-"}
                              </td>
                              <td className={hiddenColumns.includes("usedIn") ? "hidden" : "px-5 py-3 min-w-[220px]"}>
                                {visibleFgValue ? (
                                  <FgList
                                    value={visibleFgValue}
                                    fgUsages={visibleFgUsages}
                                    componentUom={c.uom}
                                    onMore={() =>
                                      setFgModal({
                                        title: `${c.id} - ${c.desc}`,
                                        componentId: c.id,
                                        componentUom: c.uom,
                                        fgUsages: visibleFgUsages,
                                        value: visibleFgValue,
                                      })
                                    }
                                  />
                                ) : (
                                  <span className="text-xs text-[#4a5080]">
                                    -
                                  </span>
                                )}
                              </td>
                              <td className={hiddenColumns.includes("requirement") ? "hidden" : "px-5 py-3"}>
                                {(() => {
                                  const isShort =
                                    demandRequirement > totalStock;
                                  return demandRequirement > 0 ? (
                                    <span
                                      className={`text-sm font-bold font-mono ${isShort ? "text-red-400" : "text-[#6c63ff]"}`}
                                    >
                                      {demandRequirement.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-[#4a5080]">
                                      —
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className={hiddenColumns.includes("totalStock") ? "hidden" : "px-5 py-3 text-sm font-bold font-mono text-[#3ecfcf]"}>
                                {totalStock.toLocaleString()}
                              </td>
                              <td className={hiddenColumns.includes("ibPending") ? "hidden" : "px-5 py-3 text-sm font-bold font-mono text-[#f2b86b]"}>
                                {Number(c.ibPending || 0).toLocaleString()}
                              </td>
                              <td
                                className={hiddenColumns.includes("shortage") ? "hidden" : `px-5 py-3 text-sm font-bold font-mono ${shortageQty > 0 ? "text-red-400" : "text-green-400"}`}
                              >
                                {shortageQty.toLocaleString()}
                              </td>
                              <td className={hiddenColumns.includes("coverageDays") ? "hidden" : "px-5 py-3 text-sm font-bold font-mono text-[#8890b0] whitespace-nowrap"}>
                                {coverageDays === null ||
                                coverageDays === undefined
                                  ? "-"
                                  : coverageDays.toLocaleString()}
                              </td>
                              <td className="min-w-[120px] px-5 py-3 whitespace-nowrap">
                                <RiskChip risk={calculatedRisk} />
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex gap-2">
                                  <ActionIconButton
                                    type="edit"
                                    label={`Edit ${c.id}`}
                                    onClick={() => openEdit(ai)}
                                  />
                                  <ActionIconButton
                                    type="delete"
                                    label={`Delete ${c.id}`}
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
              )}
            </>
          )}
        </div>
      </div>

      {showForm && (
        <FormModal
          key={editData?.id || "new-component"}
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          editData={editData}
          allComponents={components}
        />
      )}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onImport={handleImport}
      />
      <FgListModal
        title={fgModal?.title}
        value={fgModal?.value}
        componentId={fgModal?.componentId}
        componentUom={fgModal?.componentUom}
        fgProducts={fgProducts}
        fgUsages={fgModal?.fgUsages}
        onClose={() => setFgModal(null)}
      />
      <Toast toast={toast} />
      <ExportModal
        open={!!exportJob}
        title={exportJob?.title}
        rowCount={exportJob?.rows?.length || 0}
        onClose={closeExport}
        onExcel={() => handleExport("excel")}
        onPdf={() => handleExport("pdf")}
      />
    </div>
  );
}

export default Components;
