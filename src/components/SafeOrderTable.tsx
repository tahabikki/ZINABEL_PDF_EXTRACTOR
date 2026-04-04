import React, { useState } from 'react';
import type { OrderLine } from '@/types/order';
import OrderTable from './OrderTable';

interface SafeOrderTableProps {
  lines: OrderLine[];
}

/**
 * SafeOrderTable wraps OrderTable with additional error handling for mobile
 * Gracefully handles rendering errors by retrying or showing a minimal UI
 */
const SafeOrderTable: React.FC<SafeOrderTableProps> = ({ lines }) => {
  const [renderError, setRenderError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Guard against invalid input
  if (!lines || !Array.isArray(lines)) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        <p>Aucune donnée de tableau à afficher</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        <p>Pas de lignes à afficher</p>
      </div>
    );
  }

  if (renderError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          Une erreur d'affichage s'est produite
        </p>
        <button
          onClick={() => {
            setRenderError(false);
            setRetryCount(c => c + 1);
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Réessayer
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginLeft: '10px',
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Recharger
        </button>
      </div>
    );
  }

  try {
    return <OrderTable key={retryCount} lines={lines} />;
  } catch (err) {
    console.warn('SafeOrderTable render error:', err);
    setRenderError(true);
    return null;
  }
};

export default SafeOrderTable;
