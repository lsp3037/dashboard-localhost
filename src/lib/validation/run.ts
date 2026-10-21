import { z } from 'zod';

/** Body opcional do start: só o nome de um script da allowlist; nunca comando/args (§6.2 C2/C3). */
export const startRunSchema = z.object({
  script: z.string().trim().min(1).max(32).optional(),
});

export type StartRunRequest = z.infer<typeof startRunSchema>;
