import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import type {
  BP_RowData,
  BP_TableInstance,
} from '../types.ts';
import { getCellFromClientPoint } from '../components/common/cellCoordinates.ts';
import {
  BP_MenuContextImpl,
  type BP_BodyContextMenuRenderer,
} from '../components/common/menu-context.ts';
import {
  getFrozenColumnCount,
  getFrozenColumnsWidth,
  getFrozenRowCount,
  getFrozenRowsHeight,
} from '../components/common/pinning.ts';
import {
  getCellAtCoordinates,
  getFocusedCellCoordinates,
  getSelectedCellRegions,
  regionsToCellSelectionRanges,
} from '../components/common/cell-selection.ts';
import {
  TABLE_FOCUS_REGION,
  TABLE_SELECTION_REGION,
} from '../components/common/classes.ts';
import {
  FocusMode,
  Regions,
  RegionCardinality,
  type FocusedCellCoordinates,
  type FocusedRegion,
  type Region,
  type StyledRegionGroup,
} from '../components/common/region.ts';

type CellSelectionDirection = 'up' | 'down' | 'left' | 'right';

export type CellSelectionOptions<TData extends BP_RowData> = {
  table: BP_TableInstance<TData>;
  /** Resolved absolute top offset of the row at the given index. */
  getRowTop: (index: number) => number;
  /** Resolved height of the row at the given index. */
  getRowHeight: (index: number) => number;
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
  /** Width of the frozen row-header column. */
  rowHeaderWidth: number;
  /** Effective height of the column-header area. */
  columnHeaderHeight: number;

  bodyContextMenuRenderer?: BP_BodyContextMenuRenderer<TData>;
  enableBodyContextMenu?: boolean;

  enableFocusedCell?: boolean;
  onFocusedCell?: (cell: FocusedCellCoordinates) => void;
  onFocusedRegion?: (region: FocusedRegion) => void;

  selectedRegions?: Region[] | undefined;
  onSelection?: (regions: Region[]) => void;
  selectionModes?: RegionCardinality[];
};

export type CellSelectionApi = {
  /**
   * Styled region groups for the selection overlays: the selected regions
   * (resolved from the cell selection plugin's bounds) and, when
   * `enableFocusedCell` is on, the focused cell.
   */
  regionGroups: StyledRegionGroup[];
  isSelectionModeEnabled: (cardinality: RegionCardinality) => boolean;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  /** Focuses the scroll container so keyboard navigation keeps working. */
  handleBodyPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  handleColumnHeaderMouseDown: (index: number, event: ReactMouseEvent) => void;
  handleRowHeaderMouseDown: (index: number, event: ReactMouseEvent) => void;
  handleMenuMouseDown: (event: ReactMouseEvent) => void;
  /** Whether a body context menu renderer is configured and enabled. */
  isBodyContextMenuEnabled: boolean;
  /**
   * Applies Blueprint's right-click semantics before a body context menu
   * opens: when the right-clicked cell is not part of the current selection,
   * the selection (and the active cell) move to that cell.
   */
  handleBodyContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  /**
   * Builds the menu context for the right-click event and invokes the
   * configured body context menu renderer.
   */
  renderBodyContextMenu: (event: ReactMouseEvent<HTMLElement>) => ReactElement | undefined;
};

function serializeRegions(regions: Region[]): string {
  // Normalize key order and null-vs-undefined so regions that mean the same
  // thing compare equal regardless of how the caller constructed them.
  return JSON.stringify(
    regions.map((region) => ({
      rows: region.rows ?? null,
      cols: region.cols ?? null,
    })),
  );
}

/**
 * Cell-range selection and focused-cell navigation built on TanStack Table's
 * `cellSelectionFeature`. The plugin owns the selection state (drag, shift
 * extend, Ctrl/Cmd multi-range); this hook adds the Blueprint layer on top:
 * full-row/column/table selection from the headers and corner menu, keyboard
 * navigation, scroll-into-view, right-click context menu semantics, and the
 * controlled `selectedRegions` / `onSelection` props translated to and from
 * the plugin's state.
 */
