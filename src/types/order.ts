export interface OrderHeader {
  noPiece: string;
  noDemande?: string;
  // Detected document type (e.g. 'preparation', 'valorise', 'reliquat')
  docType?: string;
  // Raw title text found at the top of the PDF
  title?: string;
  // For reliquat documents, extracted source/order number (e.g. PL26002945)
  sourceOrderNumber?: string;
  reference: string;
  date: string;
  dateLivraison: string;
  statut: string;
  client: string;
  code: string;
  adresseLivraison: string;
  depot: string;
  depotSource?: string;
  depotDestination?: string;
  preparateur: string;
}

export interface OrderLine {
  codeABarre: string;
  reference: string;
  designation: string;
  qte: number;
  emplacement: string;
  stock: number;
  // Optional total price (TTC) for valorisé documents
  ttc?: number;
  // Optional missing quantity for reliquat documents
  reliquat?: number;
  brand?: string;
  carton_Qte?: number;
  qte_prepared?: number;
  // Flexible metadata for extra fields
  meta?: Record<string, unknown>;
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
