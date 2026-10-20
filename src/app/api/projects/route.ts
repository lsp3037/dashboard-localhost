import fs from 'node:fs/promises';

import { getConfig } from '@/lib/server/config';
import { resolveAllowedPath } from '@/lib/server/discovery/paths';
import { inspectProjectPath } from '@/lib/server/discovery/scan';
import { toProjectDto } from '@/lib/server/dto';
import { alreadyExists, invalidBody, notAProject, notFound } from '@/lib/server/errors';
import { jsonError, jsonOk, parseJsonBody } from '@/lib/server/http';
import { findProjectByPath, insertManualProject, listProjects } from '@/lib/server/repos/projects';
import { createProjectSchema } from '@/lib/validation/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const { allowedScripts } = getConfig();
    const projects = listProjects({ includeHidden: true }).map((project) => toProjectDto(project, allowedScripts));

    return jsonOk({ projects });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request, createProjectSchema);
    const absolutePath = resolveAllowedPath(body.path);

    let stats: Awaited<ReturnType<typeof fs.stat>>;

    try {
      stats = await fs.stat(absolutePath);
    } catch {
      throw notFound(`Caminho não encontrado: ${body.path}`, { path: body.path });
    }

    if (!stats.isDirectory()) {
      throw invalidBody(`O caminho não é um diretório: ${body.path}`, { path: body.path });
    }

    const scanned = await inspectProjectPath(absolutePath, { name: body.name });

    if (scanned === null) {
      throw notAProject(`Sem package.json nem .git em ${body.path}`, { path: body.path });
    }

    if (findProjectByPath(absolutePath) !== null) {
      throw alreadyExists(`Projeto já cadastrado para ${absolutePath}`, { path: absolutePath });
    }

    const created = insertManualProject({
      path: absolutePath,
      name: scanned.name,
      kind: scanned.kind,
      stack: scanned.stack,
      packageManager: scanned.packageManager,
      scripts: scanned.scripts,
      gitBranch: scanned.gitBranch,
      gitHeadAt: scanned.gitHeadAt,
    });

    return jsonOk({ project: toProjectDto(created, getConfig().allowedScripts) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
