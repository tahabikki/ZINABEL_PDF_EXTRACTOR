import React, { useState, useCallback } from 'react';
import PDFDropZone from '@/components/PDFDropZone';
import OrderView from '@/components/OrderView';
import { parsePDF } from '@/lib/pdfParser';
import type { ParsedOrder } from '@/types/order';
import { FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      setIsProcessing(true);
      try {
        const results = await Promise.all(files.map((f) => parsePDF(f)));
        setOrders((prev) => [...prev, ...results]);
        toast({
          title: 'Analyse terminée',
          description: `${results.length} commande(s) analysée(s) avec succès.`,
        });
      } catch (err) {
        console.error(err);
        toast({
          title: 'Erreur',
          description: "Impossible d'analyser le fichier PDF.",
          variant: 'destructive',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [toast]
  );

  const clearAll = useCallback(() => {
    setOrders([]);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">ZINABEL</h1>
              <p className="text-xs text-muted-foreground">Analyse approfondie des bons de commande</p>
            </div>
          </div>
          {orders.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4 mr-1" />
              Tout effacer
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        <PDFDropZone onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />

        {orders.length > 0 && (
          <div className="space-y-8">
            {orders.map((order) => (
              <OrderView key={order.id} order={order} />
            ))}
          </div>
        )}

        {orders.length === 0 && !isProcessing && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">
              Importez un ou plusieurs bons de commande PDF pour commencer l'analyse
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
