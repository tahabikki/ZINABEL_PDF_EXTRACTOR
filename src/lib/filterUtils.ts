import type { OrderLine } from '@/types/order';

export type SimpleFilters = {
  brandFilter?: Set<string>;
  search?: string;
};

export function filterByBrand(lines: OrderLine[], brandFilter?: Set<string>) {
  if (!brandFilter || brandFilter.size === 0) return lines;
  return lines.filter((l) => brandFilter.has(l.brand || ''));
}

export function applySimpleFilters(lines: OrderLine[], filters: SimpleFilters) {
  let result = lines;
  if (filters.brandFilter && filters.brandFilter.size > 0) {
    result = filterByBrand(result, filters.brandFilter);
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter((l) =>
      String(l.codeABarre || '').toLowerCase().includes(q) ||
      String(l.reference || '').toLowerCase().includes(q) ||
      String(l.designation || '').toLowerCase().includes(q) ||
      String(l.emplacement || '').toLowerCase().includes(q) ||
      String(l.brand || '').toLowerCase().includes(q)
    );
  }

  return result;
}
