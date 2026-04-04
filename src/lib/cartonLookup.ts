/**
 * Carton quantity and brand lookup module.
 * Loads carton_Qte.json and provides reference-based lookups.
 */

interface CartonData {
  reference: string;
  carton_Qte: number;
  brand: string;
}

let cartonCache: Map<string, CartonData> | null = null;

/**
 * Load carton data from the public folder.
 */
export async function loadCartonData(): Promise<Map<string, CartonData>> {
  if (cartonCache) return cartonCache;

  try {
    const response = await fetch('/data/carton_Qte.json');
    if (!response.ok) {
      console.warn('Failed to load carton data:', response.status);
      return new Map();
    }

    const data: CartonData[] = await response.json();
    cartonCache = new Map();

    for (const item of data) {
      // Normalize reference: remove '#' prefix if present
      const ref = (item.reference || '').replace(/^#/, '').trim();
      if (ref) {
        cartonCache.set(ref, item);
      }
    }

    console.log(`Loaded ${cartonCache.size} carton entries`);
    return cartonCache;
  } catch (error) {
    console.error('Error loading carton data:', error);
    return new Map();
  }
}

/**
 * Lookup carton info by reference.
 * Normalizes the reference (removes '#' prefix).
 */
export async function lookupCartonByReference(reference: string): Promise<{
  brand?: string;
  carton_Qte?: number;
}> {
  const map = await loadCartonData();
  const ref = (reference || '').replace(/^#/, '').trim();
  const data = map.get(ref);

  if (data) {
    return {
      brand: data.brand,
      carton_Qte: data.carton_Qte,
    };
  }

  return {};
}

/**
 * Enrich multiple lines with carton data.
 */
export async function enrichLinesWithCartonData(
  lines: Array<{ reference: string; brand?: string; carton_Qte?: number }>
): Promise<void> {
  const map = await loadCartonData();

  for (const line of lines) {
    const ref = (line.reference || '').replace(/^#/, '').trim();
    const data = map.get(ref);
    if (data) {
      line.brand = data.brand;
      line.carton_Qte = data.carton_Qte;
    }
  }
}
