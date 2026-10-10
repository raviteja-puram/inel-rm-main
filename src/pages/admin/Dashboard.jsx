import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboard, fetchWorkingDays, saveWorkingDays } from "../../services/api";
import { getCurrentUser } from "../../services/session";
import AdminSidebar from "../../components/AdminSidebar";
import { downloadExcelTable } from "../../utils/exportUtils";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";

const icons = {
  alert: (
    <>
      <path d="M10.3 3.5 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.5a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  box: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4.5 7.5 7.5 4 7.5-4M12 21v-9.5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  arrow: (
    <>
      <path d="M7 17 17 7M8 7h9v9" />
    </>
  ),
};

function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {icons[name]}
    </svg>
  );
}

function NextProductionReport({ summary, rows, onOpenBom, onClose }) {
  if (!summary) {
    return (
      <section className="next-production-report dash-card">
        <div>
          <span className="next-production-eyebrow">Production report</span>
          <h2>No upcoming production plan</h2>
          <p>Add a dated BOM plan to see its stock and shortage report here.</p>
        </div>
      </section>
    );
  }

  const shortageRows = rows.filter((row) => Number(row.shortage || 0) > 0);
  const fgIds = new Set(
    rows
      .flatMap((row) => String(row.fgPartNo || "").split(","))
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const exportReport = () => {
    const exportRows = rows.map((row) => ({
      "Production Date": summary.date,
      "Raw Material ID": row.componentId,
      Description: row.componentDesc || "",
      "Required Qty": Number(row.required || 0),
      "Available Stock": Number(row.stock || 0),
      Shortage: Number(row.shortage || 0),
      "Used by FGs": row.fgPartNo || "",
    }));
    downloadExcelTable(
      `Production Shortage ${summary.date}`,
      Object.keys(exportRows[0] || {}),
      exportRows,
    );
  };

  return (
    <section className="next-production-report dash-card">
      <div className="next-production-head">
        <div>
          <span className="next-production-eyebrow">
            {summary.date === new Date().toISOString().slice(0, 10)
              ? "Today’s production plan"
              : "Next production plan"}
          </span>
          <h2>{summary.date}</h2>
          <p>
            {fgIds.size} FGs · {rows.length} required raw materials
          </p>
        </div>
        <div className="next-production-actions">
          <button onClick={onOpenBom}>Open BOM</button>
          <button className="is-primary" onClick={exportReport}>
            Export report
          </button>
          <button
            type="button"
            aria-label="Hide this production plan from dashboard"
            title="Hide from dashboard"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
      <div className="next-production-stats">
        <div>
          <span>Total required</span>
          <strong>{fmt(summary.required)}</strong>
        </div>
        <div>
          <span>Short raw materials</span>
          <strong className={shortageRows.length ? "is-danger" : "is-safe"}>
            {shortageRows.length}
          </strong>
        </div>
        <div>
          <span>Total shortage</span>
          <strong className={summary.shortage ? "is-danger" : "is-safe"}>
            {fmt(summary.shortage)}
          </strong>
        </div>
      </div>
      <div className="next-production-list">
        {shortageRows.length ? (
          shortageRows
            .slice()
            .sort((a, b) => Number(b.shortage || 0) - Number(a.shortage || 0))
            .slice(0, 5)
            .map((row) => (
              <div key={row.componentId}>
                <span>
                  <b>{row.componentId}</b>
                  <small>{row.componentDesc || "Raw material"}</small>
                </span>
                <span>
                  Required <b>{fmt(row.required)}</b>
                </span>
                <span>
                  Stock <b>{fmt(row.stock)}</b>
                </span>
                <strong>Short {fmt(row.shortage)}</strong>
              </div>
            ))
        ) : (
          <div className="next-production-covered">
            All raw-material requirements are covered for this production date.
          </div>
        )}
      </div>
    </section>
  );
}

function fmt(value) {
  return Number(value || 0).toLocaleString("en-IN");
}
function compact(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return fmt(n);
}

function Panel({ children }) {
  return <section className="dash-card">{children}</section>;
}
function CardTitle({ title, meta, action }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs text-[#8e889d]">{meta}</p>
      </div>
      {action && (
        <button
          onClick={action}
          className="rounded-full bg-white p-2 text-[#08070d]"
        >
          <Icon name="arrow" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, tone, featured, onClick }) {
  const tones = {
    blue: "bg-[#6792ff]/16 text-[#6792ff]",
    red: "bg-[#ff6b6b]/14 text-[#ff6b6b]",
    orange: "bg-[#f0a05d]/14 text-[#f0a05d]",
    green: "bg-[#69df93]/14 text-[#69df93]",
  };
  return (
    <button
      onClick={onClick}
      className={`dash-card dash-kpi dash-kpi-${tone} group relative min-h-[148px] overflow-hidden text-left ${featured ? "dash-kpi-gradient" : ""}`}
    >
      {featured && <span className="dash-wave-art" aria-hidden="true" />}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[.1em] text-[#b0aabd]">
            {label}
          </p>
          <div className="mt-6 text-[38px] font-semibold leading-none tracking-[-.04em] text-white">
            {fmt(value)}
          </div>
          <div className="mt-3 text-xs text-[#8e889d]">
            Live inventory status
          </div>
        </div>
        <span
          className={`grid h-10 w-10 place-items-center rounded-full ${tones[tone]}`}
        >
          <Icon name={icon} />
        </span>
      </div>
    </button>
  );
}

function CoverageDays({ rows, threshold, onThresholdChange, onShowAll }) {
  const colors = ["#7598f5", "#f39a65", "#f3d36b", "#69df93"];
  const limits = [0, 5, 10, 15, 20, 30];
  return (
    <Panel>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold text-white">
            Coverage Days
          </h2>
          <p className="mt-1 text-xs text-[#8e889d]">
            Lowest material cover · live demand
          </p>
        </div>
        <button onClick={onShowAll} className="coverage-show-all">
          Show all
        </button>
      </div>
      <div className="coverage-filter">
        <div className="flex items-center justify-between">
          <span>Show coverage up to</span>
          <strong>{threshold} days</strong>
        </div>
        <input
          aria-label="Coverage day limit"
          type="range"
          min="0"
          max="5"
          step="1"
          value={limits.indexOf(threshold)}
          onChange={(event) =>
            onThresholdChange(limits[Number(event.target.value)])
          }
        />
        <div className="coverage-marks">
          {limits.map((limit) => (
            <span key={limit}>{limit}</span>
          ))}
        </div>
      </div>
      <div className="coverage-grid">
        {rows.slice(0, 6).map((row, index) => {
          const days = Number(row.coverageDays || 0);
          const color = days === 0 ? "#ff7474" : colors[index % colors.length];
          return (
            <div key={row.id} className="coverage-card">
              <span className="coverage-band" style={{ background: color }} />
              <span className="block truncate text-[11px] font-medium uppercase tracking-[.08em] text-[#8e889d]">
                {row.id}
              </span>
              <span className="mt-4 block text-[30px] font-semibold tracking-[-.04em] text-white">
                {days}
                <small className="ml-1 text-xs font-normal text-[#8e889d]">
                  days
                </small>
              </span>
              <span className="mt-3 block truncate text-left text-xs text-[#777183]">
                {row.desc || "Raw material"}
              </span>
            </div>
          );
        })}
      </div>
      {rows.length === 0 && (
        <div className="empty-state">
          No components found at or below {threshold} coverage days.
        </div>
      )}
    </Panel>
  );
}

function CoverageModal({ rows, threshold, onClose }) {
  if (!rows) return null;
  return (
    <div
      className="shortage-modal-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        className="shortage-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coverage-modal-title"
      >
        <header>
          <div>
            <p>Coverage filter</p>
            <h2 id="coverage-modal-title">
              Components at or below {threshold} days
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            X
          </button>
        </header>
        <div className="shortage-modal-summary">
          <div>
            <span>Matching components</span>
            <strong>{rows.length}</strong>
          </div>
          <div>
            <span>Selected coverage limit</span>
            <strong className="text-[#ff7474]">{threshold} days</strong>
          </div>
        </div>
        <div className="shortage-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Description</th>
                <th>Available stock</th>
                <th>Monthly demand</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.desc || "-"}</td>
                  <td>{fmt(row.totalStock)}</td>
                  <td>{fmt(row.monthlyDemand)}</td>
                  <td className="shortage-value">
                    {Number(row.coverageDays || 0)} days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="empty-state">
              No demand-bearing components match this coverage limit.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RecentActivities({ auditLogs, user, onViewAll }) {
  const activities = auditLogs
    .filter((item) => item.actor === user.username)
    .slice(0, 4);
  return (
    <Panel>
      <div className="feed-heading">
        <div>
          <h2>Recent Activities</h2>
          <p>Your admin activity history</p>
        </div>
        <button onClick={onViewAll}>View all</button>
      </div>
      <div className="feed-list">
        {activities.map((item) => (
          <button key={item.id} onClick={onViewAll} className="feed-row">
            <span
              className={`feed-icon ${item.action === "Deleted" ? "feed-red" : "feed-blue"}`}
            >
              <Icon name={item.action === "Deleted" ? "alert" : "check"} />
            </span>
            <span className="feed-copy">
              <strong>
                {item.action} {item.entity}
              </strong>
              <small>{item.detail}</small>
            </span>
            <time>
              {item.createdAt
                ? new Date(`${item.createdAt}Z`).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })
                : "Today"}
            </time>
          </button>
        ))}
        {activities.length === 0 && (
          <div className="empty-state">No recent activity yet.</div>
        )}
      </div>
    </Panel>
  );
}

function AlertsNotifications({ metrics, auditLogs, user, onOpen }) {
  const otherUsers = auditLogs
    .filter((item) => item.actor !== user.username && item.actor !== "system")
    .slice(0, 2);
  const alerts = [
    {
      title: "Expiring Soon",
      detail: `${metrics.expiringSoon || 0} materials have ETA within 30 days`,
      tone: "orange",
      path: "/admin/components",
    },
    {
      title: "Pending BOM Items",
      detail: `${metrics.pendingBomItems || 0} production plans are pending confirmation`,
      tone: "violet",
      path: "/admin/bommaster",
    },
    ...otherUsers.map((item) => ({
      title: `${item.actor} · ${item.action}`,
      detail: `${item.entity} — ${item.detail}`,
      tone: item.action === "Deleted" ? "red" : "blue",
      path: "/admin/reports",
    })),
  ];
  return (
    <Panel>
      <div className="feed-heading">
        <div>
          <h2>Alerts & Notifications</h2>
          <p>Live material-planning signals</p>
        </div>
        <span className="alert-count">{alerts.length}</span>
      </div>
      <div className="feed-list">
        {alerts.map((alert) => (
          <button
            key={alert.title}
            onClick={() => onOpen(alert.path)}
            className={`feed-row alert-feed-row alert-bg-${alert.tone}`}
          >
            <span className={`feed-icon feed-${alert.tone}`}>
              <Icon name={alert.tone === "green" ? "check" : "alert"} />
            </span>
            <span className="feed-copy">
              <strong>{alert.title}</strong>
              <small>{alert.detail}</small>
            </span>
            <b>&gt;</b>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ShortageSummary({ daily, monthly, onSelect }) {
  const cards = [
    {
      type: "daily",
      title: "Day-wise shortage",
      key: daily[0]?.date,
      row: daily[0],
      color: "#7598f5",
    },
    {
      type: "monthly",
      title: "Month-wise shortage",
      key: monthly[0]?.month,
      row: monthly[0],
      color: "#f39a65",
    },
  ];
  return (
    <Panel>
      <CardTitle
        title="Shortage Summary"
        meta="Select a card to inspect calculated items"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <button
            key={card.type}
            onClick={() => card.row && onSelect(card)}
            disabled={!card.row}
            className="shortage-card"
          >
            <span
              className="shortage-band"
              style={{ background: card.color }}
            />
            <span className="flex items-start justify-between gap-3">
              <span className="text-left">
                <span className="block text-[11px] font-medium uppercase tracking-[.08em] text-[#8e889d]">
                  {card.title}
                </span>
                <span className="mt-4 block text-lg font-medium text-white">
                  {card.key || "No shortage"}
                </span>
              </span>
              <span className="shortage-arrow">↗</span>
            </span>
            <span className="mt-7 block text-left text-[34px] font-semibold tracking-[-.05em] text-white">
              {compact(card.row?.shortage)}
            </span>
            <span className="mt-2 block text-left text-xs text-[#8e889d]">
              {card.row?.components || 0} affected components
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ShortageModal({ selection, rows, onClose }) {
  if (!selection) return null;
  return (
    <div
      className="shortage-modal-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        className="shortage-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortage-title"
      >
        <header>
          <div>
            <p>{selection.title}</p>
            <h2 id="shortage-title">{selection.key}</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            X
          </button>
        </header>
        <div className="shortage-modal-summary">
          <div>
            <span>Total shortage</span>
            <strong>{fmt(selection.row?.shortage)}</strong>
          </div>
          <div>
            <span>Affected components</span>
            <strong>{rows.length}</strong>
          </div>
        </div>
        <div className="shortage-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Raw Material</th>
                <th>Description</th>
                <th>Required</th>
                <th>{selection.type === "monthly" ? "Opening Stock" : "Stock"}</th>
                {selection.type === "monthly" && <th>Closing Stock</th>}
                <th>Shortage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.componentId}>
                  <td>{row.componentId}</td>
                  <td>{row.componentDesc || "-"}</td>
                  <td>{fmt(row.required)}</td>
                  <td>{fmt(row.stock)}</td>
                  {selection.type === "monthly" && (
                    <td>{fmt(row.closingStock)}</td>
                  )}
                  <td className="shortage-value">{fmt(row.shortage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FgCriticalTrend({ rows }) {
  const data = rows.slice(-31);
  const chartRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [tooltipPinned, setTooltipPinned] = useState(false);

  useEffect(() => {
    setHovered(null);
    setTooltipPosition(null);
    setTooltipPinned(false);
    window.clearTimeout(hideTimerRef.current);
    return () => window.clearTimeout(hideTimerRef.current);
  }, [rows]);

  if (!data.length) {
    return (
      <Panel>
        <CardTitle title="Daily FG Stock Status Tracking" meta="Automatic trend from Daily FG uploads" />
        <div className="grid min-h-40 place-items-center text-sm text-[#8e889d]">Upload a Daily FG Plan & Stock workbook to start tracking FG stock status.</div>
      </Panel>
    );
  }
  const width = 920, height = 220, left = 34, right = 14, top = 16, bottom = 34;
  const maximum = Math.max(
    1,
    ...data.flatMap((row) => [
      row.critical || 0,
      row.lowStock || 0,
      row.safe || 0,
      row.excess || 0,
    ]),
  );
  const x = (index) => left + (index * (width - left - right)) / Math.max(1, data.length - 1);
  const y = (value) => top + (height - top - bottom) * (1 - Number(value || 0) / maximum);
  const trackingLine = data.map((row, index) => `${index ? "L" : "M"}${x(index)},${y(Math.max(row.critical || 0, row.lowStock || 0, row.safe || 0, row.excess || 0))}`).join(" ");
  const legends = [["Critical", "#ff8b3d", "critical"]];
  const visibleFgs = hovered?.criticalFgs || (hovered?.criticalPartNumbers || hovered?.partNumbers || []).map((partNo) => ({ partNo, description: "" }));
  const setHoveredPoint = (event, row) => {
    const bounds = chartRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setHovered(row);
    setTooltipPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };
  const cancelTooltipClose = () => window.clearTimeout(hideTimerRef.current);
  const scheduleTooltipClose = () => {
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setHovered(null);
      setTooltipPosition(null);
    }, 180);
  };
  const clearHoveredPoint = () => {
    if (!tooltipPinned) scheduleTooltipClose();
  };
  const pinHoveredPoint = (event, row) => {
    setHoveredPoint(event, row);
    setTooltipPinned(true);
  };
  const closeTooltip = () => {
    cancelTooltipClose();
    setTooltipPinned(false);
    setHovered(null);
    setTooltipPosition(null);
  };
  const tooltipWidth = 300;
  const tooltipHeight = Math.min(340, 104 + visibleFgs.length * 34);
  const chartVisibleWidth = window.innerWidth;
  const tooltipLeft = tooltipPosition
    ? tooltipPosition.x + tooltipWidth + 8 <= chartVisibleWidth
      ? tooltipPosition.x + 8
      : Math.max(8, tooltipPosition.x - tooltipWidth - 8)
    : 8;
  const tooltipTop = tooltipPosition
    ? Math.max(8, Math.min(tooltipPosition.y - 28, window.innerHeight - tooltipHeight - 8))
    : 8;
  return (
    <Panel>
      <CardTitle title="Daily FG Stock Status Tracking" meta="Automatic count by coverage band" />
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#b0aabd]">{legends.map(([label, color]) => <span key={label} className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>)}</div>
      <div ref={chartRef} className="relative overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px] w-full" role="img" aria-label="Daily FG stock status trend">
        {[0, 0.5, 1].map((ratio) => <g key={ratio}><line x1={left} x2={width - right} y1={top + ratio * (height - top - bottom)} y2={top + ratio * (height - top - bottom)} stroke="rgba(255,255,255,.1)" /><text x="0" y={top + ratio * (height - top - bottom) + 4} fill="#8e889d" fontSize="10">{Math.round(maximum * (1 - ratio))}</text></g>)}
        <path d={trackingLine} fill="none" stroke="#ff8b3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((row, index) => {
          const pointValue = Math.max(row.critical || 0, row.lowStock || 0, row.safe || 0, row.excess || 0);
          const pointY = y(pointValue);
          const pointX = x(index);
          return (
            <g
              key={row.date}
              onMouseEnter={(event) => { cancelTooltipClose(); setTooltipPinned(false); setHoveredPoint(event, row); }}
              onMouseMove={(event) => { cancelTooltipClose(); setHoveredPoint(event, row); }}
              onMouseLeave={clearHoveredPoint}
              onClick={(event) => pinHoveredPoint(event, row)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={pointX}
                cy={pointY}
                r="14"
                fill="transparent"
                aria-label={`${row.date}: ${row.critical || 0} critical FG part numbers`}
              />
              <circle
                cx={pointX}
                cy={pointY}
                r={hovered?.date === row.date ? 5 : 3.5}
                fill="#f5f2ff"
                stroke="#6792ff"
                strokeWidth={hovered?.date === row.date ? 2.5 : 1.5}
              />
              <text x={pointX} y={pointY - 10} textAnchor="middle" fill="#f6f2ff" fontSize="10" fontWeight="600" style={{ pointerEvents: "none" }}>{pointValue}</text>
              <text x={pointX} y={height - 10} textAnchor="middle" fill="#8e889d" fontSize="10" style={{ pointerEvents: "none" }}>{row.date.slice(8, 10)}</text>
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="fg-chart-tooltip z-10 w-[300px] rounded-xl border border-white/10 bg-[#0d0d13]/95 px-3 py-2 text-[11px] text-[#f4f1ff] shadow-2xl"
          style={{ position: "fixed", left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
          onMouseEnter={cancelTooltipClose}
          onMouseLeave={() => { setTooltipPinned(false); scheduleTooltipClose(); }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-white">{hovered.date}</div>
            <button type="button" onClick={closeTooltip} className="grid h-5 w-5 place-items-center rounded text-[#aaa4ba] hover:bg-white/10 hover:text-white" aria-label="Close graph details">×</button>
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 text-[#cfc8e8]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-white">Critical FG</span>
              <b className="rounded-full bg-[#ff8b3d]/15 px-2 py-0.5 text-[#ffb078]">{hovered.critical || 0}</b>
            </div>
            <div className="mt-2 max-h-[220px] space-y-1 overflow-y-auto pr-1" onWheel={(event) => event.stopPropagation()}>
              {visibleFgs.length ? visibleFgs.map((fg) => (
                <div key={fg.partNo} className="rounded-lg bg-white/5 px-2 py-1.5">
                  <b className="block font-mono text-[#ffcfab]">{fg.partNo}</b>
                  <span className="mt-0.5 block truncate text-[#aaa4ba]" title={fg.description}>{fg.description || "No description"}</span>
                </div>
              )) : <div className="text-[#aaa4ba]">No critical FG items.</div>}
            </div>
          </div>
        </div>
      )}
      </div>
    </Panel>
  );
}

function WorkingDaysModal({ selectedMonth, onClose, onSaved }) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const initialYear = selectedMonth ? String(selectedMonth.split(" ")[1]) : String(new Date().getFullYear());
  const initialMonth = selectedMonth ? String(selectedMonth.split(" ")[0]) : "Sep";
  const [year, setYear] = useState(initialYear);
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [days, setDays] = useState(monthNames.map(() => "24"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const targetYear = selectedMonth ? String(selectedMonth.split(" ")[1]) : year;
    const targetMonth = selectedMonth ? String(selectedMonth.split(" ")[0]) : activeMonth;
    setYear(targetYear);
    setActiveMonth(targetMonth);
    fetchWorkingDays()
      .then((entries) => {
        setDays(
          monthNames.map((month) =>
            String(entries.find((entry) => entry.monthKey === `${month} ${targetYear}`)?.workingDays || 24),
          ),
        );
      })
      .catch(() => {});
  }, [selectedMonth]);

  async function submit() {
    setSaving(true);
    try {
      await saveWorkingDays(
        monthNames.map((month, index) => ({
          monthKey: `${month} ${year}`,
          workingDays: Number(days[index]),
        })),
      );
      const resultMonth = `${activeMonth || "Sep"} ${year}`;
      if (onSaved) onSaved(resultMonth);
      onClose();
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}><section className="w-[680px] max-w-full rounded-2xl border border-white/10 bg-[#13121a] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-white">Working Days Calendar</h2><p className="mt-1 text-xs text-[#8e889d]">Coverage Days = Total Stock ÷ (monthly demand ÷ saved working days).</p></div><button onClick={onClose} className="text-[#b0aabd]">Close</button></div><label className="mb-5 block text-xs text-[#b0aabd]">Year <select value={year} onChange={(event) => setYear(event.target.value)} className="ml-2 rounded-lg border border-white/10 bg-[#08070d] px-3 py-2 text-white">{[0,1,2,3].map((offset) => { const value = String(new Date().getFullYear() + offset); return <option key={value}>{value}</option>; })}</select></label><div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{monthNames.map((month, index) => <button type="button" key={month} onClick={() => setActiveMonth(month)} className={`rounded-xl border p-3 text-left text-xs ${activeMonth === month ? "border-[#6792ff] bg-[#101828] text-white" : "border-white/10 bg-[#0c0b10] text-[#b0aabd]"}`}><span className="block">{month}</span><input aria-label={`${month} ${year} working days`} type="number" min="1" max="31" value={days[index]} onChange={(event) => { setDays((current) => current.map((value, position) => position === index ? event.target.value : value)); setActiveMonth(month); }} className="mt-2 w-full rounded-lg border border-white/10 bg-[#17161d] px-2 py-2 text-sm text-white" /></button>)}</div><div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#b0aabd]">Cancel</button><button disabled={saving} onClick={submit} className="rounded-lg bg-[#6792ff] px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving..." : "Save Working Days"}</button></div></section></div>;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const buildMonthKey = (date = new Date()) => `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
const defaultMonthKey = buildMonthKey();

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [metrics, setMetrics] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthKey);
  const [selectedShortage, setSelectedShortage] = useState(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const [coverageLimit, setCoverageLimit] = useState(10);
  const [dismissedProductionDate, setDismissedProductionDate] = useState(
    () => localStorage.getItem("inel-dismissed-production-report") || "",
  );
  const [showWorkingDays, setShowWorkingDays] = useState(false);
  useEffect(() => {
    let active = true;
    setLoadError("");
    fetchDashboard(selectedMonth)
      .then((data) => {
        if (active) setMetrics(data);
      })
      .catch((error) => {
        console.error(error);
        if (active) setLoadError(error.message || "Dashboard request failed");
      });
    return () => {
      active = false;
    };
  }, [loadAttempt, selectedMonth]);
  if (!user) {
    navigate("/");
    return null;
  }
  if (loadError)
    return (
      <div className="grid min-h-screen place-items-center bg-[#05050a] px-6 text-center text-[#8e889d]">
        <div>
          <p className="text-lg font-semibold text-white">
            Dashboard could not be loaded
          </p>
          <p className="mt-2 text-sm">{loadError}</p>
          <button
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            className="mt-5 rounded-xl bg-[#6792ff] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (!metrics)
    return (
      <div className="grid min-h-screen place-items-center bg-[#05050a] text-[#8e889d]">
        Loading dashboard...
      </div>
    );
  const rows = metrics.componentRows || [];
  const coverage = rows
    .filter((row) => Number(row.monthlyDemand || 0) > 0)
    .sort((a, b) => Number(a.coverageDays || 0) - Number(b.coverageDays || 0));
  const filteredCoverage = coverage.filter(
    (row) => Number(row.coverageDays || 0) <= coverageLimit,
  );
  const daily =
    metrics.shortages?.dailySummary?.filter((row) => row.shortage > 0) || [];
  const monthly =
    metrics.shortages?.monthlySummary?.filter((row) => row.shortage > 0) || [];
  const selectedRows = selectedShortage
    ? (
        (selectedShortage.type === "daily"
          ? metrics.shortages?.daily?.[selectedShortage.key]
          : metrics.shortages?.monthly?.[selectedShortage.key]) || []
      ).filter((row) => Number(row.shortage || 0) > 0)
    : [];
  const auditLogs = metrics.auditLogs || [];
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const upcomingProductionSummaries = (
    metrics.shortages?.dailySummary || []
  )
    .filter((summary) => summary.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date));
  const todaysProductionSummary = upcomingProductionSummaries.find(
    (summary) => summary.date === todayKey,
  );
  const nextProductionSummary =
    todaysProductionSummary || upcomingProductionSummaries[0];
  const nextProductionRows = nextProductionSummary
    ? metrics.shortages?.daily?.[nextProductionSummary.date] || []
    : [];
  const showNextProductionReport =
    !nextProductionSummary ||
    nextProductionSummary.date !== dismissedProductionDate;
  const dismissNextProductionReport = () => {
    if (!nextProductionSummary?.date) return;
    localStorage.setItem(
      "inel-dismissed-production-report",
      nextProductionSummary.date,
    );
    setDismissedProductionDate(nextProductionSummary.date);
  };
  const greeting =
    today.getHours() < 12
      ? "Good Morning"
      : today.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";
  const kpis = [
    {
      label: "Raw Materials",
      value: metrics.totalComponents,
      icon: "box",
      tone: "blue",
      featured: true,
      onClick: () => navigate("/admin/components"),
    },
    {
      label: "Critical Items",
      value: metrics.riskDistribution?.critical,
      icon: "alert",
      tone: "red",
      featured: true,
      onClick: () => navigate("/admin/components?risk=critical"),
    },
    {
      label: "High Risk",
      value: metrics.riskDistribution?.high,
      icon: "alert",
      tone: "orange",
      featured: true,
      onClick: () => navigate("/admin/components?risk=high"),
    },
    {
      label: "Safe Items",
      value: metrics.riskDistribution?.safe,
      icon: "check",
      tone: "green",
      featured: true,
      onClick: () => navigate("/admin/components?risk=safe"),
    },
  ];
  return (
    <div className="erp-dashboard-dark flex min-h-screen bg-[#05050a]">
      <AdminSidebar active="dashboard" user={user} />
      <main className="dashboard-shell min-w-0 flex-1">
        <header className="dashboard-header flex shrink-0 items-center justify-between gap-5 border-b border-white/8">
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-.04em] text-white">
              {greeting}, {user.name || user.username}.
            </h1>
            <p className="mt-2 text-sm text-[#8e889d]">
              {today.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-11 w-[250px] items-center gap-3 rounded-[14px] bg-[#17161d] px-4 text-[#777183] md:flex">
              <Icon name="search" className="h-4 w-4" />
              <span className="text-sm">Search</span>
            </div>
            <button className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#202024] text-[#b0aabd]">
              <Icon name="bell" />
            </button>
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="rounded-[14px] border border-white/10 bg-[#202024] px-3 py-2.5 text-xs font-semibold text-[#b0aabd]"
              >
                {Array.from({ length: 12 }, (_, index) => {
                  const month = monthNames[index];
                  const value = `${month} ${new Date().getFullYear()}`;
                  return <option key={value} value={value}>{value}</option>;
                })}
              </select>
              <button onClick={() => setShowWorkingDays(true)} className="rounded-[14px] bg-[#202024] px-3 py-3 text-xs font-semibold text-[#b0aabd]">{metrics.workingDays || 24} Working Days</button>
            </div>
          </div>
        </header>
        <div className="dashboard-data-scroll">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </section>
          <div className="mt-4">
            <FgCriticalTrend rows={metrics.fgMonitoringTrend || []} />
          </div>
          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CoverageDays
              rows={filteredCoverage}
              threshold={coverageLimit}
              onThresholdChange={setCoverageLimit}
              onShowAll={() => setShowCoverage(true)}
            />
            <ShortageSummary
              daily={daily}
              monthly={monthly}
              onSelect={setSelectedShortage}
            />
          </section>
          {showNextProductionReport && (
            <div className="mt-4">
              <NextProductionReport
                summary={nextProductionSummary}
                rows={nextProductionRows}
                onOpenBom={() => navigate("/admin/bommaster")}
                onClose={dismissNextProductionReport}
              />
            </div>
          )}
          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AlertsNotifications
              metrics={metrics}
              auditLogs={auditLogs}
              user={user}
              onOpen={(path) => navigate(path)}
            />
            <RecentActivities
              auditLogs={auditLogs}
              user={user}
              onViewAll={() => navigate("/admin/reports")}
            />
          </section>
        </div>
      </main>
      <ShortageModal
        selection={selectedShortage}
        rows={selectedRows}
        onClose={() => setSelectedShortage(null)}
      />
      <CoverageModal
        rows={showCoverage ? filteredCoverage : null}
        threshold={coverageLimit}
        onClose={() => setShowCoverage(false)}
      />
      {showWorkingDays && <WorkingDaysModal selectedMonth={selectedMonth} onClose={() => setShowWorkingDays(false)} onSaved={(monthKey) => {
        if (monthKey) setSelectedMonth(monthKey);
        setLoadAttempt((attempt) => attempt + 1);
      }} />}
    </div>
  );
}
