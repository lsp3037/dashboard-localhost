import { z } from 'zod';

/** Body opcional do scan: raízes e profundidade precisam estar na config/allowlist. */
export const scanRequestSchema = z.object({
  roots: z.array(z.string().trim().min(1).max(1024)).max(16).optional(),
  depth: z.union([z.literal(1), z.literal(2)]).optional(),
});

export const createProjectSchema = z.object({
  path: z.string().trim().min(1).max(1024),
  name: z.string().trim().min(1).max(120).optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    notes: z.string().max(4_000).nullable().optional(),
    preferredPort: z.number().int().min(1).max(65_535).nullable().optional(),
    defaultScript: z.string().trim().min(1).max(32).nullable().optional(),
    hidden: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export type ScanRequest = z.infer<typeof scanRequestSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectSchema>;
