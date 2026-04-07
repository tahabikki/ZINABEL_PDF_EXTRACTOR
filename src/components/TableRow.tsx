import React, { memo } from 'react';
import type { OrderLine } from '@/types/order';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TableRowProps {
  line: OrderLine;
  id: string;
  isSelected: boolean;
  isValidated: boolean;
  getRowClass: (stock: number, hasEmptyCell: boolean) => string;
  onRowClick: (e: React.MouseEvent, id: string) => void;
  onCheckboxChange: (id: string) => void;
  qtePrepared: number;
  onQtePreparedChange: (rowId: string, value: number) => void;
  brandColor: string;
  compact?: boolean;
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
    qtePrepared,
    onQtePreparedChange,
    brandColor,
    compact,
  }) => {
    const { toast } = useToast();

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
        {!compact && (
          <td className={cn('px-3 py-2 text-left border-r border-table-border max-w-xs truncate', line.emptyCells.emplacement && 'bg-violet-100 text-violet-900')}>
            {line.emplacement || (
              <span className="text-muted-foreground italic text-xs">—</span>
            )}
          </td>
        )}
        {!compact && (
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
        )}
        <td className="px-3 py-2 text-right border-r border-table-border">
          {typeof line.ttc === 'number' ? (
            <span className="font-semibold">{line.ttc.toFixed(2)}</span>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-left border-r border-table-border">
          {line.brand ? (
            <span className={cn('inline-block px-2 py-1 rounded text-xs font-medium border', brandColor)}>
              {line.brand}
            </span>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-right font-semibold">
          {line.carton_Qte !== undefined ? (
            <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-indigo-100 text-indigo-800">
              {line.carton_Qte}
            </span>
          ) : (
            <span className="text-muted-foreground italic text-xs">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            min="0"
            value={qtePrepared}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              if (val > line.qte) {
                toast({
                  title: 'Erreur',
                  description: `Qte Validée ne peut pas dépasser Qté (${line.qte})`,
                  variant: 'destructive',
                });
                return;
              }
              onQtePreparedChange(id, val);
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={isValidated}
            className={cn(
              'w-16 h-7 px-1 rounded border text-right font-semibold text-sm focus:outline-none',
              isValidated
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                : 'border-sky-300 bg-sky-50/50 text-sky-900 focus:ring-2 focus:ring-sky-500'
            )}
          />
        </td>
        <td className="px-3 py-2 text-right font-bold">
          <span className={cn(
            'inline-block px-2 py-1 rounded text-xs font-bold',
            isValidated && Math.max(0, line.qte - qtePrepared) !== 0
              ? 'bg-red-100 text-red-800'
              : 'bg-orange-100 text-orange-800'
          )}>
            {Math.max(0, line.qte - qtePrepared)}
          </span>
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
      prevProps.getRowClass === nextProps.getRowClass &&
      prevProps.qtePrepared === nextProps.qtePrepared &&
      prevProps.brandColor === nextProps.brandColor &&
      prevProps.compact === nextProps.compact
    );
  }
);

TableRow.displayName = 'TableRow';

export default TableRow;
