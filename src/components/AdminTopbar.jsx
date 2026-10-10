function TopIcon({ children }) {
  return (
    <button className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#eceafa] bg-white text-[#8a849b] shadow-sm transition hover:border-[#d8d1ff] hover:text-[#6d3df5]">
      {children}
    </button>
  );
}

function AdminTopbar({ title, description, actions }) {
  return (
    <header
      className={`erp-global-topbar ${actions ? "erp-global-topbar-with-actions" : ""}`}
    >
      <div className="erp-topbar-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="erp-topbar-controls">
        <div className="erp-global-search">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span>Search materials, products or reports...</span>
          <kbd>Ctrl K</kbd>
        </div>
        <div className="erp-global-actions">
          <TopIcon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </TopIcon>
        </div>
      </div>
      {actions && <div className="erp-page-actions">{actions}</div>}
    </header>
  );
}

export default AdminTopbar;
