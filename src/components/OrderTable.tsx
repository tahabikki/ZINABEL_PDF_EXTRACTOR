import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { OrderLine, ParsedOrder } from '@/types/order';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/lib/performanceHooks';
import { Input } from '@/components/ui/input';
import { RotateCcw, Search, X, Check } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import TableRow from './TableRow';

interface OrderTableProps {
  lines: OrderLine[];
  order?: ParsedOrder;
  onFiltersReady?: (data: {
    principal: OrderLine[];
    nonValidated: OrderLine[];
    validated: OrderLine[];
    activeTab: 'principal' | 'nonValidated' | 'validated';
  }) => void;
}

type StockFilter = 'all' | 'positive' | 'zero' | 'negative';
type EmptyFilter = 'all' | 'with-empty' | 'without-empty' | 'barcode-empty';
type SortFilter =
  | 'default'
  | 'stock-asc'
  | 'stock-desc'
  | 'qte-asc'
  | 'qte-desc'
  | 'emplacement-asc'
  | 'emplacement-desc';
type QtyMode = 'exact' | 'gt' | 'lt';
type StockMode = 'exact' | 'gt' | 'lt';

const STOCK_FILTER_LABELS: Record<StockFilter, string> = {
  all: 'Tous',
  positive: 'Positif',
  zero: 'Zéro',
  negative: 'Négatif',
};

const EMPTY_FILTER_LABELS: Record<EmptyFilter, string> = {
  all: 'Tous',
  'with-empty': 'Avec vides',
  'without-empty': 'Sans vides',
  'barcode-empty': 'Code-barres vide',
};

const SORT_FILTER_LABELS: Record<SortFilter, string> = {
  default: 'Ordre PDF',
  'stock-asc': 'Stock ↑',
  'stock-desc': 'Stock ↓',
  'qte-asc': 'Qté ↑',
  'qte-desc': 'Qté ↓',
  'emplacement-asc': 'Emplacement ↑',
  'emplacement-desc': 'Emplacement ↓',
};

const QTY_TONES = [
  {
    idle: 'border-sky-200/60 bg-sky-50/50 text-sky-800 hover:bg-sky-100/70',
    active: 'border-sky-500/50 bg-sky-500/15 text-sky-800',
  },
  {
    idle: 'border-indigo-200/60 bg-indigo-50/50 text-indigo-800 hover:bg-indigo-100/70',
    active: 'border-indigo-500/50 bg-indigo-500/15 text-indigo-800',
  },
  {
    idle: 'border-violet-200/60 bg-violet-50/50 text-violet-800 hover:bg-violet-100/70',
    active: 'border-violet-500/50 bg-violet-500/15 text-violet-800',
  },
  {
    idle: 'border-cyan-200/60 bg-cyan-50/50 text-cyan-800 hover:bg-cyan-100/70',
    active: 'border-cyan-500/50 bg-cyan-500/15 text-cyan-800',
  },
  {
    idle: 'border-teal-200/60 bg-teal-50/50 text-teal-800 hover:bg-teal-100/70',
    active: 'border-teal-500/50 bg-teal-500/15 text-teal-800',
  },
];

const EMP_TONES = [
  { idle: 'border-rose-200/60 bg-rose-50/40 text-rose-800 hover:bg-rose-100/70', active: 'border-rose-500/40 bg-rose-500/12 text-rose-800' },
  { idle: 'border-pink-200/60 bg-pink-50/40 text-pink-800 hover:bg-pink-100/70', active: 'border-pink-500/40 bg-pink-500/12 text-pink-800' },
  { idle: 'border-amber-200/60 bg-amber-50/40 text-amber-800 hover:bg-amber-100/70', active: 'border-amber-500/40 bg-amber-500/12 text-amber-800' },
  { idle: 'border-sky-200/60 bg-sky-50/40 text-sky-800 hover:bg-sky-100/70', active: 'border-sky-500/40 bg-sky-500/12 text-sky-800' },
  { idle: 'border-emerald-200/60 bg-emerald-50/40 text-emerald-800 hover:bg-emerald-100/70', active: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-800' },
  { idle: 'border-indigo-200/60 bg-indigo-50/40 text-indigo-800 hover:bg-indigo-100/70', active: 'border-indigo-500/40 bg-indigo-500/12 text-indigo-800' },
  { idle: 'border-violet-200/60 bg-violet-50/40 text-violet-800 hover:bg-violet-100/70', active: 'border-violet-500/40 bg-violet-500/12 text-violet-800' },
];

function getFirstLetter(emplacement: string) {
  const s = (emplacement || '').trim();
  if (!s) return '';
  const m = s.match(/^\p{L}/u);
  if (m) return m[0].toUpperCase();
  return s[0].toUpperCase();
}

function getRowId(line: OrderLine) {
  return `${line.codeABarre || ''}||${line.reference || ''}||${line.designation || ''}||${line.emplacement || ''}`;
}

function safeLower(s?: string) {
  return (s || '').toLowerCase();
}

// Brand color palette
const BRAND_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-red-100 text-red-800 border-red-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-orange-100 text-orange-800 border-orange-200',
];

// Hash function to generate consistent color index for brand
function getBrandColorIndex(brand: string): number {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) {
    hash = ((hash << 5) - hash) + brand.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % BRAND_COLORS.length;
}

function getBrandColor(brand?: string): string {
  if (!brand) return BRAND_COLORS[0];
  return BRAND_COLORS[getBrandColorIndex(brand)];
}

/**
 * Mobile-safe setState wrapper that prevents crashes on filter interactions
 */
function createSafeSetState<T>(setter: (value: T | ((prev: T) => T)) => void, name: string = 'state') {
  return (value: T | ((prev: T) => T)) => {
    try {
      setter(value);
    } catch (err) {
      console.warn(`Error setting ${name}:`, err);
    }
  };
}

