import { createHash } from 'node:crypto';

export type Auth =
  | { mode: 'credentials'; identifier: string; secret: string }
  | { mode: 'admin'; username: string; passwordMd5: string };

export interface Config {
  apiUrl: string;
  auth: Auth;
  accessKey?: string;
  readOnly: boolean;
  allowSensitive: boolean;
  /** Enabled tool categories; undefined means all. */
  toolsets?: Set<string>;
  timeoutMs: number;
  userAgent: string;
}

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined || v === '') return fallback;

  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
}

/**
 * Accepts either the full endpoint (`https://x/includes/api.php`) or the
 * WHMCS base URL (`https://x` / `https://x/billing`) and normalizes it.
 */
export function normalizeApiUrl(raw: string): string {
  const url = new URL(raw.trim());

  if (!url.pathname.endsWith('.php')) {
    url.pathname = url.pathname.replace(/\/+$/, '') + '/includes/api.php';
  }

  return url.toString();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawUrl = env.WHMCS_API_URL ?? env.WHMCS_URL;

  if (!rawUrl) {
    throw new Error('WHMCS_API_URL is required (e.g. https://your-whmcs.com/includes/api.php)');
  }

  const identifier = env.WHMCS_IDENTIFIER ?? env.WHMCS_API_IDENTIFIER;
  const secret = env.WHMCS_SECRET ?? env.WHMCS_API_SECRET;
  const username = env.WHMCS_USERNAME;
  const password = env.WHMCS_PASSWORD;

  let auth: Auth;

  if (identifier && secret) {
    auth = { mode: 'credentials', identifier, secret };
  } else if (username && password) {
    // Legacy admin login: WHMCS expects the MD5 hash of the admin password.
    const passwordMd5 = bool(env.WHMCS_PASSWORD_IS_MD5)
      ? password
      : createHash('md5').update(password, 'utf8').digest('hex');

    auth = { mode: 'admin', username, passwordMd5 };
  } else {
    throw new Error(
      'Missing WHMCS credentials: set WHMCS_IDENTIFIER + WHMCS_SECRET (recommended) ' +
        'or WHMCS_USERNAME + WHMCS_PASSWORD.',
    );
  }

  const toolsets = env.WHMCS_TOOLSETS?.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return {
    apiUrl: normalizeApiUrl(rawUrl),
    auth,
    accessKey: env.WHMCS_ACCESS_KEY || undefined,
    readOnly: bool(env.WHMCS_READ_ONLY),
    allowSensitive: bool(env.WHMCS_ALLOW_SENSITIVE),
    toolsets: toolsets?.length ? new Set(toolsets) : undefined,
    timeoutMs: Number(env.WHMCS_TIMEOUT_MS) || 30_000,
    userAgent: env.WHMCS_USER_AGENT || 'whmcs-mcp',
  };
}
