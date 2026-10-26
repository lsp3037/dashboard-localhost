import fs from 'node:fs';
import path from 'node:path';

import { scanProjects } from '@/lib/server/discovery/scan';
import { invalidBody } from '@/lib/server/errors';
import { jsonError, jsonOk, parseJsonBody } from '@/lib/server/http';
import { saveHubSettings } from '@/lib/server/repos/settings';
import { onboardingRequestSchema } from '@/lib/validation/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request, onboardingRequestSchema);

    const resolvedRoots: string[] = [];
    for (const raw of body.projectsRoots) {
      const resolved = path.resolve(raw);
      if (!fs.existsSync(resolved)) {
        throw invalidBody(`O diretório informado não existe: ${resolved}`);
      }
      if (!fs.statSync(resolved).isDirectory()) {
        throw invalidBody(`O caminho informado não é um diretório: ${resolved}`);
      }
      if (!resolvedRoots.includes(resolved)) {
        resolvedRoots.push(resolved);
      }
    }

    const depth = body.scanDepth ?? 2;

    saveHubSettings({
      projectsRoots: resolvedRoots,
      scanDepth: depth,
      onboardingCompleted: true,
    });

    const scanResult = await scanProjects({
      roots: resolvedRoots,
      maxDepth: depth,
    });

    return jsonOk({
      ok: true,
      settings: {
        projectsRoots: resolvedRoots,
        scanDepth: depth,
        onboardingCompleted: true,
      },
      scan: scanResult,
    });
  } catch (error) {
    return jsonError(error);
  }
}
