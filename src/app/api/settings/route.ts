import fs from 'node:fs';
import path from 'node:path';

import { getConfig } from '@/lib/server/config';
import { invalidBody } from '@/lib/server/errors';
import { jsonError, jsonOk, parseJsonBody } from '@/lib/server/http';
import { checkNeedsOnboarding } from '@/lib/server/overview';
import { getHubSettings, saveHubSettings } from '@/lib/server/repos/settings';
import { updateSettingsSchema } from '@/lib/validation/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const config = getConfig();
    const settings = getHubSettings();
    const needsOnboarding = checkNeedsOnboarding(config.projectsRoots);

    return jsonOk({
      projectsRoots: config.projectsRoots,
      scanDepth: config.scanDepth,
      onboardingCompleted: settings.onboardingCompleted,
      needsOnboarding,
      port: config.port,
      allowedScripts: config.allowedScripts,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleUpdate(request);
}

export async function PUT(request: Request): Promise<Response> {
  return handleUpdate(request);
}

async function handleUpdate(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request, updateSettingsSchema);

    let resolvedRoots: string[] | undefined;

    if (body.projectsRoots !== undefined) {
      resolvedRoots = [];
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
    }

    saveHubSettings({
      projectsRoots: resolvedRoots,
      scanDepth: body.scanDepth,
      onboardingCompleted: body.onboardingCompleted,
    });

    const updatedConfig = getConfig();
    const updatedSettings = getHubSettings();
    const needsOnboarding = checkNeedsOnboarding(updatedConfig.projectsRoots);

    return jsonOk({
      projectsRoots: updatedConfig.projectsRoots,
      scanDepth: updatedConfig.scanDepth,
      onboardingCompleted: updatedSettings.onboardingCompleted,
      needsOnboarding,
      port: updatedConfig.port,
      allowedScripts: updatedConfig.allowedScripts,
    });
  } catch (error) {
    return jsonError(error);
  }
}
