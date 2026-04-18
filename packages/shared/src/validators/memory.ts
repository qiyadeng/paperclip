import { z } from "zod";

export const upsertMemoryFileSchema = z.object({
  path: z.string().min(1),
  content: z.string().max(1_048_576),
});

export type UpsertMemoryFile = z.infer<typeof upsertMemoryFileSchema>;
