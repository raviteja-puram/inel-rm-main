import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchReports } from '../../services/api';
import { getCurrentUser } from '../../services/session';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopbar from '../../components/AdminTopbar';
import ExportModal from '../../components/ExportModal';
import { downloadExcelTable, downloadPdfTable } from '../../utils/exportUtils';
import { getRequiredQuantity } from '../../utils/materialCalculations';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

const fmt = (value) => Number(value || 0).toLocaleString('en-IN');
const runItemRequired = (run, item) =>
  getRequiredQuantity(run.qty, item.norms, { uom: item.componentUom });
const dateKey = (value) => String(value || '').slice(0, 10);
const stamp = (value) => (value ? new Date(value).toLocaleString('en-IN') : '-');
const timeOnly = (value) => (value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-');

function groupByDate(records, getDate) {
  const groups = {};
  records.forEach((record) => {
    const key = dateKey(getDate(record));
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, rows]) => ({ date, rows }));
}

function ExportButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="reports-export-button rounded-lg border px-3 py-2 text-xs font-semibold"
    >
      Export
    </button>
  );
}

function stockCategory(row) {
  if (row.type === 'CONSUMPTION') return 'consumption';
  if (row.type === 'BULK_UPDATE') return 'bulk';
  return 'single';
}

const stockCategoryMeta = {
  bulk: { label: 'Bulk upload', tone: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  consumption: { label: 'Consumption', tone: 'border-red-200 bg-red-50 text-red-700', dot: 'bg-red-500' },
  single: { label: 'Single upload', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
};

function groupStockByCategory(rows) {
  return ['bulk', 'consumption', 'single']
    .map((key) => ({
      key,
      ...stockCategoryMeta[key],
      rows: rows.filter((row) => stockCategory(row) === key),
    }))
    .filter((group) => group.rows.length);
}

function StockDetailModal({ group, onClose, onExport }) {
  if (!group) return null;
  const totalQty = group.rows.reduce((sum, row) => sum + Number(row.qty || 0), 0);
  return (
    <div className="reports-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="reports-detail-modal max-h-[88vh] w-[1180px] max-w-[96vw] overflow-hidden rounded-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Stock movement</div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{group.date} - {group.label}</h2>
            <p className="mt-1 text-xs text-slate-500">{group.rows.length} movement row(s), total qty {fmt(totalQty)}</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton onClick={() => onExport(group)} />
            <button onClick={onClose} className="h-9 w-9 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900">x</button>
          </div>
        </div>
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                {['Time', 'Component', 'Description', 'Before', 'Change', 'After', 'Reason'].map((header) => (
                  <th key={header} className="sticky top-0 bg-slate-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">{timeOnly(row.displayDate)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs font-bold text-blue-600">{row.componentId}</td>
                  <td className="min-w-[280px] px-5 py-3 text-xs text-slate-600">{row.componentDesc || '-'}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-slate-900">{row.beforeStock === '' ? '-' : fmt(row.beforeStock)}</td>
                  <td className={`whitespace-nowrap px-5 py-3 text-xs font-bold ${row.type === 'CONSUMPTION' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {row.type === 'CONSUMPTION' ? '-' : '+'}{fmt(row.qty)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-slate-900">{row.afterStock === '' ? '-' : fmt(row.afterStock)}</td>
                  <td className="min-w-[260px] px-5 py-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-900">{row.changeReason}</div>
                    <div className="mt-1 text-[11px] text-slate-400">{row.remarks || row.transactionId || '-'}</div>
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

function ProductionDetailModal({ record, onClose, onExport }) {
  if (!record) return null;
  const runs = record.runs || [];
  const rows = runs.flatMap((run) =>
    (run.items || []).map((item) => ({ ...item, run })),
  );
  return (
    <div className="reports-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="reports-detail-modal max-h-[88vh] w-[1080px] max-w-[96vw] overflow-hidden rounded-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Production confirmation</div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{record.name || record.bomId}</h2>
            <p className="mt-1 text-xs text-slate-500">{record.bomId} · {record.date}</p>
            {record.description && <p className="mt-2 text-xs text-slate-500">{record.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton onClick={() => onExport(record)} />
            <button onClick={onClose} className="h-9 w-9 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900">x</button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-4">
          {[
            ['FGs on this date', runs.length],
            ['Total FG Quantity', fmt(runs.reduce((sum, run) => sum + Number(run.qty || 0), 0))],
            ['Raw Material Rows', rows.length],
            ['Status', 'Confirmed'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
        <div className="max-h-[54vh] space-y-4 overflow-auto p-4">
          {runs.map((run) => (
            <section key={run.id} className="reports-fg-section overflow-hidden rounded-xl border border-slate-200">
              <div className="reports-fg-header flex items-center justify-between gap-5 border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">FG Number</div>
                  <div className="mt-1 text-sm font-bold text-violet-600">{run.partNo}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{run.name || '-'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Production Qty</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{fmt(run.qty)}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{(run.items || []).length} components</div>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    {['Component ID', 'Description', 'Calculation', 'Norms', 'Required Qty'].map((header) => (
                      <th key={header} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(run.items || []).map((item, index) => (
                    <tr key={`${run.id}-${item.componentId}-${index}`} className="border-t border-slate-100">
                      <td className="px-5 py-3 text-xs font-bold text-blue-600">{item.componentId}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{item.componentDesc || item.desc || '-'}</td>
                      <td className="px-5 py-3 text-xs font-semibold text-slate-700">
                        {fmt(run.qty)} x {fmt(item.norms)} {item.componentUom === 'KG' ? 'g' : ''} = {fmt(runItemRequired(run, item))} {item.componentUom || ''}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold text-slate-800">{fmt(item.norms)} {item.componentUom === 'KG' ? 'g' : ''}</td>
                      <td className="px-5 py-3 text-xs font-bold text-slate-900">{fmt(runItemRequired(run, item))} {item.componentUom || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Reports() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('production');
  const [selected, setSelected] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [stockType, setStockType] = useState('all');
  const [selectedStockGroup, setSelectedStockGroup] = useState(null);
  const [exportState, setExportState] = useState(null);

  useEffect(() => {
    fetchReports({ scope: 'audit' }).then(setData).catch(console.error);
  }, []);

  const productionRuns = useMemo(() => (
    (data?.productionRuns || [])
      .slice()
      .reverse()
      .map((run) => ({ ...run }))
  ), [data]);

  const productionBatches = useMemo(() => {
    const batches = new Map();
    productionRuns.forEach((run) => {
      const legacyId = `BOM-${dateKey(run.date).replaceAll('-', '')}`;
      const bomId = run.bomId || legacyId;
      const productionDate = dateKey(run.date);
      const batchKey = `${bomId}::${productionDate}`;
      const current = batches.get(batchKey) || {
        batchKey,
        bomId,
        name: run.bomName || '',
        description: run.bomDescription || '',
        date: productionDate,
        runs: [],
      };
      current.runs.push(run);
      batches.set(batchKey, current);
    });
    return [...batches.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [productionRuns]);

  const stockRows = useMemo(() => (
    (data?.stockMovements || [])
      .slice()
      .reverse()
      .map((row) => {
        const legacyPositiveMovement = row.type !== 'CONSUMPTION' && row.beforeStock == null && row.afterStock == null;
        const before = legacyPositiveMovement ? 0 : row.beforeStock ?? '';
        const after = legacyPositiveMovement ? Number(row.qty || 0) : row.afterStock ?? '';
        return {
          ...row,
          displayDate: row.createdAt || row.receiptDate,
          beforeStock: before,
          afterStock: after,
          changeReason: row.type === 'CONSUMPTION' ? 'After BOM confirmation' : row.type === 'BULK_UPDATE' ? 'Bulk stock upload' : 'Manual stock addition',
        };
      })
  ), [data]);

  if (!user) {
    navigate('/');
    return null;
  }

  if (!data) {
    return <div className="flex min-h-screen items-center justify-center bg-[#08070d] font-['Poppins'] text-[#918a9f]">Loading reports...</div>;
  }

  function withinFilters(record, text, dateValue) {
    const d = dateKey(dateValue);
    return (!from || d >= from) && (!to || d <= to) && text.toLowerCase().includes(search.toLowerCase());
  }

  const filteredBatches = productionBatches.filter((batch) => (
    withinFilters(
      batch,
      `${batch.bomId} ${batch.name} ${batch.description} ${batch.runs.map((run) => `${run.partNo} ${run.name}`).join(' ')}`,
      batch.date,
    )
  ));
  const filteredStock = stockRows.filter((row) => (
    (stockType === 'all' || stockCategory(row) === stockType) &&
    withinFilters(row, `${row.componentId} ${row.componentDesc} ${row.type} ${row.remarks} ${row.transactionId}`, row.displayDate)
  ));

  const productionGroups = groupByDate(filteredBatches, (batch) => batch.date);
  const stockGroups = groupByDate(filteredStock, (row) => row.displayDate);

  function productionExportRows(records = productionRuns) {
    return records.flatMap((run) => (run.items || []).map((item) => ({
      Date: stamp(run.date),
      'BOM ID': run.bomId || `BOM-${dateKey(run.date).replaceAll('-', '')}`,
      'FG Part Number': run.partNo,
      'FG Name': run.name,
      'FG Quantity': Number(run.qty || 0),
      'Component ID': item.componentId,
      'Component Description': item.componentDesc || item.desc || '',
      Calculation: `${fmt(run.qty)} x ${fmt(item.norms)} ${item.componentUom === 'KG' ? 'g' : ''} = ${fmt(runItemRequired(run, item))} ${item.componentUom || ''}`,
      Norms: Number(item.norms || 0),
      'Required Qty': runItemRequired(run, item),
    })));
  }

  function stockExportRows(records = filteredStock) {
    return records.map((row) => ({
      'Date & Time': stamp(row.displayDate),
      'Component ID': row.componentId,
      'Component Description': row.componentDesc || '',
      'Before Stock': row.beforeStock === '' ? '' : Number(row.beforeStock || 0),
      'Changed Qty': Number(row.qty || 0),
      'After Stock': row.afterStock === '' ? '' : Number(row.afterStock || 0),
      Type: row.type,
      Reason: row.changeReason,
      Remarks: row.remarks || '',
      'Transaction ID': row.transactionId || row.id,
    }));
  }

  function openExport(type, records, title) {
    const productionRecords = type === 'production'
      ? records.flatMap((record) => record.runs || [record])
      : records;
    const rows = type === 'production' ? productionExportRows(productionRecords) : stockExportRows(records);
    const headers = Object.keys(rows[0] || (type === 'production'
      ? { Date: '', 'BOM ID': '', 'FG Part Number': '', 'FG Name': '', 'FG Quantity': '', 'Component ID': '', 'Component Description': '', Calculation: '', Norms: '', 'Required Qty': '' }
      : { 'Date & Time': '', 'Component ID': '', 'Component Description': '', 'Before Stock': '', 'Changed Qty': '', 'After Stock': '', Type: '', Reason: '', Remarks: '', 'Transaction ID': '' }));
    setExportState({ title, rows, headers });
  }

  function downloadExport(kind) {
    if (!exportState) return;
    if (kind === 'excel') downloadExcelTable(exportState.title, exportState.headers, exportState.rows);
    if (kind === 'pdf') downloadPdfTable(exportState.title, exportState.headers, exportState.rows);
    setExportState(null);
  }

  return (
    <div className="erp-admin reports-page flex h-screen overflow-hidden bg-[#05050a] text-white">
      <AdminSidebar active="reports" user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopbar title="Reports" description="Date-wise production confirmations and stock movement audit" user={user} />
        <div className="reports-content flex-1 overflow-y-auto p-6">
          <div className="reports-shell overflow-hidden rounded-xl border">
            <div className="reports-toolbar flex flex-wrap items-center justify-between gap-4 border-b p-4">
              <div className="reports-tabs flex rounded-lg p-1">
                {[
                  ['production', 'Production confirmations'],
                  ['stock', 'Stock movement'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`rounded-md px-4 py-2 text-xs font-semibold ${tab === key ? 'is-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                <span className="text-xs text-slate-400">to</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, product, component..." className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                {tab === 'stock' && (
                  <select value={stockType} onChange={(e) => setStockType(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                    <option value="all">All stock</option>
                    <option value="consumption">Consumption</option>
                    <option value="bulk">Bulk upload</option>
                    <option value="single">Single upload</option>
                  </select>
                )}
                <ExportButton
                  onClick={() => openExport(tab, tab === 'production' ? filteredBatches : filteredStock, tab === 'production' ? 'Production Confirmation Report' : 'Stock Movement Report')}
                />
              </div>
            </div>

            {tab === 'production' ? (
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Date-wise production confirmations</h2>
                    <p className="mt-1 text-[11px] text-slate-500">Choose a date and BOM to see only that date&apos;s confirmed FGs and raw-material calculations.</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{filteredBatches.length} BOM cards</span>
                </div>
                <div className="space-y-5 p-5">
                  {productionGroups.length ? productionGroups.map((group) => (
                    <section key={group.date} className="reports-date-group rounded-xl border p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{group.date}</h3>
                        </div>
                        <ExportButton onClick={() => openExport('production', group.rows, `Production Confirmations ${group.date}`)} />
                      </div>
                      <div className="reports-production-id-list">
                        {group.rows.map((batch) => (
                          <button
                            key={batch.batchKey}
                            onClick={() => setSelected(batch)}
                            className="reports-production-id"
                          >
                            <div>
                              <span>{batch.name || batch.bomId}</span>
                              <small>{batch.bomId}</small>
                            </div>
                            <div className="reports-production-id-summary">
                              <strong>{batch.runs.length} FGs</strong>
                              <small>
                                {fmt(batch.runs.reduce((sum, run) => sum + Number(run.qty || 0), 0))} qty
                              </small>
                            </div>
                            <b>›</b>
                          </button>
                        ))}
                      </div>
                    </section>
                  )) : <div className="py-16 text-center text-sm text-slate-400">No production confirmations for this filter</div>}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Date-wise stock movement report</h2>
                    <p className="mt-1 text-[11px] text-slate-500">Shows component, before stock, changed quantity, after stock, and reason.</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{filteredStock.length} rows</span>
                </div>
                <div className="space-y-5 p-5">
                  {stockGroups.length ? stockGroups.map((group) => (
                    <section key={group.date} className="reports-date-group overflow-hidden rounded-xl border">
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{group.date}</h3>
                          <p className="mt-1 text-[11px] text-slate-500">{group.rows.length} stock movement row(s)</p>
                        </div>
                        <ExportButton onClick={() => openExport('stock', group.rows, `Stock Movement ${group.date}`)} />
                      </div>
                      <div className="grid grid-cols-1 gap-3 bg-white p-4 md:grid-cols-3">
                        {groupStockByCategory(group.rows).map((category) => {
                          const totalQty = category.rows.reduce((sum, row) => sum + Number(row.qty || 0), 0);
                          const latest = category.rows[0];
                          return (
                            <button
                              key={`${group.date}-${category.key}`}
                              onClick={() => setSelectedStockGroup({ ...category, date: group.date })}
                              className={`rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${category.tone}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2.5 w-2.5 rounded-full ${category.dot}`} />
                                  <div className="text-sm font-bold">{category.label}</div>
                                </div>
                                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold">{category.rows.length} rows</span>
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-white/70 p-3">
                                  <div className="text-[10px] uppercase opacity-70">Total qty</div>
                                  <div className="mt-1 text-lg font-black">{fmt(totalQty)}</div>
                                </div>
                                <div className="rounded-lg bg-white/70 p-3">
                                  <div className="text-[10px] uppercase opacity-70">Latest</div>
                                  <div className="mt-1 truncate text-xs font-bold">{timeOnly(latest?.displayDate)}</div>
                                </div>
                              </div>
                              <div className="mt-3 truncate text-[11px] opacity-75">{latest?.componentId || '-'} {latest?.componentDesc || ''}</div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )) : <div className="py-16 text-center text-sm text-slate-400">No stock movements for this filter</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProductionDetailModal record={selected} onClose={() => setSelected(null)} onExport={(record) => openExport('production', [record], `${record.bomId} Production Details`)} />
      <StockDetailModal
        group={selectedStockGroup}
        onClose={() => setSelectedStockGroup(null)}
        onExport={(group) => openExport('stock', group.rows, `Stock Movement ${group.date} ${group.label}`)}
      />
      <ExportModal
        open={Boolean(exportState)}
        title={exportState?.title || ''}
        rowCount={exportState?.rows?.length || 0}
        onClose={() => setExportState(null)}
        onExcel={() => downloadExport('excel')}
        onPdf={() => downloadExport('pdf')}
      />
    </div>
  );
}

export default Reports;
