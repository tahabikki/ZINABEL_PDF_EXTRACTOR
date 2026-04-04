import React, { memo } from 'react';
import type { OrderLine } from '@/types/order';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface TableRowProps {
  line: OrderLine;
  id: string;
  isSelected: boolean;
  isValidated: boolean;
  getRowClass: (stock: number, hasEmptyCell: boolean) => string;
  onRowClick: (e: React.MouseEvent, id: string) => void;
  onCheckboxChange: (id: string) => void;
}

/**
 * Memoized table row component to prevent unnecessary re-renders
 */
const TableRow = memo<TableRowProps>(
  ({
    line,
    id,
    isSelected,
    isValidated,
    getRowClass,
    onRowClick,
    onCheckboxChange,
  }) => {
    const handleCheckboxClick = (e: React.MouseEvent) => {
      e.stopPropagation();
    };

    const handleCheckboxChange = () => {
      onCheckboxChange(id);
    };

    return (
      <tr
        onClick={(e) => onRowClick(e, id)}
        className={cn(
          'border-b border-table-border last:border-b-0 transition-colors cursor-pointer duration-150 hover:bg-primary/3',
          getRowClass(line.stock, line.hasEmptyCell),
          isValidated ? 'ring-1 ring-primary/20 bg-primary/5' : ''
        )}
      >
        <td className="px-3 py-2 text-left border-r border-table-border w-12">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only"
              checked={isSelected}
              onChange={handleCheckboxChange}
              onClick={handleCheckboxClick}
              aria-label={`Select ${line.designation || 'row'}`}
            />
            <span
              className={cn(
                'h-5 w-5 rounded-sm flex items-center justify-center transition-all duration-100',
                isSelected
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'bg-white border border-border text-muted-foreground hover:border-emerald-400'
              )}
            >
              {isSelected && <Check className="h-3 w-3" />}
            </span>
          </label>
        </td>
        <td className={cn('px-3 py-2 text-left border-r border-table-border', line.emptyCells.codeABarre && 'bg-violet-100 text-violet-900')}>
          {line.codeABarre || (
            <span className="text-muted-foreground italic text-xs">—</span>
          )}
        </td>
        <td className={cn('px-3 py-2 text-left border-r border-table-border max-w-xs truncate', line.emptyCells.reference && 'bg-violet-100 text-violet-900')}>
          {line.reference || (
            <span className="text-muted-foreground italic text-xs">—</span>
          )}
        </td>
        <td className={cn('px-3 py-2 text-left border-r border-table-border max-w-sm truncate', line.emptyCells.designation && 'bg-violet-100 text-violet-900')}>
          {line.designation || (
            <span className="text-muted-foreground italic text-xs">—</span>
          )}
        </td>
        <td className={cn('px-3 py-2 text-right border-r border-table-border font-semibold', line.emptyCells.qte && 'bg-violet-100 text-violet-900')}>
          {!line.emptyCells.qte ? (
            `${Math.round(line.qte)}`
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )}
        </td>
        <td className={cn('px-3 py-2 text-left border-r border-table-border max-w-xs truncate', line.emptyCells.emplacement && 'bg-violet-100 text-violet-900')}>
          {line.emplacement || (
            <span className="text-muted-foreground italic text-xs">—</span>
          )}
        </td>
        <td className={cn('px-3 py-2 text-right font-bold', line.emptyCells.stock && 'bg-violet-100 text-violet-900')}>
          {!line.emptyCells.stock ? (
            <span
              className={cn(
                'inline-block px-2 py-0.5 rounded text-xs font-bold transition-colors duration-150',
                line.stock > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : line.stock === 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
              )}
            >
              {line.stock}
            </span>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )}
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for optimal memoization
    return (
      prevProps.id === nextProps.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isValidated === nextProps.isValidated &&
      prevProps.line === nextProps.line &&
      prevProps.getRowClass === nextProps.getRowClass
    );
  }
);

TableRow.displayName = 'TableRow';

export default TableRow;
