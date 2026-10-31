import { z } from 'zod';
import type { Params, Value } from '../encode.js';

/** Every tool argument is JSON-compatible, so it can be encoded for WHMCS as-is. */
export type ToolInput = Record<string, z.ZodType<Value>>;

export interface ToolDef {
  /** MCP tool name, always prefixed with `whmcs_`. */
  name: string;
  /** WHMCS API action; kind/sensitivity come from the action catalog. */
  action: string;
  title: string;
  description: string;
  toolset: string;
  input: ToolInput;
  /** Params sent as base64_encode(serialize($value)). */
  serialize?: string[];
  /** Array params whose items are each sent as base64_encode(serialize($item)). */
  serializeEach?: string[];
  /** Custom mapping from tool args to WHMCS params (applied before serialization). */
  map?: (args: Params) => Params;
}

export interface ToolSpec<S extends ToolInput> extends Omit<ToolDef, 'input' | 'map'> {
  input: S;
  map?: (args: z.infer<z.ZodObject<S>>) => Params;
}

/** Declares a tool whose `map` receives arguments typed from its own input schema. */
export function defineTool<S extends ToolInput>(spec: ToolSpec<S>): ToolDef {
  const { map, ...def } = spec;

  if (!map) return def;

  const schema = z.object(spec.input);

  return { ...def, map: (args) => map(schema.parse(args)) };
}

export const id = (what: string) => z.number().int().positive().describe(what);

/** WHMCS custom fields / config options keyed by field ID. */
export const fieldMap = (what: string) =>
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).describe(what);

export const pagination = {
  limitstart: z.number().int().min(0).optional().describe('Offset of the first record (default 0)'),
  limitnum: z.number().int().min(1).max(1000).optional().describe('Records to return (WHMCS default 25)'),
};

export const date = (what: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD')
    .describe(`${what} (YYYY-MM-DD)`);

export const billingCycle = z.enum([
  'free',
  'onetime',
  'monthly',
  'quarterly',
  'semiannually',
  'annually',
  'biennially',
  'triennially',
]);

export const sortOrder = z.enum(['ASC', 'DESC']);

/** WHMCS invoice line items are passed as numbered fields: itemdescription1, itemamount1, ... */
export const invoiceItem = z.object({
  description: z.string(),
  amount: z.number(),
  taxed: z.boolean().optional(),
});
