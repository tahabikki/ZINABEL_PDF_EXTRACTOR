import React, { useMemo, useState } from 'react';
import type { ParsedOrder, OrderLine } from '@/types/order';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ChevronDown,
  Layers,
  MapPin,
  Package,
  Percent,
  Search,
  ShoppingCart,
  TrendingDown,
  Warehouse,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import EmplacementGrid from '@/components/EmplacementGrid';

interface OrderAnalyticsProps {
  order: ParsedOrder;
}

const OrderAnalytics: React.FC<OrderAnalyticsProps> = ({ order }) => {
  const { lines } = order;

  const stockZero = lines.filter((l) => l.stock === 0);
  const stockNegative = lines.filter((l) => l.stock < 0);
  const stockPositive = lines.filter((l) => l.stock > 0);
  const stockLow = lines.filter((l) => l.stock > 0 && l.stock < 10);

  const totalStockValue = lines.reduce((sum, l) => sum + l.stock, 0);
  const totalQtyOrdered = lines.reduce((sum, l) => sum + l.qte, 0);
  const uniqueEmplacements = new Set(lines.map((l) => l.emplacement)).size;
  const overOrderedItems = lines.filter((l) => l.qte > l.stock && l.stock >= 0);
  const topByQty = [...lines].sort((a, b) => b.qte - a.qte).slice(0, 5);
  const criticalItems = stockNegative.length;
  const fulfillableItems = lines.filter((l) => l.stock >= l.qte).length;
  const fulfillmentRate = lines.length > 0 ? Math.round((fulfillableItems / lines.length) * 100) : 0;
  const qtyGroupCount = new Set(lines.map((l) => Math.round(l.qte))).size;

  const [ruptureSearch, setRuptureSearch] = useState('');
  const [negativeSearch, setNegativeSearch] = useState('');

  const filteredRupture = useMemo(() => {
    if (!ruptureSearch.trim()) return stockZero;
    const q = ruptureSearch.toLowerCase();
    return stockZero.filter((l) => l.reference.toLowerCase().includes(q) || l.designation.toLowerCase().includes(q));
  }, [stockZero, ruptureSearch]);

  const filteredNegative = useMemo(() => {
    if (!negativeSearch.trim()) return stockNegative;
    const q = negativeSearch.toLowerCase();
    return stockNegative.filter((l) => l.reference.toLowerCase().includes(q) || l.designation.toLowerCase().includes(q));
  }, [stockNegative, negativeSearch]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard icon={<Package className="h-5 w-5" />} label="Total Articles" value={lines.length} color="primary" />
        <KPICard icon={<Layers className="h-5 w-5" />} label="Qté Commandée" value={totalQtyOrdered} color="primary" />
        <KPICard icon={<CheckCircle className="h-5 w-5" />} label="Stock Positif" value={stockPositive.length} color="success" />
        <KPICard icon={<AlertTriangle className="h-5 w-5" />} label="Stock = 0" value={stockZero.length} color="warning" />
        <KPICard icon={<TrendingDown className="h-5 w-5" />} label="Stock Négatif" value={stockNegative.length} color="danger" />
        <KPICard
          icon={<Percent className="h-5 w-5" />}
          label="Taux Exécution"
          value={`${fulfillmentRate}%`}
          color={fulfillmentRate >= 80 ? 'success' : fulfillmentRate >= 50 ? 'warning' : 'danger'}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" /> Emplacements — Filtrer par lettre
        </h4>
        <EmplacementGrid lines={lines} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Distribution du Stock
          </h4>
          <div className="space-y-3">
            <DistBar label="Positif" count={stockPositive.length} total={lines.length} color="bg-success" emoji="✅" />
            <DistBar label="Zéro" count={stockZero.length} total={lines.length} color="bg-warning" emoji="⚠️" />
            <DistBar label="Négatif" count={stockNegative.length} total={lines.length} color="bg-destructive" emoji="❌" />
            <DistBar label="Faible (<10)" count={stockLow.length} total={lines.length} color="bg-warning/60" emoji="📉" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard icon={<MapPin className="h-4 w-4" />} label="Emplacements" value={uniqueEmplacements.toString()} />
          <SummaryCard icon={<Warehouse className="h-4 w-4" />} label="Stock Total" value={totalStockValue.toLocaleString('fr-FR')} />
          <SummaryCard
            icon={<ShoppingCart className="h-4 w-4" />}
            label="Sur-commandés"
            value={overOrderedItems.length.toString()}
            alert={overOrderedItems.length > 0}
          />
          <SummaryCard icon={<TrendingDown className="h-4 w-4" />} label="Critiques" value={criticalItems.toString()} alert={criticalItems > 0} />
          <SummaryCard icon={<CheckCircle className="h-4 w-4" />} label="Exécutables" value={`${fulfillableItems}/${lines.length}`} />
          <SummaryCard icon={<Package className="h-4 w-4" />} label="Qté Groupes" value={qtyGroupCount.toString()} />
        </div>
      </div>

      {topByQty.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            🔝 Top 5 — Plus grandes quantités commandées
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {topByQty.map((item, i) => (
              <div key={i} className={`rounded-xl border p-4 text-center transition-all hover:scale-[1.02] ${stockCardBorder(item.stock)}`}>
                <div className="text-2xl font-black text-primary mb-1">#{i + 1}</div>
                <p className="font-mono text-xs font-bold text-foreground truncate">{item.reference}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.designation}</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="text-lg font-black text-foreground">{item.qte}</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${stockBadge(item.stock)}`}>
                    Stock:{item.stock.toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stockZero.length > 0 && (
        <StockCardGrid
          title="Articles en rupture (Stock = 0)"
          icon={<AlertTriangle className="h-5 w-5 text-warning" />}
          items={filteredRupture}
          allCount={stockZero.length}
          search={ruptureSearch}
          onSearch={setRuptureSearch}
          accentColor="warning"
          stockType="zero"
        />
      )}

      {stockNegative.length > 0 && (
        <StockCardGrid
          title="Articles en stock négatif"
          icon={<TrendingDown className="h-5 w-5 text-destructive" />}
          items={filteredNegative}
          allCount={stockNegative.length}
          search={negativeSearch}
          onSearch={setNegativeSearch}
          accentColor="destructive"
          stockType="negative"
        />
      )}
    </div>
  );
};

/* Sub-components */

function KPICard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const styles = {
    primary: 'border-primary/20 bg-primary/5',
    success: 'border-success/20 bg-success/5',
    warning: 'border-warning/20 bg-warning/5',
    danger: 'border-destructive/20 bg-destructive/5',
  };
  const iconStyles = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-destructive bg-destructive/10',
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[color]} shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`inline-flex p-2 rounded-lg mb-2 ${iconStyles[color]}`}>{icon}</div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  );
}

function DistBar({
  label,
  count,
  total,
  color,
  emoji,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  emoji: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-6 text-center">{emoji}</span>
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden relative">
        <div className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground mix-blend-difference">
          {pct}%
        </span>
      </div>
      <span className="text-xs font-bold text-foreground w-10 text-right">{count}</span>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${
        alert ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={alert ? 'text-destructive' : 'text-muted-foreground'}>{icon}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-black ${alert ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function StockCardGrid({
  title,
  icon,
  items,
  allCount,
  search,
  onSearch,
  accentColor,
  stockType,
}: {
  title: string;
  icon: React.ReactNode;
  items: OrderLine[];
  allCount: number;
  search: string;
  onSearch: (s: string) => void;
  accentColor: 'warning' | 'destructive';
  stockType: 'zero' | 'negative';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? items : items.slice(0, 12);
  const borderCls = accentColor === 'warning' ? 'border-warning/30' : 'border-destructive/30';
  const bgCls = accentColor === 'warning' ? 'bg-warning/5' : 'bg-destructive/5';
  const badgeCls = accentColor === 'warning' ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive';
  const cardHover =
    accentColor === 'warning' ? 'hover:border-warning/50 hover:shadow-warning/10' : 'hover:border-destructive/50 hover:shadow-destructive/10';

  return (
    <div className={`rounded-xl border ${borderCls} ${bgCls} p-5 shadow-sm`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 mb-4 text-left"
        aria-expanded={isOpen}
      >
        <h4 className="text-base font-bold text-foreground flex items-center gap-2">
          {icon} {title}
          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${badgeCls}`}>{allCount}</span>
        </h4>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
          {isOpen ? 'Masquer' : 'Afficher'}
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')} />
        </span>
      </button>

      {isOpen && (
        <>
          {allCount > 6 && (
            <div className="relative w-full sm:w-64 mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Rechercher par référence..."
                className="pl-9 h-9 text-sm"
              />
              {search && (
                <button
                  onClick={() => onSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayItems.map((item, i) => (
              <div key={i} className={`rounded-xl border bg-card p-4 shadow-sm transition-all ${cardHover} hover:shadow-md`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="font-mono text-sm font-black text-foreground">{item.reference}</span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
                    {stockType === 'negative' ? `Stock: ${item.stock.toLocaleString('fr-FR')}` : 'Stock: 0'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">{item.designation}</p>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <div className="flex items-center gap-1.5">
                    <Package className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase">Qté</span>
                  </div>
                  <span className="text-sm font-black text-foreground">{item.qte}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase">Empl.</span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{item.emplacement}</span>
                </div>
              </div>
            ))}
            {items.length === 0 && <div className="col-span-full text-center py-8 text-muted-foreground text-sm">Aucun résultat</div>}
          </div>

          {items.length > 12 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-4 w-full py-2.5 rounded-lg border border-border bg-card text-sm font-semibold text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
            >
              <ChevronDown className="h-4 w-4" /> Voir les {items.length - 12} restants
            </button>
          )}

          {expanded && items.length > 12 && (
            <button
              onClick={() => setExpanded(false)}
              className="mt-4 w-full py-2.5 rounded-lg border border-border bg-card text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
            >
              Réduire
            </button>
          )}
        </>
      )}
    </div>
  );
}

function stockCardBorder(stock: number) {
  if (stock < 0) return 'border-destructive/30 bg-destructive/5';
  if (stock === 0) return 'border-warning/30 bg-warning/5';
  return 'border-success/30 bg-success/5';
}

function stockBadge(stock: number) {
  if (stock < 0) return 'bg-destructive/20 text-destructive';
  if (stock === 0) return 'bg-warning/20 text-warning';
  return 'bg-success/20 text-success';
}

export default OrderAnalytics;
