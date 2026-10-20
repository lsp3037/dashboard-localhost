import { getConfig } from '@/lib/server/config';
import { toProjectDto } from '@/lib/server/dto';
import { notFound, scriptNotAllowed } from '@/lib/server/errors';
import { jsonError, jsonOk, noContent, parseJsonBody } from '@/lib/server/http';
import { deleteProject, getProject, hideProject, updateProject } from '@/lib/server/repos/projects';
import { updateProjectSchema } from '@/lib/validation/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateProjectSchema);
    const existing = getProject(id);

    if (existing === null) {
      throw notFound(`Projeto ${id} não encontrado.`, { id });
    }

    if (body.defaultScript !== undefined && body.defaultScript !== null) {
      const { allowedScripts } = getConfig();

      if (!existing.scripts.includes(body.defaultScript) || !allowedScripts.includes(body.defaultScript)) {
        throw scriptNotAllowed(`Script "${body.defaultScript}" não está disponível para ${existing.name}.`, {
          script: body.defaultScript,
          scripts: existing.scripts,
          allowedScripts: [...allowedScripts],
        });
      }
    }

    const updated = updateProject(id, body);

    return jsonOk({ project: toProjectDto(updated, getConfig().allowedScripts) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const hard = new URL(request.url).searchParams.get('hard') === '1';

    if (hard) {
      const removed = deleteProject(id);

      if (removed === null) {
        throw notFound(`Projeto ${id} não encontrado.`, { id });
      }

      return noContent();
    }

    const hidden = hideProject(id);

    return jsonOk({ project: toProjectDto(hidden, getConfig().allowedScripts) });
  } catch (error) {
    return jsonError(error);
  }
}
