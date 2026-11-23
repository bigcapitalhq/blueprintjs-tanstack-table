import type { Meta, StoryObj } from '@storybook/react';
import { createColumnHelper, type ColumnMeta } from '@tanstack/react-table';
import { useMemo } from 'react';
import type { BP_TableFeatures } from '../types.ts';
import { BP_Table } from './BP_Table.tsx';
import './BP_Table.stories.css';

type LineItem = { item: string; quantity: number; amount: string };
type Alignment = Pick<ColumnMeta<BP_TableFeatures, LineItem>, 'textAlign' | 'verticalAlign'>;

const helper = createColumnHelper<BP_TableFeatures, LineItem>();
const data: LineItem[] = [
  { item: 'Desk lamp', quantity: 2, amount: '$78.00' },
  { item: 'Notebook', quantity: 12, amount: '$54.00' },
  { item: 'Desk mat', quantity: 1, amount: '$25.00' },
];

const meta = {
  title: 'BP_Table/Column Alignment',
  args: { textAlign: 'end', verticalAlign: 'bottom' },
  argTypes: {
    textAlign: {
      description: 'Horizontal alignment of the Amount header and values.',
      control: 'select',
      options: ['start', 'center', 'end', 'left', 'right'],
    },
    verticalAlign: {
      description: 'Vertical alignment of the Amount header and values.',
      control: 'select',
      options: ['top', 'middle', 'bottom'],
    },
  },
  render: function AlignmentTable({ textAlign, verticalAlign }) {
    const columns = useMemo(() => helper.columns([
      helper.accessor('item', { header: 'Item', size: 180, meta: { textAlign: 'start', verticalAlign: 'top' } }),
      helper.accessor('quantity', { header: 'Quantity', size: 120, meta: { textAlign: 'center', verticalAlign: 'middle' } }),
      helper.accessor('amount', { header: 'Amount', size: 150, meta: { textAlign, verticalAlign } }),
    ]), [textAlign, verticalAlign]);

    return (
      <div className="bp-table-demo-wrapper bp-table-demo-alignment">
        <BP_Table data={data} columns={columns} rowHeight={64} />
      </div>
    );
  },
} satisfies Meta<Alignment>;

export default meta;
export const AmountColumn: StoryObj<typeof meta> = {};
