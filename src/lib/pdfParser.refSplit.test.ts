import { buildLineFromRowItems } from './pdfParser';
import type { TextItem } from './pdfParser';

interface TI { str: string; x: number; y: number; page: number }

test('splits leading reference token from merged designation', () => {
  // Simulate row where reference and designation got merged into designation tokens
  const items: TI[] = [
    // no barcode
    { str: '930756', x: 160, y: 100, page: 1 },
    { str: 'CRAYON', x: 220, y: 100, page: 1 },
    { str: 'INNER', x: 300, y: 100, page: 1 },
    { str: 'EYE', x: 360, y: 100, page: 1 },
    { str: 'BRIGHTENING', x: 420, y: 100, page: 1 },
    { str: '10', x: 400, y: 100, page: 1 }, // qte
  ];

  const line = buildLineFromRowItems(items as unknown as TextItem[]);
  expect(line).not.toBeNull();
  expect(line!.reference).toBe('930756');
  expect(line!.designation).toEqual(expect.stringContaining('CRAYON'));
  expect(line!.qte).toBe(10);
});
