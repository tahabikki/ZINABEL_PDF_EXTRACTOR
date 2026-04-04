import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { OrderLine } from '@/types/order';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { RotateCcw, Search, X, Check } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface OrderTableProps {
  lines: OrderLine[];
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

const OrderTable: React.FC<OrderTableProps> = ({ lines }) => {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [stockMode, setStockMode] = useState<StockMode>('exact');
  const [stockValueFilter, setStockValueFilter] = useState<string>('all');
  const [emptyFilter, setEmptyFilter] = useState<EmptyFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('default');
  const [qtyFilter, setQtyFilter] = useState<string>('all');
  const [qtyMode, setQtyMode] = useState<QtyMode>('exact');
  const [empFilter, setEmpFilter] = useState<string>('all');
  const [empSections, setEmpSections] = useState<Set<string>>(new Set());
  const [empRows, setEmpRows] = useState<Set<string>>(new Set());
  const [empLevels, setEmpLevels] = useState<Set<string>>(new Set());
  const [empEmplacements, setEmpEmplacements] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [validatedRows, setValidatedRows] = useState<string[]>([]);
  const [removeValidatedFromMaster, setRemoveValidatedFromMaster] = useState<boolean>(false);
  const [autoValidateOnCheck, setAutoValidateOnCheck] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'principal' | 'nonValidated' | 'validated'>('principal');
  const [preserveValidatedAcrossUploads, setPreserveValidatedAcrossUploads] = useState<boolean>(false);

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
    try {
      if (preserveValidatedAcrossUploads) localStorage.setItem('validatedRows', JSON.stringify(validatedRows));
      else localStorage.removeItem('validatedRows');
    } catch (e) {}
  }, [validatedRows, preserveValidatedAcrossUploads]);

  const linesSignatureRef = useRef<string>('');
  useEffect(() => {
    const sig = lines.map((l) => getRowId(l)).join('||');
    if (linesSignatureRef.current && linesSignatureRef.current !== sig) {
      // lines changed (new upload)
      if (!preserveValidatedAcrossUploads) {
        setValidatedRows([]);
        try {
          localStorage.removeItem('validatedRows');
        } catch (e) {}
      } else {
        // keep only validated ids that exist in the new lines
        setValidatedRows((prev) => prev.filter((id) => lines.some((l) => getRowId(l) === id)));
      }
      setSelectedRows(new Set());
    }
    linesSignatureRef.current = sig;
  }, [lines, preserveValidatedAcrossUploads]);

  

  const filteredAll = useMemo(() => {
    let result = lines;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.codeABarre.toLowerCase().includes(q) ||
          l.reference.toLowerCase().includes(q) ||
          l.designation.toLowerCase().includes(q) ||
          l.emplacement.toLowerCase().includes(q)
      );
    }

    if (empFilter !== 'all') {
      result = result.filter((l) => getFirstLetter(l.emplacement) === empFilter);
    }

    if (empEmplacements.size > 0) {
      result = result.filter((l) => empEmplacements.has((l.emplacement || '').trim()));
    }

    if (empSections.size > 0) {
      result = result.filter((l) => {
        const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
        return empSections.has(parts[1] || '');
      });
    }

    if (empRows.size > 0) {
      result = result.filter((l) => {
        const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
        return empRows.has(parts[2] || '');
      });
    }

    if (empLevels.size > 0) {
      result = result.filter((l) => {
        const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
        return empLevels.has(parts[3] || '');
      });
    }

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

    const hasQtyValue = qtyFilter !== 'all' && qtyFilter.trim() !== '' && !Number.isNaN(Number(qtyFilter));
    if (hasQtyValue) {
      const targetQty = Number(qtyFilter);
      if (qtyMode === 'exact') result = result.filter((l) => Math.round(l.qte) === targetQty);
      else if (qtyMode === 'gt') result = result.filter((l) => Math.round(l.qte) > targetQty);
      else result = result.filter((l) => Math.round(l.qte) < targetQty);
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
    empFilter,
    empSections,
    empRows,
    empLevels,
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
    qtyFilter !== 'all' ||
    qtyMode !== 'exact' ||
    emptyFilter !== 'all' ||
    sortFilter !== 'default' ||
    empFilter !== 'all' ||
    empSections.size > 0 ||
    empRows.size > 0 ||
    empLevels.size > 0 ||
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
          l.codeABarre.toLowerCase().includes(q) ||
          l.reference.toLowerCase().includes(q) ||
          l.designation.toLowerCase().includes(q) ||
          l.emplacement.toLowerCase().includes(q)
      );
    }

    if (empFilter !== 'all') {
      result = result.filter((l) => getFirstLetter(l.emplacement) === empFilter);
    }

    if (empEmplacements.size > 0) {
      result = result.filter((l) => empEmplacements.has((l.emplacement || '').trim()));
    }

    if (empSections.size > 0) {
      result = result.filter((l) => {
        const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
        return empSections.has(parts[1] || '');
      });
    }

    if (empRows.size > 0) {
      result = result.filter((l) => {
        const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
        return empRows.has(parts[2] || '');
      });
    }

    if (empLevels.size > 0) {
      result = result.filter((l) => {
        const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
        return empLevels.has(parts[3] || '');
      });
    }

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

    const hasQtyValue = qtyFilter !== 'all' && qtyFilter.trim() !== '' && !Number.isNaN(Number(qtyFilter));
    if (hasQtyValue) {
      const targetQty = Number(qtyFilter);
      if (qtyMode === 'exact') result = result.filter((l) => Math.round(l.qte) === targetQty);
      else if (qtyMode === 'gt') result = result.filter((l) => Math.round(l.qte) > targetQty);
      else result = result.filter((l) => Math.round(l.qte) < targetQty);
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
    empSections,
    empRows,
    empLevels,
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

  const qtyGroups = useMemo(() => {
    const map = new Map<number, number>();
    baseForCounts.forEach((l) => {
      const qty = Math.round(l.qte);
      map.set(qty, (map.get(qty) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [baseForCounts]);

  const sectionsAvailable = useMemo(() => {
    const s = new Set<string>();
    for (const l of baseForCounts) {
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      if (parts[1]) s.add(parts[1]);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr-FR', { sensitivity: 'base' }));
  }, [baseForCounts]);

  const rowsAvailable = useMemo(() => {
    const s = new Set<string>();
    for (const l of baseForCounts) {
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      if (parts[2]) s.add(parts[2]);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr-FR', { sensitivity: 'base' }));
  }, [baseForCounts]);

  const levelsAvailable = useMemo(() => {
    const s = new Set<string>();
    for (const l of baseForCounts) {
      const parts = (l.emplacement || '').split(/\s*-\s*/).map((p) => p.trim());
      if (parts[3]) s.add(parts[3]);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr-FR', { sensitivity: 'base' }));
  }, [baseForCounts]);

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
    for (const l of baseForCounts) {
      const letter = getFirstLetter(l.emplacement);
      if (!letter) continue;
      map.set(letter, (map.get(letter) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr-FR'));
  }, [baseForCounts]);

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

  const toggleSelectRow = (id: string) => {
    if (autoValidateOnCheck) {
      // toggle validation directly (do not switch view, keep in principal)
      setValidatedRows((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        return [...prev, id];
      });
      return;
    }

    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRowClick = (e: React.MouseEvent, id: string) => {
    const target = e.target as HTMLElement;
    // don't toggle when clicking interactive controls inside the row
    if (target.closest('input,button,a,label')) return;
    toggleSelectRow(id);
  };

  const resetFilters = () => {
    setSearch('');
    setStockFilter('all');
    setStockMode('exact');
    setStockValueFilter('all');
    setQtyFilter('all');
    setQtyMode('exact');
    setEmptyFilter('all');
    setSortFilter('default');
    setEmpFilter('all');
    setEmpSections(new Set());
    setEmpRows(new Set());
    setEmpLevels(new Set());
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par code, référence, désignation, emplacement..."
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              {qtyFilter !== 'all' && (
                <span className="text-xs rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">
                  Mode: {qtyMode === 'exact' ? '=' : qtyMode === 'gt' ? '>' : '<'} {qtyFilter}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-10 gap-2 mb-3 md:items-center">
              <div className="md:col-span-7 self-center rounded-md border border-primary/20 bg-primary/5 p-2">
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

              <div className="md:col-span-3 self-center rounded-md border border-primary/20 bg-primary/5 p-2">
                <span className="text-xs text-muted-foreground font-medium block mb-1">Valeur Qté</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={qtyFilter === 'all' ? '' : qtyFilter}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setQtyFilter(v === '' ? 'all' : v);
                    }}
                    placeholder="Ex: 12"
                    className="h-8"
                  />
                  <button
                    onClick={() => setQtyFilter('all')}
                    className="px-3 h-8 rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20"
                  >
                    Effacer
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
              <button
                onClick={() => setQtyFilter('all')}
                className={cn(
                  'rounded-lg border p-2 text-center transition-colors duration-150',
                  qtyFilter === 'all'
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-secondary/30 hover:bg-secondary/50 text-foreground'
                )}
              >
                <p className="text-xs font-bold">Toutes</p>
                <p className="text-[10px] opacity-80">{baseForCounts.length} articles</p>
              </button>

              {qtyGroups.map(([qty, count], index) => {
                const tone = QTY_TONES[index % QTY_TONES.length];
                const isActive = qtyFilter === String(qty);

                return (
                  <button
                    key={qty}
                    onClick={() => setQtyFilter(String(qty))}
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
              <p className="text-xs font-semibold text-foreground">Filtre Emplacement</p>
              <div className="flex items-center gap-2">
                {(empFilter !== 'all' || empSections.size > 0 || empRows.size > 0 || empLevels.size > 0) && (
                  <div className="flex items-center gap-2">
                    {empFilter !== 'all' && <span className="text-xs rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">Lettre: {empFilter}</span>}
                    {empSections.size > 0 && <span className="text-xs rounded-full px-2 py-0.5 bg-sky-50 text-sky-700 font-semibold">Section: {Array.from(empSections).join(', ')}</span>}
                    {empRows.size > 0 && <span className="text-xs rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold">Row: {Array.from(empRows).join(', ')}</span>}
                    {empLevels.size > 0 && <span className="text-xs rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 font-semibold">Level: {Array.from(empLevels).join(', ')}</span>}
                  </div>
                )}

                <button
                  onClick={() => {
                    setEmpFilter('all');
                    setEmpSections(new Set());
                    setEmpRows(new Set());
                    setEmpLevels(new Set());
                    setEmpEmplacements(new Set());
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-card text-muted-foreground text-xs hover:bg-primary/10 transition transform hover:scale-105"
                >
                  <X className="h-3 w-3" />
                  Effacer
                </button>
              </div>
            </div>

            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
              <button
                onClick={() => {
                  setEmpFilter('all');
                  setEmpSections(new Set());
                  setEmpRows(new Set());
                  setEmpLevels(new Set());
                }}
                className={cn(
                  'rounded-lg border p-2 text-center transform transition-all duration-150 hover:scale-105 active:scale-95',
                  empFilter === 'all' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-secondary/30 hover:bg-secondary/50 text-foreground'
                )}
              >
                <p className="text-xs font-bold">Toutes</p>
                <p className="text-[10px] opacity-80">{baseForCounts.length} articles</p>
              </button>

              {letterGroups.map(([letter, count], index) => {
                const tone = EMP_TONES[index % EMP_TONES.length];
                const isActive = empFilter === letter;
                return (
                  <button
                    key={letter}
                    onClick={() => {
                      setEmpFilter(letter);
                      setEmpSections(new Set());
                      setEmpRows(new Set());
                      setEmpLevels(new Set());
                    }}
                    className={cn(
                      'rounded-lg border p-2 text-center transform transition-all duration-150 hover:scale-105 active:scale-95',
                      isActive ? `${tone.active} shadow-sm ring-2 ring-current/20` : tone.idle
                    )}
                  >
                    <p className="text-sm font-black">{letter}</p>
                    <p className="text-[10px] opacity-80">{count} article{count > 1 ? 's' : ''}</p>
                  </button>
                );
              })}
            </div>

            {empFilter !== 'all' && (
              <div className="mt-3">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-foreground mb-2">Section (2ème)</p>
                  <div className="flex flex-wrap gap-2">
                    {sectionsAvailable.map((s) => {
                      const sel = empSections.has(s);
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            const next = new Set(empSections);
                            if (next.has(s)) next.delete(s);
                            else next.add(s);
                            setEmpSections(next);
                            setEmpRows(new Set());
                            setEmpLevels(new Set());
                          }}
                          className={cn(
                            'text-sm px-3 py-1 rounded-full border transition-colors transform transition-all duration-150 hover:scale-105 active:scale-95',
                            sel ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-semibold text-foreground mb-2">Row (3ème)</p>
                  <div className="flex flex-wrap gap-2">
                    {rowsAvailable.map((r) => {
                      const sel = empRows.has(r);
                      return (
                        <button
                          key={r}
                          onClick={() => {
                            const next = new Set(empRows);
                            if (next.has(r)) next.delete(r);
                            else next.add(r);
                            setEmpRows(next);
                            setEmpLevels(new Set());
                          }}
                          className={cn(
                            'text-sm px-3 py-1 rounded-full border transition-colors transform transition-all duration-150 hover:scale-105 active:scale-95',
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
                  <p className="text-xs font-semibold text-foreground mb-2">Level (4ème)</p>
                  <div className="flex flex-wrap gap-2">
                    {levelsAvailable.map((lv) => {
                      const sel = empLevels.has(lv);
                      return (
                        <button
                          key={lv}
                          onClick={() => {
                            const next = new Set(empLevels);
                            if (next.has(lv)) next.delete(lv);
                            else next.add(lv);
                            setEmpLevels(next);
                          }}
                          className={cn(
                            'text-sm px-3 py-1 rounded-full border transition-colors transform transition-all duration-150 hover:scale-105 active:scale-95',
                            sel ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'
                          )}
                        >
                          {lv}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-foreground mb-2">Emplacements (complets)</p>
                  <div className="flex flex-wrap gap-2">
                    {emplacementsAvailable.map(([empl, count]) => {
                      const sel = empEmplacements.has(empl);
                      return (
                        <button
                          key={empl}
                          onClick={() => {
                            const next = new Set(empEmplacements);
                            if (next.has(empl)) next.delete(empl);
                            else next.add(empl);
                            setEmpEmplacements(next);
                          }}
                          className={cn(
                            'text-sm px-3 py-1 rounded-full border transition-colors transform transition-all duration-150 hover:scale-105 active:scale-95',
                            sel ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'
                          )}
                        >
                          <span className="font-mono">{empl}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
        {qtyFilter !== 'all' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">
            Qté active: {qtyMode === 'exact' ? '=' : qtyMode === 'gt' ? '>' : '<'} {qtyFilter}
          </span>
        )}
        {stockValueFilter !== 'all' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-sky-500/10 text-sky-700 font-semibold">
            Stock actif: {stockMode === 'exact' ? '=' : stockMode === 'gt' ? '>' : '<'} {stockValueFilter}
          </span>
        )}
        {empFilter !== 'all' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">
            Emplacement: {empFilter}
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

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'principal' | 'nonValidated' | 'validated')}>
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
          const visible = visibleRows;
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
                </tr>
              </thead>
              <tbody>
                {visible.map((line) => {
                  const id = getRowId(line);
                  const isSelected = autoValidateOnCheck ? validatedRows.includes(id) : selectedRows.has(id);
                  const isValidated = validatedRows.includes(id);
                  return (
                    <tr
                      key={id}
                      onClick={(e) => handleRowClick(e, id)}
                      className={cn(
                        'border-b border-table-border last:border-b-0 transition-colors cursor-pointer',
                        getRowClass(line.stock, line.hasEmptyCell),
                        isValidated ? 'ring-1 ring-primary/20 bg-primary/5' : ''
                      )}
                    >
                      <td className="px-3 py-2">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelectRow(id);
                            }}
                          />
                          <span
                            className={cn(
                              'h-6 w-6 rounded-md flex items-center justify-center transition-transform transform duration-150',
                              isSelected
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg ring-2 ring-emerald-200 scale-100'
                                : 'bg-white border border-border text-muted-foreground hover:scale-105'
                            )}
                          >
                            {isSelected ? <Check className="h-4 w-4" /> : null}
                          </span>
                        </label>
                      </td>

                      <td className={cn('px-3 py-2 font-mono text-xs text-muted-foreground', line.emptyCells.codeABarre && emptyCellClass)}>
                        {line.emptyCells.codeABarre ? renderEmptyValue() : line.codeABarre}
                      </td>
                      <td className={cn('px-3 py-2 font-mono text-xs', line.emptyCells.reference && emptyCellClass)}>
                        {line.emptyCells.reference ? renderEmptyValue() : line.reference}
                      </td>
                      <td className={cn('px-3 py-2 text-foreground', line.emptyCells.designation && emptyCellClass)}>
                        {line.emptyCells.designation ? renderEmptyValue() : line.designation}
                      </td>
                      <td className={cn('px-3 py-2 text-right font-semibold', line.emptyCells.qte && emptyCellClass)}>
                        {line.emptyCells.qte ? renderEmptyValue() : line.qte.toFixed(2).replace('.', ',')}
                      </td>
                      <td className={cn('px-3 py-2 font-mono text-xs text-muted-foreground', line.emptyCells.emplacement && emptyCellClass)}>
                        {line.emptyCells.emplacement ? renderEmptyValue() : line.emplacement}
                        {isValidated && (
                          <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Validé
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-mono text-xs font-bold',
                          line.emptyCells.stock
                            ? emptyCellClass
                            : line.stock < 0
                              ? 'text-destructive'
                              : line.stock === 0
                                ? 'text-warning'
                                : 'text-success'
                        )}
                      >
                        {line.emptyCells.stock ? renderEmptyValue() : line.stock.toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  );
                })}

                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Aucun article trouvé
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

