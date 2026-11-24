import classNames from 'classnames';
import { Button, ButtonGroup, MenuItem, type ButtonProps } from '@blueprintjs/core';
import { Select, type SelectProps } from '@blueprintjs/select';
import { useMemo } from 'react';
import {
  TABLE_PAGINATION_BAR,
  TABLE_PAGINATION_BAR_CONTROLS,
  TABLE_PAGINATION_BAR_TEXT,
} from '../common/classes.ts';
import { DEFAULT_PAGE_SIZE_OPTIONS } from './constants.ts';

type PageAction = 'first' | 'previous' | 'next' | 'last';

export type PaginationControlProps = {
  /** Shared navigation button props, or a function that returns props for each action. */
  paginationButtonProps?: ButtonProps | ((action: PageAction) => ButtonProps);
  /** Blueprint Select props for the rows-per-page menu. Use pageSizeOptions to supply its items. */
  pageSizeSelectProps?: Partial<Omit<SelectProps<number>, 'items' | 'children'>>;
  /** Blueprint Button props for the trigger that displays the current page size. */
  pageSizeButtonProps?: ButtonProps;
};

export type TablePaginationBarProps = PaginationControlProps & {
  /** Zero-based index of the current page. */
  pageIndex: number;
  /** Number of rows shown per page. */
  pageSize: number;
  /**
   * Total number of pages. `undefined` means the count is unknown — typical for
   * manual/server-side pagination without a `rowCount` — in which case "last"
   * navigation is disabled and "next" stays enabled.
   */
  pageCount?: number;
  /**
   * Total number of rows across all pages, used for the "1–10 of 240" summary.
   * When `undefined`, the summary is omitted.
   */
  rowCount?: number;
  /** Page sizes offered by the rows-per-page select. */
  pageSizeOptions?: readonly number[];
  /** Invoked with the requested page index when a navigation control is used. */
  onPageIndexChange: (pageIndex: number) => void;
  /** Invoked with the requested page size when the rows-per-page select changes. */
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
};

/**
 * Blueprint-styled pagination bar rendered below the table by the
 * `withPagination` HOC. It is presentational: page state and navigation are
 * owned by the caller.
 */
export function TablePaginationBar({
  pageIndex,
  pageSize,
  pageCount,
  rowCount,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  paginationButtonProps,
  pageSizeSelectProps,
  pageSizeButtonProps,
  onPageIndexChange,
  onPageSizeChange,
  className,
}: TablePaginationBarProps) {
  const knownPageCount = pageCount != null && pageCount >= 0 ? pageCount : undefined;
  const canPrevious = pageIndex > 0;
  const canNext = knownPageCount === undefined ? true : pageIndex < knownPageCount - 1;
  const pageSizeDisabled = pageSizeSelectProps?.disabled || pageSizeButtonProps?.disabled;

  function renderPageButton(
    action: PageAction,
    label: string,
    icon: ButtonProps['icon'],
    targetPage: number | undefined,
  ) {
    const props = typeof paginationButtonProps === 'function'
      ? paginationButtonProps(action)
      : paginationButtonProps;
    return (
      <Button
        aria-label={label}
        icon={icon}
        {...props}
        disabled={targetPage === undefined || props?.disabled}
        onClick={(event) => {
          props?.onClick?.(event);
          if (targetPage !== undefined && !event.defaultPrevented) onPageIndexChange(targetPage);
        }}
      />
    );
  }

  const firstRowNumber = rowCount === undefined || rowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRowNumber =
    rowCount === undefined ? undefined : Math.min((pageIndex + 1) * pageSize, rowCount);

  // Keep the current page size selectable even when it is not one of the
  // offered options (e.g. it came from controlled state).
  const selectablePageSizes = useMemo(
    () => pageSizeOptions.includes(pageSize)
      ? [...pageSizeOptions]
      : [...pageSizeOptions, pageSize].sort((a, b) => a - b),
    [pageSize, pageSizeOptions],
  );

  return (
    <div className={classNames(TABLE_PAGINATION_BAR, className)}>
      <div className={TABLE_PAGINATION_BAR_CONTROLS}>
        <span className={TABLE_PAGINATION_BAR_TEXT}>Rows per page:</span>
        <Select<number>
          filterable={false}
          {...pageSizeSelectProps}
          items={selectablePageSizes}
          itemRenderer={pageSizeSelectProps?.itemRenderer ?? ((size, { handleClick, handleFocus, id, modifiers, ref }) => (
            <MenuItem
              active={modifiers.active}
              disabled={modifiers.disabled}
              id={id}
              key={size}
              onClick={handleClick}
              onFocus={handleFocus}
              ref={ref}
              roleStructure="listoption"
              selected={size === pageSize}
              text={size}
            />
          ))}
          disabled={pageSizeDisabled}
          onItemSelect={(size, event) => {
            pageSizeSelectProps?.onItemSelect?.(size, event);
            if (size !== pageSize) onPageSizeChange(size);
          }}
          popoverTargetProps={{ 'aria-label': 'Rows per page', ...pageSizeSelectProps?.popoverTargetProps }}
        >
          <Button
            aria-label={`Rows per page: ${pageSize}`}
            endIcon="caret-down"
            text={pageSize}
            {...pageSizeButtonProps}
            disabled={pageSizeDisabled}
          />
        </Select>
        {rowCount !== undefined && (
          <span className={TABLE_PAGINATION_BAR_TEXT}>
            {firstRowNumber === 0 ? 0 : `${firstRowNumber}–${lastRowNumber}`} of {rowCount}
          </span>
        )}
        <ButtonGroup>
          {renderPageButton('first', 'First page', 'double-chevron-left', canPrevious ? 0 : undefined)}
          {renderPageButton('previous', 'Previous page', 'chevron-left', canPrevious ? pageIndex - 1 : undefined)}
          {renderPageButton('next', 'Next page', 'chevron-right', canNext ? pageIndex + 1 : undefined)}
          {renderPageButton('last', 'Last page', 'double-chevron-right',
            canNext && knownPageCount !== undefined ? knownPageCount - 1 : undefined)}
        </ButtonGroup>
      </div>
    </div>
  );
}
