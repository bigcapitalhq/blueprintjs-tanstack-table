import type { Cell, Column } from '@tanstack/react-table';
import type { CellSelectionRange } from '@tanstack/react-table';
import type {
  BP_RowData,
  BP_TableFeatures,
  BP_TableInstance,
} from '../../types.ts';
import {
  Regions,
  RegionCardinality,
  type CellCoordinates,
  type CellInterval,
  type FocusedCellCoordinates,
  type Region,
} from './region.ts';

/**
 * Bridge between TanStack Table's `cellSelectionFeature` (selection state is an
 * ordered list of `CellSelectionRange`s keyed by row and column ids) and the
 * Blueprint-style `Region` API that `BP_Table` exposes publicly.
 *
 * The plugin's `getCellSelectionBounds()` resolves the range operations into
 * disjoint positive rectangles in *display-order* index space:
 *
 * - Row indexes are `row.getDisplayIndex()` values, i.e. positions in the
 *   pre-pagination display order (which equals the current row model's order
 *   when the table is not paginated).
 * - Column indexes index the columns in their actual render order: start
 *   pinned first, then center, then end — not `column.getIndex()`, which
 *   indexes the unpinned visible leaf order. The two orders coincide while
 *   `BP_Table`'s frozen columns are a prefix of the column order (the normal
 *   case), and this module translates between them so the overlays stay
 *   correct even when pinning is driven directly through TanStack state.
 */

/**
 * Returns the visible leaf columns in the order the table actually renders
 * them (start pinned first, then center, then end), mirroring the index space
 * the cell selection plugin's bounds use.
 */
export function getDisplayOrderedColumns<TData extends BP_RowData>(
  table: BP_TableInstance<TData>,
): Array<Column<BP_TableFeatures, TData, unknown>> {
  const columns = table.getVisibleLeafColumns();
  const pinning = table.state.columnPinning;
  if (pinning == null || (pinning.start?.length ?? 0) + (pinning.end?.length ?? 0) === 0) {
    return columns;
  }
  const byId = new Map(columns.map((column) => [column.id, column]));
  const start = (pinning.start ?? [])
    .map((id) => byId.get(id))
    .filter((column): column is Column<BP_TableFeatures, TData, unknown> => column != null);
  const end = (pinning.end ?? [])
    .map((id) => byId.get(id))
    .filter((column): column is Column<BP_TableFeatures, TData, unknown> => column != null);
  const startIds = new Set(start.map((column) => column.id));
  const endIds = new Set(end.map((column) => column.id));
  const center = columns.filter((column) => !startIds.has(column.id) && !endIds.has(column.id));
  return [...start, ...center, ...end];
}

/**
 * Maps an inclusive display-order column index interval to an inclusive
 * interval of natural column indexes (`column.getIndex()`), the coordinate
 * space `BP_Table` renders and its region APIs use. When the two orders
 * coincide (the normal case) this is the identity.
 */
function mapDisplayColumnInterval(
  displayToNatural: readonly number[],
  minDisplay: number,
  maxDisplay: number,
): CellInterval | null {
  if (displayToNatural.length === 0) {
    return null;
  }
  const from = Math.max(0, Math.min(minDisplay, displayToNatural.length - 1));
  const to = Math.max(0, Math.min(maxDisplay, displayToNatural.length - 1));
  let naturalMin = Number.POSITIVE_INFINITY;
  let naturalMax = Number.NEGATIVE_INFINITY;
  for (let index = from; index <= to; index++) {
    const natural = displayToNatural[index];
    if (natural < naturalMin) {
      naturalMin = natural;
    }
    if (natural > naturalMax) {
      naturalMax = natural;
    }
  }
  return [naturalMin, naturalMax];
}

/**
 * Maps an inclusive display-order row index interval to the interval of row
 * model indexes that render it. Rows appear in display order within the row
 * model (pagination slices that order), so the mapping is a binary search
 * over the model rows' display indexes. Returns `null` when no rendered row
 * falls inside the display interval (e.g. the selection lies on another
 * page).
 */
