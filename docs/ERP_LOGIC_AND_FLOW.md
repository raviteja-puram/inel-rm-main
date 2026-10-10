# INEL RM ERP Logic And Flow

## Business Flow

This app manages raw materials purchased from vendors and consumed while making finished/customer products.

Correct operating sequence:

1. Create raw materials in `Components`.
2. Create products/customer sellable items in `FG Products`.
3. For every product, define its BOM: raw material ID plus norms per product.
4. Enter monthly product plan in `FG Products`.
5. Receive purchased raw materials from vendors in `Stock Inward`.
6. Confirm production/sale quantity in `BOM Master`.
7. App deducts raw material stock and records movement history.
8. Dashboard/Reports calculate stock risk, coverage, shortages, and history dynamically.

## Manual Data Entry Needed

### Components / Raw Material Master

Manual fields:

- Component ID
- Description
- Application category
- UOM
- Supplier
- MPN
- Make
- SPQ
- MOQ
- Lead time
- Rate
- Buyer/controller
- Opening balance
- Stock buckets:
  - Store Stock MM01
  - Store Stock MM10
  - Inspection / QAD stock
  - WIP / PP00 stock
  - QR01 stock
- IB pending
- Planned inward
- ETA / remarks

Excel source:

- `Material Status review as on 29 Jun'26.xlsx`, sheet `ETA`
  - Component ID: column `G`
  - Component description: column `I`
  - Norms: column `K`
  - UOM: column `N`
  - Store Stock MM01: column `O`
  - QAD Inspection: column `P`
  - Store Stock MM10: column `Q`
  - WIP / PP00: column `R`
  - QR01: column `S`
  - Buyer: column `V`
  - IB Pending: column `W`
  - Inward / OP + Inward: column `Z`

- `R1 Pondy - Electronics May'26 - Nov'26.xlsx`, sheet `DM Supplier`
  - Part No: column `E`
  - Description: column `F`
  - Supplier: column `G`
  - MPN: column `H`
  - Make: column `I`
  - SPQ: column `J`
  - MOQ: column `K`
  - Lead time: column `L`
  - UOM: column `M`
  - Rate: column `N`
  - Opening balance: column `Q`
  - PP00: column `R`
  - QR01: column `W`
  - CB MM01: column `X`
  - CB MM10: column `Y`
  - IB Pending: column `AD`
  - Monthly inward columns: `AE`, `AL`, `AQ`, `AV`, `BA`, `BF`, `BK`, `BP`, `BU`, `BZ`, `CE`, `CJ` pattern

### Products / Customer Sellable Items

Manual fields:

- Product / FG part number
- Product name
- Description
- Monthly planned quantity
- BOM rows:
  - Raw material component ID
  - Norms per product

Excel source:

- `R1 Pondy - Electronics May'26 - Nov'26.xlsx`, sheet `Plan Sheet`
  - FG/SAP part: column `D`
  - Product/application: columns `E`, `F`
  - Monthly plan: columns `G:R`

- `R1 Pondy - Electronics May'26 - Nov'26.xlsx`, sheet `BOM`
  - Product names: row `1`, starting column `N`
  - Product part numbers: row `2`, starting column `N`
  - Monthly plan for those products: rows `3:14`
  - Raw material part number: column `E`
  - Raw material description: column `F`
  - UOM: column `G`
  - Make: column `H`
  - MPN: column `I`
  - Supplier: column `J`
  - Lead time: column `K`
  - SPQ: column `L`
  - MOQ: column `M`
  - BOM norms: product columns from `N` onward

### Stock Inward

Manual fields:

- Raw material
- Received quantity
- Stock bucket to update
- Vendor
- Invoice / DC number
- Receipt date
- Remarks / ETA

This is for purchased raw materials coming from outside vendors.

## Calculations

### Required Raw Material Quantity

For one product:

```text
Required Qty = Product Qty x BOM Norms
```

Excel source:

- `ETA!L`: `=J*K` or `=J*K/1000` depending UOM conversion in the original sheet.
- `Sheet2!G`: `=F*E`
- App equivalent: `buildProductionRequirementRows()`.

### Total Stock

```text
Total Stock = MM01 + MM10 + WIP/PP00 + QR01 + Inspection
```

