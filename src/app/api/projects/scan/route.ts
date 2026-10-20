import { getConfig } from '@/lib/server/config';
import { resolveAllowedPath } from '@/lib/server/discovery/paths';
import { scanProjects } from '@/lib/server/discovery/scan';
import { pathNotAllowed } from '@/lib/server/errors';
import { jsonError, jsonOk, parseJsonBody } from '@/lib/server/http';
import { scanRequestSchema } from '@/lib/validation/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request, scanRequestSchema);
    const config = getConfig();
    const requestedRoots = body.roots ?? [...config.projectsRoots];

    if (requestedRoots.length === 0) {
      throw pathNotAllowed('Nenhuma raiz informada para escanear.', { roots: [] });
    }

    // Allowlist antes de qualquer leitura de disco: raiz fora da config → 403.
    const roots = requestedRoots.map((root) => resolveAllowedPath(root));
    const result = await scanProjects({ roots, maxDepth: body.depth ?? config.scanDepth });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
