import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedOrder, OrderHeader, OrderLine } from '@/types/order';
import { enrichLinesWithCartonData } from '@/lib/cartonLookup';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface TextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

function cleanText(s: string): string {
  if (!s) return s;
  // Normalize unicode, remove control chars, collapse whitespace, replace NBSP
  const norm = s.normalize ? s.normalize('NFKC') : s;
  return norm.replace(/\u00A0/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim();
}

// Default column X boundaries (used as a fallback)
const DEFAULT_COLUMNS = [
  { name: 'codeABarre', minX: 30, maxX: 140 },
  { name: 'reference', minX: 140, maxX: 190 },
  { name: 'designation', minX: 190, maxX: 375 },
  { name: 'qte', minX: 375, maxX: 425 },
  { name: 'emplacement', minX: 425, maxX: 525 },
  { name: 'stock', minX: 525, maxX: 600 },
];

let activeColumns = DEFAULT_COLUMNS.slice();

function assignColumn(x: number): string | null {
  for (const col of activeColumns) {
    if (x >= col.minX && x < col.maxX) return col.name;
  }
  return null;
}

function mapHeaderToColName(label: string): string {
  const s = label.toLowerCase();
  if (s.includes('code')) return 'codeABarre';
  if (s.includes('référence') || s.includes('reference')) return 'reference';
  if (s.includes('désignation') || s.includes('designation')) return 'designation';
  if (s.includes('qt') || s.includes('qty') || s.includes('quant')) return 'qte';
  if (s.includes('emplacement')) return 'emplacement';
  if (s.includes('stock')) return 'stock';
  if (s.includes('ttc')) return 'ttc';
  if (s.includes('reliquat')) return 'reliquat';
  return label.replace(/\s+/g, '_');
}

function buildColumnsFromHeaderRow(items: TextItem[], headerRowY: number) {
  const Y_TOL = 6;
  const headerRowItems = items
    .filter((it) => Math.abs(it.y - headerRowY) <= Y_TOL)
    .sort((a, b) => a.x - b.x);

  if (headerRowItems.length === 0) return DEFAULT_COLUMNS.slice();

  const xs = headerRowItems.map((h) => h.x);
  const cols: Array<{ name: string; minX: number; maxX: number }> = [];

  for (let i = 0; i < headerRowItems.length; i++) {
    const name = mapHeaderToColName(headerRowItems[i].str);
    const left = i === 0 ? Math.max(0, Math.round(xs[i] - 60)) : Math.round((xs[i - 1] + xs[i]) / 2);
    const right = i === headerRowItems.length - 1 ? xs[i] + 600 : Math.round((xs[i] + xs[i + 1]) / 2);
    cols.push({ name, minX: left, maxX: right });
  }

  return cols;
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
      const raw = item.str || '';
      const txt = cleanText(raw);
      if (!txt) continue;
      allItems.push({
        str: txt,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        page: i,
      });
    }
  }

  // Use page 1 items for header extraction
  const page1Items = allItems.filter((i) => i.page === 1);

  // Find the "Détails" line on page 1 (used to separate header blocks)
  let detailsY = 0;
  for (const item of page1Items) {
    if (item.str.includes('Détails') || item.str.includes('Details')) {
      detailsY = item.y;
      break;
    }
  }

  const headerItems = page1Items.filter((i) => i.y > detailsY);

  // Detect title: prefer an explicit title row (e.g. "Bon de préparation...", "Reliquat...")
  // Fallback to joining the first few top items when no explicit title is found.
  const detectTitle = (items: TextItem[]) => {
    if (!items || items.length === 0) return '';

    const Y_TOL = 6;
    const rows = new Map<number, TextItem[]>();
    for (const it of items) {
      const y = Math.round(it.y / Y_TOL) * Y_TOL;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push(it);
    }

    const rowEntries = Array.from(rows.entries())
      .map(([y, rowItems]) => ({ y, text: rowItems.sort((a, b) => a.x - b.x).map((r) => r.str).join(' ').trim() }))
      .sort((a, b) => a.y - b.y);

    // Known title patterns (look for these first)
    const titlePatterns = [/bon\s+de\s+prépar/i, /bon\s+de\s+préparation/i, /reliquat/i, /bon\s+de\s+transf/i, /transf/i, /valoris?/i];

    for (const r of rowEntries) {
      const s = r.text;
      if (!s) continue;
      for (const p of titlePatterns) {
        if (p.test(s)) return s;
      }
    }

    // If no explicit title row found, fall back to joining the top-most items (previous behavior)
    const top = [...items].sort((a, b) => a.y - b.y).slice(0, 6);
    return top.map((t) => t.str).join(' ').trim();
  };
    

  const titleText = detectTitle(page1Items);
  let detectedDocType = 'preparation';
  let detectedSourceOrderNumber = '';
  const lcTitle = titleText.toLowerCase();
  if (lcTitle.includes('valoris') || lcTitle.includes('valoris') || lcTitle.includes('valoris') || lcTitle.includes('valorisé') || lcTitle.includes('valorise')) {
    detectedDocType = 'valorise';
  } else if (lcTitle.includes('reliquat')) {
    detectedDocType = 'reliquat';
    const numMatch = titleText.match(/PL\d+/i) || titleText.match(/N\.?\s*°\s*\w+/i);
    if (numMatch) {
      detectedSourceOrderNumber = numMatch[0];
    }
  }

  // Find the column header row Y by looking for common header labels
  let headerRowY = 0;
  const HEADER_LABELS = ['Code', 'Code à barre', 'Code a barre', 'Référence', 'Reference', 'Désignation', 'Designation', 'Qté', 'Qte', 'Emplacement', 'Stock', 'TTC', 'Reliquat'];
  for (const item of page1Items) {
    const s = item.str.toLowerCase();
    if (detailsY && item.y >= detailsY) continue;
    for (const lab of HEADER_LABELS) {
      if (s.includes(lab.toLowerCase())) {
        headerRowY = item.y;
        break;
      }
    }
    if (headerRowY) break;
  }

  // Build activeColumns from detected header row if possible
  if (headerRowY) {
    activeColumns = buildColumnsFromHeaderRow(page1Items, headerRowY);
  } else {
    activeColumns = DEFAULT_COLUMNS.slice();
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
  // Attach detection metadata
  header.title = titleText;
  header.docType = detectedDocType;
  if (detectedSourceOrderNumber) header.sourceOrderNumber = detectedSourceOrderNumber;
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

  // Additional header fields
  const noDemande = findValue('N° Demande') || findValue('N° demande') || findValue('No Demande');
  const depotSource = findValue('Dépôt source') || findValue('Depot source');
  const depotDestination = findValue('Dépôt destination') || findValue('Depot destination');

  return {
    noPiece,
    noDemande,
    reference,
    date: findValue('Date') || extractDateFromItems(items),
    dateLivraison: findValue('Date livraison'),
    statut: findValue('Statut'),
    client: findValue('Client'),
    code: findValue('Code'),
    adresseLivraison: findValue('Adresse livraison') || findValue('Adresse'),
    depot: findValue('Dépôt') || findValue('Depot'),
    depotSource,
    depotDestination,
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
      // treat reference anchors conservatively: single token, reasonably short, contains alnum
      const s = item.str.trim();
      if (s.includes(' ')) return false;
      if (s.length > 40) return false;
      if (!/[A-Za-z0-9]/.test(s)) return false;
      return true;
    }
    if (col === 'stock') {
      // only anchor stock if purely numeric (no letters)
      return /^[\d]+([.,]\d+)?$/.test(item.str.replace(/\s/g, ''));
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

  const rows: Array<{ y: number; minY: number; maxY: number; centerX: number; rowItems: TextItem[]; line: OrderLine }> = [];

  for (let i = 0; i < anchorYs.length; i++) {
    const anchorY = anchorYs[i];
    const yAbove = i > 0 ? anchorYs[i - 1] : anchorY + 50;
    const yBelow = i < anchorYs.length - 1 ? anchorYs[i + 1] : anchorY - 50;
    const yTop = (anchorY + yAbove) / 2;
    const yBottom = (anchorY + yBelow) / 2;

    const rowItems = items.filter((item) => item.y <= yTop && item.y > yBottom);
    if (rowItems.length === 0) continue;
    const line = buildLineFromRowItems(rowItems);

    if (line && isLikelyDataLine(line)) {
      const minY = Math.min(...rowItems.map((r) => r.y));
      const maxY = Math.max(...rowItems.map((r) => r.y));
      // compute a representative center X using tokens likely belonging to designation
      const desCandidates = rowItems.filter((it) => {
        const col = assignColumn(it.x);
        return col === 'designation' || col === null || (col !== 'codeABarre' && col !== 'qte' && col !== 'stock' && col !== 'ttc' && col !== 'reliquat');
      });
      const centerX = desCandidates.length > 0 ? Math.round(desCandidates.reduce((s, r) => s + r.x, 0) / desCandidates.length) : Math.round(rowItems.reduce((s, r) => s + r.x, 0) / rowItems.length);
      rows.push({ y: anchorY, minY, maxY, centerX, rowItems, line });
    }
  }

  rows.sort((a, b) => b.y - a.y);

  // Merge continuation rows (multi-line designations) into the previous product row.
  // A continuation row is typically: no code, no reference, no qte, but has designation text
  // and is vertically close to the previous row.
  const merged: Array<{ y: number; minY: number; maxY: number; centerX: number; rowItems: TextItem[]; line: OrderLine }> = [];
  const Y_CONTINUATION_GAP = 30; // allow slightly larger gaps for multi-line descriptions
  const X_CENTER_TOL = 60;
  for (const r of rows) {
    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      const prevLine = prev.line;
      const line = r.line;
      const verticalGap = r.minY - prev.maxY; // positive if r is below prev
      const centerDiff = Math.abs(prev.centerX - r.centerX);

      const isContinuation = isBlank(line.codeABarre) && isBlank(line.reference) && (line.emptyCells.qte || line.qte === 0) && !isBlank(line.designation) && verticalGap <= Y_CONTINUATION_GAP && centerDiff <= X_CENTER_TOL;
      const isQteOnlyForPrev = isBlank(line.codeABarre) && isBlank(line.reference) && !line.emptyCells.qte && (prevLine.emptyCells.qte || prevLine.qte === 0) && verticalGap <= 60 && centerDiff <= 80;

      // Fallback: if the current row contains mostly designation-like tokens and lacks qte/code,
      // consider it a continuation even if centerDiff is larger (handles multi-line with different X offsets)
      const rowItems = r.rowItems || [];
      const codeRefCount = rowItems.filter((it) => {
        const c = assignColumn(it.x);
        return c === 'codeABarre' || c === 'reference';
      }).length;
      const qteTokenCount = rowItems.filter((it) => /\d/.test(it.str) && !/^\d{11,}$/.test(it.str) && assignColumn(it.x) !== 'stock').length;
      const desLikeCount = rowItems.filter((it) => {
        const c = assignColumn(it.x);
        return c === 'designation' || c === null || (c !== 'codeABarre' && c !== 'qte' && c !== 'stock' && c !== 'ttc' && c !== 'reliquat');
      }).length;
      const fallbackContinuation = codeRefCount <= 1 && qteTokenCount === 0 && desLikeCount >= 1 && verticalGap <= 80;

      if (isContinuation || fallbackContinuation) {
        // handle hyphenation at line break
        if (prev.line.designation && prev.line.designation.endsWith('-')) {
          prev.line.designation = prev.line.designation.slice(0, -1) + line.designation;
        } else {
          prev.line.designation = (prev.line.designation + ' ' + line.designation).trim();
        }
        prev.line.emptyCells.designation = isBlank(prev.line.designation);
        prev.line.hasEmptyCell = Object.values(prev.line.emptyCells).some(Boolean);
        // expand prev span and recompute centerX conservatively
        prev.maxY = Math.max(prev.maxY, r.maxY);
        prev.minY = Math.min(prev.minY, r.minY);
        prev.centerX = Math.round((prev.centerX + r.centerX) / 2);
        continue; // skip adding this as a separate row
      }

      if (isQteOnlyForPrev) {
        // Move quantitative fields into previous line when the current row looks like a numeric-only continuation
        prev.line.qte = line.qte;
        prev.line.emptyCells.qte = false;
        // move stock if previous has none
        if (prev.line.emptyCells.stock && !line.emptyCells.stock && line.stock) {
          prev.line.stock = line.stock;
          prev.line.emptyCells.stock = false;
        }
        // move ttc/reliquat if present
        if (typeof line.ttc === 'number' && !prev.line.ttc) prev.line.ttc = line.ttc;
        if (typeof line.reliquat === 'number' && !prev.line.reliquat) prev.line.reliquat = line.reliquat;
        // merge designation if current has any
        if (!isBlank(line.designation)) {
          if (prev.line.designation && prev.line.designation.endsWith('-')) {
            prev.line.designation = prev.line.designation.slice(0, -1) + line.designation;
          } else {
            prev.line.designation = (prev.line.designation + ' ' + line.designation).trim();
          }
          prev.line.emptyCells.designation = isBlank(prev.line.designation);
        }
        prev.line.hasEmptyCell = Object.values(prev.line.emptyCells).some(Boolean);
        prev.maxY = Math.max(prev.maxY, r.maxY);
        prev.minY = Math.min(prev.minY, r.minY);
        prev.centerX = Math.round((prev.centerX + r.centerX) / 2);
        continue; // skip adding this numeric-only row
      }
    }
    merged.push({ y: r.y, minY: r.minY, maxY: r.maxY, centerX: r.centerX, line: r.line });
  }

  return merged.map((r) => r.line);
}

