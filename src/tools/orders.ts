import { z } from 'zod';
import { billingCycle, defineTool, fieldMap, id, pagination, type ToolDef } from './types.js';

const orderId = { orderid: id('Order ID') };

const orderItem = z.object({
  pid: z.number().int().describe('Product ID'),
  billingcycle: billingCycle.optional(),
  domain: z.string().optional().describe('Domain associated with the product'),
  priceoverride: z.number().optional(),
  customfields: fieldMap('{customFieldId: value}').optional(),
  configoptions: z
    .record(z.string(), z.number())
    .optional()
    .describe('{configOptionId: optionId | quantity}'),
  addons: z.array(z.number().int()).optional().describe('Addon IDs for this product'),
});

const domainItem = z.object({
  domain: z.string(),
  domaintype: z.enum(['register', 'transfer']),
  regperiod: z.number().int().min(1).max(10).optional(),
  eppcode: z.string().optional(),
  idprotection: z.boolean().optional(),
  dnsmanagement: z.boolean().optional(),
  emailforwarding: z.boolean().optional(),
});

export const orderTools: ToolDef[] = [
  {
    name: 'whmcs_get_orders',
    action: 'GetOrders',
    toolset: 'orders',
    title: 'List orders',
    description: 'List orders with their line items, payment status and fraud data.',
    input: {
      id: id('Order ID').optional(),
      userid: id('Client ID').optional(),
      status: z
        .string()
        .optional()
        .describe('Pending, Active, Fraud, Cancelled (see whmcs_get_order_statuses)'),
      ...pagination,
    },
  },
  {
    name: 'whmcs_get_order_statuses',
    action: 'GetOrderStatuses',
    toolset: 'orders',
    title: 'List order statuses',
    description: 'List order statuses with the number of orders in each.',
    input: {},
  },
  defineTool({
    name: 'whmcs_add_order',
    action: 'AddOrder',
    toolset: 'orders',
    title: 'Place order',
    description:
      'Place a new order for a client: products (with config options, custom fields, addons) and/or domain registrations/transfers. Creates the invoice unless noinvoice=true.',
    input: {
      clientid: id('Client ID'),
      paymentmethod: z.string().describe('Gateway system name (see whmcs_get_payment_methods)'),
      products: z.array(orderItem).optional(),
      domains: z.array(domainItem).optional(),
      promocode: z.string().optional(),
      promooverride: z.boolean().optional(),
      affid: z.number().int().optional(),
      contactid: z.number().int().optional(),
      nameservers: z.array(z.string()).max(5).optional(),
      noinvoice: z.boolean().optional(),
      noinvoiceemail: z.boolean().optional(),
      noemail: z.boolean().optional().describe('Skip the order confirmation email'),
      clientip: z.string().optional(),
    },
    serializeEach: ['customfields', 'configoptions'],
    map: ({ products = [], domains = [], nameservers = [], ...rest }) => {
      // AddOrder takes parallel arrays (pid[], domain[], ...) indexed by order line: products
      // first, then domains. Columns a line does not use stay undefined and are not sent.
      const productLines = products.map(() => undefined);

      return {
        ...rest,
        pid: products.map((p) => p.pid),
        billingcycle: products.map((p) => p.billingcycle),
        priceoverride: products.map((p) => p.priceoverride),
        customfields: products.map((p) => p.customfields),
        configoptions: products.map((p) => p.configoptions),
        addons: products.map((p) => p.addons?.join(',')),
        domain: [...products.map((p) => p.domain), ...domains.map((d) => d.domain)],
        domaintype: [...productLines, ...domains.map((d) => d.domaintype)],
        regperiod: [...productLines, ...domains.map((d) => d.regperiod ?? 1)],
        eppcode: [...productLines, ...domains.map((d) => d.eppcode)],
        idprotection: [...productLines, ...domains.map((d) => d.idprotection)],
        dnsmanagement: [...productLines, ...domains.map((d) => d.dnsmanagement)],
        emailforwarding: [...productLines, ...domains.map((d) => d.emailforwarding)],
        ...Object.fromEntries(nameservers.map((ns, i) => [`nameserver${i + 1}`, ns])),
      };
    },
  }),
  {
    name: 'whmcs_accept_order',
    action: 'AcceptOrder',
    toolset: 'orders',
    title: 'Accept order',
    description:
      'Accept a pending order, optionally running provisioning, domain registration and sending emails.',
    input: {
      ...orderId,
      serverid: z.number().int().optional(),
      serviceusername: z.string().optional(),
      servicepassword: z.string().optional(),
      registrar: z.string().optional(),
      sendregistrar: z.boolean().optional().describe('Send domain registration to the registrar'),
      autosetup: z.boolean().optional().describe('Run the provisioning module'),
      sendemail: z.boolean().optional().describe('Send welcome emails'),
    },
  },
  {
    name: 'whmcs_pending_order',
    action: 'PendingOrder',
    toolset: 'orders',
    title: 'Set order pending',
    description: 'Set an order (and its items) back to Pending.',
    input: orderId,
  },
  {
    name: 'whmcs_cancel_order',
    action: 'CancelOrder',
    toolset: 'orders',
    title: 'Cancel order',
    description: 'Cancel an order and its items.',
    input: {
      ...orderId,
      cancelsub: z.boolean().optional().describe('Also cancel the gateway subscription'),
      noemail: z.boolean().optional(),
    },
  },
  {
    name: 'whmcs_fraud_order',
    action: 'FraudOrder',
    toolset: 'orders',
    title: 'Mark order as fraud',
    description: 'Mark an order as fraudulent (cancels items, may close the client depending on settings).',
    input: { ...orderId, cancelsub: z.boolean().optional() },
  },
  {
    name: 'whmcs_delete_order',
    action: 'DeleteOrder',
    toolset: 'orders',
    title: 'Delete order',
    description: 'PERMANENTLY delete an order (must be Cancelled or Fraud).',
    input: orderId,
  },
  {
    name: 'whmcs_order_fraud_check',
    action: 'OrderFraudCheck',
    toolset: 'orders',
    title: 'Run fraud check',
    description: 'Run the configured fraud module against an order.',
    input: { ...orderId, ipaddress: z.string().optional() },
  },

  // Catalog
  {
    name: 'whmcs_get_products',
    action: 'GetProducts',
    toolset: 'orders',
    title: 'List products',
    description: 'List products/services in the catalog with pricing, config options and custom fields.',
    input: {
      pid: z.string().optional().describe('Product ID or comma-separated IDs'),
      gid: id('Product group ID').optional(),
      module: z.string().optional().describe('Provisioning module name, e.g. cpanel'),
    },
  },
  {
    name: 'whmcs_get_promotions',
    action: 'GetPromotions',
    toolset: 'orders',
    title: 'List promotions',
    description: 'List promotion codes.',
    input: { code: z.string().optional() },
  },
  {
    name: 'whmcs_add_product',
    action: 'AddProduct',
    toolset: 'orders',
    title: 'Create product',
    description: 'Create a product in the catalog.',
    input: {
      name: z.string(),
      gid: id('Product group ID'),
      type: z.enum(['hostingaccount', 'reselleraccount', 'server', 'other']).optional(),
      description: z.string().optional(),
      paytype: z.enum(['free', 'onetime', 'recurring']).optional(),
      module: z.string().optional().describe('Provisioning module, e.g. cpanel'),
      servergroupid: z.number().int().optional(),
      autosetup: z.enum(['', 'on', 'order', 'payment']).optional(),
      hidden: z.boolean().optional(),
      showdomainoptions: z.boolean().optional(),
      stockcontrol: z.boolean().optional(),
      qty: z.number().int().optional(),
      welcomeemail: z.number().int().optional().describe('Email template ID'),
      pricing: z
        .record(z.string(), z.record(z.string(), z.number()))
        .optional()
        .describe('{currencyId: {monthly: 9.99, msetupfee: 0, annually: 99, ...}}'),
    },
  },
];
