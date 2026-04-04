import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedOrder, OrderHeader, OrderLine } from '@/types/order';
import { enrichLinesWithCartonData } from '@/lib/cartonLookup';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface TextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

// Column X boundaries detected from PDF structure
const COLUMNS = [
  { name: 'codeABarre', minX: 30, maxX: 140 },
  { name: 'reference', minX: 140, maxX: 190 },
  { name: 'designation', minX: 190, maxX: 375 },
  { name: 'qte', minX: 375, maxX: 425 },
  { name: 'emplacement', minX: 425, maxX: 525 },
  { name: 'stock', minX: 525, maxX: 600 },
];

function assignColumn(x: number): string | null {
  for (const col of COLUMNS) {
    if (x >= col.minX && x < col.maxX) return col.name;
  }
  return null;
}

export async function parsePDF(file: File): Promise<ParsedOrder> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allItems: TextItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string; transform: number[] }>;

    for (const item of items) {
      if (!item.str.trim()) continue;
      allItems.push({
        str: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        page: i,
      });
    }
  }

  // Use page 1 items for header extraction
  const page1Items = allItems.filter((i) => i.page === 1);

  // Find the "Détails" line on page 1
  let detailsY = 0;
  for (const item of page1Items) {
    if (item.str.includes('Détails') || item.str.includes('Details')) {
      detailsY = item.y;
      break;
    }
  }

  const headerItems = page1Items.filter((i) => i.y > detailsY);

  // Find the column header row Y
  let headerRowY = 0;
  for (const item of page1Items) {
    if (
      item.y < detailsY &&
      (item.str === 'Code à barre' || item.str === 'Code a barre')
    ) {
      headerRowY = item.y;
      break;
    }
  }

  // Collect table items per page, excluding the header row and above
  // On page 1: items below headerRowY
  // On subsequent pages: all items except the logo/header area (Y > ~700 typically)
  const tableItems: TextItem[] = [];

  // Use a global index to make Y unique across pages
  // We offset each page's Y by (pageNum * 10000) to avoid collisions
  const PAGE_Y_OFFSET = 10000;

  for (const item of allItems) {
    if (item.page === 1) {
      if (item.y < headerRowY) {
        tableItems.push({
          ...item,
          y: item.y + (item.page - 1) * PAGE_Y_OFFSET,
        });
      }
    } else {
      // On subsequent pages, skip the logo/header area (typically Y > 700)
      // and skip anything that looks like "Page X / Y" or company name
      if (item.y < 750 && !item.str.includes('Page') && !item.str.includes('Alina') && !item.str.includes('Distribution') && !item.str.includes('Importation')) {
        tableItems.push({
          ...item,
          y: item.y + (item.page - 1) * PAGE_Y_OFFSET,
        });
      }
    }
  }

  const header = extractHeader(headerItems);
  const lines = extractTableLines(tableItems);
  
  // Enrich lines with carton data (brand and carton_Qte)
  await enrichLinesWithCartonData(lines);
  
  const totalQty = lines.reduce((sum, l) => sum + l.qte, 0);

  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    header,
    lines,
    totalQty,
    totalItems: lines.length,
  };
}

function extractHeader(items: TextItem[]): OrderHeader {
  const Y_TOL = 4;
  const rowMap = new Map<number, TextItem[]>();

  for (const item of items) {
    const y = Math.round(item.y / Y_TOL) * Y_TOL;
    if (!rowMap.has(y)) rowMap.set(y, []);
    rowMap.get(y)!.push(item);
  }

  const allText = items.map((i) => i.str).join(' ');

  const findValue = (label: string): string => {
    for (const [, rowItems] of rowMap.entries()) {
      const sorted = [...rowItems].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].str.toLowerCase().includes(label.toLowerCase())) {
          if (sorted[i + 1]) return sorted[i + 1].str.trim();
        }
      }
    }
    return '';
  };

  const plMatch = allText.match(/PL\d+/);
  const noPiece = plMatch ? plMatch[0] : findValue('N° Pièce');

  const b2bMatch = allText.match(/B2B\s*\d+/);
  const reference = b2bMatch ? b2bMatch[0] : findValue('Référence');

  return {
    noPiece,
    reference,
    date: findValue('Date') || extractDateFromItems(items),
    dateLivraison: findValue('Date livraison'),
    statut: findValue('Statut'),
    client: findValue('Client'),
    code: findValue('Code'),
    adresseLivraison: findValue('Adresse livraison') || findValue('Adresse'),
    depot: findValue('Dépôt') || findValue('Depot'),
    preparateur: findValue('Préparateur') || findValue('Preparateur'),
  };
}

