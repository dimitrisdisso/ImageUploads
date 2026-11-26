/** An error whose message is safe to show to the visitor. */
export class PublicError extends Error {
  readonly expose = true;
}

/**
 * Runs a server-function body and hides internal failures: database, configuration and library
 * errors are logged on the server and the browser only receives "server_error".
 */
export async function guarded<R>(fn: () => Promise<R>): Promise<R> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && (error as { expose?: unknown }).expose === true) throw new Error(error.message);
    console.error(error);
    throw new Error("server_error");
  }
}
