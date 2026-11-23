import type { Meta, StoryObj } from '@storybook/react';
import { createColumnHelper } from '@tanstack/react-table';
import { useState, type ReactNode } from 'react';
import type { BP_TableFeatures } from '../types.ts';
import { BP_Table, type BP_TableProps } from './BP_Table.tsx';
import './BP_Table.stories.css';

type Item = { item: string; quantity: number; location: string };
type CopyArgs = Pick<BP_TableProps<Item>, 'enableCopyOnSelect'>;

const helper = createColumnHelper<BP_TableFeatures, Item>();
const columns = helper.columns([
  helper.accessor('item', { header: 'Item' }),
  helper.accessor('quantity', { header: 'Quantity' }),
  helper.accessor('location', { header: 'Location' }),
]);
const data: Item[] = [
  { item: 'Desk lamp', quantity: 2, location: 'Office' },
  { item: 'Notebook', quantity: 12, location: '' },
  { item: 'Cable', quantity: 0, location: 'Storage' },
];

function ClipboardExample({ enableCopyOnSelect, children }: CopyArgs & { children: ReactNode }) {
  const [events, setEvents] = useState<string[]>([]);
  const log = (message: string) => setEvents((previous) => [...previous.slice(-9), message]);

  return (
    <>
      <p>{children} Press Ctrl+C (Cmd+C on macOS).</p>
      <div className="bp-table-demo-clipboard-table">
        <BP_Table
          data={data}
          columns={columns}
          enableFocusedCell
          enableCopyOnSelect={enableCopyOnSelect}
          htmlProps={{
            onCopy: (event) => {
              if (event.defaultPrevented) {
                log(`Copied ${JSON.stringify(event.clipboardData.getData('text/plain'))}`);
              } else {
                log(enableCopyOnSelect ? 'Copy skipped (no cell selection)' : 'Copy skipped (disabled)');
              }
            },
          }}
        />
      </div>
      <label>
        Paste here to check the result
        <textarea
          className="bp-table-demo-clipboard-paste"
          rows={3}
          onPaste={(event) => log(`Pasted ${JSON.stringify(event.clipboardData.getData('text/plain'))}`)}
        />
      </label>
      <h3>Clipboard log</h3>
      <pre role="log" aria-label="Clipboard log">{events.join('\n') || 'No clipboard events yet.'}</pre>
    </>
  );
}

const meta = {
  title: 'BP_Table/Clipboard',
  args: { enableCopyOnSelect: true },
  argTypes: { enableCopyOnSelect: { control: 'boolean' } },
} satisfies Meta<CopyArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CellRange: Story = {
  render: (args) => (
    <ClipboardExample {...args}>
      Drag from Desk lamp to the quantity 12 to select two rows and two columns.
    </ClipboardExample>
  ),
};

export const SeparateCells: Story = {
  render: (args) => (
    <ClipboardExample {...args}>
      Click Desk lamp, then Ctrl-click (Cmd-click on macOS) Office and Storage.
      Desk lamp and Office paste side by side, with Storage on the next line.
    </ClipboardExample>
  ),
};

export const CopyDisabled: Story = {
  args: { enableCopyOnSelect: false },
  render: (args) => (
    <ClipboardExample {...args}>
      Select a range to try copying with the feature turned off.
      Toggle <code>enableCopyOnSelect</code> in Controls to compare.
    </ClipboardExample>
  ),
};
