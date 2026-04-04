import React, { useState } from 'react';
import type { ParsedOrder } from '@/types/order';
import OrderHeaderCard from './OrderHeaderCard';
import SafeOrderTable from './SafeOrderTable';
import OrderAnalytics from './OrderAnalytics';
import { ChevronDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface OrderViewProps {
  order: ParsedOrder;
}

const OrderView: React.FC<OrderViewProps> = ({ order }) => {
  const [isOpen, setIsOpen] = useState(false);

  const orderName =
    order?.header?.reference ||
    order?.header?.noPiece ||
    (order?.fileName || 'Commande').replace(/\.pdf$/i, '');

  const handleCollapsibleChange = (open: boolean) => {
    try {
      setIsOpen(open);
    } catch (err) {
      console.warn('Error changing collapsible state:', err);
    }
  };

  // Guard against missing order data
  if (!order) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm p-6 text-center text-muted-foreground">
        Données de commande indisponibles
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={handleCollapsibleChange}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-6 py-4 border-b border-border bg-primary/5 text-left transition-colors hover:bg-primary/10"
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Reduire les sections' : 'Afficher les sections'}
          >
            <FileText className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground flex flex-wrap items-center gap-2">
                <span>Bon de preparation (Commande)</span>
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary truncate">
                  {orderName || 'Commande'}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground truncate">{order?.fileName || '—'}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground">
              {isOpen ? 'Masquer' : 'Afficher'}
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="p-6 space-y-6">
            {order?.header && (
              <OrderHeaderCard header={order.header} />
            )}

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Analyse approfondie</h3>
              <div className="min-h-[100px]">
                <OrderAnalytics order={order} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Details de la preparation</h3>
              <div className="min-h-[100px]">
                <SafeOrderTable lines={order?.lines || []} />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default OrderView;
