import logo from '../assets/inel-logo.svg';

function ExportModal({ open, title, rowCount, onClose, onExcel, onPdf }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[460px] max-w-[94vw] overflow-hidden rounded-2xl border border-[#1e2235] bg-[#131627] shadow-2xl">
        <div className="border-b border-[#1e2235] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#3ecfcf] px-4 py-2">
              <img src={logo} alt="INEL" className="h-8" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-[#4a5080]">
                Export Report
              </div>
              <div className="truncate text-base font-bold text-white">{title}</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 rounded-xl border border-[#1e2235] bg-[#0d0f1a] p-4">
            <div className="text-xs uppercase tracking-widest text-[#4a5080]">
              Selected Rows
            </div>
            <div className="mt-1 font-mono text-3xl font-bold text-[#3ecfcf]">
              {Number(rowCount || 0).toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-[#8890b0]">
              Current table/filter data will be downloaded.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onExcel}
              className="rounded-xl border border-[#2a2d4a] bg-[#0d0f1a] px-4 py-5 text-left transition-colors hover:border-[#6c63ff] hover:bg-[#6c63ff]/10"
            >
              <div className="text-sm font-bold text-white">Excel</div>
              <div className="mt-1 text-xs text-[#4a5080]">Download .xlsx file</div>
            </button>
            <button
              onClick={onPdf}
              className="rounded-xl border border-[#2a2d4a] bg-[#0d0f1a] px-4 py-5 text-left transition-colors hover:border-[#3ecfcf] hover:bg-[#3ecfcf]/10"
            >
              <div className="text-sm font-bold text-white">PDF</div>
              <div className="mt-1 text-xs text-[#4a5080]">Download report PDF</div>
            </button>
          </div>
        </div>

        <div className="flex justify-end border-t border-[#1e2235] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#1e2235] px-4 py-2 text-xs font-semibold text-[#8890b0] hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
