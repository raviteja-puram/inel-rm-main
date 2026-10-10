export const MANUAL_COMPONENT_FIELDS = [
  {
    key: 'buyer',
    label: 'Buyer / Controller',
    source: 'ETA!V / DM Supplier inventory controller',
    type: 'text',
  },
  {
    key: 'supplier',
    label: 'Supplier',
    source: 'DM Supplier!G',
    type: 'text',
  },
  {
    key: 'mpn',
    label: 'MPN',
    source: 'DM Supplier!H',
    type: 'text',
  },
  {
    key: 'make',
    label: 'Make',
    source: 'DM Supplier!I',
    type: 'text',
  },
  {
    key: 'spq',
    label: 'SPQ',
    source: 'DM Supplier!J',
    type: 'number',
  },
  {
    key: 'moq',
    label: 'MOQ',
    source: 'DM Supplier!K',
    type: 'number',
  },
  {
    key: 'leadTimeWeeks',
    label: 'Lead Time (Weeks)',
    source: 'DM Supplier!L / lead time sheet',
    type: 'number',
  },
  {
    key: 'rate',
    label: 'Rate',
    source: 'DM Supplier!N',
    type: 'number',
  },
  {
    key: 'openBalance',
    label: 'Opening Balance',
    source: 'DM Supplier!Q',
    type: 'number',
  },
  {
    key: 'storeStockMm01',
    label: 'Store Stock MM01',
    source: 'ETA!O / DM Supplier!X',
    type: 'number',
  },
  {
    key: 'inspectionStock',
    label: 'Inspection / QAD Stock',
    source: 'ETA!P',
    type: 'number',
  },
  {
    key: 'storeStockMm10',
    label: 'Store Stock MM10',
    source: 'ETA!Q / DM Supplier!Y',
    type: 'number',
  },
  {
    key: 'wipStock',
    label: 'WIP / PP00 Stock',
    source: 'ETA!R / DM Supplier!R',
    type: 'number',
  },
  {
    key: 'qr01Stock',
    label: 'QR01 Stock',
    source: 'ETA!S / DM Supplier!W',
    type: 'number',
  },
  {
    key: 'ibPending',
    label: 'IB Pending',
    source: 'ETA!W / DM Supplier!AD',
    type: 'number',
  },
  {
    key: 'inwardQty',
    label: 'Planned Inward',
    source: 'DM Supplier monthly Inward columns',
    type: 'number',
  },
  {
    key: 'eta',
    label: 'ETA / Remarks',
    source: 'DM Supplier monthly ETA columns',
    type: 'text',
  },
];

export const CALCULATED_COMPONENT_FIELDS = [
  { key: 'totalStock', label: 'Total Stock', formula: 'Uploaded Total stock value' },
  { key: 'totalRequirement', label: 'Total Requirement', formula: 'Confirmed production history consumption' },
  { key: 'balance', label: 'Balance', formula: 'Total stock + inward + IB pending - requirement' },
  { key: 'risk', label: 'Risk', formula: 'Coverage and shortage thresholds' },
  { key: 'usedIn', label: 'Used In', formula: 'FG products whose BOM contains the component' },
];

export const WORKBOOK_SCOPE = [
  {
    workbook: "Material Status review as on 29 Jun'26.xlsx",
    sheets: [
      {
        name: 'ETA',
        purpose: 'Material status by FG, component, norms, total stock, coverage, buyer, pending inward and balance.',
      },
      {
        name: 'PCB LIST',
        purpose: 'PCB-specific stock and requirement report.',
      },
      {
        name: 'Sheet2',
        purpose: 'Focused component requirement and transit review.',
      },
    ],
  },
  {
    workbook: "R1 Pondy - Electronics May'26 - Nov'26.xlsx",
    sheets: [
      {
        name: 'Plan Sheet',
        purpose: 'Monthly FG production plan by SAP part/product.',
      },
      {
        name: 'BOM',
        purpose: 'Cross-tab BOM matrix linking FG products to component norms.',
      },
      {
        name: 'DM Supplier',
        purpose: 'Supplier item master, stock, inward, ETA, coverage and balance planning.',
      },
      {
        name: 'EMS',
        purpose: 'EMS planning view with monthly inward, EOB and coverage.',
      },
      {
        name: 'lead time',
        purpose: 'Commodity lead-time assumptions.',
      },
    ],
  },
];
