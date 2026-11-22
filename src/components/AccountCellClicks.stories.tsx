import type { Meta, StoryObj } from '@storybook/react';
import { useState, type ComponentType } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import type { BP_TableFeatures } from '../types.ts';
import { BP_Table, type BP_TableProps } from './BP_Table.tsx';
import './BP_Table.stories.css';

type Account = { id: string; name: string; active: boolean };

const accounts: Account[] = [
  { id: '1000', name: 'Checking', active: true },
  { id: '1100', name: 'Savings', active: false },
];
const accountHelper = createColumnHelper<BP_TableFeatures, Account>();
const accountColumns = accountHelper.columns([
  accountHelper.accessor('id', { header: 'Account number' }),
  accountHelper.accessor('name', { header: 'Account name' }),
]);

const meta = {
  title: 'BP_Table/Accounts',
  component: BP_Table as ComponentType<BP_TableProps<Account>>,
} satisfies Meta<ComponentType<BP_TableProps<Account>>>;

export default meta;

export const AccountCellClicks: StoryObj<typeof meta> = {
  args: {
    data: accounts,
    columns: accountColumns,
  },
  render: function AccountTable(args) {
    const [selected, setSelected] = useState<Account>();
    return (
      <>
        <div className="bp-table-demo-wrapper">
          <BP_Table
            {...args}
            getCellProps={({ row, column }) => ({
              className: row.original.active ? undefined : 'account-inactive',
              'data-testid': column.id === 'id' ? `account-row-${row.original.id}` : undefined,
              onClick: () => setSelected(row.original),
              style: { cursor: 'pointer' },
            })}
          />
        </div>
        {selected && (
          <p role="status">
            Account {selected.id} · {selected.name} · {selected.active ? 'Active' : 'Inactive'}
          </p>
        )}
      </>
    );
  },
};
