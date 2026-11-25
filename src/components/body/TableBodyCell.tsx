import classNames from 'classnames';
import { Classes } from '@blueprintjs/core';
import { type Cell } from '@tanstack/react-table';
import { TableRowExpander } from './TableRowExpander.tsx';
import { LoadableContent } from '../common/LoadableContent.tsx';
import {
  TABLE_CELL,
  TABLE_CELL_WITH_EXPANDER,
  TABLE_CELL_LEDGER_EVEN,
  TABLE_CELL_LEDGER_ODD,
  TABLE_LAST_IN_COLUMN,
  TABLE_LAST_IN_ROW,
  TABLE_NO_WRAP_TEXT,
  TABLE_ROW_SELECTED,
  TABLE_TRUNCATED_CELL,
  TABLE_TRUNCATED_TEXT,
  columnCellIndexClass,
  rowCellIndexClass,
} from '../common/classes.ts';
import type { ColumnRegion } from '../common/pinning.ts';
import type {
  BP_BodyElementProps,
  BP_RowData,
  BP_RowExpanderOptions,
  BP_TableFeatures,
  BP_TableInstance,
} from '../../types.ts';

export type TableBodyCellProps<TData extends BP_RowData> = BP_RowExpanderOptions<TData> & {
  table: BP_TableInstance<TData>;
  cell: Cell<BP_TableFeatures, TData, unknown>;
  cellProps?: BP_BodyElementProps;
  /** Absolute index of the row this cell belongs to. */
  rowIndex: number;
  /** Top offset of the row within its quadrant's body, in pixels. */
  rowTop: number;
  /** Which column region this cell belongs to; positions are relative to it. */
  columnRegion: ColumnRegion;
  rowHeight: number;
  loading: boolean;
  isExpansionCell: boolean;
  isLastInRow: boolean;
  isLastInColumn: boolean;
};

export function TableBodyCell<TData extends BP_RowData>({
  table,
  cell,
  cellProps,
  rowIndex,
  rowTop,
  columnRegion,
  rowHeight,
  loading,
  isExpansionCell,
  rowExpanderButtonProps,
  rowExpanderIconProps,
  isLastInRow,
  isLastInColumn,
}: TableBodyCellProps<TData>) {
  const size = cell.column.getSize();
  const start = cell.column.getStart(columnRegion);
  const canExpand = isExpansionCell && cell.row.getCanExpand?.();
  const meta = cell.column.columnDef.meta;
  const showExpander = canExpand && !loading;
  const indentation = isExpansionCell && cell.row.depth > 0
    ? { paddingInlineStart: cell.row.depth * 16 }
    : undefined;
  const content = (
    <div
      className={classNames(
        TABLE_TRUNCATED_TEXT,
        TABLE_NO_WRAP_TEXT,
        meta?.bodyCellInnerClassName,
      )}
      style={showExpander ? undefined : indentation}
    >
      <LoadableContent loading={loading} variableLength>
        <table.FlexRender cell={cell} />
      </LoadableContent>
    </div>
  );

  return (
    <div
      {...cellProps}
      className={classNames(
        TABLE_CELL,
        TABLE_TRUNCATED_CELL,
        rowCellIndexClass(rowIndex),
        columnCellIndexClass(cell.column.getIndex()),
        rowIndex % 2 === 0 ? TABLE_CELL_LEDGER_EVEN : TABLE_CELL_LEDGER_ODD,
        {
          [TABLE_LAST_IN_ROW]: isLastInRow,
          [TABLE_LAST_IN_COLUMN]: isLastInColumn,
          [Classes.LOADING]: loading,
          [TABLE_ROW_SELECTED]: cell.row.getIsSelected(),
        },
        meta?.bodyCellClassName,
        cellProps?.className,
      )}
      data-vertical-align={meta?.verticalAlign}
      style={{
        fontVariantNumeric: meta?.tabularNums ? 'tabular-nums' : undefined,
        textAlign: meta?.textAlign,
        ...cellProps?.style,
        height: rowHeight,
        left: start,
        position: 'absolute',
        top: rowTop,
        width: size,
      }}
      onMouseDown={(event) => {
        // Selection is driven by TanStack's cell selection plugin; only the
        // primary button starts a selection (right-click opens the context
        // menu instead).
        cellProps?.onMouseDown?.(event);
        if (!event.defaultPrevented && event.button === 0) {
          cell.getSelectionStartHandler()(event);
        }
      }}
      onMouseEnter={(event) => {
        cellProps?.onMouseEnter?.(event);
        if (!event.defaultPrevented) {
          cell.getSelectionExtendHandler()(event);
        }
      }}
    >
      {showExpander ? (
        <div className={TABLE_CELL_WITH_EXPANDER} style={indentation}>
          <TableRowExpander
            row={cell.row}
            rowIndex={rowIndex}
            rowExpanderButtonProps={rowExpanderButtonProps}
            rowExpanderIconProps={rowExpanderIconProps}
          />
          {content}
        </div>
      ) : content}
    </div>
  );
}
