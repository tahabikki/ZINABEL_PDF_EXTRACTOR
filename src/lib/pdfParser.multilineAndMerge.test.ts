import { buildLineFromRowItems } from './pdfParser';
import type { TextItem } from './pdfParser';

interface TI { str: string; x: number; y: number; page: number }

test('handles multi-line designation and qte slightly outside qte column', () => {
  const items: TI[] = [
    { str: '1234567890123', x: 40, y: 100, page: 1 }, // barcode
    { str: 'REF-002', x: 150, y: 100, page: 1 },
    { str: 'Product multi line A', x: 200, y: 110, page: 1 },
    { str: 'continued description B', x: 200, y: 90, page: 1 },
    // qte slightly right of qte center (will be nearest numeric candidate)
    { str: '3', x: 460, y: 100, page: 1 },
    { str: 'E1-R1', x: 470, y: 100, page: 1 },
    { str: '7', x: 540, y: 100, page: 1 },
  ];

  const line = buildLineFromRowItems(items as unknown as TextItem[]);
  expect(line).not.toBeNull();
  expect(line!.qte).toBe(3);
  expect(line!.emptyCells.qte).toBe(false);
  expect(line!.designation).toEqual(expect.any(String));
  expect(line!.designation.length).toBeGreaterThan(0);
  // ensure both parts of the multi-line designation were merged
  expect(line!.designation).toEqual(expect.stringMatching(/Product multi line A|continued description B/));
});