function mapDisplayRowInterval(
  rows: ReadonlyArray<{ getDisplayIndex: () => number }>,
  minDisplay: number,
  maxDisplay: number,
): CellInterval | null {
  if (rows.length === 0) {
    return null;
  }
  let low = 0;
  let high = rows.length - 1;
  let modelMin = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (rows[mid].getDisplayIndex() >= minDisplay) {
      modelMin = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  if (modelMin < 0 || rows[modelMin].getDisplayIndex() > maxDisplay) {
    return null;
  }
  low = modelMin;
  high = rows.length - 1;
  let modelMax = modelMin;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (rows[mid].getDisplayIndex() <= maxDisplay) {
      modelMax = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return [modelMin, modelMax];
}

/**
 * Infers the Blueprint region cardinality of a resolved rectangle. A region
 * covering every row and column reads back as `FULL_TABLE`, one covering all
 * columns as `FULL_ROWS`, and one covering all rows as `FULL_COLUMNS` — so the
 * full-row/column/table selections emulated through the plugin round-trip with
 * their Blueprint cardinalities.
 */
function resolveRegionCardinality(
  rowInterval: CellInterval,
  colInterval: CellInterval,
  numRows: number,
  numCols: number,
): Region {
  const coversAllRows = rowInterval[0] === 0 && rowInterval[1] === numRows - 1;
  const coversAllCols = colInterval[0] === 0 && colInterval[1] === numCols - 1;
  if (coversAllRows && coversAllCols) {
    return Regions.table();
  } else if (coversAllCols) {
    return Regions.row(rowInterval[0], rowInterval[1]);
  } else if (coversAllRows) {
    return Regions.column(colInterval[0], colInterval[1]);
  }
  return Regions.cell(rowInterval[0], colInterval[0], rowInterval[1], colInterval[1]);
}

/**
 * Returns the current selection as Blueprint `Region`s, resolved from the cell
 * selection plugin's bounds against the currently rendered rows and columns.
 * Ranges whose corners no longer resolve (filtered-out rows, hidden columns)
 * are omitted, matching the plugin's own behavior.
 */
export function getSelectedCellRegions<TData extends BP_RowData>(
  table: BP_TableInstance<TData>,
): Region[] {
  const bounds = table.getCellSelectionBounds();
  if (bounds.length === 0) {
    return [];
  }
  const rows = table.getRowModel().rows;
  const columns = getDisplayOrderedColumns(table);
  const displayToNatural = columns.map((column) => column.getIndex());
  const regions: Region[] = [];
  for (const bound of bounds) {
    const rowInterval = mapDisplayRowInterval(rows, bound.minRowIndex, bound.maxRowIndex);
    const colInterval = mapDisplayColumnInterval(
      displayToNatural,
      bound.minColumnIndex,
      bound.maxColumnIndex,
    );
    if (rowInterval == null || colInterval == null) {
      continue;
    }
    regions.push(
      resolveRegionCardinality(
        rowInterval,
        colInterval,
        rows.length,
        displayToNatural.length,
      ),
    );
  }
  return regions;
}

/**
 * Converts Blueprint `Region`s into the cell selection plugin's
 * `CellSelectionRange` list. Full-row/column/table regions are emulated as
 * ranges spanning all currently visible rows and/or columns; the anchor corner
 * is the region's first cell, so the focused cell lands where Blueprint would
 * put it. Regions whose coordinates fall outside the current row/column
 * counts are skipped.
 */
export function regionsToCellSelectionRanges<TData extends BP_RowData>(
  table: BP_TableInstance<TData>,
  regions: Region[] | null | undefined,
): CellSelectionRange[] {
  if (regions == null || regions.length === 0) {
    return [];
  }
  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();
  if (rows.length === 0 || columns.length === 0) {
    return [];
  }
  const ranges: CellSelectionRange[] = [];
  for (const region of regions) {
    let rowInterval: CellInterval;
    let colInterval: CellInterval;
    switch (Regions.getRegionCardinality(region)) {
      case RegionCardinality.FULL_TABLE:
        rowInterval = [0, rows.length - 1];
        colInterval = [0, columns.length - 1];
        break;
      case RegionCardinality.FULL_COLUMNS:
        rowInterval = [0, rows.length - 1];
        colInterval = region.cols!;
        break;
      case RegionCardinality.FULL_ROWS:
        rowInterval = region.rows!;
        colInterval = [0, columns.length - 1];
        break;
      default:
        rowInterval = region.rows!;
        colInterval = region.cols!;
        break;
    }
    if (
      rowInterval[0] < 0 ||
      rowInterval[1] >= rows.length ||
      colInterval[0] < 0 ||
      colInterval[1] >= columns.length
    ) {
      continue;
    }
    ranges.push({
      anchorRowId: rows[rowInterval[0]].id,
      anchorColumnId: columns[colInterval[0]].id,
      focusRowId: rows[rowInterval[1]].id,
      focusColumnId: columns[colInterval[1]].id,
    });
  }
  return ranges;
}

/**
 * Returns the table's active cell (the anchor of the most recent selection
 * range) in the coordinate space `BP_Table` renders, or `undefined` when
 * there is no active cell or it is not part of the currently rendered row
 * model (e.g. it lives on another page).
 */
export function getFocusedCellCoordinates<TData extends BP_RowData>(
  table: BP_TableInstance<TData>,
): FocusedCellCoordinates | undefined {
  const cell = table.getFocusedCell();
  if (cell == null) {
    return undefined;
  }
  const row = table.getRowModel().rows.indexOf(cell.row);
  if (row < 0) {
    return undefined;
  }
  return { row, col: cell.column.getIndex() };
}

/**
 * Returns the rendered cell at the given coordinates (row model index and
 * natural visible column index), or `undefined` when the coordinates fall
 * outside the current model.
 */
export function getCellAtCoordinates<TData extends BP_RowData>(
  table: BP_TableInstance<TData>,
  coordinates: CellCoordinates,
): Cell<BP_TableFeatures, TData, unknown> | undefined {
  const row = table.getRowModel().rows[coordinates.row];
  const column = table.getVisibleLeafColumns()[coordinates.col];
  if (row == null || column == null) {
    return undefined;
  }
  return row.getAllCellsByColumnId()[column.id];
}
