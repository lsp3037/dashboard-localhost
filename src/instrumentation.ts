/**
 * Executado uma vez quando o servidor Next sobe (§9 F3.5).
 * `register` roda também no edge runtime; o bootstrap do hub é só Node.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { bootstrapHub } = await import('@/lib/server/bootstrap');
  await bootstrapHub();
}
