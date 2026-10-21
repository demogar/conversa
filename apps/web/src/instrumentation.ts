/** Runs once when the server starts. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { forwardClientAddresses } = await import('./lib/forwarded-for');
  forwardClientAddresses();
}
