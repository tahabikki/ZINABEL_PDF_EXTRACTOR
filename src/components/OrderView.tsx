import React, { useState } from 'react';
import type { ParsedOrder, OrderLine } from '@/types/order';
import OrderHeaderCard from './OrderHeaderCard';
import SafeOrderTable from './SafeOrderTable';
import OrderAnalytics from './OrderAnalytics';
import { ChevronDown, FileText, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { downloadOrderPDF } from '@/lib/pdfExport';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface OrderViewProps {
  order: ParsedOrder;
  onDelete?: (orderId: string) => void;
}

const OrderView: React.FC<OrderViewProps> = ({ 
  order, 
  onDelete
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'principal' | 'nonValidated' | 'validated'>('principal');
  const [principalLines, setPrincipalLines] = useState<OrderLine[]>([]);
  const [validatedLines, setValidatedLines] = useState<OrderLine[]>([]);
  const [nonValidatedLines, setNonValidatedLines] = useState<OrderLine[]>([]);
  const { toast } = useToast();

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

  const handleDelete = () => {
    if (onDelete) {
      onDelete(order.id);
    }
  };

  const handleFiltersReady = (data: {
    principal: OrderLine[];
    nonValidated: OrderLine[];
    validated: OrderLine[];
    activeTab: 'principal' | 'nonValidated' | 'validated';
  }) => {
    setPrincipalLines(data.principal);
    setNonValidatedLines(data.nonValidated);
    setValidatedLines(data.validated);
    setActiveTab(data.activeTab);
  };

  const handleDownloadPrincipal = () => {
    try {
      downloadOrderPDF(order, 'principal', undefined, undefined, principalLines);
      toast({
        title: 'Succès',
        description: 'PDF Principal téléchargé avec succès.',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le PDF.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadValidated = () => {
    try {
      downloadOrderPDF(order, 'validated', undefined, undefined, validatedLines);
      toast({
        title: 'Succès',
        description: 'PDF Validés téléchargé avec succès.',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le PDF.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadNonValidated = () => {
    try {
      downloadOrderPDF(order, 'non-validated', undefined, undefined, nonValidatedLines);
      toast({
        title: 'Succès',
        description: 'PDF Non Validés téléchargé avec succès.',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le PDF.',
        variant: 'destructive',
      });
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
              <div className="flex flex-wrap gap-2 mt-1">
                {order?.header?.client && (
                  <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
                    Client: {order.header.client}
                  </span>
                )}
                {order?.header?.noPiece && (
                  <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 border border-purple-200">
                    N° Pièce: {order.header.noPiece}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Download Buttons */}
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadPrincipal();
                  }}
                  className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 text-xs"
                  title="Télécharger Principal"
                >
                  Principal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadNonValidated();
                  }}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 text-xs"
                  title="Télécharger Non Validés"
                >
                  Non Validés
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadValidated();
                  }}
                  className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 text-xs"
                  title="Télécharger Validés"
                >
                  Validés
                </Button>
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
              {/* Delete Button - Last */}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                title="Supprimer cette commande"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
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
                <SafeOrderTable lines={order?.lines || []} order={order} onFiltersReady={handleFiltersReady} />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default OrderView;