export function buildLineFromRowItems(rowItems: TextItem[]): OrderLine | null {
  if (rowItems.length === 0) return null;

  // Use active columns when available, otherwise fall back to defaults
  const colsForCenters = (activeColumns && activeColumns.length) ? activeColumns : DEFAULT_COLUMNS;
  const colCenters = colsForCenters.map((c) => ({ name: c.name, center: Math.round((c.minX + c.maxX) / 2), width: c.maxX - c.minX }));

  // Group tokens by column using strict bounds first, then nearest-center fallback
  const tokensByCol: Record<string, TextItem[]> = {} as Record<string, TextItem[]>;
  for (const c of colCenters) tokensByCol[c.name] = [];

  for (const it of rowItems) {
    const colName = assignColumn(it.x);
    if (colName && tokensByCol[colName]) {
      tokensByCol[colName].push(it);
    } else {
      // nearest center
      let best: { name: string; center: number; width: number } | null = null;
      let bestDist = Infinity;
      for (const c of colCenters) {
        const d = Math.abs(it.x - c.center);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (best) {
        tokensByCol[best.name] = tokensByCol[best.name] || [];
        tokensByCol[best.name].push(it);
      }
    }
  }

  const codeRaw = (tokensByCol['codeABarre'] || []).sort((a, b) => a.x - b.x).map((i) => i.str).join('');
  let referenceRaw = (tokensByCol['reference'] || []).sort((a, b) => a.x - b.x).map((i) => i.str).join(' ');
  // Preserve top-to-bottom ordering for multi-line designation
  const designationRaw = (tokensByCol['designation'] || []).sort((a, b) => a.y - b.y).map((i) => i.str).join(' ');
  const qteRaw = (tokensByCol['qte'] || []).sort((a, b) => a.x - b.x).map((i) => i.str).join('');
  const emplacementRaw = (tokensByCol['emplacement'] || []).sort((a, b) => a.x - b.x).map((i) => i.str).join(' ');
  const stockRaw = (tokensByCol['stock'] || []).sort((a, b) => a.x - b.x).map((i) => i.str).join(' ');
  const ttcRaw = (tokensByCol['ttc'] || []).sort((a, b) => a.x - b.x).map((i) => i.str).join('');
  const reliquatRaw = (tokensByCol['reliquat'] || []).sort((a, b) => a.x - b.x).map((i) => i.str).join(' ');

  let finalQteRaw = qteRaw;
  if (isBlank(finalQteRaw)) {
    try {
      const qCol = colCenters.find((c) => c.name === 'qte') || colsForCenters.find((c) => c.name === 'qte');
      if (qCol) {
        const qCenter = qCol.center;
        const candidates = rowItems
          .filter((it) => /\d/.test(it.str) && !/^\d{11,}$/.test(it.str))
          // exclude tokens clearly inside stock/ttc/reliquat columns
          .filter((it) => {
            const assigned = assignColumn(it.x);
            return assigned !== 'stock' && assigned !== 'ttc' && assigned !== 'reliquat';
          })
          .map((it) => ({ it, dist: Math.abs(it.x - qCenter) }))
          .sort((a, b) => a.dist - b.dist);
        if (candidates.length > 0) {
          // accept candidate only if it's reasonably close to the qte column center
          const maxAccept = Math.max(60, Math.round((qCol.width || 40) / 2) + 20);
          if (candidates[0].dist <= maxAccept) finalQteRaw = candidates[0].it.str;
        }
      } else {
        // without a q-column definition, avoid picking arbitrary numeric tokens (too risky)
      }
    } catch (e) {
      // ignore fallback errors
    }
  }

  let codeABarre = codeRaw.replace(/\s/g, '').trim();
  let reference = referenceRaw.trim();
  let designation = designationRaw.trim();

  // Heuristic: if `reference` is empty but the first token of `designation`
  // looks like a reference (short numeric or alnum code) move it to `reference`.
  if (!reference) {
    const desTokens = (tokensByCol['designation'] || []).slice().sort((a, b) => a.x - b.x);
    if (desTokens.length > 0) {
      const firstTokRaw = desTokens[0].str.replace(/\s+/g, '').trim();
      const isNumRef = /^[0-9]{3,12}$/.test(firstTokRaw);
      const isAlphaNumRef = /^[A-Z0-9\-_.]{2,15}$/.test(firstTokRaw);
      const restHasAlpha = desTokens.slice(1).some((t) => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(t.str));
      if ((isNumRef || isAlphaNumRef) && restHasAlpha) {
        reference = firstTokRaw;
        // remove first token from designation tokens and rebuild designation
        desTokens.shift();
        designation = desTokens.map((i) => i.str).join(' ').trim();
      }
    }
  }

  // Additional heuristic: sometimes tokens that belong to `designation` are
  // assigned to the `reference` column due to tight column boundaries. If
  // `designation` may be empty when tokens belonging to it were assigned to
  // the `reference` column due to tight column boundaries. If that is the
  // case, and the reference contains multiple tokens where some look like
  // alphabetic designation text, split the reference into `reference` and
  // `designation` parts.
  if (isBlank(designation) && reference) {
    const refTokens = (tokensByCol['reference'] || []).slice().sort((a, b) => a.x - b.x);
    if (refTokens.length > 1) {
      let splitIdx = -1;
      for (let i = 0; i < refTokens.length; i++) {
        const tok = refTokens[i].str.replace(/\s+/g, '').trim();
        const isNumRef = /^[0-9]{3,12}$/.test(tok);
        const isAlphaNumRef = /^[A-Z0-9\-_.]{2,15}$/.test(tok);
        const tokenHasAlpha = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(refTokens[i].str);
        if (tokenHasAlpha && !isAlphaNumRef) {
          splitIdx = i;
          break;
        }
        // If current token looks like a ref and next token has alphabetic chars,
        // split after current token.
        if ((isNumRef || isAlphaNumRef) && i + 1 < refTokens.length) {
          const nextHasAlpha = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(refTokens[i + 1].str);
          if (nextHasAlpha) {
            splitIdx = i + 1;
            break;
          }
        }
      }
      if (splitIdx > 0) {
        const refPart = refTokens.slice(0, splitIdx).map((t) => t.str.replace(/\s+/g, '').trim()).join(' ');
        const desPart = refTokens.slice(splitIdx).map((t) => t.str).join(' ');
        reference = refPart;
        designation = desPart.trim();
      }
    }
  }

  // If designation already has content but some alphabetic tokens ended up
  // assigned to the `reference` column (often a mis-assignment due to tight
  // column boundaries), move trailing alphabetic tokens from `reference`
  // to the front of `designation` so the product name is contiguous.
  if (!isBlank(designation) && reference) {
    const refTokens = (tokensByCol['reference'] || []).slice().sort((a, b) => a.x - b.x);
    if (refTokens.length > 1) {
      let firstAlphaIdx = -1;
      for (let i = 1; i < refTokens.length; i++) {
        if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(refTokens[i].str)) {
          firstAlphaIdx = i;
          break;
        }
      }
      if (firstAlphaIdx > 0) {
        const refPart = refTokens.slice(0, firstAlphaIdx).map((t) => t.str.replace(/\s+/g, '').trim()).join(' ');
        const desPart = refTokens.slice(firstAlphaIdx).map((t) => t.str).join(' ');
        reference = refPart;
        designation = (desPart + ' ' + designation).trim();
      }
    }
  }
  const emplacement = emplacementRaw.trim();
  const qte = parseNumber(finalQteRaw);
  const stock = parseNumber(stockRaw);
  const ttc = parseNumber(ttcRaw);
  const reliquat = parseNumber(reliquatRaw);

  const hasTtcDigit = /\d/.test(ttcRaw || '');
  const hasReliquatDigit = /\d/.test(reliquatRaw || '');

  // Some PDFs place a non-barcode token in the first column when barcode is empty.
  // In that case, treat it as a reference and keep barcode empty.
  if (codeABarre && !/^\d{13}$/.test(codeABarre) && isBlank(reference)) {
    reference = codeABarre;
    codeABarre = '';
  }

  const hasQteDigit = /\d/.test(finalQteRaw || '');
  const hasStockDigit = /\d/.test(stockRaw || '');

  const emptyCells = {
    codeABarre: isBlank(codeABarre),
    reference: isBlank(reference),
    designation: isBlank(designation),
    qte: !hasQteDigit,
    emplacement: isBlank(emplacement),
    stock: !hasStockDigit,
  };

  const line: OrderLine = {
    codeABarre,
    reference,
    designation,
    qte,
    emplacement,
    stock,
    ...(hasTtcDigit ? { ttc } : {}),
    ...(hasReliquatDigit ? { reliquat } : {}),
    emptyCells,
    hasEmptyCell: Object.values(emptyCells).some(Boolean),
    meta: {},
  };

  return line;
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
