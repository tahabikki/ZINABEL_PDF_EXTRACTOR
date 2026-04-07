import React, { useState, Suspense } from 'react';
import type { ParsedOrder, OrderLine } from '@/types/order';
import OrderHeaderCard from './OrderHeaderCard';
import SafeOrderTable from './SafeOrderTable';
const OrderAnalytics = React.lazy(() => import('./OrderAnalytics'));
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

  // Use the PDF's top title when available; otherwise fallback to detected type labels
  const rawDocType = (order?.header?.docType || '').toString().toLowerCase().trim();
  const rawHeaderTitle = (order?.header?.title || '').toString().trim();

  // Detect when the parser returned a columns header row (e.g. "Référence Désignation Emplacement Stock")
  // and avoid using it as the document title.
  const looksLikeColumnHeader = (() => {
    if (!rawHeaderTitle) return false;
    const t = rawHeaderTitle.toLowerCase();
    // If it contains both reference and designation, it's very likely a columns header
    if (t.includes('référence') || t.includes('reference')) {
      if (t.includes('désignation') || t.includes('designation')) return true;
    }
    // also treat headers that contain emplacement+stock as columns header
    if (t.includes('emplacement') && t.includes('stock')) return true;
    return false;
  })();

  const baseTitleMap: Record<string, string> = {
    preparation: 'Bon de préparation',
    commande: 'Bon de préparation',
    valorise: 'Bon valorisé',
    valorisé: 'Bon valorisé',
    reliquat: 'Bon de reliquat',
    transfert: 'Bon de transfert',
    transfer: 'Bon de transfert',
  };

  const typeLabelMap: Record<string, string> = {
    preparation: 'Commande',
    commande: 'Commande',
    valorise: 'Valorisé',
    valorisé: 'Valorisé',
    reliquat: 'Reliquat',
    transfert: 'Transfert',
    transfer: 'Transfert',
  };

  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const detectedFromDocType = rawDocType || '';
  let detectedFromTitle = '';
  if (!detectedFromDocType && rawHeaderTitle) {
    const t = rawHeaderTitle.toLowerCase();
    if (t.includes('reliqu')) detectedFromTitle = 'reliquat';
    else if (t.includes('transf')) detectedFromTitle = 'transfert';
    else if (t.includes('valor')) detectedFromTitle = 'valorise';
    else if (t.includes('prepar')) detectedFromTitle = 'preparation';
    else if (t.includes('commande')) detectedFromTitle = 'commande';
  }

  // final detected type (prefer explicit docType, otherwise heuristics from title)
  const detected = detectedFromDocType || detectedFromTitle;
  // Compute doc kind for color/badge: prefer detected type, fallback to title heuristic or 'commande'
  const docKindForBadge = detected || (rawHeaderTitle && /reliqu/i.test(rawHeaderTitle) ? 'reliquat' : 'commande');

  const typeColorClasses: Record<string, string> = {
    preparation: 'bg-sky-100 text-sky-800 border-sky-200',
    commande: 'bg-blue-100 text-blue-800 border-blue-200',
    valorise: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'valorisé': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    reliquat: 'bg-rose-100 text-rose-800 border-rose-200',
    transfert: 'bg-amber-100 text-amber-800 border-amber-200',
    transfer: 'bg-amber-100 text-amber-800 border-amber-200',
  };

  // Compute the display title. Avoid using a columns header as the document title.
  let displayTitle = '';
  if (rawHeaderTitle && !looksLikeColumnHeader) {
    displayTitle = rawHeaderTitle;
    // if it's a reliquat and a sourceOrderNumber is present but not shown, append it
    const isReliquat = /reliqu/i.test(rawHeaderTitle);
    const sourceNum = order?.header?.sourceOrderNumber;
    if (isReliquat && sourceNum && !rawHeaderTitle.includes(sourceNum)) {
      displayTitle = `${rawHeaderTitle} N° ${sourceNum}`;
    }
  } else {
    const detected = detectedFromDocType || detectedFromTitle;
    // Prefer a constructed reliquat title that includes the original PL number when available
    if (detected === 'reliquat') {
      const src = order?.header?.sourceOrderNumber;
      displayTitle = src ? `Reliquat de commande N° ${src}` : `${baseTitleMap['reliquat']} (${typeLabelMap['reliquat']})`;
    } else {
      displayTitle = detected
        ? `${baseTitleMap[detected] ?? 'Bon de préparation'} (${typeLabelMap[detected] ?? capitalize(detected)})`
        : 'Bon de préparation (Commande)';
    }
  }

  const handleCollapsibleChange = (open: boolean) => {
    try {
      setIsOpen(open);
    } catch (err) {
      console.warn('Error changing collapsible state:', err);
    }
  };

  // Build colored badge classes for the detected doc kind
  const docBadgeClass = `${typeColorClasses[docKindForBadge] ?? 'bg-primary/10 text-primary border-primary/20'} inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold`;

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

  const [downloading, setDownloading] = useState<null | 'principal' | 'non-validated' | 'validated'>(null);

  const handleDownloadPrincipal = async () => {
    if (downloading) return;
    setDownloading('principal');
    try {
      await downloadOrderPDF(order, 'principal', undefined, undefined, principalLines);
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
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadValidated = async () => {
    if (downloading) return;
    setDownloading('validated');
    try {
      await downloadOrderPDF(order, 'validated', undefined, undefined, validatedLines);
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
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadNonValidated = async () => {
    if (downloading) return;
    setDownloading('non-validated');
    try {
      await downloadOrderPDF(order, 'non-validated', undefined, undefined, nonValidatedLines);
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
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadJSON = () => {
    try {
      const filename = `${orderName || 'commande'}.json`;
      const dataStr = JSON.stringify(order, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Succès', description: 'JSON téléchargé.' });
    } catch (error) {
      console.error('JSON download error:', error);
      toast({ title: 'Erreur', description: 'Impossible de télécharger le JSON.', variant: 'destructive' });
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
          <div
            role="button"
            tabIndex={0}
            className="flex w-full items-center gap-3 px-6 py-4 border-b border-border bg-primary/5 text-left transition-colors hover:bg-primary/10"
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Reduire les sections' : 'Afficher les sections'}
          >
            <FileText className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2">
                  <span className={cn(docBadgeClass, 'mr-2')}>{typeLabelMap[docKindForBadge] ?? capitalize(docKindForBadge)}</span>
                  <span>{displayTitle}</span>
                </span>
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
                  disabled={!!downloading}
                  className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 text-xs"
                  title="Télécharger Principal"
                >
                  {downloading === 'principal' ? 'Téléchargement...' : 'Principal'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadNonValidated();
                  }}
                  disabled={!!downloading}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 text-xs"
                  title="Télécharger Non Validés"
                >
                  {downloading === 'non-validated' ? 'Téléchargement...' : 'Non Validés'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadValidated();
                  }}
                  disabled={!!downloading}
                  className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 text-xs"
                  title="Télécharger Validés"
                >
                  {downloading === 'validated' ? 'Téléchargement...' : 'Validés'}
                </Button>
              </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadJSON();
                  }}
                  className="text-slate-600 border-slate-200 hover:bg-slate-50 text-xs"
                  title="Exporter JSON"
                >
                  JSON
                </Button>

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
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="p-6 space-y-6">
            {order?.header && (
              <OrderHeaderCard header={order.header} />
            )}

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Analyse approfondie</h3>
              <div className="min-h-[100px]">
                <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement des analytics...</div>}>
                  <OrderAnalytics order={order} />
                </Suspense>
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
