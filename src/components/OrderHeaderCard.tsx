import React from 'react';
import type { OrderHeader } from '@/types/order';

interface OrderHeaderCardProps {
  header: OrderHeader;
}

const OrderHeaderCard: React.FC<OrderHeaderCardProps> = ({ header }) => {
  const leftFields = [
    { label: 'N° Pièce', value: header.noPiece },
    { label: 'N° Demande', value: header.noDemande },
    { label: 'Référence', value: header.reference },
    { label: 'Date', value: header.date },
    { label: 'Date livraison', value: header.dateLivraison },
    { label: 'Statut', value: header.statut },
  ];

  const rightFields = [
    { label: 'Client', value: header.client },
    { label: 'Code', value: header.code },
    { label: 'Adresse livraison', value: header.adresseLivraison },
    { label: 'Dépôt', value: header.depot },
    { label: 'Dépôt source', value: header.depotSource },
    { label: 'Dépôt destination', value: header.depotDestination },
    { label: 'Préparateur', value: header.preparateur || '—' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-table-border rounded-lg overflow-hidden">
      {/* Left column */}
      <div className="border-r border-table-border">
        {leftFields.map((f) => (
          <div key={f.label} className="flex border-b border-table-border last:border-b-0">
            <div className="w-36 shrink-0 bg-table-header px-3 py-2 text-xs font-semibold text-foreground">
              {f.label}
            </div>
            <div className="px-3 py-2 text-sm text-foreground flex-1 font-mono">
              {f.value || '—'}
            </div>
          </div>
        ))}
      </div>
      {/* Right column */}
      <div>
        {rightFields.map((f) => (
          <div key={f.label} className="flex border-b border-table-border last:border-b-0">
            <div className="w-36 shrink-0 bg-table-header px-3 py-2 text-xs font-semibold text-foreground">
              {f.label}
            </div>
            <div className="px-3 py-2 text-sm text-foreground flex-1">
              {f.value || '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderHeaderCard;
