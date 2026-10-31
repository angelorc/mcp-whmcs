import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ACTIONS, docsUrl, findAction, type ActionInfo } from './actions.js';
import { WhmcsClient, WhmcsError } from './client.js';
import type { Config } from './config.js';
import { phpSerializeBase64, unwrapParams, type Params, type Value } from './encode.js';
import { billingTools } from './tools/billing.js';
import { clientTools } from './tools/clients.js';
import { domainTools } from './tools/domains.js';
import { orderTools } from './tools/orders.js';
import { serviceTools } from './tools/services.js';
import { supportTools } from './tools/support.js';
import { systemTools } from './tools/system.js';
import type { ToolDef } from './tools/types.js';

export const VERSION = '0.1.0';

export const ALL_TOOLS: ToolDef[] = [
  ...clientTools,
  ...serviceTools,
  ...orderTools,
  ...billingTools,
  ...domainTools,
  ...supportTools,
  ...systemTools,
];

const MAX_CHARS = Number(process.env.WHMCS_MAX_RESPONSE_CHARS) || 100_000;

const confirmField = z
  .literal(true)
  .describe('Must be true. Only set it after the user explicitly approved this destructive action.');

/**
 * Serializes a response within MAX_CHARS. When it is too large, trailing items of its
 * largest list are dropped so the output stays valid JSON, with a note on what was cut.
 */
function render(data: Params): string {
  const text = JSON.stringify(data);

  if (text.length <= MAX_CHARS) return text;

  let largest: [string, Value[]] | undefined;

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length > (largest?.[1].length ?? 0)) largest = [key, value];
  }

  if (largest) {
    const [key, items] = largest;

    const attempt = (n: number) =>
      JSON.stringify({
        ...data,
        [key]: items.slice(0, n),
        _truncated: `Showing ${n} of ${items.length} ${key}: use filters or limitstart/limitnum for the rest.`,
      });

    // Binary search for the largest prefix of the list that fits.
    let lo = 0;
    let hi = items.length;

    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);

      if (attempt(mid).length <= MAX_CHARS) lo = mid;
      else hi = mid - 1;
    }

    const fitted = attempt(lo);

    if (lo > 0 && fitted.length <= MAX_CHARS) return fitted;
  }

  return `${text.slice(0, MAX_CHARS)}\n… [truncated ${text.length - MAX_CHARS} chars; narrow the query with filters or limitstart/limitnum]`;
}

function ok(data: Params): CallToolResult {
  const { result: _result, ...rest } = data;

  return { content: [{ type: 'text', text: render(unwrapParams(rest)) }] };
}

function fail(err: Error): CallToolResult {
  const message =
    err instanceof WhmcsError ? `WHMCS ${err.action} failed: ${err.message}` : `Error: ${err.message}`;

  return { isError: true, content: [{ type: 'text', text: message }] };
}

/** Converts validated tool args into WHMCS request params. */
export function buildParams(def: ToolDef, args: Params): Params {
  const { confirm: _confirm, ...rest } = args;
  const params = def.map ? def.map(rest) : rest;

  for (const key of def.serialize ?? []) {
    const value = params[key];

    if (value !== undefined) params[key] = phpSerializeBase64(value);
  }

  for (const key of def.serializeEach ?? []) {
    const value = params[key];

    // Array.from keeps holes as undefined, so parallel-array indexes stay aligned.
    if (Array.isArray(value)) {
      params[key] = Array.from(value, (v) => (v === undefined ? undefined : phpSerializeBase64(v)));
    }
  }

  return params;
}

function isAllowed(info: ActionInfo, config: Config): boolean {
  if (config.readOnly && info.kind !== 'read') return false;

  if (info.sensitive && !config.allowSensitive) return false;

  return true;
}

export function selectTools(config: Config): ToolDef[] {
  return ALL_TOOLS.filter((def) => {
    const info = ACTIONS.get(def.action);

    if (!info) throw new Error(`Tool ${def.name} references unknown action ${def.action}`);

    if (config.toolsets && !config.toolsets.has(def.toolset)) return false;

    return isAllowed(info, config);
  });
}

/** Unknown actions (e.g. added by third-party addons) are treated as destructive. */
const CUSTOM_ACTION: ActionInfo = { category: 'Custom', kind: 'destructive', sensitive: false };

