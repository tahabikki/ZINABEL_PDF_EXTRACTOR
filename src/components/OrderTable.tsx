import React, { useMemo, useState } from 'react';
import type { OrderLine } from '@/types/order';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Filter, Search, X } from 'lucide-react';

interface OrderTableProps {
  lines: OrderLine[];
}

type StockFilter = 'all' | 'positive' | 'zero' | 'negative';
type EmptyFilter = 'all' | 'with-empty' | 'without-empty' | 'barcode-empty';
type SortFilter = 'default' | 'stock-asc' | 'stock-desc';

const OrderTable: React.FC<OrderTableProps> = ({ lines }) => {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [emptyFilter, setEmptyFilter] = useState<EmptyFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('default');
  const [qtyFilter, setQtyFilter] = useState<string>('all');

  const qtyGroups = useMemo(() => {
    const map = new Map<number, number>();
    lines.forEach((l) => {
      const qty = Math.round(l.qte);
      map.set(qty, (map.get(qty) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [lines]);

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

    if (emptyFilter === 'with-empty') result = result.filter((l) => l.hasEmptyCell);
    else if (emptyFilter === 'without-empty') result = result.filter((l) => !l.hasEmptyCell);
    else if (emptyFilter === 'barcode-empty') result = result.filter((l) => l.emptyCells.codeABarre);

    if (qtyFilter !== 'all') {
      const targetQty = Number(qtyFilter);
      result = result.filter((l) => Math.round(l.qte) === targetQty);
    }

    if (sortFilter !== 'default') {
      result = [...result].sort((a, b) => {
        if (sortFilter === 'stock-asc') return a.stock - b.stock;
        return b.stock - a.stock;
      });
    }

    return result;
  }, [lines, search, stockFilter, emptyFilter, qtyFilter, sortFilter]);

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

  const stockFilters: { key: StockFilter; label: string; color: string }[] = [
    { key: 'all', label: 'Tous', color: 'bg-secondary text-foreground' },
    { key: 'positive', label: 'Positif', color: 'bg-success/10 text-success border-success/30' },
    { key: 'zero', label: 'Zéro', color: 'bg-warning/10 text-warning border-warning/30' },
    { key: 'negative', label: 'Négatif', color: 'bg-destructive/10 text-destructive border-destructive/30' },
  ];

  const emptyFilters: { key: EmptyFilter; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'with-empty', label: 'Avec vides' },
    { key: 'without-empty', label: 'Sans vides' },
    { key: 'barcode-empty', label: 'Code-barres vide' },
  ];

  const sortFilters: { key: SortFilter; label: string }[] = [
    { key: 'default', label: 'Ordre PDF' },
    { key: 'stock-asc', label: 'Stock ↑' },
    { key: 'stock-desc', label: 'Stock ↓' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
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

        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {stockFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStockFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                stockFilter === f.key
                  ? `${f.color} border-current shadow-sm scale-105`
                  : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Filtre Qté</p>
          {qtyFilter !== 'all' && (
            <button
              onClick={() => setQtyFilter('all')}
              className="text-xs font-medium text-primary hover:underline"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          <button
            onClick={() => setQtyFilter('all')}
            className={cn(
              'rounded-lg border p-2 text-center transition-all',
              qtyFilter === 'all'
                ? 'border-primary/40 bg-primary/10'
                : 'border-border bg-secondary/30 hover:bg-secondary/50'
            )}
          >
            <p className="text-xs font-bold text-foreground">Toutes</p>
            <p className="text-[10px] text-muted-foreground">{lines.length} articles</p>
          </button>

          {qtyGroups.map(([qty, count]) => (
            <button
              key={qty}
              onClick={() => setQtyFilter(String(qty))}
              className={cn(
                'rounded-lg border p-2 text-center transition-all',
                qtyFilter === String(qty)
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-border bg-secondary/30 hover:bg-secondary/50'
              )}
            >
              <p className="text-sm font-black text-foreground">{qty}</p>
              <p className="text-[10px] text-muted-foreground">{count} article{count > 1 ? 's' : ''}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-semibold">Cellules:</span>
          {emptyFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setEmptyFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                emptyFilter === f.key
                  ? 'bg-violet-600/15 text-violet-700 border-violet-400/50 shadow-sm scale-105'
                  : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-semibold">Tri:</span>
          {sortFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setSortFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                sortFilter === f.key
                  ? 'bg-primary/10 text-primary border-primary/30 shadow-sm scale-105'
                  : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <p>{filtered.length} / {lines.length} article(s)</p>
        {qtyFilter !== 'all' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold">
            Qté active: {qtyFilter}
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
