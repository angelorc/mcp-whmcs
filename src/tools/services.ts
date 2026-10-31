import { z } from 'zod';
import { billingCycle, date, fieldMap, id, pagination, type ToolDef } from './types.js';

const serviceId = { serviceid: id('Service (hosting) ID, from whmcs_get_client_products') };

export const serviceTools: ToolDef[] = [
  {
    name: 'whmcs_get_client_products',
    action: 'GetClientsProducts',
    toolset: 'services',
    title: 'List client services',
    description:
      'List services/products owned by clients, with status, billing, next due date, server, username, custom fields and config options.',
    input: {
      clientid: id('Client ID').optional(),
      serviceid: id('Service ID').optional(),
      pid: id('Product ID').optional(),
      domain: z.string().optional(),
      username2: z.string().optional().describe('Service username'),
      ...pagination,
    },
  },
  {
    name: 'whmcs_get_client_addons',
    action: 'GetClientsAddons',
    toolset: 'services',
    title: 'List client addons',
    description: 'List addons purchased by clients.',
    input: {
      clientid: id('Client ID').optional(),
      serviceid: id('Parent service ID').optional(),
      addonid: id('Addon ID').optional(),
    },
  },
  {
    name: 'whmcs_update_client_product',
    action: 'UpdateClientProduct',
    toolset: 'services',
    title: 'Update service',
    description:
      'Update a client service record (billing, dates, status, credentials, custom fields). Does NOT call the provisioning module; use whmcs_module_* for that.',
    serialize: ['customfields', 'configoptions'],
    input: {
      ...serviceId,
      pid: id('Move to product ID').optional(),
      serverid: z.number().int().optional(),
      domain: z.string().optional(),
      status: z
        .enum(['Pending', 'Active', 'Suspended', 'Terminated', 'Cancelled', 'Fraud', 'Completed'])
        .optional(),
      billingcycle: z.string().optional().describe('e.g. Monthly, Annually, Free Account'),
      regdate: date('Registration date').optional(),
      nextduedate: date('Next due date').optional(),
      terminationdate: date('Termination date').optional(),
      firstpaymentamount: z.number().optional(),
      recurringamount: z.number().optional(),
      paymentmethod: z.string().optional(),
      serviceusername: z.string().optional(),
      servicepassword: z.string().optional(),
      dedicatedip: z.string().optional(),
      assignedips: z.string().optional(),
      notes: z.string().optional(),
      overideautosuspend: z.boolean().optional(),
      overidesuspenduntil: date('Do not auto-suspend until').optional(),
      suspendreason: z.string().optional(),
      promoid: z.number().int().optional(),
      autorecalc: z.boolean().optional().describe('Recalculate the recurring amount'),
      customfields: fieldMap('{customFieldId: value}').optional(),
      configoptions: z
        .record(z.string(), z.union([z.number(), z.string(), z.array(z.number())]))
        .optional()
        .describe('{configOptionId: optionId | quantity}'),
    },
  },
  {
    name: 'whmcs_update_client_addon',
    action: 'UpdateClientAddon',
    toolset: 'services',
    title: 'Update service addon',
    description: 'Update a client addon record.',
    input: {
      id: id('Client addon ID'),
      status: z.enum(['Pending', 'Active', 'Suspended', 'Terminated', 'Cancelled', 'Fraud']).optional(),
      addonid: z.number().int().optional(),
      name: z.string().optional(),
      setupfee: z.number().optional(),
      recurring: z.number().optional(),
      billingcycle: z.string().optional(),
      nextduedate: date('Next due date').optional(),
      terminationDate: date('Termination date').optional(),
      notes: z.string().optional(),
      autorecalc: z.boolean().optional(),
    },
  },
  {
    name: 'whmcs_module_create',
    action: 'ModuleCreate',
    toolset: 'services',
    title: 'Provision service',
    description: 'Run the provisioning module "Create" command (creates the account on the server).',
    input: serviceId,
  },
  {
    name: 'whmcs_module_suspend',
    action: 'ModuleSuspend',
    toolset: 'services',
    title: 'Suspend service',
    description: 'Suspend a service via its provisioning module.',
    input: { ...serviceId, suspendreason: z.string().optional() },
  },
  {
    name: 'whmcs_module_unsuspend',
    action: 'ModuleUnsuspend',
    toolset: 'services',
    title: 'Unsuspend service',
    description: 'Unsuspend a service via its provisioning module.',
    input: serviceId,
  },
  {
    name: 'whmcs_module_terminate',
    action: 'ModuleTerminate',
    toolset: 'services',
    title: 'Terminate service',
    description:
      'Terminate a service via its provisioning module. Usually DELETES the account and its data on the server.',
    input: serviceId,
  },
  {
    name: 'whmcs_module_change_password',
    action: 'ModuleChangePw',
    toolset: 'services',
    title: 'Change service password',
    description: 'Change the service password on the server via its provisioning module.',
    input: {
      ...serviceId,
      servicepassword: z.string().optional().describe('New password; omit to push the stored one'),
    },
  },
  {
    name: 'whmcs_module_change_package',
    action: 'ModuleChangePackage',
    toolset: 'services',
    title: 'Apply package change',
    description:
      'Push the current product/config options of a service to the server (after an up/downgrade).',
    input: serviceId,
  },
  {
    name: 'whmcs_module_custom',
    action: 'ModuleCustom',
    toolset: 'services',
    title: 'Run custom module command',
    description: 'Run a custom provisioning-module function (e.g. "reboot" for VPS modules).',
    input: { ...serviceId, func_name: z.string().describe('Module custom function name') },
  },
  {
    name: 'whmcs_upgrade_product',
    action: 'UpgradeProduct',
    toolset: 'services',
    title: 'Upgrade/downgrade service',
    description:
      'Upgrade or downgrade a service (product or configurable options). Use calconly=true first to preview the price.',
    input: {
      ...serviceId,
      type: z.enum(['product', 'configoptions']),
      paymentmethod: z.string().describe('Gateway system name'),
      newproductid: z.number().int().optional().describe('Required when type=product'),
      newproductbillingcycle: billingCycle.optional(),
      configoptions: z
        .record(z.string(), z.number())
        .optional()
        .describe('Required when type=configoptions: {configOptionId: optionId | quantity}'),
      promocode: z.string().optional(),
      calconly: z.boolean().optional().describe('Only calculate the upgrade price'),
    },
  },
  {
    name: 'whmcs_add_cancel_request',
    action: 'AddCancelRequest',
    toolset: 'services',
    title: 'Request service cancellation',
    description: 'Create a cancellation request for a service.',
    input: {
      ...serviceId,
      type: z.enum(['Immediate', 'End of Billing Period']).optional(),
      reason: z.string().optional(),
    },
  },
];
