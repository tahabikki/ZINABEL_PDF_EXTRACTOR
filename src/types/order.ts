export interface OrderHeader {
  noPiece: string;
  reference: string;
  date: string;
  dateLivraison: string;
  statut: string;
  client: string;
  code: string;
  adresseLivraison: string;
  depot: string;
  preparateur: string;
}

export interface OrderLine {
  codeABarre: string;
  reference: string;
  designation: string;
  qte: number;
  emplacement: string;
  stock: number;
  emptyCells: {
    codeABarre: boolean;
    reference: boolean;
    designation: boolean;
    qte: boolean;
    emplacement: boolean;
    stock: boolean;
  };
  hasEmptyCell: boolean;
}

export interface ParsedOrder {
  id: string;
  fileName: string;
  header: OrderHeader;
  lines: OrderLine[];
  totalQty: number;
  totalItems: number;
}
