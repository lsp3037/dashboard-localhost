import { listDirectories } from '@/lib/server/discovery/directories';
import { jsonError, jsonOk } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const targetPath = url.searchParams.get('path');
    const result = await listDirectories(targetPath);

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
