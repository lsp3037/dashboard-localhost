import { getConfig } from '@/lib/server/config';
import { attachRuns, toProjectDto } from '@/lib/server/dto';
import { notFound, projectRunning, scriptNotAllowed } from '@/lib/server/errors';
import { jsonError, jsonOk, noContent, parseJsonBody } from '@/lib/server/http';
import { deleteProject, getProject, hideProject, updateProject } from '@/lib/server/repos/projects';
import type { ProjectRow } from '@/lib/server/repos/projects';
import { getActiveRun, getLastFinishedRun } from '@/lib/server/repos/runs';
import type { ProjectDTO } from '@/lib/shared/types';
import { updateProjectSchema } from '@/lib/validation/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function projectPayload(id: string, row: ProjectRow): { project: ProjectDTO } {
  return {
    project: attachRuns(
      toProjectDto(row, getConfig().allowedScripts),
      getActiveRun(id),
      getLastFinishedRun(id),
    ),
  };
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

    return jsonOk(projectPayload(id, updated));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const hard = new URL(request.url).searchParams.get('hard') === '1';

    if (hard) {
      if (getActiveRun(id) !== null) {
        throw projectRunning(`Projeto ${id} tem execução ativa; pare antes de remover.`, { id });
      }

      const removed = deleteProject(id);

      if (removed === null) {
        throw notFound(`Projeto ${id} não encontrado.`, { id });
      }

      return noContent();
    }

    const hidden = hideProject(id);

    return jsonOk(projectPayload(id, hidden));
  } catch (error) {
    return jsonError(error);
  }
}
