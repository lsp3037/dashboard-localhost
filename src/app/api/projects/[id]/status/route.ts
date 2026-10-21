import { toRunDto } from '@/lib/server/dto';
import { projectNotFound } from '@/lib/server/errors';
import { jsonError, jsonOk } from '@/lib/server/http';
import { getProcessManager } from '@/lib/server/process/manager';
import { listListeners } from '@/lib/server/process/ports';
import { getProject } from '@/lib/server/repos/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ListenerDTO {
  port: number;
  pid: number;
  external: boolean;
}

/**
 * Polling de fallback da UI (§4.2): estado do run + listeners da porta relevante.
 * Somente leitura: nunca mata nem adota listener externo.
 */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const project = getProject(id);

    if (project === null) {
      throw projectNotFound(`Projeto ${id} não encontrado.`, { id });
    }

    const manager = getProcessManager();
    const run = manager.getRun(id);
    const relevantPort = run?.port ?? project.preferredPort;

    const listeners: ListenerDTO[] = [];

    if (relevantPort !== null) {
      const owned = (await listListeners()).get(relevantPort);

      if (owned !== undefined) {
        listeners.push({ port: relevantPort, pid: owned, external: run?.port !== relevantPort });
      }
    }

    return jsonOk({
      projectId: id,
      run: run === null ? null : toRunDto(run),
      port: relevantPort,
      listeners,
    });
  } catch (error) {
    return jsonError(error);
  }
}
