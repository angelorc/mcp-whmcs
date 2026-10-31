import { z } from 'zod';
import type { Config } from './config.js';
import { toFormBody, type Params } from './encode.js';

/** Every WHMCS JSON reply carries `result`; failures add `message`. */
const responseSchema = z
  .object({ result: z.string().optional(), message: z.string().optional() })
  .catchall(z.json());

export type WhmcsResponse = z.infer<typeof responseSchema>;

export class WhmcsError extends Error {
  constructor(
    message: string,
    readonly action: string,
    readonly status?: number,
    readonly response?: WhmcsResponse,
  ) {
    super(message);
    this.name = 'WhmcsError';
  }
}

export class WhmcsClient {
  constructor(private readonly config: Config) {}

  private authFields(): Record<string, string> {
    const { auth, accessKey } = this.config;

    const fields: Record<string, string> =
      auth.mode === 'credentials'
        ? { identifier: auth.identifier, secret: auth.secret }
        : { username: auth.username, password: auth.passwordMd5 };

    if (accessKey) fields.accesskey = accessKey;

    return fields;
  }

  /** Calls a WHMCS API action and returns the decoded JSON response. */
  async call(action: string, params: Params = {}): Promise<WhmcsResponse> {
    const body = toFormBody({ ...params, ...this.authFields(), action, responsetype: 'json' });

    let res: Response;

    try {
      res = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': this.config.userAgent,
        },
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new WhmcsError(`Request to WHMCS failed: ${reason}`, action);
    }

    const text = await res.text();
    let data: WhmcsResponse | undefined;

    try {
      data = responseSchema.safeParse(JSON.parse(text)).data;
    } catch {
      // Not JSON at all: handled below together with JSON that is not an object.
    }

    if (!data) {
      const snippet = text.slice(0, 300).replace(/\s+/g, ' ').trim();
      throw new WhmcsError(
        `WHMCS returned a non-JSON response (HTTP ${res.status}): ${snippet || '<empty>'}`,
        action,
        res.status,
      );
    }

    // WHMCS reports failures as {"result":"error","message":"..."}, sometimes with HTTP 200;
    // a few actions (e.g. GetInvoice) use {"status":"error"} instead.
    if (data.result === 'error' || data.status === 'error' || !res.ok) {
      throw new WhmcsError(hint(data.message ?? `HTTP ${res.status}`), action, res.status, data);
    }

    return data;
  }
}

/** Adds remediation hints to the most common WHMCS errors. */
function hint(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid ip')) {
    return `${message}: whitelist this machine's IP in WHMCS (Configuration > System Settings > General Settings > Security > API IP Access Restriction) or set WHMCS_ACCESS_KEY.`;
  }

  if (m.includes('authentication failed') || m.includes('invalid or missing credentials')) {
    return `${message}: check WHMCS_IDENTIFIER/WHMCS_SECRET (or WHMCS_USERNAME/WHMCS_PASSWORD) and that the admin role has API access.`;
  }

  if (m.includes('malformed utf-8')) {
    return `${message}: WHMCS could not JSON-encode data stored with an invalid charset; narrow the query (limitnum, filters) to skip the broken record.`;
  }

  if (m.includes('permission') && m.includes('denied')) {
    return `${message}: the API role assigned to these credentials does not allow this action.`;
  }

  return message;
}