export function useCellSelection<TData extends BP_RowData>({
  table,
  getRowTop,
  getRowHeight,
  scrollContainerRef,
  rowHeaderWidth,
  columnHeaderHeight,
  bodyContextMenuRenderer,
  enableBodyContextMenu,
  enableFocusedCell = false,
  onFocusedCell,
  onFocusedRegion,
  selectedRegions: controlledSelectedRegions,
  onSelection,
  selectionModes,
}: CellSelectionOptions<TData>): CellSelectionApi {
  const isSelectionControlled = controlledSelectedRegions != null;
  const isBodyContextMenuEnabled = enableBodyContextMenu ?? bodyContextMenuRenderer != null;
  // Set around imperative keyboard moves so the follow-up scroll only fires
  // for keyboard navigation, not pointer-driven selection changes.
  const keyboardMoveRef = useRef(false);
  // Serialized value of the controlled regions last applied to the table, so
  // the controlled sync does not echo itself back through `onSelection`.
  const lastAppliedRef = useRef<string | undefined>(undefined);

  const isSelectionModeEnabled = useCallback(
    (cardinality: RegionCardinality) => {
      if (selectionModes == null) {
        return true;
      }
      return selectionModes.includes(cardinality);
    },
    [selectionModes],
  );

  // Reactive sources for the derived selection/focus values, extracted so the
  // memo dependencies are statically checkable.
  const cellSelection = table.state.cellSelection;
  const columnPinning = table.state.columnPinning;
  const rows = table.getRowModel().rows;
  const visibleLeafColumns = table.getVisibleLeafColumns();

  // The selection as Blueprint regions, resolved from the plugin's bounds
  // against the current rows and columns.
  const selectedRegions = useMemo(
    () => getSelectedCellRegions(table),
    // The translation helper reads reactive table state (selection, rows,
    // columns, pinning) that the linter cannot see through the `table` prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cellSelection, columnPinning, rows, table, visibleLeafColumns],
  );

  // The plugin's active cell (anchor of the most recent range), only exposed
  // when focused-cell navigation is enabled.
  const focusedCell = useMemo(
    () => (enableFocusedCell ? getFocusedCellCoordinates(table) : undefined),
    // Same as above: the helper reads the selection and row model from the table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cellSelection, enableFocusedCell, rows, table],
  );

  const regionGroups = useMemo<StyledRegionGroup[]>(() => {
    const groups: StyledRegionGroup[] = [];
    if (selectedRegions.length > 0) {
      groups.push({ className: TABLE_SELECTION_REGION, regions: selectedRegions });
    }
    if (focusedCell != null) {
      groups.push({
        className: TABLE_FOCUS_REGION,
        regions: [Regions.cell(focusedCell.row, focusedCell.col)],
      });
    }
    return groups;
  }, [focusedCell, selectedRegions]);

  // Apply externally controlled `selectedRegions` to the plugin's state.
  useEffect(() => {
    if (!isSelectionControlled) {
      return;
    }
    const serialized = serializeRegions(controlledSelectedRegions ?? []);
    if (lastAppliedRef.current === serialized) {
      return;
    }
    lastAppliedRef.current = serialized;
    table.setCellSelection(regionsToCellSelectionRanges(table, controlledSelectedRegions));
  }, [controlledSelectedRegions, isSelectionControlled, table]);

  // Report selection changes through `onSelection` in both the controlled and
  // uncontrolled modes, skipping echoes of the controlled value and the
  // initial mount (matching the old behavior, where `onSelection` only fired
  // on user-driven changes).
  const previousRegionsRef = useRef<string | null>(null);
  const hasEmittedRegionsRef = useRef(false);
  useEffect(() => {
    const serialized = serializeRegions(selectedRegions);
    if (previousRegionsRef.current === serialized) {
      return;
    }
    previousRegionsRef.current = serialized;
    if (!hasEmittedRegionsRef.current) {
      // Seed the baseline without emitting, so mounting (or the initial
      // application of a controlled value) does not report a change.
      hasEmittedRegionsRef.current = true;
      return;
    }
    if (isSelectionControlled && lastAppliedRef.current === serialized) {
      return;
    }
    onSelection?.(selectedRegions);
  }, [isSelectionControlled, onSelection, selectedRegions]);

  // Report focused-cell changes through the callbacks.
  const previousFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enableFocusedCell) {
      return;
    }
    const serialized = focusedCell != null ? `${focusedCell.row}-${focusedCell.col}` : null;
    if (previousFocusRef.current === serialized) {
      return;
    }
    previousFocusRef.current = serialized;
    if (focusedCell != null) {
      onFocusedCell?.(focusedCell);
      onFocusedRegion?.({
        type: FocusMode.CELL,
        row: focusedCell.row,
        col: focusedCell.col,
        focusSelectionIndex: 0,
      });
    }
  }, [enableFocusedCell, focusedCell, onFocusedCell, onFocusedRegion]);

  const focusContainer = useCallback(() => {
    if (enableFocusedCell) {
      scrollContainerRef.current?.focus();
    }
  }, [enableFocusedCell, scrollContainerRef]);

  const scrollToFocusedCell = useCallback(() => {
    const focused = getFocusedCellCoordinates(table);
    if (focused == null) {
      return;
    }
    const el = scrollContainerRef.current;
    if (el == null) {
      return;
    }
    const columns = table.getVisibleLeafColumns();
    const column = columns[focused.col];
    if (column == null) {
      return;
    }
    const frozenColumnCount = getFrozenColumnCount(table);
    const frozenColumnsWidth = getFrozenColumnsWidth(table);
    const frozenRowCount = getFrozenRowCount(table);
    const frozenRowsHeight = getFrozenRowsHeight(table, getRowHeight);

    // The cell's position in the content coordinate space (frozen columns
    // and rows first, scrollable region after them; `column.getStart()` and
    // the row tops are absolute grid offsets).
    const columnLeft = column.getStart();
    const columnRight = columnLeft + column.getSize();
    const rowTop = getRowTop(focused.row);
    const rowBottom = rowTop + getRowHeight(focused.row);

    // The visible cell area excludes the row-header column, the
    // column-header area, and the frozen rows/columns: those never scroll and
    // always cover their part of the viewport.
    const viewportWidth = el.clientWidth - rowHeaderWidth - frozenColumnsWidth;
    const viewportHeight = el.clientHeight - columnHeaderHeight - frozenRowsHeight;

    let nextScrollLeft = el.scrollLeft;
    let nextScrollTop = el.scrollTop;

    if (focused.col >= frozenColumnCount) {
      const left = columnLeft - frozenColumnsWidth;
      const right = columnRight - frozenColumnsWidth;
      if (left < nextScrollLeft) {
        nextScrollLeft = Math.max(0, left);
      } else if (right > nextScrollLeft + viewportWidth) {
        nextScrollLeft = right - viewportWidth;
      }
    }
    if (focused.row >= frozenRowCount) {
      const top = rowTop - frozenRowsHeight;
      const bottom = rowBottom - frozenRowsHeight;
      if (top < nextScrollTop) {
        nextScrollTop = Math.max(0, top);
      } else if (bottom > nextScrollTop + viewportHeight) {
        nextScrollTop = bottom - viewportHeight;
      }
    }

    if (nextScrollLeft !== el.scrollLeft) {
      el.scrollLeft = nextScrollLeft;
    }
    if (nextScrollTop !== el.scrollTop) {
      el.scrollTop = nextScrollTop;
    }
  }, [
    columnHeaderHeight,
    getRowHeight,
    getRowTop,
    rowHeaderWidth,
    scrollContainerRef,
    table,
  ]);

  // Keyboard moves update the selection synchronously; scroll after the
  // resulting re-render so the new focused cell's geometry is current.
  useEffect(() => {
    if (!keyboardMoveRef.current) {
      return;
    }
    keyboardMoveRef.current = false;
    scrollToFocusedCell();
  }, [cellSelection, scrollToFocusedCell, table]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key;

      let direction: CellSelectionDirection | undefined;
      if (key === 'ArrowUp') {
        direction = 'up';
      } else if (key === 'ArrowDown') {
        direction = 'down';
      } else if (key === 'ArrowLeft') {
        direction = 'left';
      } else if (key === 'ArrowRight') {
        direction = 'right';
      }

      if (direction != null) {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          table.extendCellSelection(direction);
        } else if (enableFocusedCell) {
          keyboardMoveRef.current = true;
          table.moveCellSelection(direction);
        }
        return;
      }

      if (key === 'Tab' && enableFocusedCell) {
        event.preventDefault();
        event.stopPropagation();
        keyboardMoveRef.current = true;
        table.moveCellSelection(event.shiftKey ? 'left' : 'right');
        return;
      }

      if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        table.resetCellSelection(true);
        return;
      }

      if (modifier && key.toLowerCase() === 'a') {
        event.preventDefault();
        event.stopPropagation();
        table.selectAllCells();
      }
    },
    [enableFocusedCell, table],
  );

  const getCellFromEvent = useCallback(
    (clientX: number, clientY: number) =>
      getCellFromClientPoint(
        { table, scrollContainerRef, rowHeaderWidth, columnHeaderHeight, getRowTop, getRowHeight },
        clientX,
        clientY,
      ),
    [columnHeaderHeight, getRowHeight, getRowTop, rowHeaderWidth, scrollContainerRef, table],
  );

  const handleBodyPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Only the primary button activates keyboard focus; selection itself is
      // handled by the cells' mouse handlers from the cell selection plugin.
      if (event.button === 0) {
        focusContainer();
      }
    },
    [focusContainer],
  );

  const handleBodyContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (!isBodyContextMenuEnabled) {
        return;
      }
      const coords = getCellFromEvent(event.clientX, event.clientY);
      if (coords == null) {
        return;
      }
      const cell = getCellAtCoordinates(table, coords);
      if (cell == null) {
        return;
      }
      if (cell.getIsSelected()) {
        // The right-click landed inside the current selection: keep it, so the
        // menu acts on the whole selection.
        return;
      }
      if (isSelectionModeEnabled(RegionCardinality.CELLS)) {
        table.setCellSelection([
          {
            anchorRowId: cell.row.id,
            anchorColumnId: cell.column.id,
            focusRowId: cell.row.id,
            focusColumnId: cell.column.id,
          },
        ]);
      }
    },
    [getCellFromEvent, isBodyContextMenuEnabled, isSelectionModeEnabled, table],
  );

  const renderBodyContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>): ReactElement | undefined => {
      if (!isBodyContextMenuEnabled || bodyContextMenuRenderer == null) {
        return undefined;
      }
      const coords = getCellFromEvent(event.clientX, event.clientY);
      if (coords == null) {
        return undefined;
      }
      const context = new BP_MenuContextImpl<TData>({
        table,
        target: Regions.cell(coords.row, coords.col),
        // Read the selection freshly: the right-click may have just moved it.
        selectedRegions: getSelectedCellRegions(table),
        numRows: table.getRowModel().rows.length,
        numCols: table.getVisibleLeafColumns().length,
      });
      return bodyContextMenuRenderer(context) ?? undefined;
    },
    [bodyContextMenuRenderer, getCellFromEvent, isBodyContextMenuEnabled, table],
  );

  const handleColumnHeaderMouseDown = useCallback(
    (index: number, event: ReactMouseEvent) => {
      if (!isSelectionModeEnabled(RegionCardinality.FULL_COLUMNS)) {
        table.resetCellSelection(true);
        focusContainer();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const rows = table.getRowModel().rows;
      const column = table.getVisibleLeafColumns()[index];
      if (column == null || rows.length === 0) {
        return;
      }
      if (event.shiftKey) {
        // Extend the active range's focus column to the clicked column,
        // keeping its anchor and rows, mirroring Blueprint's shift-click.
        table.setCellSelection((previous) => {
          const active = previous[previous.length - 1];
          if (active == null) {
            return [
              {
                anchorRowId: rows[0].id,
                anchorColumnId: column.id,
                focusRowId: rows[rows.length - 1].id,
                focusColumnId: column.id,
              },
            ];
          }
          return [...previous.slice(0, -1), { ...active, focusColumnId: column.id }];
        });
      } else {
        table.setCellSelection([
          {
            anchorRowId: rows[0].id,
            anchorColumnId: column.id,
            focusRowId: rows[rows.length - 1].id,
            focusColumnId: column.id,
          },
        ]);
      }
      focusContainer();
    },
    [focusContainer, isSelectionModeEnabled, table],
  );

  const handleRowHeaderMouseDown = useCallback(
    (index: number, event: ReactMouseEvent) => {
      if (!isSelectionModeEnabled(RegionCardinality.FULL_ROWS)) {
        table.resetCellSelection(true);
        focusContainer();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();
      const row = rows[index];
      if (row == null || columns.length === 0) {
        return;
      }
      if (event.shiftKey) {
        // Extend the active range's focus row to the clicked row, keeping its
        // anchor and columns, mirroring Blueprint's shift-click.
        table.setCellSelection((previous) => {
          const active = previous[previous.length - 1];
          if (active == null) {
            return [
              {
                anchorRowId: row.id,
                anchorColumnId: columns[0].id,
                focusRowId: row.id,
                focusColumnId: columns[columns.length - 1].id,
              },
            ];
          }
          return [...previous.slice(0, -1), { ...active, focusRowId: row.id }];
        });
      } else {
        table.setCellSelection([
          {
            anchorRowId: row.id,
            anchorColumnId: columns[0].id,
            focusRowId: row.id,
            focusColumnId: columns[columns.length - 1].id,
          },
        ]);
      }
      focusContainer();
    },
    [focusContainer, isSelectionModeEnabled, table],
  );

  const handleMenuMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      if (!isSelectionModeEnabled(RegionCardinality.FULL_TABLE)) {
        table.resetCellSelection(true);
        focusContainer();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      table.selectAllCells();
      focusContainer();
    },
    [focusContainer, isSelectionModeEnabled, table],
  );

  return {
    regionGroups,
    handleBodyContextMenu,
    handleBodyPointerDown,
    handleColumnHeaderMouseDown,
    handleKeyDown,
    handleMenuMouseDown,
    handleRowHeaderMouseDown,
    isBodyContextMenuEnabled,
    isSelectionModeEnabled,
    renderBodyContextMenu,
  };
}
