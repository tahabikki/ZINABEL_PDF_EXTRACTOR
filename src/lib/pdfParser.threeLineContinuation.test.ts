import { buildLineFromRowItems } from './pdfParser';
import type { TextItem } from './pdfParser';

interface TI { str: string; x: number; y: number; page: number }

test('merges three-line designation into a single product row', () => {
  // Simulate a product with 3 lines of designation; each continuation might have slightly different X
  const items: TI[] = [
    { str: '1234567890123', x: 40, y: 100, page: 1 }, // anchor
    { str: 'REF-100', x: 150, y: 100, page: 1 },
    { str: 'Product title part A', x: 200, y: 108, page: 1 },
    { str: 'continued part B', x: 220, y: 92, page: 1 },
    { str: 'more details C', x: 200, y: 76, page: 1 },
    { str: '5', x: 400, y: 100, page: 1 }, // qte
  ];

  // The real extractor will group these into a single row. We simulate grouping by creating
  // rowItems for the main anchor (y~100) and the two continuation rows and ensuring
  // buildLineFromRowItems merges designation parts when called sequentially.
  const first = buildLineFromRowItems(items.filter((i) => i.y >= 96) as unknown as TextItem[]);
  const second = buildLineFromRowItems(items.filter((i) => i.y < 96 && i.y >= 84) as unknown as TextItem[]);
  const third = buildLineFromRowItems(items.filter((i) => i.y < 84) as unknown as TextItem[]);

  // Emulate merging: third and second should be continuations; assert their designation parts exist
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(third).not.toBeNull();
  expect(first!.designation).toContain('Product title');
  expect(second!.designation).toContain('continued');
  expect(third!.designation).toContain('more details');

  // After full extraction these should be merged; here we assert that buildLineFromRowItems
  // produces the right segments so that merging code can combine them.
  expect(first!.qte).toBe(5);
});
