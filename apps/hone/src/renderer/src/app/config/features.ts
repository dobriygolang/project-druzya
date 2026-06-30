/** Parse VITE_* boolean: "true"|"1" → true, "false"|"0" → false, else undefined. */
function readBoolEnv(raw: string | undefined): boolean | undefined {
  const v = raw?.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

/**
 * Dev username/passwordless login (identity DEV_AUTH=true).
 * Default: on in `vite dev`, off in production builds.
 */
export const DEV_LOGIN_ENABLED =
  readBoolEnv(import.meta.env.VITE_HONE_DEV_LOGIN) ?? import.meta.env.DEV;
