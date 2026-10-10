const BASE = import.meta.env.DEV ? "http://localhost:3001/api" : "/api";

async function request(path, options = {}) {
  let actorHeaders = {};
  try {
    const user = JSON.parse(localStorage.getItem("inel_rm_current_user"));
    if (user) actorHeaders = { "X-INEL-User": user.username || "", "X-INEL-Role": user.role || "" };
  } catch { /* Anonymous API access. */ }
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json", ...actorHeaders, ...(options.headers || {}) }, ...options });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `Request failed: ${res.status}`); }
  return res.json();
}

async function uploadFile(path, file) {
  const form = new FormData(); form.append("file", file);
  let headers = {};
  try { const user = JSON.parse(localStorage.getItem("inel_rm_current_user")); if (user) headers = { "X-INEL-User": user.username || "", "X-INEL-Role": user.role || "" }; } catch { /* Anonymous API access. */ }
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: form, headers });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export const fetchComponents = () => request("/components");
export const saveComponent = (c) => request("/components", { method: "POST", body: JSON.stringify(c) });
export const deleteComponentApi = (id) => request(`/components/${encodeURIComponent(id)}`, { method: "DELETE" });
export const uploadComponents = (file, workbook = false) => uploadFile(`/uploads/components${workbook ? "?mode=workbook" : ""}`, file);
export const fetchFgProducts = () => request("/fg-products");
export const saveFgProduct = (fg) => request("/fg-products", { method: "POST", body: JSON.stringify(fg) });
export const deleteFgProductApi = (partNo) => request(`/fg-products/${encodeURIComponent(partNo)}`, { method: "DELETE" });
export const uploadFgProducts = (file) => uploadFile("/uploads/fg-products", file);
export const fetchFgStockMonitoring = () => request("/fg-stock-monitoring");
export const deleteFgStockSnapshotApi = (id) => request(`/fg-stock-monitoring/${encodeURIComponent(id)}`, { method: "DELETE" });
export const uploadFgStockMonitoring = (file) => uploadFile("/uploads/fg-stock-monitoring", file);
export const fetchWorkingDays = () => request("/working-days");
export const saveWorkingDays = (entries) => request("/working-days", { method: "PUT", body: JSON.stringify({ entries }) });
export const fetchProductionPlans = () => request("/production-plans");
export const previewProductionPlan = (file) => uploadFile("/uploads/production-plan", file);
export const confirmProductionPlans = (plans) => request("/production-plans/confirm", { method: "POST", body: JSON.stringify({ plans }) });
export const updateProductionPlanPriorities = (ids) => request("/production-plans/priorities", { method: "PUT", body: JSON.stringify({ ids }) });
export const confirmUploadedProductionPlans = (ids = []) => request("/production-plans/confirm-production", { method: "POST", body: JSON.stringify({ ids }) });
export const confirmProductionPlan = (id) => request(`/production-plans/${encodeURIComponent(id)}/confirm-production`, { method: "POST" });
export const deleteProductionPlan = (id) => request(`/production-plans/${encodeURIComponent(id)}`, { method: "DELETE" });
export const clearProductionPlans = () => request("/production-plans", { method: "DELETE" });
export const fetchProductionRuns = () => request("/production-runs");
export const confirmProductionRun = (payload) => request("/production-runs", { method: "POST", body: JSON.stringify(payload) });
export const fetchStockMovements = () => request("/stock/movements");
export const saveStockInward = (payload) => request("/stock/inward", { method: "POST", body: JSON.stringify(payload) });
export const uploadStock = (file) => uploadFile("/uploads/stock", file);
export const fetchDashboard = (month) => request(`/dashboard${month ? `?month=${encodeURIComponent(month)}` : ""}`);
export const fetchReports = (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/reports${qs ? `?${qs}` : ""}`); };
export const sendRiskEmailNow = () => request("/reports/email-now", { method: "POST" });
export const fetchEmailRecipients = () => request("/email/recipients");
export const addEmailRecipient = (recipient) => request("/email/recipients", {method: "POST",body: JSON.stringify(recipient),});
export const updateEmailRecipient = (id, recipient) => request(`/email/recipients/${encodeURIComponent(id)}`, {method: "PUT",body: JSON.stringify(recipient),});
export const deleteEmailRecipient = (id) => request(`/email/recipients/${encodeURIComponent(id)}`, {method: "DELETE",});
export const fetchEmailSettings = () => request("/email/settings");
export const updateEmailSettings = (settings) => request("/email/settings", {method: "PUT",body: JSON.stringify(settings),});
export const fetchEmailLogs = () =>request("/email/logs");
export const deleteAllData = () => request("/admin/all-data", { method: "DELETE" });