export function createServer(config: Config, client = new WhmcsClient(config)): McpServer {
  const run = async (action: string, params: Params): Promise<CallToolResult> => {
    try {
      return ok(await client.call(action, params));
    } catch (err) {
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const server = new McpServer(
    { name: 'whmcs', version: VERSION },
    {
      instructions: [
        'Tools for administering a WHMCS billing/hosting installation through its External API.',
        'Typical flow: find the client (whmcs_get_clients) → inspect services/domains/invoices/tickets by client ID → act.',
        'IDs are numeric database IDs; ticket "ticketnum" is the public ticket number.',
        'Destructive tools require confirm=true: ask the user first.',
        'For any WHMCS action without a dedicated tool, use whmcs_list_actions and whmcs_call_api.',
        config.readOnly ? 'This server is in READ-ONLY mode: write actions are disabled.' : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  );

  for (const def of selectTools(config)) {
    const info = ACTIONS.get(def.action)!;
    const destructive = info.kind === 'destructive';
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: `${def.description}\n\nWHMCS action: ${def.action} (${docsUrl(def.action)})`,
        inputSchema: destructive ? { ...def.input, confirm: confirmField } : def.input,
        annotations: {
          title: def.title,
          readOnlyHint: info.kind === 'read',
          destructiveHint: destructive,
          idempotentHint: info.kind === 'read',
          openWorldHint: true,
        },
      },
      async (args) => run(def.action, buildParams(def, args)),
    );
  }

  server.registerTool(
    'whmcs_list_actions',
    {
      title: 'List WHMCS API actions',
      description:
        'List every WHMCS API action with category, kind (read/write/destructive), whether it is allowed by the current configuration and its documentation URL. Use before whmcs_call_api.',
      inputSchema: {
        category: z.string().optional().describe('Filter by category, e.g. Billing, Domains, Support'),
        kind: z.enum(['read', 'write', 'destructive']).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ category, kind }) => {
      const curated = new Map(ALL_TOOLS.map((t) => [t.action, t.name]));

      const rows = [...ACTIONS].flatMap(([action, i]) => {
        if (category && i.category.toLowerCase() !== category.toLowerCase()) return [];

        if (kind && i.kind !== kind) return [];

        return [
          {
            action,
            category: i.category,
            kind: i.kind,
            sensitive: i.sensitive || undefined,
            allowed: isAllowed(i, config),
            tool: curated.get(action),
            docs: docsUrl(action),
          },
        ];
      });

      return ok({ count: rows.length, actions: rows });
    },
  );

  server.registerTool(
    'whmcs_call_api',
    {
      title: 'Call any WHMCS API action',
      description:
        'Call any WHMCS API action (including custom actions added by addon modules) with raw parameters. ' +
        'Prefer the dedicated whmcs_* tools when one exists. Nested objects/arrays are sent in PHP bracket notation; ' +
        'list in `serialize` the params WHMCS expects as base64-encoded serialized arrays (e.g. customfields). ' +
        'Write/destructive and unknown actions require confirm=true.',
      inputSchema: {
        action: z.string().describe('WHMCS action name, e.g. GetClientsDetails'),
        params: z.record(z.string(), z.json()).optional().describe('Action parameters'),
        serialize: z.array(z.string()).optional().describe('Param names to send as base64(serialize(value))'),
        confirm: z.boolean().optional().describe('Required (true) for non-read actions, after user approval'),
      },
      annotations: { readOnlyHint: config.readOnly, destructiveHint: !config.readOnly, openWorldHint: true },
    },
    async ({ action, params = {}, serialize = [], confirm }) => {
      const found = findAction(action);

      const [name, info] = found ?? [action, CUSTOM_ACTION];

      if (!isAllowed(info, config)) {
        return fail(
          new Error(
            config.readOnly && info.kind !== 'read'
              ? `${name} is a ${info.kind} action and the server runs with WHMCS_READ_ONLY=true.`
              : `${name} is sensitive; set WHMCS_ALLOW_SENSITIVE=true to enable it.`,
          ),
        );
      }

      if (info.kind !== 'read' && confirm !== true) {
        return fail(
          new Error(
            `${name} is a ${info.kind} action${found ? '' : ' (unknown action)'}: ask the user, then retry with confirm=true.`,
          ),
        );
      }

      const def: ToolDef = {
        name: 'whmcs_call_api',
        action: name,
        title: '',
        description: '',
        toolset: '',
        input: {},
        serialize,
      };

      return run(name, buildParams(def, params));
    },
  );

  return server;
}
