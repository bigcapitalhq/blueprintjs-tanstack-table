import { createContext, useContext } from 'react';
import type { CellSelectionApi } from '../../hooks/use-cell-selection.ts';

export const TableSelectionContext = createContext<CellSelectionApi | null>(null);

export function useTableSelection(): CellSelectionApi | null {
  return useContext(TableSelectionContext);
}
