/**
 * Live tests against the WHMCS instance configured in `.env` (Bun loads it automatically).
 *
 * The server is always started with WHMCS_READ_ONLY=true, so these tests can run against
 * production: no tool that creates, changes or deletes records is even registered.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

const configured = Boolean(process.env.WHMCS_API_URL);

const textResult = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
});

const record = z.record(z.string(), z.json());

const list = z.array(record);

let client: Client;

/** Calls a tool and returns its decoded JSON payload, failing the test on tool errors. */
async function call(name: string, args: Record<string, z.infer<typeof record>[string]> = {}) {
  const result = textResult.parse(await client.callTool({ name, arguments: args }));

  expect(result.isError ?? false, result.content[0]?.text).toBe(false);

  return record.parse(JSON.parse(result.content[0].text));
}

async function callError(name: string, args: Record<string, z.infer<typeof record>[string]>) {
  const result = textResult.parse(await client.callTool({ name, arguments: args }));

  expect(result.isError).toBe(true);

  return result.content[0].text;
}

/** Returns the first record of a list field, or undefined when the list is empty. */
function first(data: z.infer<typeof record>, key: string) {
  const parsed = list.safeParse(data[key]);

  return parsed.success ? parsed.data[0] : undefined;
}

describe.skipIf(!configured)('live WHMCS (read-only)', () => {
  beforeAll(async () => {
    const env = Object.fromEntries(
      Object.entries(process.env).flatMap(([k, v]) => (v === undefined ? [] : [[k, v]])),
    );

    client = new Client({ name: 'whmcs-mcp-live-test', version: '0' });
    await client.connect(
      new StdioClientTransport({
        command: 'bun',
        args: ['src/index.ts'],
        env: { ...env, WHMCS_READ_ONLY: 'true', WHMCS_ALLOW_SENSITIVE: 'false' },
        stderr: 'ignore',
      }),
    );
  });

  afterAll(() => client?.close());

  test('only read-only tools are registered', async () => {
    const { tools } = await client.listTools();

    expect(tools.length).toBeGreaterThan(40);

    for (const tool of tools) {
      if (tool.name !== 'whmcs_call_api') expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  test('connects and reports the WHMCS version', async () => {
    const data = await call('whmcs_whmcs_details');

    expect(JSON.stringify(data)).toMatch(/\d+\.\d+/);
  });

  test('dashboard stats', async () => {
    const data = await call('whmcs_get_stats');

    expect(data).toHaveProperty('income_today');
  });

  test('clients → details, services, domains, invoices', async () => {
    const clients = await call('whmcs_get_clients', { limitnum: 2 });

    expect(Number(clients.totalresults)).toBeGreaterThan(0);

    const c = first(clients, 'clients');

    expect(c).toBeDefined();

    const clientid = Number(c?.id);
    const details = await call('whmcs_get_client_details', { clientid, stats: true });

    expect(Number(details.userid ?? record.parse(details.client).id)).toBe(clientid);

    const owned = await Promise.all(
      ['whmcs_get_client_products', 'whmcs_get_client_domains'].map((tool) =>
        call(tool, { clientid, limitnum: 5 }),
      ),
    );

    for (const data of owned) expect(data).toHaveProperty('totalresults');

    const invoices = await call('whmcs_get_invoices', { userid: clientid, limitnum: 2 });

    expect(invoices).toHaveProperty('totalresults');
  });

  test('invoice detail', async () => {
    const invoice = first(await call('whmcs_get_invoices', { limitnum: 1 }), 'invoices');

    if (!invoice) return;

    const data = await call('whmcs_get_invoice', { invoiceid: Number(invoice.id) });

    expect(Number(data.invoiceid)).toBe(Number(invoice.id));
  });

  test('tickets → ticket detail', async () => {
    const tickets = await call('whmcs_get_tickets', { limitnum: 1 });
    const ticket = first(tickets, 'tickets');

    if (!ticket) return;

    const data = await call('whmcs_get_ticket', { ticketid: Number(ticket.id) });

    expect(Number(data.ticketid)).toBe(Number(ticket.id));
  });

  test('catalog and configuration lookups', async () => {
    const tools = [
      'whmcs_get_orders',
      'whmcs_get_products',
      'whmcs_get_currencies',
      'whmcs_get_payment_methods',
      'whmcs_get_support_departments',
      'whmcs_get_support_statuses',
      'whmcs_get_ticket_counts',
      'whmcs_get_admin_users',
    ];

    await Promise.all(tools.map((tool) => call(tool, tool === 'whmcs_get_orders' ? { limitnum: 2 } : {})));
  });

  test('oversized responses are cut to valid JSON', async () => {
    const data = await call('whmcs_get_products');

    expect(data.products).toBeDefined();
  });

  test('WHMCS errors surface as tool errors', async () => {
    const text = await callError('whmcs_get_invoice', { invoiceid: 999_999_999 });

    expect(text).toMatch(/GetInvoice failed/);
  });

  test('generic call_api allows reads and blocks writes', async () => {
    const actions = await call('whmcs_list_actions', { kind: 'destructive' });

    expect(Number(actions.count)).toBeGreaterThan(10);

    const admin = await call('whmcs_call_api', { action: 'getadmindetails' });

    expect(admin).toHaveProperty('adminid');

    expect(
      await callError('whmcs_call_api', { action: 'DeleteClient', params: { clientid: 1 }, confirm: true }),
    ).toMatch(/READ_ONLY/);
    expect(await callError('whmcs_call_api', { action: 'MyAddonAction', confirm: true })).toMatch(
      /READ_ONLY/,
    );
  });
});
