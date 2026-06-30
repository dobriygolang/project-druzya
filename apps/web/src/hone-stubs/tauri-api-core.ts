export async function invoke<T = unknown>(
  _cmd: string,
  _args?: Record<string, unknown>,
): Promise<T> {
  throw new Error('Tauri IPC is unavailable in the web demo');
}
