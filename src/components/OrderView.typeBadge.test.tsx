import React from 'react';
import { render, screen } from '@testing-library/react';
import OrderView from './OrderView';
import type { ParsedOrder } from '@/types/order';

const mockOrder: ParsedOrder = {
  id: 'o1',
  fileName: 'file.pdf',
  header: {
    reference: 'REF1',
    noPiece: 'NP1',
    docType: 'reliquat',
    title: '',
    sourceOrderNumber: 'PL26002945',
    client: '',
    date: '',
    dateLivraison: '',
    statut: '',
    code: '',
    adresseLivraison: '',
    depot: '',
    preparateur: '',
  },
  lines: [
    {
      codeABarre: '',
      reference: 'REF1',
      designation: 'Item1',
      qte: 1,
      emplacement: '',
      stock: 0,
      emptyCells: { codeABarre: false, reference: false, designation: false, qte: false, emplacement: false, stock: false },
      hasEmptyCell: false,
    },
  ],
  totalQty: 1,
  totalItems: 1,
};

test('OrderView shows constructed reliquat title and has a colored badge', () => {
  const { container } = render(<OrderView order={mockOrder} />);

  // Display title should include the source order number
  expect(screen.getByText(/Reliquat de commande N° PL26002945/)).toBeInTheDocument();

  // There should be a badge element with a colour class for reliquat (bg-rose-100)
  expect(container.querySelector('.bg-rose-100')).not.toBeNull();
});
