import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchComponents, fetchStockMovements, saveStockInward, uploadStock } from '../../services/api';
import { getCurrentUser } from '../../services/session';
import { getPermissions } from '../../services/permissions';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopbar from '../../components/AdminTopbar';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

const fmt = (value) => Number(value || 0).toLocaleString();

function StockUpdate() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const permissions = getPermissions(user);
  const [components, setComponents] = useState([]);
  const [movements, setMovements] = useState([]);
  const [cart, setCart] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [stockMode, setStockMode] = useState('add');
  const [material, setMaterial] = useState({ componentId: '', qty: '' });
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialOptionsOpen, setMaterialOptionsOpen] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);

  async function reload() {
    const [componentRows, movementRows] = await Promise.all([
      fetchComponents(),
      fetchStockMovements(),
    ]);
    setComponents(componentRows);
    setMovements(movementRows);
  }

  useEffect(() => { reload().catch(console.error); }, []);
  if (!user) { navigate('/'); return null; }

  function addLine() {
    const qty = Number(material.qty);
    const invalidQty =
      material.qty === '' ||
      !Number.isFinite(qty) ||
      (stockMode === 'replace' ? qty < 0 : qty <= 0);
    if (!material.componentId || invalidQty)
      return alert(
        stockMode === 'replace'
          ? 'Select material and enter a stock value of 0 or more'
          : 'Select material and enter a quantity greater than 0',
      );
    const component = components.find((item) => item.id === material.componentId);
    setCart((rows) => [...rows.filter((item) => item.componentId !== material.componentId), {
      componentId: component.id,
      componentDesc: component.desc,
      currentStock: Number(component.stock || 0),
      qty,
    }]);
    setMaterial({ componentId: '', qty: '' });
    setMaterialSearch('');
    setMaterialOptionsOpen(false);
  }

  const visibleComponents = components.filter((component) => {
    const query = materialSearch.trim().toLowerCase();
    return !query || String(component.id || '').toLowerCase().includes(query) || String(component.desc || '').toLowerCase().includes(query);
  });
  const stockHistory = movements
    .filter((movement) =>
      ['INWARD', 'STOCK_REPLACE', 'BULK_UPDATE'].includes(movement.type),
    )
    .slice()
    .reverse();
  const historyDates = Array.from(
    stockHistory.reduce((groups, movement) => {
      const date = String(movement.createdAt || movement.receiptDate || '').slice(0, 10);
      if (!date) return groups;
      const group = groups.get(date) || { date, count: 0, qty: 0 };
      group.count += 1;
      group.qty += Number(movement.qty || 0);
      groups.set(date, group);
      return groups;
    }, new Map()).values(),
  ).sort((a, b) => b.date.localeCompare(a.date));
  const selectedHistory = selectedHistoryDate
    ? stockHistory.filter(
        (movement) =>
          String(movement.createdAt || movement.receiptDate || '').slice(0, 10) ===
          selectedHistoryDate,
      )
    : [];

  async function addStock() {
    if (!cart.length) return alert('Add at least one material line');
    const result = await saveStockInward({
      mode: stockMode,
      items: cart.map(({ componentId, qty }) => ({ componentId, qty })),
    });
    setComponents(result.components);
    setMovements(result.movements || []);
    setCart([]);
    alert(
      stockMode === 'replace'
        ? 'Existing stock replaced successfully'
        : 'Quantity added to existing stock successfully',
    );
  }

  return (
    <div className="erp-admin stock-page flex h-screen overflow-hidden bg-[#05050a] text-white">
      <AdminSidebar active="stock" user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopbar
          title="Upload Stock"
          description="Add stock quantities directly or upload them from Excel"
          user={user}
          actions={permissions.canManageStock ? <button onClick={() => setShowUpload(true)} className="erp-primary-action">Upload Stock Excel</button> : null}
        />
        <div className="stock-content flex-1 space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-[1fr_360px] gap-5">
            <section className="stock-entry-card overflow-hidden rounded-xl border shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-sm font-semibold">Update stock</h2>
                <p className="mt-1 text-[11px] text-slate-500">First choose whether the entered quantity should be added or replace the current stock.</p>
              </div>
              <div className="stock-entry-form p-5">
                <div className="stock-mode-options mb-5 grid grid-cols-2 gap-3">
                  {[
                    {
                      value: 'add',
                      title: 'Add to existing',
                      description: 'Current stock + entered quantity',
                    },
                    {
                      value: 'replace',
                      title: 'Replace existing',
                      description: 'Entered quantity becomes total stock',
                    },
                  ].map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setStockMode(option.value)}
                      className={`stock-mode-option rounded-xl border p-3 text-left transition ${
                        stockMode === option.value
                          ? 'border-[#a66cf1] bg-[#a66cf1]/15 text-white'
                          : 'border-white/10 bg-[#111015] text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span
                          className={`h-2.5 w-2.5 rounded-full border ${
                            stockMode === option.value
                              ? 'border-[#c99cff] bg-[#c99cff]'
                              : 'border-slate-600'
                          }`}
                        />
                        {option.title}
                      </div>
                      <div className="mt-1.5 pl-[18px] text-[10px] opacity-70">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-[1fr_150px_auto] items-end gap-3">
                  <div className="text-xs text-slate-500">
                    <label>Raw material</label>
                    <div className="stock-material-combobox relative mt-1.5">
                      <input
                        type="text"
                        value={materialSearch}
                        onFocus={() => setMaterialOptionsOpen(true)}
                        onBlur={() => setTimeout(() => setMaterialOptionsOpen(false), 120)}
                        onChange={(e) => {
                          setMaterialSearch(e.target.value);
                          setMaterial((current) => ({ ...current, componentId: '' }));
                          setMaterialOptionsOpen(true);
                        }}
                        placeholder="Type raw material ID or description..."
                        autoComplete="off"
                        className="block w-full rounded-lg border px-3 py-2.5 text-sm"
                      />
                      {materialOptionsOpen && !material.componentId && (
                        <div className="stock-material-options">
                          {visibleComponents.length ? (
                            visibleComponents.map((component) => (
                              <button
                                type="button"
                                key={component.id}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setMaterial((current) => ({
                                    ...current,
                                    componentId: component.id,
                                  }));
                                  setMaterialSearch(`${component.id} - ${component.desc}`);
                                  setMaterialOptionsOpen(false);
                                }}
                              >
                                <strong>{component.id}</strong>
                                <span>{component.desc || 'No description'}</span>
                              </button>
                            ))
                          ) : (
                            <div className="stock-material-empty">No matching materials</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <label className="text-xs text-slate-500">
                    Quantity
                    <input type="number" value={material.qty} onChange={(e) => setMaterial((v) => ({ ...v, qty: e.target.value }))} className="mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm" />
                  </label>
                  <button onClick={addLine} className="erp-secondary-action h-[42px]">+ Add line</button>
                </div>
              </div>
            </section>

            <section className="stock-cart-card overflow-hidden rounded-xl border shadow-sm">
              <div className="flex justify-between border-b p-5">
                <div>
                  <h2 className="text-sm font-semibold">
                    {stockMode === 'replace' ? 'Stock to replace' : 'Stock to add'}
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-500">{cart.length} material lines</p>
                </div>
                <span className="text-xs font-bold">{fmt(cart.reduce((sum, item) => sum + item.qty, 0))}</span>
              </div>
              <div className="min-h-[190px] divide-y">
                {cart.length ? cart.map((item) => (
                  <div key={item.componentId} className="flex justify-between gap-3 p-4">
                    <div>
                      <div className="text-xs font-semibold text-[#6d3df5]">{item.componentId}</div>
                      <div className="max-w-[220px] truncate text-[11px] text-slate-500">{item.componentDesc}</div>
                    </div>
                    <div className="text-right">
                      <b className="text-xs">{fmt(item.qty)}</b>
                      <div className="mt-1 text-[9px] text-slate-500">
                        {stockMode === 'replace'
                          ? `${fmt(item.currentStock)} → ${fmt(item.qty)}`
                          : `${fmt(item.currentStock)} + ${fmt(item.qty)} = ${fmt(item.currentStock + item.qty)}`}
                      </div>
                      <button onClick={() => setCart((rows) => rows.filter((x) => x.componentId !== item.componentId))} className="mt-1 block text-[10px] text-red-500">Remove</button>
                    </div>
                  </div>
                )) : <div className="py-16 text-center text-xs text-slate-400">No materials added</div>}
              </div>
              <div className="border-t p-4">
                <button onClick={addStock} className="erp-primary-action w-full">
                  {stockMode === 'replace' ? 'Replace Stock' : 'Add Stock'}
                </button>
              </div>
            </section>
          </div>

          <section className="stock-history-card overflow-hidden rounded-xl border">
            <div className="border-b p-5">
              <h2 className="text-sm font-semibold">Stock Addition History</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Select a date to view its manual and Excel stock additions
              </p>
            </div>
            {historyDates.length ? (
              <div className="p-5">
                <div className="stock-history-date-cards">
                  {historyDates.map((group) => (
                    <button
                      type="button"
                      key={group.date}
                      className={selectedHistoryDate === group.date ? 'is-active' : ''}
                      onClick={() =>
                        setSelectedHistoryDate((current) =>
                          current === group.date ? null : group.date,
                        )
                      }
                    >
                      <small>
                        {new Date(`${group.date}T00:00:00`).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </small>
                      <strong>{fmt(group.qty)}</strong>
                      <span>{group.count} stock updates</span>
                    </button>
                  ))}
                </div>

                {selectedHistoryDate && (
                  <div className="stock-history-detail">
                    <div>
                      <span>
                        {new Date(`${selectedHistoryDate}T00:00:00`).toLocaleDateString('en-GB', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <b>{selectedHistory.length} updates</b>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            {['Time', 'Component ID', 'Description', 'Before Stock', 'Entered Qty', 'After Stock', 'Method'].map((heading) => (
                              <th key={heading}>{heading}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedHistory.map((movement) => (
                            <tr key={movement.id}>
                              <td>
                                {new Date(
                                  movement.createdAt || movement.receiptDate,
                                ).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td><strong>{movement.componentId}</strong></td>
                              <td>{movement.componentDesc || '-'}</td>
                              <td>
                                {movement.beforeStock === null ||
                                movement.beforeStock === undefined
                                  ? '-'
                                  : fmt(movement.beforeStock)}
                              </td>
                              <td>
                                <b>
                                  {movement.type === 'INWARD' ? '+' : ''}
                                  {fmt(movement.qty)}
                                </b>
                              </td>
                              <td>
                                <b className="stock-after">
                                  {movement.afterStock === null ||
                                  movement.afterStock === undefined
                                    ? '-'
                                    : fmt(movement.afterStock)}
                                </b>
                              </td>
                              <td>
                                <span className={movement.type === 'BULK_UPDATE' ? 'is-excel' : 'is-manual'}>
                                  {movement.type === 'BULK_UPDATE'
                                    ? 'Excel upload'
                                    : movement.type === 'STOCK_REPLACE'
                                      ? 'Manual replace'
                                      : 'Manual add'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500">
                No stock has been added yet
              </div>
            )}
          </section>
        </div>
      </div>
      {showUpload && (
        <div className="stock-upload-backdrop fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowUpload(false)}>
          <section className="stock-upload-modal w-[500px] max-w-[94vw] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold">Upload Stock</h2>
                <p className="mt-1 text-xs">Update multiple Raw Material stock values from Excel.</p>
              </div>
              <button type="button" onClick={() => setShowUpload(false)} aria-label="Close">×</button>
            </div>
            <div className="stock-upload-note">
              <strong className="mb-2 block text-white">Column name controls the stock action</strong>
              <div className="space-y-2">
                <div>
                  <b className="text-[#7edcc4]">Update Stock</b>
                  <span> — adds the uploaded quantity to the previous stock.</span>
                </div>
                <div>
                  <b className="text-[#f2b86b]">Total Stock</b>
                  <span> — replaces the previous stock with the uploaded value.</span>
                </div>
                <div>
                  <b className="text-[#a66cf1]">IB Pending</b>
                  <span> — updates the Raw Materials IB Pending column.</span>
                </div>
              </div>
              <div className="mt-3 text-[10px] opacity-70">
                Also accepted: Stock Delta / Received Qty for Add, and Stock Value / Stock for Replace. IB Pending can be uploaded with either stock action or by itself.
              </div>
            </div>
            <input
              className="stock-upload-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (
                  !window.confirm(
                    'Confirm stock upload rules:\\n\\n' +
                      '• Update Stock = ADD to existing stock\\n' +
                      '• Total Stock = REPLACE existing stock\\n' +
                      '• IB Pending = UPDATE the IB Pending value\\n\\n' +
                      `Continue with ${file.name}?`,
                  )
                ) {
                  e.target.value = '';
                  return;
                }
                const result = await uploadStock(file);
                await reload();
                if (result.errors?.length || result.notFound?.length) {
                  alert(
                    [
                      ...(result.errors || []),
                      ...(result.notFound || []).map(
                        (id) => `Unknown raw material ID ${id} skipped`,
                      ),
                    ].join("\n"),
                  );
                }
                alert(
                  `Stock upload completed.\\n\\nAdded to existing: ${result.added || 0}\\nReplaced existing: ${result.replaced || 0}\\nIB Pending updated: ${result.ibPendingUpdated || 0}`,
                );
                setShowUpload(false);
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}

export default StockUpdate;
