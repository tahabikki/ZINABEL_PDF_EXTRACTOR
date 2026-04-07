import { buildLineFromRowItems } from './pdfParser';
import type { TextItem } from './pdfParser';

interface TI { str: string; x: number; y: number; page: number }

test('does not pick stock value as qte when qte column is empty', () => {
  const items: TI[] = [
    { str: '1234567890123', x: 40, y: 100, page: 1 }, // barcode
    { str: 'REF-003', x: 150, y: 100, page: 1 },
    { str: 'Product X', x: 200, y: 100, page: 1 },
    // stock in stock column
    { str: '10', x: 540, y: 100, page: 1 },
  ];

  const line = buildLineFromRowItems(items as unknown as TextItem[]);
  expect(line).not.toBeNull();
  // qte should remain empty (no digits near qte column)
  expect(line!.emptyCells.qte).toBe(true);
  expect(line!.qte).toBe(0);
  // stock should be detected
  expect(line!.emptyCells.stock).toBe(false);
  expect(line!.stock).toBe(10);
});

test('treats dash/en-dash as empty qte', () => {
  const items: TI[] = [
    { str: '1234567890123', x: 40, y: 100, page: 1 },
    { str: 'REF-004', x: 150, y: 100, page: 1 },
    { str: 'Product Y', x: 200, y: 100, page: 1 },
    { str: '—', x: 400, y: 100, page: 1 }, // dash in qte column
  ];

  const line = buildLineFromRowItems(items as unknown as TextItem[]);
  expect(line).not.toBeNull();
  expect(line!.emptyCells.qte).toBe(true);
  expect(line!.qte).toBe(0);
});
