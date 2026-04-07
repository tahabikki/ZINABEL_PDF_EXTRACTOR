import React from 'react';
import { render, screen } from '@testing-library/react';
import SafeOrderTable from './SafeOrderTable';

const lines = [
  {
    codeABarre: '111',
    reference: 'REF1',
    designation: 'Item1',
    qte: 1,
    emplacement: 'A - 1 - 1 - 1',
    stock: 0,
    emptyCells: { codeABarre: false, reference: false, designation: false, qte: false, emplacement: false, stock: false },
    hasEmptyCell: false,
  },
];

const order: any = {
  id: 'o1',
  fileName: 'file.pdf',
  header: {
    docType: 'reliquat',
    title: '',
    sourceOrderNumber: 'PL26002945',
    reference: 'REF1',
    date: '',
    dateLivraison: '',
    statut: '',
    client: '',
    code: '',
    adresseLivraison: '',
    depot: '',
    preparateur: '',
  },
  lines,
  totalQty: 1,
  totalItems: 1,
};

test('SafeOrderTable hides Emplacement and Stock columns for reliquat PDFs', () => {
  render(<SafeOrderTable lines={lines} order={order} />);

  expect(screen.queryByText('Emplacement')).toBeNull();
  expect(screen.queryByText('Stock')).toBeNull();
});
