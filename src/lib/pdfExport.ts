import html2pdf from 'html2pdf.js';
import type { ParsedOrder, OrderLine } from '@/types/order';

type TabType = 'principal' | 'non-validated' | 'validated';

function getFilteredLines(lines: OrderLine[], tab: TabType, validatedRows?: string[]): OrderLine[] {
  // For now, return all lines - the actual filtering will depend on how validation state is passed
  return lines;
}

function generateTableHTML(order: ParsedOrder, lines: OrderLine[], tab: TabType, qtePreparedMap?: Map<string, number>): string {
  const tabTitle = {
    'principal': 'Principal',
    'non-validated': 'Non Validés',
    'validated': 'Validés',
  }[tab];

  const tabColor = {
    'principal': { bg: '#fed7aa', border: '#f59e0b', text: '#92400e' },
    'non-validated': { bg: '#fecaca', border: '#ef4444', text: '#7f1d1d' },
    'validated': { bg: '#bbf7d0', border: '#10b981', text: '#064e3b' },
  }[tab];

  // Get stock status color
  function getStockRowColor(stock: number): string {
    if (stock > 0) return '#f0fdf4'; // green-50
    if (stock === 0) return '#fffbeb'; // amber-50
    return '#fef2f2'; // red-50
  }

  function getStockBadgeHTML(stock: number): string {
    if (stock > 0) {
      return `<span style="display: inline-block; padding: 4px 8px; background: #d1fae5; color: #047857; border-radius: 4px; font-size: 11px; font-weight: bold;">+${stock}</span>`;
    }
    if (stock === 0) {
      return `<span style="display: inline-block; padding: 4px 8px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 11px; font-weight: bold;">0</span>`;
    }
    return `<span style="display: inline-block; padding: 4px 8px; background: #fee2e2; color: #7f1d1d; border-radius: 4px; font-size: 11px; font-weight: bold;">${stock}</span>`;
  }

  const rows = lines.map((line) => {
    const rowBg = getStockRowColor(line.stock);
    const qtePrepared = qtePreparedMap?.get(`${line.codeABarre || ''}||${line.reference || ''}||${line.designation || ''}||${line.emplacement || ''}`) || line.qte || 0;
    const qteNonValidee = Math.max(0, (line.qte || 0) - qtePrepared);
    return `
    <tr style="background: ${rowBg}; page-break-inside: avoid;">
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: left; font-size: 10px; font-family: monospace;">${line.codeABarre || '—'}</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: left; font-size: 10px; font-family: monospace; font-weight: 600;">${line.reference || '—'}</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: left; font-size: 10px;">${line.designation || '—'}</td>
      <td style="padding: 8px 6px; border: 1px solid #e5e7eb; text-align: center; font-size: 11px; font-weight: bold; color: #1f2937; background: #f9fafb; white-space: nowrap;">${Math.round(line.qte)}</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: left; font-size: 10px; font-weight: 600;">${line.emplacement || '—'}</td>
      <td style="padding: 8px 6px; border: 1px solid #e5e7eb; text-align: center; font-size: 11px; white-space: nowrap;">${getStockBadgeHTML(line.stock)}</td>
      <td style="padding: 8px 6px; border: 1px solid #e5e7eb; text-align: center; font-size: 9px; white-space: nowrap;"><span style="display: inline-block; padding: 3px 6px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-weight: 600;">${line.brand || '—'}</span></td>
      <td style="padding: 8px 6px; border: 1px solid #e5e7eb; text-align: center; font-size: 9px; white-space: nowrap;"><span style="display: inline-block; padding: 3px 6px; background: #e0e7ff; color: #3730a3; border-radius: 4px; font-weight: 600;">${line.carton_Qte || '—'}</span></td>
      <td style="padding: 8px 6px; border: 1px solid #e5e7eb; text-align: center; font-size: 11px; font-weight: bold; color: #0369a1; background: #eff6ff; white-space: nowrap;">${qtePrepared}</td>
      <td style="padding: 8px 6px; border: 1px solid #e5e7eb; text-align: center; font-size: 11px; font-weight: bold; background: ${qteNonValidee > 0 ? '#fef2f2' : '#f0fdf4'}; white-space: nowrap;"><span style="display: inline-block; padding: 3px 6px; background: ${qteNonValidee > 0 ? '#fee2e2' : '#d1fae5'}; color: ${qteNonValidee > 0 ? '#7f1d1d' : '#047857'}; border-radius: 4px; font-weight: 600;">${qteNonValidee}</span></td>
    </tr>
  `;
  }).join('');

  const totalQty = Math.round(lines.reduce((sum, line) => sum + line.qte, 0));
  const totalItems = lines.length;
  const totalStock = Math.round(lines.reduce((sum, line) => sum + line.stock, 0));

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${tabTitle}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          background: #ffffff;
          color: #1f2937;
        }
        .container { 
          max-width: 100%; 
          margin: 0;
          padding: 25px;
        }
        .header-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 25px;
          border-radius: 12px;
          margin-bottom: 25px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header-section h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 15px;
          letter-spacing: -0.5px;
        }
        .header-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }
        .header-item {
          font-size: 12px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          border-left: 3px solid rgba(255, 255, 255, 0.5);
        }
        .header-item-label {
          font-weight: 700;
          font-size: 10px;
          opacity: 0.9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header-item-value {
          font-weight: 600;
          font-size: 13px;
          margin-top: 4px;
        }
        .tab-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          border: 2px solid;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .tab-badge.principal {
          background: #fed7aa;
          color: #92400e;
          border-color: #f59e0b;
        }
        .tab-badge.non-validated {
          background: #fecaca;
          color: #7f1d1d;
          border-color: #ef4444;
        }
        .tab-badge.validated {
          background: #bbf7d0;
          color: #064e3b;
          border-color: #10b981;
        }

        .metrics-section {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          margin-bottom: 25px;
        }
        .metric-card {
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #667eea;
          text-align: center;
        }
        .metric-card.blue { border-left-color: #3b82f6; }
        .metric-card.green { border-left-color: #10b981; }
        .metric-card.purple { border-left-color: #8b5cf6; }
        .metric-value {
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
        }
        .metric-label {
          font-size: 11px;
          color: #6b7280;
          font-weight: 600;
          margin-top: 5px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          overflow: hidden;
          page-break-inside: avoid;
          orphans: 3;
          widows: 3;
        }
        thead tr {
          background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 100%);
          border-bottom: 3px solid #d1d5db;
          page-break-inside: avoid;
        }
        th {
          padding: 12px 10px;
          text-align: left;
          font-weight: 700;
          font-size: 11px;
          color: #1f2937;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          background: #f9fafb;
          page-break-inside: avoid;
          white-space: nowrap;
        }
        th:nth-child(4),
        th:nth-child(6),
        th:nth-child(7),
        th:nth-child(8),
        th:nth-child(9),
        th:nth-child(10) {
          padding: 10px 6px;
          font-size: 9px;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 10px;
          page-break-inside: avoid;
        }
        tbody tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        tbody tr:last-child td {
          border-bottom: none;
        }

        .footer-section {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #6b7280;
        }
        .footer-left {
          flex: 1;
        }
        .footer-right {
          text-align: right;
          font-style: italic;
        }
        .logo-text {
          font-size: 14px;
          font-weight: 700;
          color: #667eea;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header-section">
          <h1>📋 BON DE PRÉPARATION</h1>
          <div class="header-grid">
            <div class="header-item">
              <div class="header-item-label">Commande / Référence</div>
              <div class="header-item-value">${order?.header?.reference || '—'}</div>
            </div>
            <div class="header-item">
              <div class="header-item-label">N° Pièce</div>
              <div class="header-item-value">${order?.header?.noPiece || '—'}</div>
            </div>
            <div class="header-item">
              <div class="header-item-label">Client</div>
              <div class="header-item-value">${order?.header?.client || '—'}</div>
            </div>
            <div class="header-item">
              <div class="header-item-label">Date</div>
              <div class="header-item-value">${order?.header?.date || '—'}</div>
            </div>
          </div>
          <div>
            <span class="tab-badge ${tab === 'principal' ? 'principal' : tab === 'non-validated' ? 'non-validated' : 'validated'}">
              ✓ ${tabTitle}
            </span>
          </div>
        </div>

        <div class="metrics-section">
          <div class="metric-card blue">
            <div class="metric-value">${totalItems}</div>
            <div class="metric-label">Articles</div>
          </div>
          <div class="metric-card green">
            <div class="metric-value">${totalQty}</div>
            <div class="metric-label">Quantité Totale</div>
          </div>
          <div class="metric-card purple">
            <div class="metric-value">${totalStock >= 0 ? '+' : ''}${totalStock}</div>
            <div class="metric-label">Stock Global</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Code-Barres</th>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Qté</th>
              <th>Emplacement</th>
              <th>Stock</th>
              <th>Marque</th>
              <th>Carton Qté</th>
              <th>Qte Validée</th>
              <th>Qte Non Validée</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="footer-section">
          <div class="footer-left">
            <div class="logo-text">ZINABEL</div>
            <div style="margin-top: 5px; font-size: 9px;">Analyse approfondie des bons de commande</div>
          </div>
          <div class="footer-right">
            Généré le ${new Date().toLocaleString('fr-FR', { 
              year: 'numeric', 
              month: '2-digit', 
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}

export function downloadOrderPDF(
  order: ParsedOrder, 
  tab: TabType, 
  validatedRows?: string[], 
  qtePreparedMap?: Map<string, number>,
  filteredLines?: OrderLine[]
): void {
  try {
    const linesToUse = filteredLines || getFilteredLines(order.lines, tab, validatedRows);
    const html = generateTableHTML(order, linesToUse, tab, qtePreparedMap);
    
    const element = document.createElement('div');
    element.innerHTML = html;
    
    const filename = `${order?.header?.noPiece || 'commande'}_${tab}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    const options = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'landscape' as const, unit: 'mm' as const, format: 'a4' as const },
    };

    html2pdf().set(options).from(element).save();
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}
