import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ChevronDown, ChevronRight, X } from 'lucide-react';
import type { ParsedOrder } from '@/types/order';

type Product = {
  reference: string;
  name?: string;
  quantity?: number | null;
  brand?: string;
  client?: string;
  orderNumber?: string;
};

const Analysis: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [aggregatedByRef, setAggregatedByRef] = useState<Map<string, number>>(new Map());
  const [orderBreakdown, setOrderBreakdown] = useState<Map<string, Map<string, { qty: number; client: string }>>>(new Map());
  const [brandBreakdown, setBrandBreakdown] = useState<Map<string, Map<string, number>>>(new Map());
  const [fileName, setFileName] = useState<string>('');
  const [searchRaw, setSearchRaw] = useState<string>('');
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [globalResults, setGlobalResults] = useState<Product[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedRef, setExpandedRef] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('parsedOrders');
      if (raw) {
        const parsed = JSON.parse(raw) as ParsedOrder[];
        setOrders(parsed);
        processOrders(parsed);
      }
    } catch (e) {
      console.warn('Failed to read parsedOrders from localStorage', e);
    }
  }, []);

  const processOrders = useCallback((ordersData: ParsedOrder[]) => {
    const refTotals = new Map<string, number>();
    const orderMap = new Map<string, Map<string, { qty: number; client: string }>>();
    const brandMap = new Map<string, Map<string, number>>();

    for (const order of ordersData) {
      const orderNumber = order.header.noPiece || order.header.noDemande || order.header.reference || order.id;
      
      for (const line of order.lines) {
        const ref = line.reference.trim();
        const qty = typeof line.qte === 'number' ? Math.round(line.qte) : 0;
        const brand = line.brand || 'Sans marque';

        if (ref === '') continue;

        refTotals.set(ref, (refTotals.get(ref) || 0) + qty);

        if (!orderMap.has(ref)) orderMap.set(ref, new Map());
        const existing = orderMap.get(ref)!.get(orderNumber);
        if (existing) {
          existing.qty += qty;
        } else {
          orderMap.get(ref)!.set(orderNumber, { qty, client: order.header.client || 'Client inconnu' });
        }

        if (!brandMap.has(ref)) brandMap.set(ref, new Map());
        brandMap.get(ref)!.set(brand, (brandMap.get(ref)!.get(brand) || 0) + qty);
      }
    }

    setAggregatedByRef(refTotals);
    setOrderBreakdown(orderMap);
    setBrandBreakdown(brandMap);
  }, []);

  const doGlobalSearch = () => {
    const qRaw = searchRaw || '';
    const q = qRaw.toLowerCase().trim();
    if (!q) {
      setGlobalResults([]);
      setIsGlobalSearch(false);
      return;
    }
    const terms = q.split(/\s+/).filter(Boolean);
    const results: Product[] = [];
    for (const order of orders) {
      const orderNumber = order.header.noPiece || order.header.noDemande || order.header.reference || order.id;
      for (const line of order.lines) {
        const ref = (line.reference || '').toLowerCase();
        const name = ((line.designation || '') as string).toLowerCase();
        if (terms.every((t) => ref.includes(t) || name.includes(t))) {
          results.push({
            reference: line.reference,
            name: line.designation,
            quantity: line.qte,
            brand: line.brand,
            client: order.header.client,
            orderNumber,
          });
        }
      }
    }
    setGlobalResults(results);
    setIsGlobalSearch(true);
  };

  const clearGlobalSearch = () => {
    setGlobalResults([]);
    setIsGlobalSearch(false);
    setSearchRaw('');
  };

  const handleDownload = () => {
    if (selectedRows.size === 0) {
      toast({ title: 'Aucune référence sélectionnée', variant: 'destructive' });
      return;
    }
    toast({ title: 'Fonctionnalité en développement', description: 'Le téléchargement PDF sera disponible bientôt', variant: 'default' });
  };

  const toggleRow = (ref: string) => {
    setSelectedRows((prev) => {
      const s = new Set(prev);
      if (s.has(ref)) s.delete(ref);
      else s.add(ref);
      return s;
    });
  };

  const toggleExpand = (ref: string) => {
    setExpandedRef((prev) => (prev === ref ? null : ref));
  };

  const allSelected = aggregatedByRef.size > 0 && [...aggregatedByRef.keys()].every((ref) => selectedRows.has(ref));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(aggregatedByRef.keys()));
  };

  const getOrderBreakdown = (ref: string) => {
    const map = orderBreakdown.get(ref);
    if (!map) return [];
    return [...map.entries()].sort((a, b) => b[1].qty - a[1].qty);
  };

  const getBrandBreakdown = (ref: string) => {
    const map = brandBreakdown.get(ref);
    if (!map) return [];
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { navigate(-1); }}>
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Analyse des références</h1>
              <p className="text-xs text-muted-foreground">Agrégation des références de toutes les commandes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">
              Aucune commande trouvée. Veuillez d'abord importer des PDF dans la page d'accueil.
            </p>
            <Button className="mt-4" onClick={() => navigate('/')}>
              Aller à l'accueil
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">{orders.length} commande(s) chargée(s)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="w-full">
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Rechercher référence"
                    value={searchRaw}
                    onChange={(e) => setSearchRaw(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') doGlobalSearch(); }}
                  />
                  <Button variant="outline" onClick={doGlobalSearch}>Rechercher</Button>
                </div>
              </div>
              <div className="w-full">
                <Input className="w-full" placeholder="Nom du fichier PDF" value={fileName} onChange={(e) => setFileName(e.target.value)} />
              </div>
              <div className="w-full flex items-center">
                <Button className="w-full" onClick={handleDownload} disabled={aggregatedByRef.size === 0}>Télécharger PDF</Button>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-1/3">
                {(isGlobalSearch) ? (
                  <div className="text-left">
                    <Button variant="secondary" size="sm" onClick={() => { clearGlobalSearch(); }} className="flex items-center gap-2">
                      <ArrowLeft className="h-3 w-3" />
                      Retour
                    </Button>
                  </div>
                ) : <div />}
              </div>
              <div className="w-1/3 text-center">
                <div className="text-sm font-medium">Références uniques: {aggregatedByRef.size}</div>
              </div>
              <div className="w-1/3 text-right">
                <div className="text-sm">Sélectionnées: {selectedRows.size} référence(s)</div>
              </div>
            </div>

            {isGlobalSearch && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Résultats de recherche</h3>
                {globalResults.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucun résultat.</div>
                ) : (
                  <div className="overflow-auto border rounded-md mb-6">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-muted-foreground">
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Référence</th>
                          <th className="px-3 py-2">Marque</th>
                          <th className="px-3 py-2">N° Commande</th>
                          <th className="px-3 py-2">Client</th>
                          <th className="px-3 py-2">Qté</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalResults.map((p, index) => {
                          const ref = p.reference.trim();
                          const totalQty = aggregatedByRef.get(ref) ?? 0;
                          return (
                            <tr key={`${ref}-${index}`} className="border-t">
                              <td className="px-3 py-2">
                                <Checkbox checked={selectedRows.has(ref)} onCheckedChange={() => toggleRow(ref)} />
                              </td>
                              <td className="px-3 py-2 font-mono text-sm">{ref}</td>
                              <td className="px-3 py-2 text-sm">{p.brand || '-'}</td>
                              <td className="px-3 py-2 text-sm">{p.orderNumber || '-'}</td>
                              <td className="px-3 py-2 text-sm">{p.client || '-'}</td>
                              <td className="px-3 py-2">{p.quantity ?? 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { clearGlobalSearch(); }}>Fermer</Button>
                  <Button variant="outline" size="sm" onClick={() => { setSearchRaw(''); clearGlobalSearch(); }}>Effacer</Button>
                </div>
              </div>
            )}

            {!isGlobalSearch && (
              <div className="overflow-auto border rounded-md mb-6">
                <h3 className="text-lg font-semibold mb-2">Table des références agrégées</h3>
                {aggregatedByRef.size === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucune donnée extraite des fichiers PDF.</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-muted-foreground">
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Référence</th>
                        <th className="px-3 py-2">Marque</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...aggregatedByRef.entries()].map(([ref, totalQty]) => {
                        const isExpanded = expandedRef === ref;
                        const orders = getOrderBreakdown(ref);
                        const brands = getBrandBreakdown(ref);
                        const mainBrand = brands.length > 0 ? brands[0][0] : '-';
                        return (
                          <React.Fragment key={ref}>
                            <tr className="border-t bg-muted/30">
                              <td className="px-2 py-2">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleExpand(ref)}>
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              </td>
                              <td className="px-3 py-2">
                                <Checkbox checked={selectedRows.has(ref)} onCheckedChange={() => toggleRow(ref)} />
                              </td>
                              <td className="px-3 py-2 font-mono text-sm cursor-pointer" onClick={() => toggleExpand(ref)}>{ref}</td>
                              <td className="px-3 py-2 text-sm cursor-pointer" onClick={() => toggleExpand(ref)}>{mainBrand}</td>
                              <td className="px-3 py-2 text-right font-medium">{totalQty}</td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={5} className="p-0 bg-muted/10">
                                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2">Par Commande</h4>
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="text-left text-muted-foreground">
                                            <th className="py-1">N° Commande</th>
                                            <th className="py-1">Client</th>
                                            <th className="py-1 text-right">Qté</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {orders.map(([orderNum, data]) => (
                                            <tr key={orderNum} className="border-t">
                                              <td className="py-1">{orderNum}</td>
                                              <td className="py-1 text-sm">{data.client}</td>
                                              <td className="py-1 text-right">{data.qty}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2">Par Marque</h4>
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="text-left text-muted-foreground">
                                            <th className="py-1">Marque</th>
                                            <th className="py-1 text-right">Qté</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {brands.map(([brand, qty]) => (
                                            <tr key={brand} className="border-t">
                                              <td className="py-1">{brand}</td>
                                              <td className="py-1 text-right">{qty}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-2">Références sélectionnées</h3>
              {selectedRows.size === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune référence sélectionnée.</div>
              ) : (
                <div className="overflow-auto border rounded-md">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-muted-foreground">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Référence</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selectedRows].map((ref) => {
                        const totalQty = aggregatedByRef.get(ref) ?? 0;
                        return (
                          <tr key={ref} className="border-t">
                            <td className="px-3 py-2">
                              <Checkbox checked={true} onCheckedChange={() => toggleRow(ref)} />
                            </td>
                            <td className="px-3 py-2 font-mono text-sm">{ref}</td>
                            <td className="px-3 py-2 text-right">{totalQty}</td>
                            <td className="px-3 py-2">
                              <Button variant="ghost" size="sm" onClick={() => toggleRow(ref)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Analysis;