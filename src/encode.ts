/**
 * Encoding helpers for the WHMCS API.
 *
 * WHMCS is a PHP application that reads `application/x-www-form-urlencoded`
 * bodies, so nested values must use PHP bracket notation (`pid[0]=1`,
 * `pricing[1][monthly]=9.99`). A few parameters (custom fields, configurable
 * options, quote line items, ...) must instead be sent as
 * `base64_encode(serialize($array))`, which `phpSerialize` reproduces.
 */

export type Scalar = string | number | boolean | null | undefined;

export type Value = Scalar | Value[] | { [key: string]: Value };

/** Named request/response parameters of a WHMCS action. */
export type Params = Record<string, Value>;

/** PHP booleans: the string "false" is truthy in PHP, so send 1/0. */
function scalarToString(v: Exclude<Scalar, null | undefined>): string {
  if (typeof v === 'boolean') return v ? '1' : '0';

  return String(v);
}

/** Flatten a params object into form fields using PHP bracket notation. */
export function toFormBody(params: Params): URLSearchParams {
  const body = new URLSearchParams();

  const walk = (key: string, value: Value): void => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(`${key}[${i}]`, item));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(`${key}[${k}]`, v);
    } else {
      body.append(key, scalarToString(value));
    }
  };

  for (const [k, v] of Object.entries(params)) walk(k, v);

  return body;
}

function serializeString(s: string): string {
  return `s:${Buffer.byteLength(s, 'utf8')}:"${s}";`;
}

function serializeKey(k: string | number): string {
  const n = typeof k === 'number' ? k : /^(0|-?[1-9][0-9]*)$/.test(k) ? Number(k) : NaN;

  return Number.isSafeInteger(n) ? `i:${n};` : serializeString(String(k));
}

/** Minimal PHP `serialize()` for JSON-compatible values. */
export function phpSerialize(value: Value): string {
  if (value === null || value === undefined) return 'N;';

  if (typeof value === 'boolean') return `b:${value ? 1 : 0};`;

  if (typeof value === 'number') {
    return Number.isInteger(value) ? `i:${value};` : `d:${value};`;
  }

  if (typeof value === 'string') return serializeString(value);

  const entries: [string | number, Value][] = Array.isArray(value)
    ? value.map((v, i) => [i, v])
    : Object.entries(value);

  return `a:${entries.length}:{${entries.map(([k, v]) => serializeKey(k) + phpSerialize(v)).join('')}}`;
}

/** `base64_encode(serialize($value))`, the format WHMCS expects for array params. */
export function phpSerializeBase64(value: Value): string {
  return Buffer.from(phpSerialize(value), 'utf8').toString('base64');
}

/**
 * WHMCS wraps lists as {"clients": {"client": [...]}}; collapse those
 * single-key wrappers so the model sees plain arrays.
 */
export function unwrap(value: Value): Value {
  if (Array.isArray(value)) return value.map(unwrap);

  if (value === null || typeof value !== 'object') return value;

  const entries = Object.entries(value);

  if (entries.length === 1 && Array.isArray(entries[0][1])) return unwrap(entries[0][1]);

  return Object.fromEntries(entries.map(([k, v]) => [k, unwrap(v)]));
}

/** `unwrap` for every field of a response, keeping it a record. */
export function unwrapParams(params: Params): Params {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, unwrap(v)]));
}
