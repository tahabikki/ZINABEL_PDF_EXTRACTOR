import React, { useMemo, useState } from 'react';
import type { OrderLine } from '@/types/order';

function splitParts(emplacement: string) {
  const parts = emplacement.split(/\s*-\s*/).map((p) => p.trim());
  return {
    letter: parts[0] || '',
    section: parts[1] || '',
    row: parts[2] || '',
    level: parts[3] || '',
  };
}

export default function EmplacementGrid({ lines }: { lines: OrderLine[] }) {
  const parsed = useMemo(() => {
    const map = new Map<string, { emplacement: string; count: number; letter: string; section: string; row: string; level: string }>();
    for (const l of lines) {
      const e = (l.emplacement || '').trim();
      if (!e) continue;
      if (!map.has(e)) map.set(e, { emplacement: e, count: 0, letter: '', section: '', row: '', level: '' });
      const prev = map.get(e)!;
      prev.count += 1;
    }
    for (const [empl, obj] of map.entries()) {
      const parts = splitParts(empl);
      map.set(empl, { emplacement: empl, count: obj.count, letter: parts.letter.toUpperCase(), section: parts.section, row: parts.row, level: parts.level });
    }
    return Array.from(map.values());
  }, [lines]);

  const letterStats = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of parsed) {
      const l = p.letter || '';
      if (!l) continue;
      m.set(l, (m.get(l) || 0) + p.count);
    }
    return m;
  }, [parsed]);

  const uniqueLetters = useMemo(() => Array.from(letterStats.keys()).sort((a, b) => a.localeCompare(b, 'fr-FR', { sensitivity: 'base' })), [letterStats]);

  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());

  const toggleLetter = (letter: string) => setSelectedLetter((prev) => (prev === letter ? null : letter));

  const resetFilters = () => {
    setSelectedLetter(null);
    setSelectedSections(new Set());
    setSelectedRows(new Set());
    setSelectedLevels(new Set());
  };

  const sectionsForLetter = useMemo(() => {
    const s = new Set<string>();
    for (const p of parsed) if (!selectedLetter || p.letter === selectedLetter) if (p.section) s.add(p.section);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr-FR'));
  }, [parsed, selectedLetter]);

  const rowsForSelection = useMemo(() => {
    const s = new Set<string>();
    for (const p of parsed) {
      if (selectedLetter && p.letter !== selectedLetter) continue;
      if (selectedSections.size > 0 && !selectedSections.has(p.section)) continue;
      if (p.row) s.add(p.row);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr-FR'));
  }, [parsed, selectedLetter, selectedSections]);

  const levelsForSelection = useMemo(() => {
    const s = new Set<string>();
    for (const p of parsed) {
      if (selectedLetter && p.letter !== selectedLetter) continue;
      if (selectedSections.size > 0 && !selectedSections.has(p.section)) continue;
      if (selectedRows.size > 0 && !selectedRows.has(p.row)) continue;
      if (p.level) s.add(p.level);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr-FR'));
  }, [parsed, selectedLetter, selectedSections, selectedRows]);

  const toggleSet = (s: Set<string>, v: string, setter: (s: Set<string>) => void) => {
    const next = new Set(s);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setter(next);
  };

  const displayedEmplacements = useMemo(() => {
    return parsed
      .filter((p) => (selectedLetter ? p.letter === selectedLetter : true))
      .filter((p) => (selectedSections.size > 0 ? selectedSections.has(p.section) : true))
      .filter((p) => (selectedRows.size > 0 ? selectedRows.has(p.row) : true))
      .filter((p) => (selectedLevels.size > 0 ? selectedLevels.has(p.level) : true))
      .sort((a, b) => a.emplacement.localeCompare(b.emplacement, 'fr-FR'));
  }, [parsed, selectedLetter, selectedSections, selectedRows, selectedLevels]);

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3 mb-4">
        {uniqueLetters.map((letter) => (
          <button
            key={letter}
            onClick={() => toggleLetter(letter)}
            className={`rounded-xl p-3 text-center border transition ${selectedLetter === letter ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'}`}
          >
            <div className="text-lg font-black">{letter}</div>
            <div className="text-[12px] text-muted-foreground mt-1">{letterStats.get(letter) || 0} articles</div>
          </button>
        ))}
      </div>

      {selectedLetter && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={resetFilters} className="text-sm px-3 py-1 rounded-full border border-border bg-card text-muted-foreground">
              Réinitialiser
            </button>
            <div className="text-sm text-muted-foreground">Filtrer {selectedLetter}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">Section (2ème)</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {sectionsForLetter.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSet(selectedSections, s, setSelectedSections)}
                  className={`text-sm px-3 py-1 rounded-full border transition ${selectedSections.has(s) ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground mb-2">Row (3ème)</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {rowsForSelection.map((r) => (
                <button
                  key={r}
                  onClick={() => toggleSet(selectedRows, r, setSelectedRows)}
                  className={`text-sm px-3 py-1 rounded-full border transition ${selectedRows.has(r) ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'}`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground mb-2">Level (4ème)</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {levelsForSelection.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => toggleSet(selectedLevels, lvl, setSelectedLevels)}
                  className={`text-sm px-3 py-1 rounded-full border transition ${selectedLevels.has(lvl) ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayedEmplacements.map((it) => (
              <div key={it.emplacement} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">{it.letter}</div>
                <div className="font-mono text-sm font-bold truncate">{it.emplacement}</div>
                <div className="text-[10px] text-muted-foreground mt-2">Articles: {it.count}</div>
              </div>
            ))}
            {displayedEmplacements.length === 0 && <div className="col-span-full text-center py-8 text-muted-foreground">Aucun emplacement</div>}
          </div>
        </div>
      )}
    </div>
  );
}
