import { Icon } from '@blueprintjs/core';
import type { Row } from '@tanstack/react-table';
import classNames from 'classnames';
import type { BP_RowData, BP_RowExpanderOptions, BP_TableFeatures } from '../../types.ts';
import { TABLE_ROW_EXPANDER } from '../common/classes.ts';

type TableRowExpanderProps<TData extends BP_RowData> = BP_RowExpanderOptions<TData> & {
  row: Row<BP_TableFeatures, TData>;
  rowIndex: number;
};

export function TableRowExpander<TData extends BP_RowData>({
  row,
  rowIndex,
  rowExpanderButtonProps,
  rowExpanderIconProps,
}: TableRowExpanderProps<TData>) {
  const expanded = row.getIsExpanded();
  const buttonProps =
    typeof rowExpanderButtonProps === 'function' ? rowExpanderButtonProps(row) : rowExpanderButtonProps;
  const iconProps =
    typeof rowExpanderIconProps === 'function' ? rowExpanderIconProps(row) : rowExpanderIconProps;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} row ${rowIndex + 1}`}
      {...buttonProps}
      className={classNames(TABLE_ROW_EXPANDER, buttonProps?.className)}
      onMouseDown={(event) => {
        event.stopPropagation();
        buttonProps?.onMouseDown?.(event);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        buttonProps?.onPointerDown?.(event);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        buttonProps?.onKeyDown?.(event);
      }}
      onClick={(event) => {
        buttonProps?.onClick?.(event);
        if (!event.defaultPrevented) {
          row.toggleExpanded();
        }
      }}
    >
      <Icon icon={expanded ? 'caret-down' : 'caret-right'} size={14} {...iconProps} />
    </button>
  );
}
