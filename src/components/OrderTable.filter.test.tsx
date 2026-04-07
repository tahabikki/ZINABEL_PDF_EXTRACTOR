import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { applySimpleFilters } from '../lib/filterUtils';
import OrderTable from './OrderTable';

const sampleLines = [
  {
    codeABarre: '111',
    reference: 'REF1',
    designation: 'Apple',
    qte: 2,
    emplacement: 'A - Sec1 - R1 - L1',
    stock: 10,
    ttc: 5,
    brand: 'BrandA',
    emptyCells: { stock: false, codeABarre: false, emplacement: false },
    hasEmptyCell: false,
    cartonQte: 1,
  },
  {
    codeABarre: '222',
    reference: 'REF2',
    designation: 'Banana',
    qte: 3,
    emplacement: 'B - Sec2 - R2 - L2',
    stock: 0,
    ttc: 7,
    brand: 'BrandB',
    emptyCells: { stock: false, codeABarre: false, emplacement: false },
    hasEmptyCell: false,
    cartonQte: 1,
  },
  {
    codeABarre: '333',
    reference: 'REF3',
    designation: 'Cucumber',
    qte: 1,
    emplacement: 'A - Sec1 - R3 - L1',
    stock: -1,
    ttc: 10,
    brand: 'BrandA',
    emptyCells: { stock: false, codeABarre: false, emplacement: false },
    hasEmptyCell: false,
    cartonQte: 1,
  },
];

test('brand filter updates visible rows (pure function)', () => {
  // no filters -> all lines
  const all = applySimpleFilters(sampleLines, {});
  expect(all.length).toBe(3);

  // brand filter BrandA -> Apple + Cucumber
  const res = applySimpleFilters(sampleLines, { brandFilter: new Set(['BrandA']) });
  const names = res.map((r) => r.designation).sort();
  expect(names).toEqual(['Apple', 'Cucumber']);

  // BrandB only -> Banana
  const resB = applySimpleFilters(sampleLines, { brandFilter: new Set(['BrandB']) });
  expect(resB.map((r) => r.designation)).toEqual(['Banana']);
});

test('OrderTable UI brand filter updates table rows', () => {
  render(<OrderTable lines={sampleLines} />);

  // initial rows present
  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('Banana')).toBeInTheDocument();

  // click BrandA filter button (button text includes count)
  const brandBtn = screen.getByRole('button', { name: /BrandA/i });
  fireEvent.click(brandBtn);

  // Banana should be filtered out; BrandA items remain
  expect(screen.queryByText('Banana')).toBeNull();
  expect(screen.getByText('Apple')).toBeInTheDocument();
});
