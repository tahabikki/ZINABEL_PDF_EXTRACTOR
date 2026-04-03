import React, { useMemo, useState } from 'react';
import type { OrderLine } from '@/types/order';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { RotateCcw, Search, X } from 'lucide-react';

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

const OrderTable: React.FC<OrderTableProps> = ({ lines }) => {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [stockMode, setStockMode] = useState<StockMode>('exact');
  const [stockValueFilter, setStockValueFilter] = useState<string>('all');
  const [emptyFilter, setEmptyFilter] = useState<EmptyFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('default');
  const [qtyFilter, setQtyFilter] = useState<string>('all');
  const [qtyMode, setQtyMode] = useState<QtyMode>('exact');

  const qtyGroups = useMemo(() => {
    const map = new Map<number, number>();
    lines.forEach((l) => {
      const qty = Math.round(l.qte);
      map.set(qty, (map.get(qty) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [lines]);

  const stockCounts = useMemo(
    () => ({
      all: lines.length,
      positive: lines.filter((l) => !l.emptyCells.stock && l.stock > 0).length,
      zero: lines.filter((l) => !l.emptyCells.stock && l.stock === 0).length,
      negative: lines.filter((l) => !l.emptyCells.stock && l.stock < 0).length,
    }),
    [lines]
  );

  const filtered = useMemo(() => {
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
  }, [lines, search, stockFilter, stockMode, stockValueFilter, qtyFilter, qtyMode, emptyFilter, sortFilter]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    stockFilter !== 'all' ||
    stockValueFilter !== 'all' ||
    stockMode !== 'exact' ||
    qtyFilter !== 'all' ||
    qtyMode !== 'exact' ||
    emptyFilter !== 'all' ||
    sortFilter !== 'default';

  const resetFilters = () => {
    setSearch('');
    setStockFilter('all');
    setStockMode('exact');
    setStockValueFilter('all');
    setQtyFilter('all');
    setQtyMode('exact');
    setEmptyFilter('all');
    setSortFilter('default');
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
                <p className="text-[10px] opacity-80">{lines.length} articles</p>
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
        <p>{filtered.length} / {lines.length} article(s)</p>
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

      <div className="overflow-x-auto rounded-lg border border-table-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-table-header">
              <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border">Code à barre</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border">Référence</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border">Désignation</th>
              <th className="px-3 py-2.5 text-right font-semibold text-foreground border-b border-table-border">Qté</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-table-border">Emplacement</th>
              <th className="px-3 py-2.5 text-right font-semibold text-foreground border-b border-table-border">Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((line, idx) => (
              <tr
                key={`${line.codeABarre}-${idx}`}
                className={cn(
                  'border-b border-table-border last:border-b-0 transition-colors',
                  getRowClass(line.stock, line.hasEmptyCell)
                )}
              >
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
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Aucun article trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderTable;

