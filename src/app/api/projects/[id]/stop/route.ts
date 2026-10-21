import { toRunDto } from '@/lib/server/dto';
import { projectNotFound } from '@/lib/server/errors';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getProcessManager } from '@/lib/server/process/manager';
import { getProject } from '@/lib/server/repos/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Encerra a árvore de processos do run ativo (§4.2). Idempotente apenas para "já morreu". */
export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const project = getProject(id);

    if (project === null) {
      throw projectNotFound(`Projeto ${id} não encontrado.`, { id });
    }

    const run = await getProcessManager().stop(id);

    return jsonOk({ run: toRunDto(run) });
  } catch (error) {
    return jsonError(error);
  }
}
