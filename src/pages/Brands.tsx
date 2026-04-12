import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { downloadMinimalLinesPDF } from '@/lib/pdfExport';
import { ArrowLeft } from 'lucide-react';
import { useDebounce } from '@/lib/performanceHooks';

type Product = {
  reference: string;
  name?: string;
  stock?: number | null;
  price?: number | null;
  quantity?: number | null;
  free_quantity?: number | null;
  brand?: string;
  carton_Qte?: number | null;
};

function getItemId(p: Product) {
  return `${(p.brand || 'Sans marque').trim()}||${p.reference}`;
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = s.charCodeAt(i) + ((h << 5) - h);
    h |= 0;
  }
  return h;
}

const Brands: React.FC = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [qteMap, setQteMap] = useState<Map<string, number>>(new Map());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string>('');
  const [searchRaw, setSearchRaw] = useState<string>('');
  const search = useDebounce(searchRaw, 250);

  // Load products from public/carton_Qte.json (served by Vite from /carton_Qte.json)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/carton_Qte.json');
        if (!res.ok) throw new Error('Failed to fetch carton_Qte.json');
        const data = await res.json();
        if (!mounted) return;
        setProducts(data as Product[]);
      } catch (e) {
        console.warn('Could not load carton_Qte.json, falling back to empty list', e);
        setProducts([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const brandGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const b = (p.brand || 'Sans marque').trim();
      map.set(b, (map.get(b) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  // Lines for currently opened brand
  const brandLines = useMemo(() => {
    if (!activeBrand) return [] as Product[];
    return products.filter((p) => ((p.brand || 'Sans marque').trim() === activeBrand));
  }, [products, activeBrand]);

  const filteredLines = useMemo(() => {
    if (!search || search.trim() === '') return brandLines;
    const q = search.toLowerCase().trim();
    return brandLines.filter((p) => (p.reference || '').toLowerCase().includes(q));
  }, [brandLines, search]);

  useEffect(() => {
    // initialize qteMap for visible lines while preserving existing values
    setQteMap((prev) => {
      const m = new Map(prev);
      for (const p of brandLines) {
        const id = getItemId(p);
        if (!m.has(id)) {
          const initial = typeof p.quantity === 'number' ? Math.round(p.quantity) : 0;
          m.set(id, initial);
        }
      }
      return m;
    });
    // Keep selectedRows intact so checked rows persist across opening/closing brands
  }, [brandLines]);

  // Note: brand selection is handled by opening the brand; per-row selections
  // are stored in `selectedRows` and persist across brand changes.

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const allSelected = filteredLines.length > 0 && filteredLines.every((p) => selectedRows.has(getItemId(p)));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(filteredLines.map((p) => getItemId(p))));
  };

  const handleQtyChange = (id: string, v: string) => {
    const n = Number(v);
    setQteMap((prev) => {
      const m = new Map(prev);
      if (Number.isNaN(n) || n < 0) m.set(id, 0);
      else m.set(id, Math.round(n));
      return m;
    });
  };

  const handleDownload = async () => {
    const selected = products.filter((p) => selectedRows.has(getItemId(p)));
    if (selected.length === 0) {
      toast({ title: 'Aucune référence sélectionnée', variant: 'destructive' });
      return;
    }
    const preparedMap = new Map<string, number>();
    const finalLines = selected.map((p) => {
      const id = getItemId(p);
      const q = qteMap.get(id) ?? (typeof p.quantity === 'number' ? Math.round(p.quantity) : 0);
      preparedMap.set(id, q);
      // Include brand so exporter can compute per-brand totals
      return { reference: p.reference, qte: q, brand: p.brand || 'Sans marque' } as any;
    });
    const title = Array.from(new Set(selected.map((p) => (p.brand || 'Marques')))).join(', ') || 'Marques';
    const filename = (fileName || `${title}_${new Date().toISOString().split('T')[0]}`).replace(/\s+/g, '_') + '.pdf';
    try {
      await downloadMinimalLinesPDF(finalLines as any, filename, title, preparedMap);
      toast({ title: 'PDF téléchargé', description: filename });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Impossible de générer le PDF', variant: 'destructive' });
    }
  };

  const selectedProducts = useMemo(() => {
    return products.filter((p) => selectedRows.has(getItemId(p)));
  }, [products, selectedRows]);

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (activeBrand) setActiveBrand(null);
                else navigate('/');
              }}
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Marques</h1>
              <p className="text-xs text-muted-foreground">Sélectionnez une ou plusieurs marques puis exportez les références</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div>
          <div className="mb-4 text-sm text-muted-foreground">Sélectionnez une ou plusieurs marques (cases) pour créer la table ci-dessous.</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {brandGroups.map(([b, count]) => {
              const hue = Math.abs(hashString(b)) % 360;
              const bg = `linear-gradient(135deg, hsl(${hue} 85% 95%), hsl(${(hue + 25) % 360} 70% 90%))`;
              const borderColor = `hsl(${hue} 60% 78%)`;
              return (
                <div
                  key={b}
                  role="button"
                  onClick={() => setActiveBrand(b)}
                  className="p-6 rounded-xl text-left cursor-pointer transform transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
                  style={{ background: bg, border: `1px solid ${borderColor}` }}
                >
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold truncate text-gray-900">{b}</div>
                        <div className="text-sm text-gray-700 mt-1">{count} référence(s)</div>
                      </div>
                    
                    </div>
                    <div className="absolute top-3 right-3 text-xs bg-white/85 text-gray-900 px-2 py-1 rounded-full shadow">{count}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="w-full">
              <Input className="w-full" placeholder="Rechercher référence" value={searchRaw} onChange={(e) => setSearchRaw(e.target.value)} />
            </div>
            <div className="w-full">
              <Input className="w-full" placeholder="Nom du fichier PDF" value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </div>
            <div className="w-full flex items-center">
              <Button className="w-full" onClick={handleDownload} disabled={selectedProducts.length === 0}>Télécharger PDF</Button>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-1/3">
              {activeBrand ? (
                <div className="text-left">
                  <Button variant="secondary" size="sm" onClick={() => setActiveBrand(null)} className="flex items-center gap-2">
                    <ArrowLeft className="h-3 w-3" />
                    Retour grille
                  </Button>
                </div>
              ) : <div />}
            </div>
            <div className="w-1/3 text-center">
              <div className="text-sm font-medium">Marque ouverte: {activeBrand || 'Aucune'}</div>
            </div>
            <div className="w-1/3 text-right">
              <div className="text-sm">Sélectionnées: {selectedProducts.length} référence(s)</div>
            </div>
          </div>

          {activeBrand && (
            <div className="overflow-auto border rounded-md mb-6">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Référence</th>
                    <th className="px-3 py-2">Qté</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((p) => {
                    const id = getItemId(p);
                    return (
                      <tr key={id} className="border-t">
                        <td className="px-3 py-2">
                          <Checkbox checked={selectedRows.has(id)} onCheckedChange={() => toggleRow(id)} />
                        </td>
                        <td className="px-3 py-2 font-mono text-sm">{p.reference}</td>
                        <td className="px-3 py-2 w-32">
                          <Input value={String(qteMap.get(id) ?? 0)} onChange={(e) => handleQtyChange(id, e.target.value)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-2">Table des références sélectionnées</h3>
            {selectedProducts.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune référence sélectionnée.</div>
            ) : (
              <div className="overflow-auto border rounded-md">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Référence</th>
                      <th className="px-3 py-2">Qté</th>
                      <th className="px-3 py-2">Marque</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map((p) => {
                      const id = getItemId(p);
                      return (
                        <tr key={id} className="border-t">
                          <td className="px-3 py-2">
                            <Checkbox checked={true} onCheckedChange={() => toggleRow(id)} />
                          </td>
                          <td className="px-3 py-2 font-mono text-sm">{p.reference}</td>
                          <td className="px-3 py-2 w-32">
                            <Input value={String(qteMap.get(id) ?? 0)} onChange={(e) => handleQtyChange(id, e.target.value)} />
                          </td>
                          <td className="px-3 py-2">{p.brand}</td>
                          <td className="px-3 py-2">
                            <Button variant="ghost" size="sm" onClick={() => toggleRow(id)}>Retirer</Button>
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
      </main>
    </div>
  );
};

export default Brands;
