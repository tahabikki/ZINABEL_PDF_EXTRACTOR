import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ChevronDown, ChevronRight, X, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import type { ParsedOrder } from '@/types/order';

type Product = {
  reference: string;
  designation?: string;
  quantity?: number | null;
  brand?: string;
  client?: string;
  orderNumber?: string;
  emplacement?: string;
};

type RefData = {
  totalQty: number;
  mainBrand: string;
  mainDesignation: string;
  mainEmplacement: string;
  orders: Map<string, { qty: number; client: string }>;
  brands: Map<string, number>;
};

type SortKey = 'reference' | 'brand' | 'emplacement' | 'designation' | 'totalQty';
type SortDir = 'asc' | 'desc';

const Analysis: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [refData, setRefData] = useState<Map<string, RefData>>(new Map());
  const [fileName, setFileName] = useState<string>('');
  const [searchRaw, setSearchRaw] = useState<string>('');
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [globalResults, setGlobalResults] = useState<Product[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedRef, setExpandedRef] = useState<string | null>(null);

  const [filterEmplacement, setFilterEmplacement] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterOrder, setFilterOrder] = useState('');
  const [filterQtyMin, setFilterQtyMin] = useState('');
  const [filterQtyMax, setFilterQtyMax] = useState('');
  const [empFilter, setEmpFilter] = useState<Set<string>>(new Set());
  const [empSectionsByLetter, setEmpSectionsByLetter] = useState<Map<string, Set<string>>>(new Map());
  const [empRowsByLetter, setEmpRowsByLetter] = useState<Map<string, Set<string>>>(new Map());
  const [empLevelsByLetter, setEmpLevelsByLetter] = useState<Map<string, Set<string>>>(new Map());
  
  const [sortKey, setSortKey] = useState<SortKey>('reference');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showFilters, setShowFilters] = useState(true);

  const getFirstLetter = (emplacement: string) => {
    const s = (emplacement || '').trim();
    if (!s) return '#';
    const first = s.charAt(0).toUpperCase();
    if (/[A-Z]/.test(first)) return first;
    return '#';
  };

  const getSection = (emplacement: string) => {
    const parts = (emplacement || '').split(/\s*-\s*/).map(p => p.trim());
    return parts[1] || '';
  };

  const getRow = (emplacement: string) => {
    const parts = (emplacement || '').split(/\s*-\s*/).map(p => p.trim());
    return parts[2] || '';
  };

  const getLevel = (emplacement: string) => {
    const parts = (emplacement || '').split(/\s*-\s*/).map(p => p.trim());
    return parts[3] || '';
  };

  const allLetters = useMemo(() => {
    const letters = new Set<string>();
    refData.forEach((data) => {
      const letter = getFirstLetter(data.mainEmplacement);
      letters.add(letter);
    });
    return Array.from(letters).sort();
  }, [refData]);

  const allEmplacements = useMemo(() => {
    const emps = new Set<string>();
    refData.forEach((data) => {
      if (data.mainEmplacement) emps.add(data.mainEmplacement);
    });
    return Array.from(emps).sort();
  }, [refData]);

  const availableSectionsByLetter = useMemo(() => {
    const map = new Map<string, Set<string>>();
    refData.forEach((data) => {
      const letter = getFirstLetter(data.mainEmplacement);
      const section = getSection(data.mainEmplacement);
      if (section) {
        if (!map.has(letter)) map.set(letter, new Set());
        map.get(letter)!.add(section);
      }
    });
    return map;
  }, [refData]);

  const availableRowsByLetter = useMemo(() => {
    const map = new Map<string, Set<string>>();
    refData.forEach((data) => {
      const letter = getFirstLetter(data.mainEmplacement);
      const row = getRow(data.mainEmplacement);
      if (row) {
        if (!map.has(letter)) map.set(letter, new Set());
        map.get(letter)!.add(row);
      }
    });
    return map;
  }, [refData]);

  const availableLevelsByLetter = useMemo(() => {
    const map = new Map<string, Set<string>>();
    refData.forEach((data) => {
      const letter = getFirstLetter(data.mainEmplacement);
      const level = getLevel(data.mainEmplacement);
      if (level) {
        if (!map.has(letter)) map.set(letter, new Set());
        map.get(letter)!.add(level);
      }
    });
    return map;
  }, [refData]);

  const allDesignations = useMemo(() => {
    const desigs = new Set<string>();
    refData.forEach((data) => {
      if (data.mainDesignation) desigs.add(data.mainDesignation);
    });
    return Array.from(desigs).sort();
  }, [refData]);

  const allClients = useMemo(() => {
    const clients = new Set<string>();
    refData.forEach((data) => {
      data.orders.forEach((v) => clients.add(v.client));
    });
    return Array.from(clients).sort();
  }, [refData]);

  const allBrands = useMemo(() => {
    const brands = new Set<string>();
    refData.forEach((data) => {
      data.brands.forEach((_, brand) => brands.add(brand));
    });
    return Array.from(brands).sort();
  }, [refData]);

  const allOrders = useMemo(() => {
    const nums = new Set<string>();
    refData.forEach((data) => {
      data.orders.forEach((_, num) => nums.add(num));
    });
    return Array.from(nums).sort();
  }, [refData]);

  const toggleEmpLetter = (letter: string) => {
    setEmpFilter((prev) => {
      const s = new Set(prev);
      if (s.has(letter)) s.delete(letter);
      else s.add(letter);
      return s;
    });
  };

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
    const refs = new Map<string, RefData>();

    for (const order of ordersData) {
      const orderNumber = order.header.noPiece || order.header.noDemande || order.header.reference || order.id;
      
      for (const line of order.lines) {
        const ref = line.reference.trim();
        const qty = typeof line.qte === 'number' ? Math.round(line.qte) : 0;
        const brand = line.brand || 'Sans marque';
        const designation = line.designation || '';
        const emplacement = line.emplacement || '';

        if (ref === '') continue;

        if (!refs.has(ref)) {
          refs.set(ref, {
            totalQty: 0,
            mainBrand: brand,
            mainDesignation: designation,
            mainEmplacement: emplacement,
            orders: new Map(),
            brands: new Map(),
          });
        }

        const data = refs.get(ref)!;
        data.totalQty += qty;
        
        if (data.mainBrand === 'Sans marque' && brand !== 'Sans marque') {
          data.mainBrand = brand;
        }
        if (!data.mainDesignation && designation) {
          data.mainDesignation = designation;
        }
        if (!data.mainEmplacement && emplacement) {
          data.mainEmplacement = emplacement;
        }

        const existingOrder = data.orders.get(orderNumber);
        if (existingOrder) {
          existingOrder.qty += qty;
        } else {
          data.orders.set(orderNumber, { qty, client: order.header.client || 'Client inconnu' });
        }

        data.brands.set(brand, (data.brands.get(brand) || 0) + qty);
      }
    }

    setRefData(refs);
  }, []);

  const sortedRefs = useMemo(() => {
    const entries = [...refData.entries()];
    entries.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'reference':
          cmp = a[0].localeCompare(b[0]);
          break;
        case 'brand':
          cmp = a[1].mainBrand.localeCompare(b[1].mainBrand);
          break;
        case 'designation':
          cmp = a[1].mainDesignation.localeCompare(b[1].mainDesignation);
          break;
        case 'emplacement':
          cmp = a[1].mainEmplacement.localeCompare(b[1].mainEmplacement);
          break;
        case 'totalQty':
          cmp = a[1].totalQty - b[1].totalQty;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return entries.filter(([ref, data]) => {
      const letter = getFirstLetter(data.mainEmplacement);
      const section = getSection(data.mainEmplacement);
      const row = getRow(data.mainEmplacement);
      const level = getLevel(data.mainEmplacement);

      if (empFilter.size > 0 && !empFilter.has(letter)) return false;
      
      const letterSections = empSectionsByLetter.get(letter) || new Set();
      if (letterSections.size > 0 && section && !letterSections.has(section)) return false;
      
      const letterRows = empRowsByLetter.get(letter) || new Set();
      if (letterRows.size > 0 && row && !letterRows.has(row)) return false;
      
      const letterLevels = empLevelsByLetter.get(letter) || new Set();
      if (letterLevels.size > 0 && level && !letterLevels.has(level)) return false;

      if (filterEmplacement && data.mainEmplacement !== filterEmplacement) return false;
      if (filterDesignation && data.mainDesignation !== filterDesignation) return false;
      if (filterBrand && !data.brands.has(filterBrand)) return false;
      if (filterQtyMin && data.totalQty < parseInt(filterQtyMin)) return false;
      if (filterQtyMax && data.totalQty > parseInt(filterQtyMax)) return false;
      
      if (filterClient) {
        let hasClient = false;
        data.orders.forEach((v) => {
          if (v.client.toLowerCase().includes(filterClient.toLowerCase())) hasClient = true;
        });
        if (!hasClient) return false;
      }
      
      if (filterOrder) {
        let hasOrder = false;
        data.orders.forEach((_, num) => {
          if (num === filterOrder) hasOrder = true;
        });
        if (!hasOrder) return false;
      }
      
      return true;
    });
  }, [refData, sortKey, sortDir, filterEmplacement, filterDesignation, filterClient, filterBrand, filterOrder, filterQtyMin, filterQtyMax, empFilter, empSectionsByLetter, empRowsByLetter, empLevelsByLetter, availableSectionsByLetter, availableRowsByLetter, availableLevelsByLetter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

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
            designation: line.designation,
            quantity: line.qte,
            brand: line.brand,
            client: order.header.client,
            orderNumber,
            emplacement: line.emplacement,
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

  const clearFilters = () => {
    setFilterEmplacement('');
    setFilterDesignation('');
    setFilterClient('');
    setFilterBrand('');
    setFilterOrder('');
    setFilterQtyMin('');
    setFilterQtyMax('');
    setEmpFilter(new Set());
    setEmpSectionsByLetter(new Map());
    setEmpRowsByLetter(new Map());
    setEmpLevelsByLetter(new Map());
  };

  const hasFilters = filterEmplacement || filterDesignation || filterClient || filterBrand || filterOrder || filterQtyMin || filterQtyMax || empFilter.size > 0 || empSectionsByLetter.size > 0 || empRowsByLetter.size > 0 || empLevelsByLetter.size > 0;

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
                <Button className="w-full" onClick={handleDownload} disabled={refData.size === 0}>Télécharger PDF</Button>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
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
                <div className="text-sm font-medium">Références uniques: {sortedRefs.length}{refData.size !== sortedRefs.length && ` (${refData.size} total)`}</div>
              </div>
              <div className="w-1/3 text-right">
                <div className="text-sm">Sélectionnées: {selectedRows.size} référence(s)</div>
              </div>
            </div>

            <div className="mb-4">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {showFilters ? 'Masquer' : 'Afficher'} les filtres
                {hasFilters && <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 text-xs">!</span>}
              </Button>
            </div>

            {showFilters && (
              <div className="mb-6 p-5 bg-gradient-to-br from-muted/40 to-muted/20 rounded-xl border border-border/60 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                      <Filter className="h-4 w-4" />
                    </div>
                    <span className="text-base font-bold text-foreground">Filtres Avancés</span>
                  </div>
                  {hasFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
                      Effacer tout
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Emplacement</label>
                    <select
                      value={filterEmplacement}
                      onChange={(e) => setFilterEmplacement(e.target.value)}
                      className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Tous</option>
                      {allEmplacements.map((emp) => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Désignation</label>
                    <select
                      value={filterDesignation}
                      onChange={(e) => setFilterDesignation(e.target.value)}
                      className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Tous</option>
                      {allDesignations.map((d) => (
                        <option key={d} value={d}>{d.substring(0, 35)}{d.length > 35 ? '...' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Client</label>
                    <select
                      value={filterClient}
                      onChange={(e) => setFilterClient(e.target.value)}
                      className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Tous</option>
                      {allClients.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Marque</label>
                    <select
                      value={filterBrand}
                      onChange={(e) => setFilterBrand(e.target.value)}
                      className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Tous</option>
                      {allBrands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">N° Commande</label>
                    <select
                      value={filterOrder}
                      onChange={(e) => setFilterOrder(e.target.value)}
                      className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Tous</option>
                      {allOrders.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Quantité</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Min"
                        type="number"
                        value={filterQtyMin}
                        onChange={(e) => setFilterQtyMin(e.target.value)}
                        className="h-10 text-sm rounded-lg border border-input bg-background px-3 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <Input
                        placeholder="Max"
                        type="number"
                        value={filterQtyMax}
                        onChange={(e) => setFilterQtyMax(e.target.value)}
                        className="h-10 text-sm rounded-lg border border-input bg-background px-3 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                {allLetters.length > 0 && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">Emplacement</span>
                        {(empFilter.size > 0 || empSectionsByLetter.size > 0 || empRowsByLetter.size > 0 || empLevelsByLetter.size > 0) && (
                          <div className="flex gap-1.5">
                            {empFilter.size > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                Lettres: {Array.from(empFilter).sort().join(', ')}
                              </span>
                            )}
                            {empSectionsByLetter.size > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Sections: {empSectionsByLetter.size}
                              </span>
                            )}
                            {empRowsByLetter.size > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                Rangées: {empRowsByLetter.size}
                              </span>
                            )}
                            {empLevelsByLetter.size > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                Niveaux: {empLevelsByLetter.size}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {allLetters.map((letter) => {
                        const isActive = empFilter.has(letter);
                        const letterCount = (availableSectionsByLetter.get(letter)?.size || 0) + 
                                          (availableRowsByLetter.get(letter)?.size || 0) + 
                                          (availableLevelsByLetter.get(letter)?.size || 0);
                        return (
                          <button
                            key={letter}
                            onClick={() => toggleEmpLetter(letter)}
                            className={`relative px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                              isActive
                                ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                                : 'bg-card hover:bg-secondary text-foreground border border-border hover:border-primary/50 shadow-sm'
                            }`}
                          >
                            {letter}
                            {!isActive && letterCount > 0 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] bg-muted-foreground/20 rounded-full flex items-center justify-center">
                                {letterCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {Array.from(empFilter).sort().map((letter) => {
                      const letterSections = availableSectionsByLetter.get(letter) || new Set();
                      const letterRows = availableRowsByLetter.get(letter) || new Set();
                      const letterLevels = availableLevelsByLetter.get(letter) || new Set();

                      return (
                        <div key={letter} className="mb-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">
                              {letter}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {letterSections.size} section{letterSections.size !== 1 ? 's' : ''} · {letterRows.size} rangée{letterRows.size !== 1 ? 's' : ''} · {letterLevels.size} niveau{letterLevels.size !== 1 ? 'x' : ''}
                            </span>
                          </div>
                          
                          {letterSections.size > 0 && (
                            <div className="mb-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                <span className="text-xs font-semibold text-green-700">Section (2ème)</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(letterSections).sort().map((s) => {
                                  const currentSections = empSectionsByLetter.get(letter) || new Set();
                                  const isActive = currentSections.has(s);
                                  return (
                                    <button
                                      key={s}
                                      onClick={() => {
                                        const next = new Set(currentSections);
                                        if (next.has(s)) next.delete(s);
                                        else next.add(s);
                                        setEmpSectionsByLetter(prev => new Map(prev).set(letter, next));
                                        setEmpRowsByLetter(prev => new Map(prev).set(letter, new Set()));
                                        setEmpLevelsByLetter(prev => new Map(prev).set(letter, new Set()));
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                                        isActive
                                          ? 'bg-green-500 text-white shadow-sm'
                                          : 'bg-card hover:bg-green-50 text-foreground border border-border hover:border-green-300'
                                      }`}
                                    >
                                      {s}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {letterRows.size > 0 && letterSections.size === 0 && (
                            <div className="mb-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                <span className="text-xs font-semibold text-orange-700">Rangée (3ème)</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(letterRows).sort().map((r) => {
                                  const currentRows = empRowsByLetter.get(letter) || new Set();
                                  const isActive = currentRows.has(r);
                                  return (
                                    <button
                                      key={r}
                                      onClick={() => {
                                        const next = new Set(currentRows);
                                        if (next.has(r)) next.delete(r);
                                        else next.add(r);
                                        setEmpRowsByLetter(prev => new Map(prev).set(letter, next));
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                                        isActive
                                          ? 'bg-orange-500 text-white shadow-sm'
                                          : 'bg-card hover:bg-orange-50 text-foreground border border-border hover:border-orange-300'
                                      }`}
                                    >
                                      {r}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {letterLevels.size > 0 && letterSections.size === 0 && letterRows.size === 0 && (
                            <div className="mb-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                <span className="text-xs font-semibold text-purple-700">Niveau (4ème)</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(letterLevels).sort().map((l) => {
                                  const currentLevels = empLevelsByLetter.get(letter) || new Set();
                                  const isActive = currentLevels.has(l);
                                  return (
                                    <button
                                      key={l}
                                      onClick={() => {
                                        const next = new Set(currentLevels);
                                        if (next.has(l)) next.delete(l);
                                        else next.add(l);
                                        setEmpLevelsByLetter(prev => new Map(prev).set(letter, next));
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                                        isActive
                                          ? 'bg-purple-500 text-white shadow-sm'
                                          : 'bg-card hover:bg-purple-50 text-foreground border border-border hover:border-purple-300'
                                      }`}
                                    >
                                      {l}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
                          <th className="px-3 py-2">Désignation</th>
                          <th className="px-3 py-2">Emplacement</th>
                          <th className="px-3 py-2">Marque</th>
                          <th className="px-3 py-2">N° Commande</th>
                          <th className="px-3 py-2">Client</th>
                          <th className="px-3 py-2">Qté</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalResults.map((p, index) => {
                          const ref = p.reference.trim();
                          const data = refData.get(ref);
                          return (
                            <tr key={`${ref}-${index}`} className="border-t">
                              <td className="px-3 py-2">
                                <Checkbox checked={selectedRows.has(ref)} onCheckedChange={() => toggleRow(ref)} />
                              </td>
                              <td className="px-3 py-2 font-mono text-sm">{ref}</td>
                              <td className="px-3 py-2 text-sm max-w-[200px] truncate">{p.designation || '-'}</td>
                              <td className="px-3 py-2 text-sm">{p.emplacement || '-'}</td>
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
                {sortedRefs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucune donnée.</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-muted-foreground">
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort('reference')}>
                          Référence <SortIcon column="reference" />
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort('designation')}>
                          Désignation <SortIcon column="designation" />
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort('emplacement')}>
                          Emplacement <SortIcon column="emplacement" />
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort('brand')}>
                          Marque <SortIcon column="brand" />
                        </th>
                        <th className="px-3 py-2 text-right cursor-pointer hover:text-foreground" onClick={() => toggleSort('totalQty')}>
                          Total <SortIcon column="totalQty" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRefs.map(([ref, data]) => {
                        const isExpanded = expandedRef === ref;
                        const orders = [...data.orders.entries()].sort((a, b) => b[1].qty - a[1].qty);
                        const brands = [...data.brands.entries()].sort((a, b) => b[1] - a[1]);
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
                              <td className="px-3 py-2 text-sm max-w-[200px] truncate cursor-pointer" onClick={() => toggleExpand(ref)} title={data.mainDesignation}>{data.mainDesignation || '-'}</td>
                              <td className="px-3 py-2 text-sm cursor-pointer" onClick={() => toggleExpand(ref)}>{data.mainEmplacement || '-'}</td>
                              <td className="px-3 py-2 text-sm cursor-pointer" onClick={() => toggleExpand(ref)}>{data.mainBrand}</td>
                              <td className="px-3 py-2 text-right font-medium">{data.totalQty}</td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={7} className="p-0 bg-muted/10">
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
                                          {orders.map(([orderNum, d]) => (
                                            <tr key={orderNum} className="border-t">
                                              <td className="py-1">{orderNum}</td>
                                              <td className="py-1 text-sm">{d.client}</td>
                                              <td className="py-1 text-right">{d.qty}</td>
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
                        const data = refData.get(ref);
                        return (
                          <tr key={ref} className="border-t">
                            <td className="px-3 py-2">
                              <Checkbox checked={true} onCheckedChange={() => toggleRow(ref)} />
                            </td>
                            <td className="px-3 py-2 font-mono text-sm">{ref}</td>
                            <td className="px-3 py-2 text-right">{data?.totalQty ?? 0}</td>
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