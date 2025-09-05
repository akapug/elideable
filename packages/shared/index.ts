import { z } from 'zod';

export const DiffAction = z.enum(['create', 'overwrite', 'append', 'modify']);
export const FileDiff = z.object({
  path: z.string(),
  action: DiffAction,
  contents: z.string().optional(),
});
export const Plan = z.object({
  summary: z.string(),
  files: z.array(FileDiff),
});
export type Plan = z.infer<typeof Plan>;
export type FileDiff = z.infer<typeof FileDiff>;