function extractDateFromItems(items: TextItem[]): string {
  for (const item of items) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(item.str)) {
      return item.str;
    }
  }
  return '';
}

function extractTableLines(items: TextItem[]): OrderLine[] {
  if (items.length === 0) return [];

  // Build row anchors from both barcode and reference columns.
  // This keeps rows even when "Code a barre" is empty.
  const anchors = items.filter((item) => {
    const col = assignColumn(item.x);
    if (col === 'codeABarre') {
      return /^\d{13}$/.test(item.str.replace(/\s/g, ''));
    }
    if (col === 'reference') {
      return !isBlank(item.str);
    }
    if (col === 'stock') {
      return /[\d]/.test(item.str);
    }
    return false;
  });

  if (anchors.length === 0) return [];

  const sortedAnchorYs = anchors.map((a) => a.y).sort((a, b) => b - a);
  const anchorYs: number[] = [];

  for (const y of sortedAnchorYs) {
    const last = anchorYs[anchorYs.length - 1];
    if (last === undefined || Math.abs(last - y) > 6) {
      anchorYs.push(y);
    }
  }

  const rows: Array<{ y: number; line: OrderLine }> = [];

  for (let i = 0; i < anchorYs.length; i++) {
    const anchorY = anchorYs[i];
    const yAbove = i > 0 ? anchorYs[i - 1] : anchorY + 50;
    const yBelow = i < anchorYs.length - 1 ? anchorYs[i + 1] : anchorY - 50;
    const yTop = (anchorY + yAbove) / 2;
    const yBottom = (anchorY + yBelow) / 2;

    const rowItems = items.filter((item) => item.y <= yTop && item.y > yBottom);
    const line = buildLineFromRowItems(rowItems);

    if (line && isLikelyDataLine(line)) {
      rows.push({ y: anchorY, line });
    }
  }

  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => r.line);
}

function buildLineFromRowItems(rowItems: TextItem[]): OrderLine | null {
  if (rowItems.length === 0) return null;

  const codeRaw = rowItems
    .filter((it) => assignColumn(it.x) === 'codeABarre')
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str)
    .join('');

  const referenceRaw = rowItems
    .filter((it) => assignColumn(it.x) === 'reference')
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str)
    .join('');

  const designationRaw = rowItems
    .filter((it) => assignColumn(it.x) === 'designation')
    .sort((a, b) => b.y - a.y)
    .map((i) => i.str)
    .join(' ');

  const qteRaw = rowItems
    .filter((it) => assignColumn(it.x) === 'qte')
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str)
    .join('');

  const emplacementRaw = rowItems
    .filter((it) => assignColumn(it.x) === 'emplacement')
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str)
    .join('');

  const stockRaw = rowItems
    .filter((it) => assignColumn(it.x) === 'stock')
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str)
    .join('');

  let codeABarre = codeRaw.replace(/\s/g, '').trim();
  let reference = referenceRaw.trim();
  const designation = designationRaw.trim();
  const emplacement = emplacementRaw.trim();
  const qte = parseNumber(qteRaw);
  const stock = parseNumber(stockRaw);

  // Some PDFs place a non-barcode token in the first column when barcode is empty.
  // In that case, treat it as a reference and keep barcode empty.
  if (codeABarre && !/^\d{13}$/.test(codeABarre) && isBlank(reference)) {
    reference = codeABarre;
    codeABarre = '';
  }

  const emptyCells = {
    codeABarre: isBlank(codeABarre),
    reference: isBlank(reference),
    designation: isBlank(designation),
    qte: isBlank(qteRaw),
    emplacement: isBlank(emplacement),
    stock: isBlank(stockRaw),
  };

  return {
    codeABarre,
    reference,
    designation,
    qte,
    emplacement,
    stock,
    emptyCells,
    hasEmptyCell: Object.values(emptyCells).some(Boolean),
  };
}

function isLikelyDataLine(line: OrderLine): boolean {
  // Keep real product lines while ignoring noise.
  return !line.emptyCells.reference || !line.emptyCells.designation;
}

function isBlank(str: string): boolean {
  return str.trim().length === 0;
}

function parseNumber(str: string): number {
  const cleaned = str.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
