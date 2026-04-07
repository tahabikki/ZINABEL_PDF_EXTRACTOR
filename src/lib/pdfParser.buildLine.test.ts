import { buildLineFromRowItems } from './pdfParser';
import type { TextItem } from './pdfParser';

interface TI { str: string; x: number; y: number; page: number }

test('buildLineFromRowItems parses qte when token present in qte column', () => {
  // create synthetic row items matching DEFAULT_COLUMNS positions
  const items: TI[] = [
    { str: '1234567890123', x: 40, y: 100, page: 1 }, // barcode
    { str: 'REF-001', x: 150, y: 100, page: 1 },
    { str: 'Product name line1', x: 200, y: 102, page: 1 },
    { str: 'Product name line2', x: 200, y: 98, page: 1 },
    { str: '5', x: 400, y: 100, page: 1 }, // qte
    { str: 'A - Sec1 - R1 - L1', x: 460, y: 100, page: 1 },
    { str: '10', x: 540, y: 100, page: 1 },
  ];

  const line = buildLineFromRowItems(items as unknown as TextItem[]);
  expect(line).not.toBeNull();
  expect(line!.qte).toBe(5);
  expect(line!.emptyCells.qte).toBe(false);
});
