import type { IconProps } from '@blueprintjs/core';
import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type HTMLProps,
  type ReactNode,
  type MutableRefObject,
} from 'react';
import {
  ColumnPinningState,
  ColumnVisibilityState,
  type Cell,
  type ExpandedState,
  type Row,
  RowData,
  RowPinningState,
  RowSelectionState,
  TableFeatures,
  TableOptions,
  TableState,
  ReactTable,
  type CellData,
} from '@tanstack/react-table';

declare module '@tanstack/react-table' {
  /**
   * Extra metadata supported on column definitions, applied by `BP_Table` when
   * rendering the table's cells.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parameters must match TanStack's ColumnMeta signature for merging
  interface ColumnMeta<in out TFeatures extends TableFeatures, in out TData extends RowData, TValue extends CellData = CellData> {
    /**
     * Additional class name(s) applied to this column's body cells, e.g.
     * `meta: { bodyCellClassName: 'my-cell' }`. Useful for styling cell
     * contents (centering editors, removing cell padding, and so on).
     */
    bodyCellClassName?: string;
    /** Additional class name(s) applied to this column's header cells. */
    headCellClassName?: string;
    /**
     * Additional class name(s) applied to this column's footer cells.
     * Reserved for forward compatibility: the table does not render footers
     * yet, so this option currently has no effect.
     */
    footerCellClassName?: string;
  }
}

export type LiteralUnion<T extends U, U = string> =
  | (Record<never, never> & U)
  | T;
export type Prettify<T> = { [K in keyof T]: T[K] } & unknown;
export type Xor<A, B> =
  | Prettify<{ [k in keyof A]?: never } & B>
  | Prettify<{ [k in keyof B]?: never } & A>;

/**
 * Standard HTML attributes accepted for the table's outer container element:
 * React's `HTMLProps`, minus a handful of attributes reserved by the table API,
 * plus a `ref` to the container element.
 */
export type HTMLPropsRef<T extends HTMLElement> = {
  ref?: MutableRefObject<null | T> | null;
} & Omit<
  HTMLProps<T>,
  'color' | 'data' | 'label' | 'ref' | 'size' | 'style' | 'type'
>;
export type BP_DensityState = 'lg' | 'md' | 'sm' | 'xl' | 'xs';
export type BP_RowData<T = unknown> = Record<string, T>;

/**
 * Loading options that can be passed to the table to render skeleton
 * placeholders in the corresponding table regions.
 */
export enum TableLoadingOption {
  CELLS = 'cells',
  COLUMN_HEADERS = 'column-header',
  ROW_HEADERS = 'row-header',
}

/** Returns true if the supplied loading option is present in the given array. */
export function hasLoadingOption<T extends string>(loadingOptions: readonly T[], loadingOption: T) {
  return loadingOptions.indexOf(loadingOption) !== -1;
}

/** Which regions of the table are currently showing a loading placeholder. */
export type TableLoading = {
  areCellsLoading: boolean;
  areColumnHeadersLoading: boolean;
  areRowHeadersLoading: boolean;
};
export type BP_CellValue = unknown;

export type BP_DefinedTableOptions<TFeatures extends TableFeatures, TData extends RowData> = Omit<TableOptions<TFeatures, TData>, 'features'>;

export type BP_TableOptions<TFeatures extends TableFeatures, TData extends RowData> = BP_DefinedTableOptions<TFeatures, TData> & {
  features?: TableFeatures;
};
export type BP_TableFeatures = TableFeatures;
export type BP_TableState = TableState<BP_TableFeatures>;
/** Maps column ids to their visibility (`true` = visible, `false` = hidden). */
export type BP_VisibilityState = ColumnVisibilityState;
/** Maps frozen ("start") and right-pinned ("end") column ids. */
export type BP_ColumnPinningState = ColumnPinningState;
/** Maps frozen ("top") and bottom-pinned ("bottom") row ids. */
export type BP_RowPinningState = RowPinningState;
/** Maps row ids to their selection (`true` = selected), driven by the row-selection checkboxes. */
export type BP_RowSelectionState = RowSelectionState;
/** Expanded row IDs, or `true` to expand every eligible row. */
export type BP_ExpandedRowsState = ExpandedState;
export type BP_RowDetailRenderer<TData extends BP_RowData> = (row: Row<BP_TableFeatures, TData>) => ReactNode;

/** HTML attributes for a rendered data cell. The table owns its contents. */
export type BP_BodyElementProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'dangerouslySetInnerHTML'> & {
  [attribute: `data-${string}`]: string | number | boolean | undefined;
};

export type BP_BodyPropsOptions<TData extends BP_RowData> = {
  /** Attributes and event handlers for the entire data cell, including its padding. */
  getCellProps?: (cell: Cell<BP_TableFeatures, TData, unknown>) => BP_BodyElementProps | undefined;
};

type RowExpanderPropsValue<TData extends BP_RowData, TProps> =
  | TProps
  | ((row: Row<BP_TableFeatures, TData>) => TProps);

export type BP_RowExpanderOptions<TData extends BP_RowData> = {
  /** Native props for the row's disclosure button, or a function of the row. */
  rowExpanderButtonProps?: RowExpanderPropsValue<
    TData,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'dangerouslySetInnerHTML'>
  >;
  /** Blueprint Icon props, or a function of the row for state-dependent icons. */
  rowExpanderIconProps?: RowExpanderPropsValue<TData, Partial<IconProps>>;
};

export type BP_TableInstance<TData extends BP_RowData = BP_RowData> =
  ReactTable<BP_TableFeatures, TData>;
