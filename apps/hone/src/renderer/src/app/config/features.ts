/** Parse VITE_* boolean: "true"|"1" → true, "false"|"0" → false, else undefined. */
function readBoolEnv(raw: string | undefined): boolean | undefined {
  const v = raw?.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

/**
 * Local-only data mode — notes/tasks/focus persist on device, no cloud sync.
 * Auth (login) is unchanged. Set VITE_HONE_LOCAL_ONLY=false for cloud APIs.
 */
export const LOCAL_ONLY =
  readBoolEnv(import.meta.env.VITE_HONE_LOCAL_ONLY) ?? true;

/**
 * Dev username/passwordless login (identity DEV_AUTH=true).
 * Default: on in `vite dev`, off in production builds.
 */
export const DEV_LOGIN_ENABLED =
  readBoolEnv(import.meta.env.VITE_HONE_DEV_LOGIN) ?? import.meta.env.DEV;
