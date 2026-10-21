import { toRunDto } from '@/lib/server/dto';
import { isHubPath } from '@/lib/server/discovery/paths';
import { projectNotFound, projectRunning } from '@/lib/server/errors';
import { jsonError, jsonOk, parseJsonBody } from '@/lib/server/http';
import { getProcessManager } from '@/lib/server/process/manager';
import { getProject } from '@/lib/server/repos/projects';
import { startRunSchema } from '@/lib/validation/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Inicia o dev server do projeto (§4.2). Todo o comando é montado no servidor:
 * o body só pode trazer o nome de um script da allowlist.
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const project = getProject(id);

    if (project === null) {
      throw projectNotFound(`Projeto ${id} não encontrado.`, { id });
    }

    if (isHubPath(project.path)) {
      throw projectRunning('O próprio hub já está rodando e não pode se iniciar.', { id });
    }

    const body = await parseJsonBody(request, startRunSchema);
    const run = await getProcessManager().start(project, body.script ?? null);

    return jsonOk({ run: toRunDto(run) }, 202);
  } catch (error) {
    return jsonError(error);
  }
}