Excel source:

- `ETA!T`: `=O` in some rows, but conceptually total stock comes from stock buckets.
- `DM Supplier!Z`: total stock after stock bucket calculations.
- App equivalent: `getComponentTotalStock()`.

### Demand Requirement

```text
Planned Requirement = Product Monthly Plan x BOM Norms
Confirmed Requirement = Confirmed Production Qty x BOM Norms
Demand Requirement = max(Planned Requirement, Confirmed Requirement)
```

The app uses planned demand for upcoming stock planning. Confirmed production is kept for actual consumption history. The higher value is used as current material demand so the app does not ignore either future plan or already-confirmed usage.

### Coverage Days - Future / Commented For Now

Coverage days is not active in the current UI. Keep this formula only as a future planning reference until the business confirms the exact workbook rule.

```text
ADR = Demand Requirement / 25 working days
Coverage Days = Total Stock / ADR
```

### ADR Reference

```text
ADR = Demand Requirement / 25 working days
```

Excel source:

- `DM Supplier!P`: ADR.
- `IMP!N`: `=M/25`.
- App equivalent: `getComponentAdr()`.

### Coverage Days Reference

```text
Coverage Days = Total Stock / ADR
```

Excel source:

- `ETA!U`: `=T/M`.
- `DM Supplier!AB`, `AC`, and monthly `Cov` columns.
- `IMP!W`: coverage.
- App equivalent: `getComponentCoverageDays()`.

### Balance

```text
Balance = Total Stock + Planned Inward + IB Pending - Demand Requirement
```

Excel source:

- `ETA!AA`: `=X-Z` in the visible material status sheet.
- `DM Supplier!AA` and monthly `Bal` columns.
- App equivalent: `getComponentBalance()`.

### Shortage

```text
Shortage = max(0, Required Qty - Total Stock)
```

App equivalent:

- `buildProductionRequirementRows()`

### Risk / Status

Current app status:

```text
Critical = Total Stock is 0 while demand exists
High = Total Stock < Demand Requirement
Watch = Total Stock is less than 120% of Demand Requirement
Safe = Total Stock covers Demand Requirement with buffer
```

Coverage-based interpretation:

```text
Critical = 0 coverage days
High = coverage <= 30 days
Watch = coverage <= 60 days
Safe = coverage > 60 days
```

Excel source:

- Excel does not store one clean universal status formula in the inspected sheets; status is inferred from coverage, balance, shortage, and stock availability. In the app, coverage days is no longer a required manual entry. It is calculated from product plan, BOM norms, and stock.

## Stock Updates

### Vendor Receipt

When material is received in `Stock Inward`:

```text
Selected Stock Bucket = Selected Stock Bucket + Received Qty
```

The app records a stock movement:

```text
type = INWARD
componentId
qty
bucket
vendor
invoiceNo
receiptDate
remarks
```

### Production / Sale Confirmation

When a product is confirmed in `BOM Master`:

1. Read product BOM.
2. Calculate required quantity for each raw material.
3. Compare against total stock.
4. Deduct required quantity from stock buckets.
5. Save production history.
6. Save stock movement history as `CONSUMPTION`.

Deduction order:

```text
MM01 -> MM10 -> WIP/PP00 -> QR01 -> Inspection
```

## Data That Should Not Be Stored

These should always be calculated dynamically:

- Used In
- Required quantity
- Total stock
- ADR
- Coverage days
- Balance
- Shortage
- Risk/status
- Dashboard totals
- Report totals

## Current App Modules

- `Components`: raw material master.
- `FG Products`: product/customer item master and BOM owner.
- `Stock Inward`: vendor receipt and stock increase.
- `BOM Master`: production/sale confirmation and stock consumption.
- `Reports`: stock planning, movement history, production history, calculated outputs.
- `Dashboard`: high-level calculated monitoring.

## Backend Migration Notes

Suggested database tables:

- `raw_materials`
- `products`
- `product_bom_items`
- `monthly_product_plans`
- `stock_movements`
- `production_runs`
- `production_run_items`
- `users`

The current LocalStorage service should later be replaced by API calls, while calculation utilities can remain shared or move to backend services.
