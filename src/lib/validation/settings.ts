import { z } from 'zod';

export const updateSettingsSchema = z.object({
  projectsRoots: z.array(z.string().trim().min(1).max(1024)).min(1).optional(),
  scanDepth: z.union([z.literal(1), z.literal(2)]).optional(),
  onboardingCompleted: z.boolean().optional(),
  cleanPreviousScan: z.boolean().optional(),
});

export const onboardingRequestSchema = z.object({
  projectsRoots: z.array(z.string().trim().min(1).max(1024)).min(1, 'Selecione ao menos uma pasta de projetos.'),
  scanDepth: z.union([z.literal(1), z.literal(2)]).optional(),
  cleanPreviousScan: z.boolean().optional(),
});

export type UpdateSettingsRequest = z.infer<typeof updateSettingsSchema>;
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;
