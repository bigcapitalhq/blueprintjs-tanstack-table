import type { Meta, StoryObj } from '@storybook/react';
import { createColumnHelper, type ColumnMeta } from '@tanstack/react-table';
import { useMemo } from 'react';
import type { BP_TableFeatures } from '../types.ts';
import { BP_Table } from './BP_Table.tsx';
import './BP_Table.stories.css';

type InvoiceLine = { item: string; quantity: number; unitPrice: string; amount: string };
type TabularNums = Pick<ColumnMeta<BP_TableFeatures, InvoiceLine>, 'tabularNums'>;

const helper = createColumnHelper<BP_TableFeatures, InvoiceLine>();
const data: InvoiceLine[] = [
  { item: 'Desk lamp', quantity: 2, unitPrice: '$39.00', amount: '$78.00' },
  { item: 'Notebook', quantity: 12, unitPrice: '$4.50', amount: '$54.00' },
  { item: 'Desk mat', quantity: 1, unitPrice: '$25.00', amount: '$25.00' },
  { item: 'Monitor stand', quantity: 8, unitPrice: '$11.25', amount: '$90.00' },
];

const meta = {
  title: 'BP_Table/Column Tabular Nums',
  args: { tabularNums: true },
  argTypes: {
    tabularNums: {
      description: 'Apply font-variant-numeric: tabular-nums to the numeric columns.',
      control: 'boolean',
    },
  },
  render: function TabularNumsTable({ tabularNums }) {
    const columns = useMemo(() => helper.columns([
      helper.accessor('item', { header: 'Item', size: 180, meta: { textAlign: 'start' } }),
      helper.accessor('quantity', { header: 'Quantity', size: 100, meta: { textAlign: 'end', tabularNums } }),
      helper.accessor('unitPrice', { header: 'Unit Price', size: 120, meta: { textAlign: 'end', tabularNums } }),
      helper.accessor('amount', { header: 'Amount', size: 120, meta: { textAlign: 'end', tabularNums } }),
    ]), [tabularNums]);

    return (
      <div className="bp-table-demo-wrapper">
        <BP_Table data={data} columns={columns} />
      </div>
    );
  },
} satisfies Meta<TabularNums>;

export default meta;
export const AmountColumns: StoryObj<typeof meta> = {};
