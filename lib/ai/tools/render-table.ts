import { tool } from 'ai';
import { z } from 'zod';

// A generic table-rendering tool. The model should provide columns and rows.
// We validate and echo the structure back for the UI to render with TanStack Table.
export const renderTable = tool({
  description:
    'Render a table in the UI using TanStack Table. Provide columns and rows. Keep rows small and paginated if large.',
  inputSchema: z.object({
    caption: z.string().optional().describe('Optional caption for the table'),
    columns: z
      .array(
        z
          .object({
            id: z.string().min(1).describe('Unique column identifier'),
            header: z.string().optional().describe('Header label to display'),
            accessorKey: z
              .string()
              .optional()
              .describe('Key to read from each row; defaults to id'),
            // Optional width or alignment hints
            width: z.number().optional(),
            align: z.enum(['left', 'center', 'right']).optional(),
          })
          .strict(),
      )
      .min(1),
    rows: z
      .array(
        z
          .record(z.any())
          .describe(
            'Array of row objects; keys should match column id/accessorKey values',
          ),
      )
      .min(0),
    // Optional sorting and paging hints for the client renderer
    initialSorting: z
      .array(
        z.object({ id: z.string(), desc: z.boolean().optional() }).strict(),
      )
      .optional(),
    pageSize: z.number().min(1).max(200).optional(),
  }),
  execute: async (input) => {
    // No server-side processing required; just echo the validated shape
    return input;
  },
});
