import { createContext } from 'react';

/** Reports the number of rows available to paginate after expanding the tree. */
export const PaginationRowCountContext = createContext<((count: number) => void) | undefined>(undefined);
