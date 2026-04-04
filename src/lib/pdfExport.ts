import html2pdf from 'html2pdf.js';
import type { ParsedOrder, OrderLine } from '@/types/order';

type TabType = 'principal' | 'non-validated' | 'validated';

function getFilteredLines(lines: OrderLine[], tab: TabType, validatedRows?: string[]): OrderLine[] {
  // For now, return all lines - the actual filtering will depend on how validation state is passed
  return lines;
}

function generateTableHTML(order: ParsedOrder, lines: OrderLine[], tab: TabType): string {
  const tabTitle = {
    'principal': 'Principal',
    'non-validated': 'Non Validés',
    'validated': 'Validés',
  }[tab];

  const rows = lines.map((line) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 11px;">${line.codeABarre || '—'}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 11px;">${line.reference || '—'}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 11px;">${line.designation || '—'}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; font-size: 11px; font-weight: bold;">${Math.round(line.qte)}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 11px;">${line.emplacement || '—'}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold; font-size: 11px;">${line.stock}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 11px;">${line.brand || '—'}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; font-size: 11px;">${line.carton_Qte || '—'}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${tabTitle}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { font-size: 20px; margin-bottom: 10px; }
        .header { margin-bottom: 20px; background: #f3f4f6; padding: 15px; border-radius: 8px; }
        .header-info { margin: 5px 0; font-size: 12px; }
        .header-label { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f3f4f6; padding: 10px; border: 1px solid #d1d5db; text-align: left; font-weight: bold; font-size: 12px; }
        td { padding: 8px; border: 1px solid #e5e7eb; }
        .tab-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 10px; }
        .tab-principal { background: #fed7aa; color: #92400e; }
        .tab-non-validated { background: #fecaca; color: #7f1d1d; }
        .tab-validated { background: #bbf7d0; color: #064e3b; }
      </style>
    </head>
    <body>
      <h1>Bon de Préparation - ${tabTitle}</h1>
      <div class="header">
        <div class="header-info">
          <span class="header-label">Commande:</span> ${order?.header?.reference || '—'}
        </div>
        <div class="header-info">
          <span class="header-label">Client:</span> ${order?.header?.client || '—'}
        </div>
        <div class="header-info">
          <span class="header-label">N° Pièce:</span> ${order?.header?.noPiece || '—'}
        </div>
        <div class="header-info">
          <span class="header-label">Date:</span> ${order?.header?.date || '—'}
        </div>
        <div class="header-info">
          <span class="tab-badge tab-${tab === 'principal' ? 'principal' : tab === 'non-validated' ? 'non-validated' : 'validated'}">
            ${tabTitle}
          </span>
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
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div style="margin-top: 20px; font-size: 12px; color: #666;">
        <p>Total articles: ${lines.length}</p>
        <p>Total quantité: ${Math.round(lines.reduce((sum, line) => sum + line.qte, 0))}</p>
        <p style="margin-top: 20px; text-align: right; color: #999; font-size: 10px;">
          Généré le ${new Date().toLocaleString('fr-FR')}
        </p>
      </div>
    </body>
    </html>
  `;

  return html;
}

export function downloadOrderPDF(order: ParsedOrder, tab: TabType, validatedRows?: string[]): void {
  try {
    const filteredLines = getFilteredLines(order.lines, tab, validatedRows);
    const html = generateTableHTML(order, filteredLines, tab);
    
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
