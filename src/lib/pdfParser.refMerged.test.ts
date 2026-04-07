import { buildLineFromRowItems } from './pdfParser';

interface TI { str: string; x: number; y: number; page: number }

test('splits merged reference+designation when both ended in reference column', () => {
  // All tokens are positioned near the reference column, so they would be
  // combined into reference by simple column assignment. Parser should split.
  const items: TI[] = [
    { str: '930756', x: 150, y: 100, page: 1 },
    { str: 'CRAYON', x: 170, y: 100, page: 1 },
    { str: 'INNER', x: 200, y: 100, page: 1 },
    { str: 'EYE', x: 230, y: 100, page: 1 },
    { str: 'BRIGHTENING', x: 260, y: 100, page: 1 },
    { str: '12', x: 400, y: 100, page: 1 },
  ];

  const line = buildLineFromRowItems(items as any);
  expect(line).not.toBeNull();
  expect(line!.reference).toBe('930756');
  expect(line!.designation).toEqual(expect.stringContaining('CRAYON'));
  expect(line!.qte).toBe(12);
});
