CREATE TABLE IF NOT EXISTS components (
  id TEXT PRIMARY KEY,
  desc TEXT NOT NULL DEFAULT '',
  component_type TEXT DEFAULT '',
  oe_export TEXT DEFAULT '',
  material_discipline TEXT DEFAULT '',
  cat TEXT DEFAULT '',
  product_group TEXT DEFAULT '',
  uom TEXT DEFAULT '',
  buyer TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  vendor TEXT DEFAULT '',
  vendor_code TEXT DEFAULT '',
  mpn TEXT DEFAULT '',
  make TEXT DEFAULT '',
  spq REAL DEFAULT 0,
  moq REAL DEFAULT 0,
  lead_time_weeks REAL DEFAULT 0,
  rate REAL DEFAULT 0,
  open_balance REAL DEFAULT 0,
  store_stock_mm01 REAL DEFAULT 0,
  inspection_stock REAL DEFAULT 0,
  store_stock_mm10 REAL DEFAULT 0,
  wip_stock REAL DEFAULT 0,
  qr01_stock REAL DEFAULT 0,
  ib_pending REAL DEFAULT 0,
  inward_qty REAL DEFAULT 0,
  eta TEXT DEFAULT '',
  stock REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS fg_products (
  part_no TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  desc TEXT DEFAULT '',
  buyer TEXT DEFAULT '',
  customer TEXT DEFAULT '',
  market_segment TEXT DEFAULT '',
  product_group TEXT DEFAULT '',
  product_type TEXT DEFAULT '',
  customer_category TEXT DEFAULT '',
  stock_norm_days REAL DEFAULT 0,
  total_stock REAL DEFAULT 0,
  fg_category TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS fg_stock_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_date TEXT NOT NULL,
  fg_part_no TEXT NOT NULL,
  month_key TEXT DEFAULT '',
  month_plan_qty REAL DEFAULT 0,
  adr REAL DEFAULT 0,
  stock_norm_days REAL DEFAULT 0,
  total_stock REAL DEFAULT 0,
  UNIQUE(monitor_date, fg_part_no),
  FOREIGN KEY (fg_part_no) REFERENCES fg_products(part_no) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS working_days_calendar (
  month_key TEXT PRIMARY KEY,
  working_days INTEGER NOT NULL DEFAULT 24,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS fg_bom_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fg_part_no TEXT NOT NULL,
  component_id TEXT NOT NULL,
  norms REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (fg_part_no) REFERENCES fg_products(part_no) ON DELETE CASCADE,
  FOREIGN KEY (component_id) REFERENCES components(id),
  UNIQUE(fg_part_no, component_id)
);
CREATE TABLE IF NOT EXISTS fg_monthly_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fg_part_no TEXT NOT NULL,
  month_key TEXT NOT NULL,
  qty REAL DEFAULT 0,
  FOREIGN KEY (fg_part_no) REFERENCES fg_products(part_no) ON DELETE CASCADE,
  UNIQUE(fg_part_no, month_key)
);
CREATE TABLE IF NOT EXISTS production_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fg_part_no TEXT NOT NULL,
  fg_description TEXT DEFAULT '',
  qty REAL NOT NULL,
  production_date TEXT NOT NULL,
  bom_id TEXT DEFAULT '',
  bom_name TEXT DEFAULT '',
  bom_description TEXT DEFAULT '',
  priority_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (fg_part_no) REFERENCES fg_products(part_no)
);
CREATE TABLE IF NOT EXISTS production_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fg_part_no TEXT NOT NULL,
  fg_name TEXT DEFAULT '',
  qty REAL NOT NULL,
  run_date TEXT DEFAULT (datetime('now')),
  bom_id TEXT DEFAULT '',
  bom_name TEXT DEFAULT '',
  bom_description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS production_run_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  component_id TEXT NOT NULL,
  norms REAL DEFAULT 0,
  required REAL DEFAULT 0,
  stock_before REAL DEFAULT NULL,
  FOREIGN KEY (run_id) REFERENCES production_runs(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  transaction_id TEXT DEFAULT '',
  type TEXT NOT NULL,
  component_id TEXT NOT NULL,
  component_desc TEXT DEFAULT '',
  qty REAL DEFAULT 0,
  before_stock REAL DEFAULT NULL,
  after_stock REAL DEFAULT NULL,
  bucket TEXT DEFAULT '',
  vendor TEXT DEFAULT '',
  invoice_no TEXT DEFAULT '',
  receipt_date TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bom_fg ON fg_bom_items(fg_part_no);
CREATE INDEX IF NOT EXISTS idx_bom_component ON fg_bom_items(component_id);
CREATE INDEX IF NOT EXISTS idx_prod_plan_date ON production_plans(production_date);
CREATE INDEX IF NOT EXISTS idx_prod_plan_fg ON production_plans(fg_part_no);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL DEFAULT 'system',
  role TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS email_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enabled INTEGER NOT NULL DEFAULT 1,
    send_time TEXT NOT NULL DEFAULT '17:30',
    report_type TEXT NOT NULL DEFAULT 'daily_inventory',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS email_report_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date TEXT NOT NULL,
    sent_at TEXT,
    status TEXT NOT NULL,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_report_logs_one_success_per_day
ON email_report_logs(report_date)
WHERE status = 'SENT';

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