const OrderTable: React.FC<OrderTableProps> = ({ lines, onFiltersReady }) => {
  const [rawSearch, setRawSearch] = useState('');
  const search = useDebounce(rawSearch, 250); // debounce search for better performance
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [stockMode, setStockMode] = useState<StockMode>('exact');
  const [stockValueFilter, setStockValueFilter] = useState<string>('all');
  const [emptyFilter, setEmptyFilter] = useState<EmptyFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('default');
  const [qtyFilter, setQtyFilter] = useState<Set<string>>(new Set());
  const [qtyMode, setQtyMode] = useState<QtyMode>('exact');
  const [brandFilter, setBrandFilter] = useState<Set<string>>(new Set());
  const [ttcFilterEnabled, setTtcFilterEnabled] = useState<boolean>(false);
  const [ttcOp, setTtcOp] = useState<'gt' | 'lt' | 'between'>('gt');
  const [ttcValueMin, setTtcValueMin] = useState<string>('');
  const [ttcValueMax, setTtcValueMax] = useState<string>('');
  const [empFilter, setEmpFilter] = useState<Set<string>>(new Set());
  
  // Per-letter selections - each letter has its own section/row/level choices
  const [empSectionsByLetter, setEmpSectionsByLetter] = useState<Map<string, Set<string>>>(new Map());
  const [empRowsByLetter, setEmpRowsByLetter] = useState<Map<string, Set<string>>>(new Map());
  const [empLevelsByLetter, setEmpLevelsByLetter] = useState<Map<string, Set<string>>>(new Map());
  
  const [empEmplacements, setEmpEmplacements] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [validatedRows, setValidatedRows] = useState<string[]>([]);
  const [qtePreparedMap, setQtePreparedMap] = useState<Map<string, number>>(new Map());
  const [removeValidatedFromMaster, setRemoveValidatedFromMaster] = useState<boolean>(false);
  const [autoValidateOnCheck, setAutoValidateOnCheck] = useState<boolean>(true);

  // Create safe versions of all setters to prevent DOM race condition crashes on mobile
  const safeSetRawSearch = createSafeSetState(setRawSearch, 'search');
  const safeSetStockFilter = createSafeSetState(setStockFilter, 'stockFilter');
  const safeSetStockMode = createSafeSetState(setStockMode, 'stockMode');
  const safeSetStockValueFilter = createSafeSetState(setStockValueFilter, 'stockValueFilter');
  const safeSetQtyFilter = createSafeSetState(setQtyFilter, 'qtyFilter');
  const safeSetQtyMode = createSafeSetState(setQtyMode, 'qtyMode');
  const safeSetBrandFilter = createSafeSetState(setBrandFilter, 'brandFilter');
  const safeSetEmptyFilter = createSafeSetState(setEmptyFilter, 'emptyFilter');
  const safeSetEmpFilter = createSafeSetState(setEmpFilter, 'empFilter');
  const safeSetEmpEmplacements = createSafeSetState(setEmpEmplacements, 'empEmplacements');
  const safeSetSelectedRows = createSafeSetState(setSelectedRows, 'selectedRows');
  const safeSetValidatedRows = createSafeSetState(setValidatedRows, 'validatedRows');
  const safeSetSortFilter = createSafeSetState(setSortFilter, 'sortFilter');
  const [activeView, setActiveView] = useState<'principal' | 'nonValidated' | 'validated'>('principal');
  const [preserveValidatedAcrossUploads, setPreserveValidatedAcrossUploads] = useState<boolean>(false);

  const updateQtePrepared = (rowId: string, value: number) => {
    setQtePreparedMap((prev) => {
      const newMap = new Map(prev);
      if (value <= 0) {
        newMap.delete(rowId);
      } else {
        newMap.set(rowId, value);
      }
      return newMap;
    });
  };

  useEffect(() => {
    if (!preserveValidatedAcrossUploads) {
      try {
        localStorage.removeItem('validatedRows');
      } catch (e) {}
      setValidatedRows([]);
      return;
    }

    try {
      const raw = localStorage.getItem('validatedRows');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setValidatedRows(arr);
      }
    } catch (e) {
      // ignore
    }
  }, [preserveValidatedAcrossUploads]);

  useEffect(() => {
    if (preserveValidatedAcrossUploads) localStorage.setItem('validatedRows', JSON.stringify(validatedRows));
    else localStorage.removeItem('validatedRows');
  }, [validatedRows, preserveValidatedAcrossUploads]);

  const linesSignatureRef = useRef<string>('');
  useEffect(() => {
    const sig = lines.map((l) => getRowId(l)).join('||');
    const isFirstLoad = !linesSignatureRef.current;
    const hasChanged = linesSignatureRef.current && linesSignatureRef.current !== sig;
    
    if (isFirstLoad || hasChanged) {
      // Initialize or reset on first load or when lines change
      if (hasChanged && !preserveValidatedAcrossUploads) {
        setValidatedRows([]);
        try {
          localStorage.removeItem('validatedRows');
        } catch (e) {}
      } else if (hasChanged) {
        // Keep only validated ids that exist in new lines
        setValidatedRows((prev) => prev.filter((id) => lines.some((l) => getRowId(l) === id)));
      }
      
      if (hasChanged) {
        setSelectedRows(new Set());
      }
      
      // Initialize qtePreparedMap with default values (Qte Validée = Qte) - on first load AND on new uploads
      const newQtePreparedMap = new Map<string, number>();
      lines.forEach((line) => {
        const rowId = getRowId(line);
        newQtePreparedMap.set(rowId, line.qte);
      });
      setQtePreparedMap(newQtePreparedMap);
    }
    linesSignatureRef.current = sig;
  }, [lines, preserveValidatedAcrossUploads]);

  

  const filteredAll = useMemo(() => {
    let result = lines;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          safeLower(l.codeABarre).includes(q) ||
          safeLower(l.reference).includes(q) ||
          safeLower(l.designation).includes(q) ||
          safeLower(l.emplacement).includes(q) ||
          safeLower(l.brand).includes(q)
      );
    }

    if (empFilter.size > 0) {
      result = result.filter((l) => empFilter.has(getFirstLetter(l.emplacement)));
    }

    if (empEmplacements.size > 0) {
      result = result.filter((l) => empEmplacements.has((l.emplacement || '').trim()));
    }

    // Apply per-letter section/row/level filters
    result = result.filter((l) => {
      const letter = getFirstLetter(l.emplacement);
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      const section = parts[1] || '';
      const row = parts[2] || '';
      const level = parts[3] || '';

      // If letter is selected, check its specific filters
      if (empFilter.has(letter)) {
        const letterSections = empSectionsByLetter.get(letter) || new Set();
        const letterRows = empRowsByLetter.get(letter) || new Set();
        const letterLevels = empLevelsByLetter.get(letter) || new Set();

        if (letterSections.size > 0 && !letterSections.has(section)) return false;
        if (letterRows.size > 0 && !letterRows.has(row)) return false;
        if (letterLevels.size > 0 && !letterLevels.has(level)) return false;
      }

      return true;
    });

    if (stockFilter === 'positive') result = result.filter((l) => !l.emptyCells.stock && l.stock > 0);
    else if (stockFilter === 'zero') result = result.filter((l) => !l.emptyCells.stock && l.stock === 0);
    else if (stockFilter === 'negative') result = result.filter((l) => !l.emptyCells.stock && l.stock < 0);

    const hasStockValue =
      stockValueFilter !== 'all' && stockValueFilter.trim() !== '' && !Number.isNaN(Number(stockValueFilter));
    if (hasStockValue) {
      const targetStock = Number(stockValueFilter);
      if (stockMode === 'exact') result = result.filter((l) => !l.emptyCells.stock && l.stock === targetStock);
      else if (stockMode === 'gt') result = result.filter((l) => !l.emptyCells.stock && l.stock > targetStock);
      else result = result.filter((l) => !l.emptyCells.stock && l.stock < targetStock);
    }

    const hasQtyValue = qtyFilter.size > 0;
    if (hasQtyValue) {
      if (qtyMode === 'exact') result = result.filter((l) => qtyFilter.has(String(Math.round(l.qte))));
      else if (qtyMode === 'gt') result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty > Number(q));
      });
      else result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty < Number(q));
      });
    }

    if (brandFilter.size > 0) {
      result = result.filter((l) => brandFilter.has(l.brand || ''));
    }

    // Apply TTC filter when enabled
    if (ttcFilterEnabled) {
      const min = ttcValueMin === '' ? NaN : Number(ttcValueMin);
      const max = ttcValueMax === '' ? NaN : Number(ttcValueMax);
      result = result.filter((l) => {
        const t = typeof l.ttc === 'number' ? l.ttc : NaN;
        if (Number.isNaN(t)) return false;
        if (ttcOp === 'gt') return !Number.isNaN(min) ? t > min : true;
        if (ttcOp === 'lt') return !Number.isNaN(min) ? t < min : true;
        // between
        if (!Number.isNaN(min) && !Number.isNaN(max)) return t >= min && t <= max;
        if (!Number.isNaN(min)) return t >= min;
        if (!Number.isNaN(max)) return t <= max;
        return true;
      });
    }

    if (emptyFilter === 'with-empty') result = result.filter((l) => l.hasEmptyCell);
    else if (emptyFilter === 'without-empty') result = result.filter((l) => !l.hasEmptyCell);
    else if (emptyFilter === 'barcode-empty') result = result.filter((l) => l.emptyCells.codeABarre);

    if (sortFilter !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortFilter) {
          case 'stock-asc':
            return a.stock - b.stock;
          case 'stock-desc':
            return b.stock - a.stock;
          case 'qte-asc':
            return a.qte - b.qte;
          case 'qte-desc':
            return b.qte - a.qte;
          case 'emplacement-asc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (a.emplacement || '').localeCompare(b.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          case 'emplacement-desc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (b.emplacement || '').localeCompare(a.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          default:
            return 0;
        }
      });
    }

    return result;
  }, [
    lines,
    search,
    stockFilter,
    stockMode,
    stockValueFilter,
    qtyFilter,
    qtyMode,
    brandFilter,
    emptyFilter,
    sortFilter,
    empFilter,
    empSectionsByLetter,
    empRowsByLetter,
    empLevelsByLetter,
    empEmplacements,
  ]);

  // Same as filteredAll but without quantity filter - used for quantity group counts so all quantities always show
  const filteredAllWithoutQtyFilter = useMemo(() => {
    let result = lines;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          safeLower(l.codeABarre).includes(q) ||
          safeLower(l.reference).includes(q) ||
          safeLower(l.designation).includes(q) ||
          safeLower(l.emplacement).includes(q)
      );
    }

    if (empFilter.size > 0) {
      result = result.filter((l) => empFilter.has(getFirstLetter(l.emplacement)));
    }

    if (empEmplacements.size > 0) {
      result = result.filter((l) => empEmplacements.has((l.emplacement || '').trim()));
    }

    // Apply per-letter section/row/level filters
    result = result.filter((l) => {
      const letter = getFirstLetter(l.emplacement);
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      const section = parts[1] || '';
      const row = parts[2] || '';
      const level = parts[3] || '';

      // If letter is selected, check its specific filters
      if (empFilter.has(letter)) {
        const letterSections = empSectionsByLetter.get(letter) || new Set();
        const letterRows = empRowsByLetter.get(letter) || new Set();
        const letterLevels = empLevelsByLetter.get(letter) || new Set();

        if (letterSections.size > 0 && !letterSections.has(section)) return false;
        if (letterRows.size > 0 && !letterRows.has(row)) return false;
        if (letterLevels.size > 0 && !letterLevels.has(level)) return false;
      }

      return true;
    });

    if (stockFilter === 'positive') result = result.filter((l) => !l.emptyCells.stock && l.stock > 0);
    else if (stockFilter === 'zero') result = result.filter((l) => !l.emptyCells.stock && l.stock === 0);
    else if (stockFilter === 'negative') result = result.filter((l) => !l.emptyCells.stock && l.stock < 0);

    const hasStockValue =
      stockValueFilter !== 'all' && stockValueFilter.trim() !== '' && !Number.isNaN(Number(stockValueFilter));
    if (hasStockValue) {
      const targetStock = Number(stockValueFilter);
      if (stockMode === 'exact') result = result.filter((l) => !l.emptyCells.stock && l.stock === targetStock);
      else if (stockMode === 'gt') result = result.filter((l) => !l.emptyCells.stock && l.stock > targetStock);
      else result = result.filter((l) => !l.emptyCells.stock && l.stock < targetStock);
    }

    // NOTE: Quantity filter is NOT applied here - that's intentional!
    // This allows qtyGroups to show all available quantities with their counts

    if (emptyFilter === 'with-empty') result = result.filter((l) => l.hasEmptyCell);
    else if (emptyFilter === 'without-empty') result = result.filter((l) => !l.hasEmptyCell);
    else if (emptyFilter === 'barcode-empty') result = result.filter((l) => l.emptyCells.codeABarre);

    if (sortFilter !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortFilter) {
          case 'stock-asc':
            return a.stock - b.stock;
          case 'stock-desc':
            return b.stock - a.stock;
          case 'qte-asc':
            return a.qte - b.qte;
          case 'qte-desc':
            return b.qte - a.qte;
          case 'emplacement-asc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (a.emplacement || '').localeCompare(b.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          case 'emplacement-desc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (b.emplacement || '').localeCompare(a.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          default:
            return 0;
        }
      });
    }

    return result;
  }, [
    lines,
    search,
    stockFilter,
    stockMode,
    stockValueFilter,
    emptyFilter,
    sortFilter,
    empFilter,
    empSectionsByLetter,
    empRowsByLetter,
    empLevelsByLetter,
    empEmplacements,
  ]);

  const filteredNonValidated = useMemo(() => {
    return filteredAll.filter((l) => !validatedRows.includes(getRowId(l)));
  }, [filteredAll, validatedRows]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    stockFilter !== 'all' ||
    stockValueFilter !== 'all' ||
    stockMode !== 'exact' ||
    qtyFilter.size > 0 ||
    qtyMode !== 'exact' ||
    emptyFilter !== 'all' ||
    sortFilter !== 'default' ||
    empFilter.size > 0 ||
    empSectionsByLetter.size > 0 ||
    empRowsByLetter.size > 0 ||
    empLevelsByLetter.size > 0 ||
    empEmplacements.size > 0;

  const validatedLines = useMemo(() => {
    return lines.filter((l) => validatedRows.includes(getRowId(l)));
  }, [lines, validatedRows]);

  // Apply current filters to an arbitrary list (used for validated view counts)
  const applyFilters = (baseLines: OrderLine[]) => {
    let result = baseLines;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          safeLower(l.codeABarre).includes(q) ||
          safeLower(l.reference).includes(q) ||
          safeLower(l.designation).includes(q) ||
          safeLower(l.emplacement).includes(q) ||
          safeLower(l.brand).includes(q)
      );
    }

    if (empFilter.size > 0) {
      result = result.filter((l) => empFilter.has(getFirstLetter(l.emplacement)));
    }

    if (empEmplacements.size > 0) {
      result = result.filter((l) => empEmplacements.has((l.emplacement || '').trim()));
    }

    // Apply per-letter section/row/level filters
    result = result.filter((l) => {
      const letter = getFirstLetter(l.emplacement);
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      const section = parts[1] || '';
      const row = parts[2] || '';
      const level = parts[3] || '';

      // If letter is selected, check its specific filters
      if (empFilter.has(letter)) {
        const letterSections = empSectionsByLetter.get(letter) || new Set();
        const letterRows = empRowsByLetter.get(letter) || new Set();
        const letterLevels = empLevelsByLetter.get(letter) || new Set();

        if (letterSections.size > 0 && !letterSections.has(section)) return false;
        if (letterRows.size > 0 && !letterRows.has(row)) return false;
        if (letterLevels.size > 0 && !letterLevels.has(level)) return false;
      }

      return true;
    });

    if (stockFilter === 'positive') result = result.filter((l) => !l.emptyCells.stock && l.stock > 0);
    else if (stockFilter === 'zero') result = result.filter((l) => !l.emptyCells.stock && l.stock === 0);
    else if (stockFilter === 'negative') result = result.filter((l) => !l.emptyCells.stock && l.stock < 0);

    const hasStockValue =
      stockValueFilter !== 'all' && stockValueFilter.trim() !== '' && !Number.isNaN(Number(stockValueFilter));
    if (hasStockValue) {
      const targetStock = Number(stockValueFilter);
      if (stockMode === 'exact') result = result.filter((l) => !l.emptyCells.stock && l.stock === targetStock);
      else if (stockMode === 'gt') result = result.filter((l) => !l.emptyCells.stock && l.stock > targetStock);
      else result = result.filter((l) => !l.emptyCells.stock && l.stock < targetStock);
    }

    const hasQtyValue = qtyFilter.size > 0;
    if (hasQtyValue) {
      if (qtyMode === 'exact') result = result.filter((l) => qtyFilter.has(String(Math.round(l.qte))));
      else if (qtyMode === 'gt') result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty > Number(q));
      });
      else result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty < Number(q));
      });
    }

    if (emptyFilter === 'with-empty') result = result.filter((l) => l.hasEmptyCell);
    else if (emptyFilter === 'without-empty') result = result.filter((l) => !l.hasEmptyCell);
    else if (emptyFilter === 'barcode-empty') result = result.filter((l) => l.emptyCells.codeABarre);

    if (sortFilter !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortFilter) {
          case 'stock-asc':
            return a.stock - b.stock;
          case 'stock-desc':
            return b.stock - a.stock;
          case 'qte-asc':
            return a.qte - b.qte;
          case 'qte-desc':
            return b.qte - a.qte;
          case 'emplacement-asc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (a.emplacement || '').localeCompare(b.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          case 'emplacement-desc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (b.emplacement || '').localeCompare(a.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          default:
            return 0;
        }
      });
    }

    return result;
  };

  // Same as applyFilters but without quantity filter - used for displaying available quantities
  const applyFiltersWithoutQty = (baseLines: OrderLine[]) => {
    let result = baseLines;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          safeLower(l.codeABarre).includes(q) ||
          safeLower(l.reference).includes(q) ||
          safeLower(l.designation).includes(q) ||
          safeLower(l.emplacement).includes(q)
      );
    }

    if (empFilter.size > 0) {
      result = result.filter((l) => empFilter.has(getFirstLetter(l.emplacement)));
    }

    if (empEmplacements.size > 0) {
      result = result.filter((l) => empEmplacements.has((l.emplacement || '').trim()));
    }

    // Apply per-letter section/row/level filters
    result = result.filter((l) => {
      const letter = getFirstLetter(l.emplacement);
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      const section = parts[1] || '';
      const row = parts[2] || '';
      const level = parts[3] || '';

      // If letter is selected, check its specific filters
      if (empFilter.has(letter)) {
        const letterSections = empSectionsByLetter.get(letter) || new Set();
        const letterRows = empRowsByLetter.get(letter) || new Set();
        const letterLevels = empLevelsByLetter.get(letter) || new Set();

        if (letterSections.size > 0 && !letterSections.has(section)) return false;
        if (letterRows.size > 0 && !letterRows.has(row)) return false;
        if (letterLevels.size > 0 && !letterLevels.has(level)) return false;
      }

      return true;
    });

    if (stockFilter === 'positive') result = result.filter((l) => !l.emptyCells.stock && l.stock > 0);
    else if (stockFilter === 'zero') result = result.filter((l) => !l.emptyCells.stock && l.stock === 0);
    else if (stockFilter === 'negative') result = result.filter((l) => !l.emptyCells.stock && l.stock < 0);

    const hasStockValue =
      stockValueFilter !== 'all' && stockValueFilter.trim() !== '' && !Number.isNaN(Number(stockValueFilter));
    if (hasStockValue) {
      const targetStock = Number(stockValueFilter);
      if (stockMode === 'exact') result = result.filter((l) => !l.emptyCells.stock && l.stock === targetStock);
      else if (stockMode === 'gt') result = result.filter((l) => !l.emptyCells.stock && l.stock > targetStock);
      else result = result.filter((l) => !l.emptyCells.stock && l.stock < targetStock);
    }

    // NOTE: Quantity filter is NOT applied here - intentional for counting available quantities

    if (emptyFilter === 'with-empty') result = result.filter((l) => l.hasEmptyCell);
    else if (emptyFilter === 'without-empty') result = result.filter((l) => !l.hasEmptyCell);
    else if (emptyFilter === 'barcode-empty') result = result.filter((l) => l.emptyCells.codeABarre);

    if (sortFilter !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortFilter) {
          case 'stock-asc':
            return a.stock - b.stock;
          case 'stock-desc':
            return b.stock - a.stock;
          case 'qte-asc':
            return a.qte - b.qte;
          case 'qte-desc':
            return b.qte - a.qte;
          case 'emplacement-asc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (a.emplacement || '').localeCompare(b.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          case 'emplacement-desc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (b.emplacement || '').localeCompare(a.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          default:
            return 0;
        }
      });
    }

    return result;
  };

  // Same as applyFiltersWithoutQty but also without emplacement filters - for showing all available emplacements
  const applyFiltersWithoutEmp = (baseLines: OrderLine[]) => {
    let result = baseLines;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          safeLower(l.codeABarre).includes(q) ||
          safeLower(l.reference).includes(q) ||
          safeLower(l.designation).includes(q) ||
          safeLower(l.emplacement).includes(q) ||
          safeLower(l.brand).includes(q)
      );
    }

    // NOTE: All emplacement filters are NOT applied here - intentional for showing all available locations
    // Skipping: empFilter, empEmplacements, empSections, empRows, empLevels

    if (stockFilter === 'positive') result = result.filter((l) => !l.emptyCells.stock && l.stock > 0);
    else if (stockFilter === 'zero') result = result.filter((l) => !l.emptyCells.stock && l.stock === 0);
    else if (stockFilter === 'negative') result = result.filter((l) => !l.emptyCells.stock && l.stock < 0);

    const hasStockValue =
      stockValueFilter !== 'all' && stockValueFilter.trim() !== '' && !Number.isNaN(Number(stockValueFilter));
    if (hasStockValue) {
      const targetStock = Number(stockValueFilter);
      if (stockMode === 'exact') result = result.filter((l) => !l.emptyCells.stock && l.stock === targetStock);
      else if (stockMode === 'gt') result = result.filter((l) => !l.emptyCells.stock && l.stock > targetStock);
      else result = result.filter((l) => !l.emptyCells.stock && l.stock < targetStock);
    }

    const hasQtyValue = qtyFilter.size > 0;
    if (hasQtyValue) {
      if (qtyMode === 'exact') result = result.filter((l) => qtyFilter.has(String(Math.round(l.qte))));
      else if (qtyMode === 'gt') result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty > Number(q));
      });
      else result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty < Number(q));
      });
    }

    if (emptyFilter === 'with-empty') result = result.filter((l) => l.hasEmptyCell);
    else if (emptyFilter === 'without-empty') result = result.filter((l) => !l.hasEmptyCell);
    else if (emptyFilter === 'barcode-empty') result = result.filter((l) => l.emptyCells.codeABarre);

    if (sortFilter !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortFilter) {
          case 'stock-asc':
            return a.stock - b.stock;
          case 'stock-desc':
            return b.stock - a.stock;
          case 'qte-asc':
            return a.qte - b.qte;
          case 'qte-desc':
            return b.qte - a.qte;
          case 'emplacement-asc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (a.emplacement || '').localeCompare(b.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          case 'emplacement-desc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (b.emplacement || '').localeCompare(a.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          default:
            return 0;
        }
      });
    }

    return result;
  };

  // For section/row/level options - exclude those filters so all options always available
  const applyFiltersWithoutLocationStructure = (baseLines: OrderLine[]) => {
    let result = baseLines;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          safeLower(l.codeABarre).includes(q) ||
          safeLower(l.reference).includes(q) ||
          safeLower(l.designation).includes(q) ||
          safeLower(l.emplacement).includes(q)
      );
    }

    if (empFilter.size > 0) {
      result = result.filter((l) => empFilter.has(getFirstLetter(l.emplacement)));
    }

    if (empEmplacements.size > 0) {
      result = result.filter((l) => empEmplacements.has((l.emplacement || '').trim()));
    }

    // NOTE: Section/Row/Level filters are NOT applied - intentional for showing all available options
    // Skipping: empSections, empRows, empLevels

    if (stockFilter === 'positive') result = result.filter((l) => !l.emptyCells.stock && l.stock > 0);
    else if (stockFilter === 'zero') result = result.filter((l) => !l.emptyCells.stock && l.stock === 0);
    else if (stockFilter === 'negative') result = result.filter((l) => !l.emptyCells.stock && l.stock < 0);

    const hasStockValue =
      stockValueFilter !== 'all' && stockValueFilter.trim() !== '' && !Number.isNaN(Number(stockValueFilter));
    if (hasStockValue) {
      const targetStock = Number(stockValueFilter);
      if (stockMode === 'exact') result = result.filter((l) => !l.emptyCells.stock && l.stock === targetStock);
      else if (stockMode === 'gt') result = result.filter((l) => !l.emptyCells.stock && l.stock > targetStock);
      else result = result.filter((l) => !l.emptyCells.stock && l.stock < targetStock);
    }

    const hasQtyValue = qtyFilter.size > 0;
    if (hasQtyValue) {
      if (qtyMode === 'exact') result = result.filter((l) => qtyFilter.has(String(Math.round(l.qte))));
      else if (qtyMode === 'gt') result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty > Number(q));
      });
      else result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty < Number(q));
      });
    }

    if (emptyFilter === 'with-empty') result = result.filter((l) => l.hasEmptyCell);
    else if (emptyFilter === 'without-empty') result = result.filter((l) => !l.hasEmptyCell);
    else if (emptyFilter === 'barcode-empty') result = result.filter((l) => l.emptyCells.codeABarre);

    if (sortFilter !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortFilter) {
          case 'stock-asc':
            return a.stock - b.stock;
          case 'stock-desc':
            return b.stock - a.stock;
          case 'qte-asc':
            return a.qte - b.qte;
          case 'qte-desc':
            return b.qte - a.qte;
          case 'emplacement-asc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (a.emplacement || '').localeCompare(b.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          case 'emplacement-desc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (b.emplacement || '').localeCompare(a.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          default:
            return 0;
        }
      });
    }

    return result;
  };

  // filtered (existing) is the master-filtered list; compute a filtered view for validated lines
  const filteredValidated = useMemo(() => applyFilters(validatedLines), [
    validatedLines,
    search,
    empFilter,
    empSectionsByLetter,
    empRowsByLetter,
    empLevelsByLetter,
    empEmplacements,
    stockFilter,
    stockMode,
    stockValueFilter,
    qtyFilter,
    qtyMode,
    emptyFilter,
    sortFilter,
  ]);

  const baseForCounts = activeView === 'validated' ? filteredValidated : activeView === 'nonValidated' ? filteredNonValidated : filteredAll;

  // For quantity options - exclude qty filter so all quantities always available
  const filteredValidatedWithoutQty = useMemo(() => applyFiltersWithoutQty(validatedLines), [
    validatedLines,
    search,
    empFilter,
    empSectionsByLetter,
    empRowsByLetter,
    empLevelsByLetter,
    empEmplacements,
    stockFilter,
    stockMode,
    stockValueFilter,
    emptyFilter,
    sortFilter,
  ]);

  const filteredNonValidatedWithoutQty = useMemo(() => {
    return filteredAllWithoutQtyFilter.filter((l) => !validatedRows.includes(getRowId(l)));
  }, [filteredAllWithoutQtyFilter, validatedRows]);

  const baseForCountsWithoutQty = useMemo(
    () =>
      activeView === 'validated'
        ? filteredValidatedWithoutQty
        : activeView === 'nonValidated'
          ? filteredNonValidatedWithoutQty
          : filteredAllWithoutQtyFilter,
    [activeView, filteredValidatedWithoutQty, filteredNonValidatedWithoutQty, filteredAllWithoutQtyFilter]
  );

  const qtyGroups = useMemo(() => {
    const map = new Map<number, number>();
    baseForCountsWithoutQty.forEach((l) => {
      const qty = Math.round(l.qte);
      map.set(qty, (map.get(qty) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [baseForCountsWithoutQty]);

  const brandGroups = useMemo(() => {
    const map = new Map<string, number>();
    baseForCountsWithoutQty.forEach((l) => {
      const brand = l.brand || '';
      map.set(brand, (map.get(brand) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [baseForCountsWithoutQty]);

  // For emplacement options - exclude all emplacement filters so all locations always available
  const filteredAllWithoutEmp = useMemo(() => {
    let result = lines;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          safeLower(l.codeABarre).includes(q) ||
          safeLower(l.reference).includes(q) ||
          safeLower(l.designation).includes(q) ||
          safeLower(l.emplacement).includes(q)
      );
    }

    // NOTE: All emplacement filters are NOT applied here - intentional for showing all available locations
    // Skipping: empFilter, empEmplacements, empSections, empRows, empLevels

    if (stockFilter === 'positive') result = result.filter((l) => !l.emptyCells.stock && l.stock > 0);
    else if (stockFilter === 'zero') result = result.filter((l) => !l.emptyCells.stock && l.stock === 0);
    else if (stockFilter === 'negative') result = result.filter((l) => !l.emptyCells.stock && l.stock < 0);

    const hasStockValue =
      stockValueFilter !== 'all' && stockValueFilter.trim() !== '' && !Number.isNaN(Number(stockValueFilter));
    if (hasStockValue) {
      const targetStock = Number(stockValueFilter);
      if (stockMode === 'exact') result = result.filter((l) => !l.emptyCells.stock && l.stock === targetStock);
      else if (stockMode === 'gt') result = result.filter((l) => !l.emptyCells.stock && l.stock > targetStock);
      else result = result.filter((l) => !l.emptyCells.stock && l.stock < targetStock);
    }

    const hasQtyValue = qtyFilter.size > 0;
    if (hasQtyValue) {
      if (qtyMode === 'exact') result = result.filter((l) => qtyFilter.has(String(Math.round(l.qte))));
      else if (qtyMode === 'gt') result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty > Number(q));
      });
      else result = result.filter((l) => {
        const qty = Math.round(l.qte);
        return Array.from(qtyFilter).some(q => qty < Number(q));
      });
    }

    if (emptyFilter === 'with-empty') result = result.filter((l) => l.hasEmptyCell);
    else if (emptyFilter === 'without-empty') result = result.filter((l) => !l.hasEmptyCell);
    else if (emptyFilter === 'barcode-empty') result = result.filter((l) => l.emptyCells.codeABarre);

    if (sortFilter !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortFilter) {
          case 'stock-asc':
            return a.stock - b.stock;
          case 'stock-desc':
            return b.stock - a.stock;
          case 'qte-asc':
            return a.qte - b.qte;
          case 'qte-desc':
            return b.qte - a.qte;
          case 'emplacement-asc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (a.emplacement || '').localeCompare(b.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          case 'emplacement-desc': {
            if (a.emptyCells.emplacement && !b.emptyCells.emplacement) return 1;
            if (!a.emptyCells.emplacement && b.emptyCells.emplacement) return -1;
            return (b.emplacement || '').localeCompare(a.emplacement || '', 'fr-FR', { sensitivity: 'base' });
          }
          default:
            return 0;
        }
      });
    }

    return result;
  }, [
    lines,
    search,
    stockFilter,
    stockMode,
    stockValueFilter,
    qtyFilter,
    qtyMode,
    emptyFilter,
    sortFilter,
  ]);

  const filteredValidatedWithoutEmp = useMemo(() => applyFiltersWithoutEmp(validatedLines), [
    validatedLines,
    search,
    stockFilter,
    stockMode,
    stockValueFilter,
    qtyFilter,
    qtyMode,
    emptyFilter,
    sortFilter,
  ]);

  const filteredNonValidatedWithoutEmp = useMemo(() => {
    return filteredAllWithoutEmp.filter((l) => !validatedRows.includes(getRowId(l)));
  }, [filteredAllWithoutEmp, validatedRows]);

  const baseForCountsWithoutEmp = useMemo(
    () =>
      activeView === 'validated'
        ? filteredValidatedWithoutEmp
        : activeView === 'nonValidated'
          ? filteredNonValidatedWithoutEmp
          : filteredAllWithoutEmp,
    [activeView, filteredValidatedWithoutEmp, filteredNonValidatedWithoutEmp, filteredAllWithoutEmp]
  );

  // For section/row/level options - exclude those filters so all always available
  const filteredValidatedWithoutLocationStructure = useMemo(
    () => applyFiltersWithoutLocationStructure(validatedLines),
    [
      validatedLines,
      search,
      empFilter,
      empEmplacements,
      stockFilter,
      stockMode,
      stockValueFilter,
      qtyFilter,
      qtyMode,
      emptyFilter,
      sortFilter,
    ]
  );

  const filteredNonValidatedWithoutLocationStructure = useMemo(() => {
    return applyFiltersWithoutLocationStructure(
      filteredNonValidated instanceof Function ? filteredNonValidated() : filteredNonValidated
    ).filter((l) => !validatedRows.includes(getRowId(l)));
  }, [filteredNonValidated, validatedRows, search, empFilter, empEmplacements, stockFilter, stockMode, stockValueFilter, qtyFilter, qtyMode, emptyFilter, sortFilter]);

  const baseForCountsWithoutLocationStructure = useMemo(
    () =>
      activeView === 'validated'
        ? filteredValidatedWithoutLocationStructure
        : activeView === 'nonValidated'
          ? filteredNonValidatedWithoutLocationStructure
          : applyFiltersWithoutLocationStructure(lines),
    [
      activeView,
      filteredValidatedWithoutLocationStructure,
      filteredNonValidatedWithoutLocationStructure,
      search,
      empFilter,
      empEmplacements,
      stockFilter,
      stockMode,
      stockValueFilter,
      qtyFilter,
      qtyMode,
      emptyFilter,
      sortFilter,
    ]
  );

  const sectionsAvailable = useMemo(() => {
    const s = new Set<string>();
    for (const l of baseForCountsWithoutLocationStructure) {
      const letter = getFirstLetter(l.emplacement);
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      if (parts[1]) s.add(parts[1]);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr-FR', { sensitivity: 'base' }));
  }, [baseForCountsWithoutLocationStructure]);

  const getRowsForLetter = (letter: string) => {
    const s = new Set<string>();
    const letterSections = empSectionsByLetter.get(letter) || new Set();
    
    for (const l of baseForCountsWithoutLocationStructure) {
      if (getFirstLetter(l.emplacement) !== letter) continue;
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      const section = parts[1] || '';
      
      // If sections selected for this letter, only show rows for selected sections
      if (letterSections.size > 0 && !letterSections.has(section)) continue;
      
      if (parts[2]) s.add(parts[2]);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr-FR', { sensitivity: 'base' }));
  };

  const getLevelsForLetter = (letter: string) => {
    const s = new Set<string>();
    const letterSections = empSectionsByLetter.get(letter) || new Set();
    const letterRows = empRowsByLetter.get(letter) || new Set();
    
    for (const l of baseForCountsWithoutLocationStructure) {
      if (getFirstLetter(l.emplacement) !== letter) continue;
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      const section = parts[1] || '';
      const row = parts[2] || '';
      
      if (letterSections.size > 0 && !letterSections.has(section)) continue;
      if (letterRows.size > 0 && !letterRows.has(row)) continue;
      
      if (parts[3]) s.add(parts[3]);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr-FR', { sensitivity: 'base' }));
  };

  const emplacementsAvailable = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of baseForCounts) {
      const key = (l.emplacement || '').trim();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr-FR'));
  }, [baseForCounts]);

  const letterGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of baseForCountsWithoutEmp) {
      const letter = getFirstLetter(l.emplacement);
      if (!letter) continue;
      map.set(letter, (map.get(letter) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr-FR'));
  }, [baseForCountsWithoutEmp]);

  const stockCounts = useMemo(
    () => ({
      all: baseForCounts.length,
      positive: baseForCounts.filter((l) => !l.emptyCells.stock && l.stock > 0).length,
      zero: baseForCounts.filter((l) => !l.emptyCells.stock && l.stock === 0).length,
      negative: baseForCounts.filter((l) => !l.emptyCells.stock && l.stock < 0).length,
    }),
    [baseForCounts]
  );

  useEffect(() => {
    // clear selection when switching views
    setSelectedRows(new Set());
  }, [activeView]);

  const visibleRows = activeView === 'principal' ? filteredAll : activeView === 'nonValidated' ? filteredNonValidated : filteredValidated;
  const visibleRowIds = visibleRows.map((l) => getRowId(l));
  const allVisibleSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((id) => (autoValidateOnCheck ? validatedRows.includes(id) : selectedRows.has(id)));
  const someVisibleSelected = visibleRowIds.some((id) => (autoValidateOnCheck ? validatedRows.includes(id) : selectedRows.has(id)));

  const toggleSelectAllVisible = () => {
    const allNow = allVisibleSelected;
    if (allNow) {
      if (autoValidateOnCheck) {
        // unvalidate all visible
        setValidatedRows((prev) => prev.filter((id) => !visibleRowIds.includes(id)));
      } else {
        setSelectedRows(new Set());
      }
      return;
    }

    if (autoValidateOnCheck) {
      // validate all visible (keep user on principal)
      setValidatedRows((prev) => {
        const next = [...prev];
        for (const id of visibleRowIds) {
          if (!next.includes(id)) next.push(id);
        }
        return next;
      });
      return;
    }

    setSelectedRows(new Set(visibleRowIds));
  };

  // Progressive rendering for large tables to avoid long blocking renders on low-end devices
  const [renderedCount, setRenderedCount] = useState<number>(Math.min(200, visibleRows.length));
  useEffect(() => {
    // reset when visible rows change
    setRenderedCount(Math.min(200, visibleRows.length));

    const CHUNK = 200;
    let idleId: any = null;

    const scheduleChunk = () => {
      if ((window as any).requestIdleCallback) {
        idleId = (window as any).requestIdleCallback(() => {
          setRenderedCount((prev) => {
            const next = Math.min(visibleRows.length, prev + CHUNK);
            if (next < visibleRows.length) scheduleChunk();
            return next;
          });
        });
      } else {
        idleId = window.setTimeout(() => {
          setRenderedCount((prev) => {
            const next = Math.min(visibleRows.length, prev + CHUNK);
            if (next < visibleRows.length) scheduleChunk();
            return next;
          });
        }, 50);
      }
    };

    scheduleChunk();

    return () => {
      if ((window as any).cancelIdleCallback && idleId) (window as any).cancelIdleCallback(idleId);
      if (typeof idleId === 'number') clearTimeout(idleId);
    };
  }, [visibleRows]);

  const toggleSelectRow = (id: string) => {
    try {
      if (!id) return; // guard against empty IDs
      if (autoValidateOnCheck) {
        // toggle validation directly (do not switch view, keep in principal)
        setValidatedRows((prev) => {
          try {
            if (!Array.isArray(prev)) return [id];
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            return [...prev, id];
          } catch (e) {
            console.warn('toggleSelectRow validation error:', e);
            return prev;
          }
        });
        return;
      }

      setSelectedRows((prev) => {
        try {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        } catch (e) {
          console.warn('toggleSelectRow selection error:', e);
          return prev;
        }
      });
    } catch (err) {
      console.warn('toggleSelectRow error:', err);
    }
  };

  const handleRowClick = (e: React.MouseEvent, id: string) => {
    try {
      // normalize event target to an Element (avoid Text nodes which have no `closest`)
      let node: Element | null = (e.target as Element) ?? null;
      if (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
      // don't toggle when clicking interactive controls inside the row
      if (node && typeof (node as Element).closest === 'function' && node.closest('input,button,a,label')) return;
      toggleSelectRow(id);
    } catch (err) {
      // silently fail on event handling errors to prevent DOM race condition crashes
      // eslint-disable-next-line no-console
      console.warn('Row click handler error (non-fatal):', err);
    }
  };

  const resetFilters = () => {
    setRawSearch('');
    setStockFilter('all');
    setStockMode('exact');
    setStockValueFilter('all');
    setQtyFilter(new Set());
    setQtyMode('exact');
    setEmptyFilter('all');
    setSortFilter('default');
    setEmpFilter(new Set());
    setEmpSectionsByLetter(new Map());
    setEmpRowsByLetter(new Map());
    setEmpLevelsByLetter(new Map());
    setEmpEmplacements(new Set());
  };

  const handleValidate = () => {
    setValidatedRows((prev) => {
      const next = [...prev];
      for (const id of selectedRows) {
        if (!next.includes(id)) next.push(id);
      }
      return next;
    });
    setSelectedRows(new Set());
  };

  useEffect(() => {
    // persist validated rows
  }, [validatedRows]);

  const handleUnvalidate = (ids: string[]) => {
    if (ids.length === 0) return;
    setValidatedRows((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const getRowClass = (stock: number, hasEmptyCell: boolean) => {
    if (hasEmptyCell) return 'bg-violet-500/10 hover:bg-violet-500/20 border-l-4 border-l-violet-500';
    if (stock < 0) return 'bg-destructive/10 hover:bg-destructive/20 border-l-4 border-l-destructive';
    if (stock === 0) return 'bg-warning/10 hover:bg-warning/20 border-l-4 border-l-warning';
    return 'bg-success/5 hover:bg-success/10 border-l-4 border-l-success';
  };

  const renderEmptyValue = () => (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-600/15 text-violet-700">
      Vide
    </span>
  );

  const emptyCellClass = 'bg-violet-600/15 text-violet-700';

  const stockCards: Array<{ key: StockFilter; label: string; count: number; activeClass: string; idleClass: string }> = [
    {
      key: 'all',
      label: 'Tous',
      count: stockCounts.all,
      activeClass: 'border-slate-500/40 bg-slate-500/10 text-slate-700',
      idleClass: 'border-border bg-secondary/30 text-foreground hover:bg-secondary/60',
    },
    {
      key: 'positive',
      label: 'Positif',
      count: stockCounts.positive,
      activeClass: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-700',
      idleClass: 'border-emerald-200/40 bg-emerald-50/40 text-emerald-700/80 hover:bg-emerald-100/60',
    },
    {
      key: 'zero',
      label: 'Zéro',
      count: stockCounts.zero,
      activeClass: 'border-amber-500/40 bg-amber-500/12 text-amber-700',
      idleClass: 'border-amber-200/40 bg-amber-50/40 text-amber-700/80 hover:bg-amber-100/60',
    },
    {
      key: 'negative',
      label: 'Négatif',
      count: stockCounts.negative,
      activeClass: 'border-rose-500/40 bg-rose-500/12 text-rose-700',
      idleClass: 'border-rose-200/40 bg-rose-50/40 text-rose-700/80 hover:bg-rose-100/60',
    },
  ];

  const emptyFilters: Array<{ key: EmptyFilter; label: string; activeClass: string; idleClass: string }> = [
    {
      key: 'all',
      label: 'Tous',
      activeClass: 'bg-slate-500/10 text-slate-700 border-slate-400/50',
      idleClass: 'bg-slate-50 text-slate-700 border-slate-200/60 hover:bg-slate-100',
    },
    {
      key: 'with-empty',
      label: 'Avec vides',
      activeClass: 'bg-violet-600/15 text-violet-700 border-violet-400/50',
      idleClass: 'bg-violet-50 text-violet-700 border-violet-200/60 hover:bg-violet-100',
    },
    {
      key: 'without-empty',
      label: 'Sans vides',
      activeClass: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/50',
      idleClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100',
    },
    {
      key: 'barcode-empty',
      label: 'Code-barres vide',
      activeClass: 'bg-amber-500/12 text-amber-700 border-amber-400/50',
      idleClass: 'bg-amber-50 text-amber-700 border-amber-200/60 hover:bg-amber-100',
    },
  ];

  const sortFilters: Array<{ key: SortFilter; label: string; activeClass: string; idleClass: string }> = [
    {
      key: 'default',
      label: 'Ordre PDF',
      activeClass: 'bg-slate-500/10 text-slate-700 border-slate-400/50',
      idleClass: 'bg-slate-50 text-slate-700 border-slate-200/60 hover:bg-slate-100',
    },
    {
      key: 'stock-asc',
      label: 'Stock ↑',
      activeClass: 'bg-sky-500/12 text-sky-700 border-sky-400/50',
      idleClass: 'bg-sky-50 text-sky-700 border-sky-200/60 hover:bg-sky-100',
    },
    {
      key: 'stock-desc',
      label: 'Stock ↓',
      activeClass: 'bg-indigo-500/12 text-indigo-700 border-indigo-400/50',
      idleClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/60 hover:bg-indigo-100',
    },
    {
      key: 'qte-asc',
      label: 'Qté ↑',
      activeClass: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/50',
      idleClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100',
    },
    {
      key: 'qte-desc',
      label: 'Qté ↓',
      activeClass: 'bg-amber-500/12 text-amber-700 border-amber-400/50',
      idleClass: 'bg-amber-50 text-amber-700 border-amber-200/60 hover:bg-amber-100',
    },
    {
      key: 'emplacement-asc',
      label: 'Emplacement ↑',
      activeClass: 'bg-violet-500/12 text-violet-700 border-violet-400/50',
      idleClass: 'bg-violet-50 text-violet-700 border-violet-200/60 hover:bg-violet-100',
    },
    {
      key: 'emplacement-desc',
      label: 'Emplacement ↓',
      activeClass: 'bg-cyan-500/12 text-cyan-700 border-cyan-400/50',
      idleClass: 'bg-cyan-50 text-cyan-700 border-cyan-200/60 hover:bg-cyan-100',
    },
  ];

  const qtyModes: Array<{ key: QtyMode; label: string; activeClass: string; idleClass: string }> = [
    {
      key: 'exact',
      label: 'Exacte (=)',
      activeClass: 'bg-primary/12 text-primary border-primary/40',
      idleClass: 'bg-primary/5 text-primary/80 border-primary/20 hover:bg-primary/10',
    },
    {
      key: 'gt',
      label: 'Plus que (>)',
      activeClass: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/50',
      idleClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100',
    },
    {
      key: 'lt',
      label: 'Moins que (<)',
      activeClass: 'bg-amber-500/12 text-amber-700 border-amber-400/50',
      idleClass: 'bg-amber-50 text-amber-700 border-amber-200/60 hover:bg-amber-100',
    },
  ];

  const stockModes: Array<{ key: StockMode; label: string; activeClass: string; idleClass: string }> = [
    {
      key: 'exact',
      label: 'Exacte (=)',
      activeClass: 'bg-primary/12 text-primary border-primary/40',
      idleClass: 'bg-primary/5 text-primary/80 border-primary/20 hover:bg-primary/10',
    },
    {
      key: 'gt',
      label: 'Plus que (>)',
      activeClass: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/50',
      idleClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100',
    },
    {
      key: 'lt',
      label: 'Moins que (<)',
      activeClass: 'bg-amber-500/12 text-amber-700 border-amber-400/50',
      idleClass: 'bg-amber-50 text-amber-700 border-amber-200/60 hover:bg-amber-100',
    },
  ];

  // Notify parent of available filtered data
  useEffect(() => {
    onFiltersReady?.({
      principal: filteredAll,
      nonValidated: filteredNonValidated,
      validated: filteredValidated,
      activeTab: activeView,
    });
  }, [filteredAll, filteredNonValidated, filteredValidated, activeView, onFiltersReady]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-black text-foreground tracking-wide">FILTER MASTER</h4>
            <p className="text-xs text-muted-foreground">Tous les filtres en une seule section, organisés par rôle.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleValidate}
              disabled={selectedRows.size === 0}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all',
                selectedRows.size > 0
                  ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-700 hover:scale-[1.02]'
                  : 'border-border bg-secondary/40 text-muted-foreground cursor-not-allowed'
              )}
            >
              <Check className="h-4 w-4" />
              Valider ({selectedRows.size})
            </button>

            <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-muted-foreground bg-card">
              <input
                type="checkbox"
                checked={removeValidatedFromMaster}
                onChange={(e) => setRemoveValidatedFromMaster(e.target.checked)}
              />
              <span className="text-xs">Retirer validés</span>
            </label>

            <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-muted-foreground bg-card">
              <input
                type="checkbox"
                checked={preserveValidatedAcrossUploads}
                onChange={(e) => setPreserveValidatedAcrossUploads(e.target.checked)}
              />
              <span className="text-xs">Conserver validés entre uploads</span>
            </label>

            <button
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
                hasActiveFilters
                  ? 'border-primary/40 bg-gradient-to-r from-primary/10 to-primary/20 text-primary hover:from-primary/20 hover:to-primary/30 hover:scale-[1.02]'
                  : 'border-border bg-secondary/40 text-muted-foreground cursor-not-allowed'
              )}
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser filtres
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs font-semibold text-foreground mb-2">Recherche</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                placeholder="Rechercher par code, référence, désignation, emplacement..."
                className="pl-9 pr-9"
              />
              {rawSearch && (
                <button
                  onClick={() => setRawSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Stock filter</p>
              {stockValueFilter !== 'all' && (
                <span className="text-xs rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">
                  Mode: {stockMode === 'exact' ? '=' : stockMode === 'gt' ? '>' : '<'} {stockValueFilter}
                </span>
              )}
            </div>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
              {stockCards.map((card) => (
                <button
                  key={card.key}
                  onClick={() => setStockFilter(card.key)}
                  className={cn(
                    'w-full rounded-lg border p-2 text-center transition-colors duration-150',
                    stockFilter === card.key ? `${card.activeClass} shadow-sm ring-2 ring-current/25` : card.idleClass
                  )}
                >
                  <p className="text-xs font-bold">{card.label}</p>
                  <p className="text-[10px] opacity-80">{card.count} articles</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-10 gap-2 mt-3 md:items-center">
              <div className="md:col-span-7 self-center rounded-md border border-primary/20 bg-primary/5 p-2">
                <span className="text-xs text-muted-foreground font-medium block mb-1">Mode Stock</span>
                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
                  {stockModes.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setStockMode(m.key)}
                      className={cn(
                        'w-full h-7 px-2 rounded-full text-[11px] font-semibold border transition-colors duration-150',
                        stockMode === m.key ? `${m.activeClass} shadow-sm ring-2 ring-current/25` : m.idleClass
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-3 self-center rounded-md border border-primary/20 bg-primary/5 p-2">
                <span className="text-xs text-muted-foreground font-medium block mb-1">Valeur Stock</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    value={stockValueFilter === 'all' ? '' : stockValueFilter}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setStockValueFilter(v === '' ? 'all' : v);
                    }}
                    placeholder="Ex: 12"
                    className="h-8"
                  />
                  <button
                    onClick={() => setStockValueFilter('all')}
                    className="px-3 h-8 rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20"
                  >
                    Effacer
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Filtre Qté</p>
              {qtyFilter.size > 0 && (
                <span className="text-xs rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">
                  {qtyFilter.size} quantité{qtyFilter.size > 1 ? 's' : ''} sélectionnée{qtyFilter.size > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 mb-3">
              <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
                <span className="text-xs text-muted-foreground font-medium block mb-1">Mode Qté</span>
                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
                  {qtyModes.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setQtyMode(m.key)}
                      className={cn(
                        'w-full h-7 px-2 rounded-full text-[11px] font-semibold border transition-colors duration-150',
                        qtyMode === m.key ? `${m.activeClass} shadow-sm ring-2 ring-current/25` : m.idleClass
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
              <button
                onClick={() => setQtyFilter(new Set())}
                className={cn(
                  'rounded-lg border p-2 text-center transition-colors duration-150',
                  qtyFilter.size === 0
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-secondary/30 hover:bg-secondary/50 text-foreground'
                )}
              >
                <p className="text-xs font-bold">Toutes</p>
                <p className="text-[10px] opacity-80">{baseForCounts.length} articles</p>
              </button>

              {qtyGroups.map(([qty, count], index) => {
                const tone = QTY_TONES[index % QTY_TONES.length];
                const isActive = qtyFilter.has(String(qty));

                return (
                  <button
                    key={qty}
                    onClick={() => {
                      setQtyFilter((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(String(qty))) {
                          newSet.delete(String(qty));
                        } else {
                          newSet.add(String(qty));
                        }
                        return newSet;
                      });
                    }}
                    className={cn(
                      'rounded-lg border p-2 text-center transition-colors duration-150',
                      isActive ? `${tone.active} shadow-sm ring-2 ring-current/20` : tone.idle
                    )}
                  >
                    <p className="text-sm font-black">{qty}</p>
                    <p className="text-[10px] opacity-80">{count} article{count > 1 ? 's' : ''}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Filtre Marque</p>
              {brandFilter.size > 0 && (
                <span className="text-xs rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">
                  {brandFilter.size} marque{brandFilter.size > 1 ? 's' : ''} sélectionnée{brandFilter.size > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
              <button
                onClick={() => setBrandFilter(new Set())}
                className={cn(
                  'rounded-lg border p-2 text-center transition-colors duration-150',
                  brandFilter.size === 0
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-secondary/30 hover:bg-secondary/50 text-foreground'
                )}
              >
                <p className="text-xs font-bold">Toutes</p>
                <p className="text-[10px] opacity-80">{baseForCountsWithoutQty.length} articles</p>
              </button>

              {brandGroups.map(([brand, count]) => {
                const isActive = brandFilter.has(brand);
                const bgColor = isActive 
                  ? 'border-blue-500/50 bg-blue-500/15 text-blue-800 shadow-sm ring-2 ring-blue-500/25'
                  : 'border-border bg-secondary/30 hover:bg-secondary/50 text-foreground';

                return (
                  <button
                    key={brand || 'empty'}
                    onClick={() => {
                      safeSetBrandFilter((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(brand)) {
                          newSet.delete(brand);
                        } else {
                          newSet.add(brand);
                        }
                        return newSet;
                      });
                    }}
                    className={cn(
                      'rounded-lg border p-2 text-center transition-colors duration-150',
                      bgColor
                    )}
                  >
                    <p className="text-xs font-bold truncate">{brand || '(N/A)'}</p>
                    <p className="text-[10px] opacity-80">{count} articles</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Filtre TTC</p>
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={ttcFilterEnabled} onChange={(e) => setTtcFilterEnabled(e.target.checked)} />
                <span className="text-xs">Activer</span>
              </label>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <select value={ttcOp} onChange={(e) => setTtcOp(e.target.value as any)} className="h-8 rounded-md border px-2 text-sm">
                  <option value="gt">Plus que (&gt;)</option>
                  <option value="lt">Moins que (&lt;)</option>
                  <option value="between">Entre</option>
                </select>
                <Input type="number" value={ttcValueMin} onChange={(e) => setTtcValueMin(e.target.value)} placeholder="Min TTC" className="h-8" />
                {ttcOp === 'between' && (
                  <Input type="number" value={ttcValueMax} onChange={(e) => setTtcValueMax(e.target.value)} placeholder="Max TTC" className="h-8" />
                )}
                <button onClick={() => { setTtcValueMin(''); setTtcValueMax(''); setTtcFilterEnabled(false); }} className="px-3 h-8 rounded-md border bg-card text-xs">Effacer</button>
              </div>
              <p className="text-[11px] text-muted-foreground">Filtre les articles avec colonne TTC présente.</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Filtre Emplacement</p>
              <div className="flex items-center gap-2">
                {(empFilter.size > 0 || empSectionsByLetter.size > 0 || empRowsByLetter.size > 0 || empLevelsByLetter.size > 0) && (
                  <div className="flex items-center gap-2">
                    {empFilter.size > 0 && <span className="text-xs rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">Lettres: {Array.from(empFilter).sort().join(', ')}</span>}
                    {empSectionsByLetter.size > 0 && Array.from(empSectionsByLetter.entries()).map(([letter, sections]) => 
                      sections.size > 0 && <span key={`sec-${letter}`} className="text-xs rounded-full px-2 py-0.5 bg-sky-50 text-sky-700 font-semibold">{letter} Section: {Array.from(sections).join(', ')}</span>
                    )}
                    {empRowsByLetter.size > 0 && Array.from(empRowsByLetter.entries()).map(([letter, rows]) => 
                      rows.size > 0 && <span key={`row-${letter}`} className="text-xs rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold">{letter} Row: {Array.from(rows).join(', ')}</span>
                    )}
                    {empLevelsByLetter.size > 0 && Array.from(empLevelsByLetter.entries()).map(([letter, levels]) => 
                      levels.size > 0 && <span key={`lv-${letter}`} className="text-xs rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 font-semibold">{letter} Level: {Array.from(levels).join(', ')}</span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => {
                    setEmpFilter(new Set());
                    setEmpSectionsByLetter(new Map());
                    setEmpRowsByLetter(new Map());
                    setEmpLevelsByLetter(new Map());
                    setEmpEmplacements(new Set());
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-card text-muted-foreground text-xs hover:bg-primary/10 transition"
                >
                  <X className="h-3 w-3" />
                  Effacer
                </button>
              </div>
            </div>

            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
              <button
                onClick={() => {
                  setEmpFilter(new Set());
                  setEmpSectionsByLetter(new Map());
                  setEmpRowsByLetter(new Map());
                  setEmpLevelsByLetter(new Map());
                }}
                className={cn(
                  'rounded-lg border p-2 text-center transition-colors duration-150',
                  empFilter.size === 0 ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-secondary/30 hover:bg-secondary/50 text-foreground'
                )}
              >
                <p className="text-xs font-bold">Toutes</p>
                <p className="text-[10px] opacity-80">{baseForCounts.length} articles</p>
              </button>

              {letterGroups.map(([letter, count], index) => {
                const tone = EMP_TONES[index % EMP_TONES.length];
                const isActive = empFilter.has(letter);
                return (
                  <button
                    key={letter}
                    onClick={() => {
                      setEmpFilter((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(letter)) {
                          newSet.delete(letter);
                        } else {
                          newSet.add(letter);
                        }
                        return newSet;
                      });
                    }}
                    className={cn(
                      'rounded-lg border p-2 text-center transition-colors duration-150',
                      isActive ? `${tone.active} shadow-sm ring-2 ring-current/20` : tone.idle
                    )}
                  >
                    <p className="text-sm font-black">{letter}</p>
                    <p className="text-[10px] opacity-80">{count} article{count > 1 ? 's' : ''}</p>
                  </button>
                );
              })}
            </div>

            {empFilter.size > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                {Array.from(empFilter).sort().map((letter) => {
                  const letterSections = empSectionsByLetter.get(letter) || new Set();
                  const letterRows = empRowsByLetter.get(letter) || new Set();
                  const letterLevels = empLevelsByLetter.get(letter) || new Set();
                  const rowsForLetter = getRowsForLetter(letter);
                  const levelsForLetter = getLevelsForLetter(letter);

                  // Get sections available for this letter
                  const sectionsForLetter = new Set<string>();
                  for (const l of baseForCountsWithoutLocationStructure) {
                    if (getFirstLetter(l.emplacement) === letter) {
                      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
                      if (parts[1]) sectionsForLetter.add(parts[1]);
                    }
                  }

                  return (
                    <div key={letter} className="mb-4 pb-4 border-b border-border/50 last:border-0">
                      <p className="text-xs font-bold text-primary mb-2.5">{letter}</p>
                      
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-foreground mb-1.5">Section (2ème)</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(sectionsForLetter).sort().map((s) => {
                            const sel = letterSections.has(s);
                            return (
                              <button
                                key={s}
                                onClick={() => {
                                  const next = new Set(letterSections);
                                  if (next.has(s)) next.delete(s);
                                  else next.add(s);
                                  setEmpSectionsByLetter(prev => new Map(prev).set(letter, next));
                                  // Clear rows/levels when section changes
                                  setEmpRowsByLetter(prev => new Map(prev).set(letter, new Set()));
                                  setEmpLevelsByLetter(prev => new Map(prev).set(letter, new Set()));
                                }}
                                className={cn(
                                  'text-sm px-3 py-1 rounded-full border transition-colors duration-150',
                                  sel ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'
                                )}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mb-2">
                        <p className="text-xs font-semibold text-foreground mb-1.5">Row (3ème)</p>
                        <div className="flex flex-wrap gap-2">
                          {rowsForLetter.map((r) => {
                            const sel = letterRows.has(r);
                            return (
                              <button
                                key={r}
                                onClick={() => {
                                  const next = new Set(letterRows);
                                  if (next.has(r)) next.delete(r);
                                  else next.add(r);
                                  setEmpRowsByLetter(prev => new Map(prev).set(letter, next));
                                  // Clear levels when row changes
                                  setEmpLevelsByLetter(prev => new Map(prev).set(letter, new Set()));
                                }}
                                className={cn(
                                  'text-sm px-3 py-1 rounded-full border transition-colors duration-150',
                                  sel ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'
                                )}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1.5">Level (4ème)</p>
                        <div className="flex flex-wrap gap-2">
                          {levelsForLetter.map((lv) => {
                            const sel = letterLevels.has(lv);
                            return (
                              <button
                                key={lv}
                                onClick={() => {
                                  const next = new Set(letterLevels);
                                  if (next.has(lv)) next.delete(lv);
                                  else next.add(lv);
                                  setEmpLevelsByLetter(prev => new Map(prev).set(letter, next));
                                }}
                                className={cn(
                                  'text-sm px-3 py-1 rounded-full border transition-colors duration-150',
                                  sel ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'
                                )}
                              >
                                {lv}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">Cellules</p>
              <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(145px,1fr))]">
                {emptyFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setEmptyFilter(f.key)}
                    className={cn(
                      'w-full h-8 px-2.5 rounded-full text-xs font-semibold border transition-colors duration-150',
                      emptyFilter === f.key ? `${f.activeClass} shadow-sm ring-2 ring-current/35` : f.idleClass
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background/60 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">Tri</p>
              <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(145px,1fr))]">
                {sortFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setSortFilter(f.key)}
                    className={cn(
                      'w-full h-8 px-2.5 rounded-full text-xs font-semibold border transition-colors duration-150',
                      sortFilter === f.key ? `${f.activeClass} shadow-sm ring-2 ring-current/35` : f.idleClass
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <p>
          {activeView === 'principal'
            ? `${filteredAll.length} / ${lines.length} article(s)`
            : activeView === 'nonValidated'
            ? `${filteredNonValidated.length} non-validé(s)`
            : `${filteredValidated.length} / ${validatedLines.length} validé(s)`}
        </p>
        {search.trim().length > 0 && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-slate-500/10 text-slate-700 font-semibold">
            Recherche: {search.trim()}
          </span>
        )}
        {stockFilter !== 'all' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-700 font-semibold">
            Stock filtre: {STOCK_FILTER_LABELS[stockFilter]}
          </span>
        )}
        {qtyFilter.size > 0 && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">
            Qté active: {qtyMode === 'exact' ? '=' : qtyMode === 'gt' ? '>' : '<'} {Array.from(qtyFilter).sort((a, b) => Number(a) - Number(b)).join(', ')}
          </span>
        )}
        {stockValueFilter !== 'all' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-sky-500/10 text-sky-700 font-semibold">
            Stock actif: {stockMode === 'exact' ? '=' : stockMode === 'gt' ? '>' : '<'} {stockValueFilter}
          </span>
        )}
        {empFilter.size > 0 && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">
            Emplacements: {Array.from(empFilter).sort().join(', ')}
          </span>
        )}
        {emptyFilter !== 'all' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-violet-600/15 text-violet-700 font-semibold">
            Cellules: {EMPTY_FILTER_LABELS[emptyFilter]}
          </span>
        )}
        {sortFilter !== 'default' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-indigo-500/10 text-indigo-700 font-semibold">
            Tri: {SORT_FILTER_LABELS[sortFilter]}
          </span>
        )}
        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-violet-600/15 text-violet-700 font-semibold">
          Lignes avec cellule vide en violet
        </span>
      </div>

      <Tabs value={activeView} onValueChange={(v) => {
        try {
          const view = v as 'principal' | 'nonValidated' | 'validated';
          setActiveView(view);
        } catch (err) {
          console.warn('Tab change error:', err);
        }
      }}>
        <TabsList className="w-full grid grid-cols-3 gap-2 p-1 bg-card rounded-lg border border-border">
          <TabsTrigger
            value="principal"
            className={cn(
              'w-full rounded-md py-2 flex items-center justify-center text-sm font-semibold transition-transform hover:scale-[1.02]',
              'data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm'
            )}
          >
            Principal
          </TabsTrigger>

          <TabsTrigger
            value="nonValidated"
            className={cn(
              'w-full rounded-md py-2 flex items-center justify-center gap-2 text-sm font-semibold transition-transform hover:scale-[1.02]',
              'data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800 data-[state=active]:shadow-sm'
            )}
          >
            <span>Non Validés</span>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
              {filteredNonValidated.length}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="validated"
            className={cn(
              'w-full rounded-md py-2 flex items-center justify-center gap-2 text-sm font-semibold transition-transform hover:scale-[1.02]',
              'data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm'
            )}
          >
            <span>Validés</span>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
              {filteredValidated.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between gap-2 mt-3 mb-2">
        {activeView === 'validated' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleUnvalidate([...selectedRows])}
              disabled={selectedRows.size === 0}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold',
                selectedRows.size > 0 ? 'border-rose-500/40 bg-rose-500/12 text-rose-700' : 'border-border bg-card text-muted-foreground'
              )}
            >
              Dévalider ({selectedRows.size})
            </button>

            <button
              onClick={() => setValidatedRows([])}
              disabled={validatedRows.length === 0}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold',
                validatedRows.length > 0 ? 'border-border bg-card text-foreground' : 'border-border bg-card text-muted-foreground'
              )}
            >
              Vider validés
            </button>
          </div>
        ) : activeView === 'nonValidated' ? (
          <div className="text-xs text-muted-foreground">Affichage Non Validés</div>
        ) : (
          <div className="text-xs text-muted-foreground">Affichage principal</div>
        )}

        <div className="text-xs text-muted-foreground">
          {activeView === 'principal'
            ? `${filteredAll.length} / ${lines.length} article(s)`
            : activeView === 'nonValidated'
            ? `${filteredNonValidated.length} non-validé(s)`
            : `${validatedLines.length} validé(s)`}
        </div>
      </div>

        {/* debug panel removed */}

      <div className="overflow-x-auto rounded-lg border border-table-border">
        {(() => {
          const visible = visibleRows.slice(0, renderedCount);
          const visibleIds = visible.map((l) => getRowId(l));
          const allSelected = visibleIds.length > 0 && visibleIds.every((id) => (autoValidateOnCheck ? validatedRows.includes(id) : selectedRows.has(id)));

          return (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-table-header">
                  <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border w-12">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={allSelected}
                        onChange={() => toggleSelectAllVisible()}
                        aria-label="Select all visible"
                      />
                      <span
                        className={cn(
                          'h-6 w-6 rounded-md flex items-center justify-center transition-transform transform duration-150',
                          allSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md ring-2 ring-emerald-200'
                            : 'bg-white border border-border text-muted-foreground hover:scale-105'
                        )}
                      >
                        {allSelected && <Check className="h-4 w-4" />}
                      </span>
                    </label>
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border">Code à barre</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border">Référence</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border">Désignation</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground border-b border-table-border">Qté</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border">Emplacement</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground border-b border-table-border">Stock</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground border-b border-table-border">TTC</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border">Marque</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground border-b border-table-border">Carton Qté</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground border-b border-table-border">Qte Validée</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground border-b border-table-border">Qte Non Validée</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((line) => {
                  const id = getRowId(line);
                  const isSelected = autoValidateOnCheck ? validatedRows.includes(id) : selectedRows.has(id);
                  const isValidated = validatedRows.includes(id);
                  const qtePrepared = qtePreparedMap.get(id) || 0;
                  const brandColor = getBrandColor(line.brand);
                  return (
                    <TableRow
                      key={id}
                      line={line}
                      id={id}
                      isSelected={isSelected}
                      isValidated={isValidated}
                      getRowClass={getRowClass}
                      onRowClick={handleRowClick}
                      onCheckboxChange={toggleSelectRow}
                      qtePrepared={qtePrepared}
                      onQtePreparedChange={updateQtePrepared}
                      brandColor={brandColor}
                    />
                  );
                })}

                {visible.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                      Aucun article trouvé
                    </td>
                  </tr>
                )}
                {renderedCount < visibleRows.length && (
                  <tr>
                    <td colSpan={12} className="px-3 py-4 text-center text-muted-foreground">
                      Chargement progressif des lignes... ({renderedCount}/{visibleRows.length})
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          );
        })()}
      </div>
    </div>
  );
};

export default OrderTable;

