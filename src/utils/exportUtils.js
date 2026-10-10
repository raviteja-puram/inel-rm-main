import * as XLSX from 'xlsx';

function safeFileName(name) {
  return String(name || 'export').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildFgMissingItemsRows(skippedMaterials = []) {
  const rows = [];
  skippedMaterials.forEach((entry) => {
    const seen = new Set();
    (entry?.materialIds || []).forEach((materialId) => {
      const key = `${entry?.fgPartNo || ''}|${materialId || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        'FG Part Number': entry?.fgPartNo || '',
        'Missing Material ID': materialId || '',
        'Reason': 'Material not found in component master',
      });
    });
  });
  return rows;
}

export function buildMissingFgUploadRows(preview = {}) {
  const rows = [];
  const seen = new Set();

  const addRow = (fg, reason) => {
    const partNo = String(fg?.partNo || '').trim();
    if (!partNo || seen.has(partNo + reason)) return;
    seen.add(partNo + reason);
    rows.push({
      'FG Part Number': partNo,
      'FG Name': fg?.name || '',
      'Production Dates': Array.isArray(fg?.dates) ? fg.dates.join(', ') : '',
      'Skipped Plan Rows': Number(fg?.planRows || 0),
      'Reason': reason,
    });
  };

  (preview?.unmappedFgs || []).forEach((fg) => addRow(fg, 'No raw materials mapped'));
  (preview?.skippedFgs || []).forEach((fg) => addRow(fg, 'FG not found in FG master'));

  (preview?.errors || [])
    .filter((message) => /^unknown fg\s*:/i.test(String(message || '').trim()))
    .forEach((message) => {
      const partNo = String(message).replace(/^unknown fg\s*:\s*/i, '').trim();
      if (!partNo) return;
      addRow({ partNo, name: '', dates: [], planRows: 1 }, 'FG not found in FG master');
    });

  return rows;
}

export function downloadExcelTable(title, headers, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['INEL RM'],
    [title],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [`Rows: ${rows.length}`],
    [],
  ]);
  XLSX.utils.sheet_add_json(worksheet, rows, {
    header: headers,
    origin: 'A6',
    skipHeader: false,
  });
  worksheet['!cols'] = headers.map((header) => ({
    wch: Math.max(14, Math.min(34, String(header).length + 8)),
  }));
  XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31) || 'Export');
  XLSX.writeFile(workbook, `${safeFileName(title)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function pdfEscape(text) {
  return String(text ?? '').replace(/[\\()]/g, '\\$&').replace(/\r?\n/g, ' ');
}

function pdfTextWidth(text, fontSize) {
  return String(text ?? '').length * fontSize * 0.48;
}

function wrapPdfText(value, width, fontSize, maxLines = 6) {
  const words = String(value ?? '-').replace(/\s*\|\s*/g, ' | ').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (pdfTextWidth(next, fontSize) <= width) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    if (pdfTextWidth(word, fontSize) <= width) {
      current = word;
      return;
    }
    const charsPerLine = Math.max(6, Math.floor(width / (fontSize * 0.48)));
    for (let i = 0; i < word.length; i += charsPerLine) {
      lines.push(word.slice(i, i + charsPerLine));
    }
    current = '';
  });
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].slice(0, -3)}...`];
  }
  return lines.length ? lines : ['-'];
}

function getColumnWidths(headers, tableWidth) {
  const weights = headers.map((header) => {
    const key = String(header).toLowerCase();
    if (key.includes('used in') || key.includes('remarks')) return 2.4;
    if (key.includes('description') || key.includes('name')) return 1.9;
    if (key.includes('component') || key.includes('part')) return 1.35;
    if (key.includes('supplier')) return 1.2;
    return 1;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (tableWidth * weight) / totalWeight);
}

function drawRect(x, y, width, height, options = {}) {
  const fill = options.fill ? `${options.fill} rg ${x} ${y} ${width} ${height} re f` : '';
  const stroke = options.stroke ? `${options.stroke} RG ${x} ${y} ${width} ${height} re S` : '';
  return [fill, stroke].filter(Boolean).join('\n');
}

function drawText(text, x, y, fontSize = 7, color = '0 0 0') {
  return `BT ${color} rg /F1 ${fontSize} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(text)}) Tj ET`;
}

function buildPdfPages(title, headers, rows) {
  const page = { width: 842, height: 595, margin: 24 };
  const tableWidth = page.width - page.margin * 2;
  const widths = getColumnWidths(headers, tableWidth);
  const fontSize = headers.length > 9 ? 5.6 : 6.4;
  const headerHeight = 24;
  const bottom = 30;
  const pages = [];
  let commands = [];
  let y = 0;

  function startPage() {
    if (commands.length) pages.push(commands.join('\n'));
    commands = [
      drawText('INEL RM', page.margin, 570, 16),
      drawText(title, 120, 570, 12),
      drawText(`Generated: ${new Date().toLocaleString('en-IN')}`, page.margin, 554, 7),
      drawText(`Rows: ${rows.length}`, 720, 554, 7),
    ];
    y = 528;
    let x = page.margin;
    headers.forEach((header, i) => {
      commands.push(drawRect(x, y, widths[i], headerHeight, { fill: '0.12 0.22 0.38', stroke: '0.55 0.60 0.72' }));
      wrapPdfText(header, widths[i] - 8, 6.3, 2).forEach((line, lineIdx) => {
        commands.push(drawText(line, x + 4, y + headerHeight - 9 - lineIdx * 8, 6.3, '1 1 1'));
      });
      x += widths[i];
    });
    y -= headerHeight;
  }

  startPage();
  rows.forEach((row, rowIndex) => {
    const wrapped = headers.map((header, i) => wrapPdfText(
      row[header],
      widths[i] - 8,
      fontSize,
      String(header).toLowerCase().includes('used in') ? 8 : 5,
    ));
    const rowHeight = Math.max(18, Math.max(...wrapped.map((lines) => lines.length)) * (fontSize + 2) + 8);
    if (y - rowHeight < bottom) startPage();
    let x = page.margin;
    headers.forEach((header, i) => {
      commands.push(drawRect(x, y - rowHeight, widths[i], rowHeight, {
        fill: rowIndex % 2 === 0 ? '0.98 0.99 1' : '0.94 0.96 0.99',
        stroke: '0.78 0.82 0.90',
      }));
      wrapped[i].forEach((line, lineIdx) => {
        commands.push(drawText(line, x + 4, y - 10 - lineIdx * (fontSize + 2), fontSize));
      });
      x += widths[i];
    });
    y -= rowHeight;
  });
  pages.push(commands.join('\n'));
  return pages.map((content, index) => `${content}\n${drawText(`Page ${index + 1} of ${pages.length}`, 744, 18, 7)}`);
}

export function downloadPdfTable(title, headers, rows) {
  const pageContents = buildPdfPages(title, headers, rows);
  const objects = [];
  const pages = [];

  function addObject(body) {
    objects.push(body);
    return objects.length;
  }

  const fontObj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pageContents.forEach((content) => {
    const contentObj = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageObj = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObj} 0 R >>`);
    pages.push(pageObj);
  });

  const pagesObjIndex = objects.length + 1;
  pages.forEach((pageObj) => {
    objects[pageObj - 1] = objects[pageObj - 1].replace('/Parent 0 0 R', `/Parent ${pagesObjIndex} 0 R`);
  });
  const pagesObj = addObject(`<< /Type /Pages /Kids [${pages.map((page) => `${page} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  const catalogObj = addObject(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xref}\n%%EOF`;

  downloadBlob(
    `${safeFileName(title)}_${new Date().toISOString().slice(0, 10)}.pdf`,
    new Blob([pdf], { type: 'application/pdf' }),
  );
}
