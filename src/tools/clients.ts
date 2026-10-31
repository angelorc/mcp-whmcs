import { z } from 'zod';
import { fieldMap, id, pagination, sortOrder, type ToolDef } from './types.js';

const contactFields = {
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  companyname: z.string().optional(),
  email: z.string().email().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code, e.g. IT'),
  phonenumber: z.string().optional(),
  tax_id: z.string().optional().describe('VAT number / tax ID'),
};

const clientExtra = {
  currency: z.number().int().optional().describe('Currency ID'),
  groupid: z.number().int().optional().describe('Client group ID'),
  language: z.string().optional(),
  notes: z.string().optional().describe('Admin-only notes'),
  marketingoptin: z.boolean().optional(),
  customfields: fieldMap('Client custom fields as {fieldId: value}').optional(),
};

const contactEmailPrefs = {
  generalemails: z.boolean().optional(),
  productemails: z.boolean().optional(),
  domainemails: z.boolean().optional(),
  invoiceemails: z.boolean().optional(),
  supportemails: z.boolean().optional(),
};

export const clientTools: ToolDef[] = [
  {
    name: 'whmcs_get_clients',
    action: 'GetClients',
    toolset: 'clients',
    title: 'Search clients',
    description:
      'List/search clients. `search` matches the start of email, first/last/full name or company name. Returns id, name, email, status, date created.',
    input: {
      search: z.string().optional(),
      status: z.enum(['Active', 'Inactive', 'Closed']).optional(),
      orderby: z
        .enum(['id', 'firstname', 'lastname', 'companyname', 'email', 'groupid', 'datecreated', 'status'])
        .optional(),
      sorting: sortOrder.optional(),
      ...pagination,
    },
  },
  {
    name: 'whmcs_get_client_details',
    action: 'GetClientsDetails',
    toolset: 'clients',
    title: 'Get client details',
    description:
      'Full profile of one client (address, credit, currency, custom fields, owner user). Set `stats` for invoice/revenue/ticket statistics.',
    input: {
      clientid: id('Client ID').optional(),
      email: z.string().email().optional().describe('Look up by email instead of ID'),
      stats: z.boolean().optional().describe('Include billing/support statistics'),
    },
  },
  {
    name: 'whmcs_add_client',
    action: 'AddClient',
    toolset: 'clients',
    title: 'Create client',
    description: 'Create a new client account (and, unless owner_user_id is given, its owner user).',
    serialize: ['customfields'],
    input: {
      ...contactFields,
      firstname: z.string(),
      lastname: z.string(),
      email: z.string().email(),
      ...clientExtra,
      password2: z.string().optional().describe('Password for the new owner user'),
      owner_user_id: z
        .number()
        .int()
        .optional()
        .describe('Attach to an existing user instead of creating one'),
      clientip: z.string().optional(),
      noemail: z.boolean().optional().describe('Do not send the welcome email'),
      skipvalidation: z.boolean().optional().describe('Skip required-field validation'),
    },
  },
  {
    name: 'whmcs_update_client',
    action: 'UpdateClient',
    toolset: 'clients',
    title: 'Update client',
    description: 'Update fields of an existing client. Only the provided fields are changed.',
    serialize: ['customfields'],
    input: {
      clientid: id('Client ID'),
      ...contactFields,
      ...clientExtra,
      status: z.enum(['Active', 'Inactive', 'Closed']).optional(),
      paymentmethod: z.string().optional().describe('Default gateway system name, e.g. paypal'),
      latefeeoveride: z.boolean().optional(),
      overideduenotices: z.boolean().optional(),
      taxexempt: z.boolean().optional(),
      separateinvoices: z.boolean().optional(),
      disableautocc: z.boolean().optional(),
      emailoptout: z.boolean().optional(),
    },
  },
  {
    name: 'whmcs_close_client',
    action: 'CloseClient',
    toolset: 'clients',
    title: 'Close client',
    description: 'Close a client: sets status Closed and cancels all active products, addons and domains.',
    input: { clientid: id('Client ID') },
  },
  {
    name: 'whmcs_delete_client',
    action: 'DeleteClient',
    toolset: 'clients',
    title: 'Delete client',
    description: 'PERMANENTLY delete a client and all associated data. Prefer whmcs_close_client.',
    input: {
      clientid: id('Client ID'),
      deleteusers: z.boolean().optional().describe('Also delete users not associated with other clients'),
      deletetransactions: z.boolean().optional(),
    },
  },
  {
    name: 'whmcs_get_client_groups',
    action: 'GetClientGroups',
    toolset: 'clients',
    title: 'List client groups',
    description: 'List client groups with their discount and colour.',
    input: {},
  },
  {
    name: 'whmcs_add_client_note',
    action: 'AddClientNote',
    toolset: 'clients',
    title: 'Add client note',
    description: 'Add an admin note to a client profile.',
    input: {
      userid: id('Client ID'),
      notes: z.string(),
      sticky: z.boolean().optional().describe('Show the note prominently on the client summary'),
    },
  },
  {
    name: 'whmcs_get_emails',
    action: 'GetEmails',
    toolset: 'clients',
    title: 'List client emails',
    description: 'List emails sent to a client (email log).',
    input: {
      clientid: id('Client ID'),
      date: z.string().optional().describe('Filter by date (YYYY-MM-DD)'),
      subject: z.string().optional(),
      ...pagination,
    },
  },
  {
    name: 'whmcs_get_cancelled_packages',
    action: 'GetCancelledPackages',
    toolset: 'clients',
    title: 'List cancellation requests',
    description: 'List service cancellation requests.',
    input: { ...pagination },
  },

  // Contacts
  {
    name: 'whmcs_get_contacts',
    action: 'GetContacts',
    toolset: 'clients',
    title: 'List contacts',
    description: 'List client contacts, optionally filtered by client or contact fields.',
    input: {
      userid: id('Client ID').optional(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      companyname: z.string().optional(),
      email: z.string().optional(),
      ...pagination,
    },
  },
  {
    name: 'whmcs_add_contact',
    action: 'AddContact',
    toolset: 'clients',
    title: 'Add contact',
    description: 'Add a contact (billing/technical/etc.) to a client.',
    input: { clientid: id('Client ID'), ...contactFields, ...contactEmailPrefs },
  },
  {
    name: 'whmcs_update_contact',
    action: 'UpdateContact',
    toolset: 'clients',
    title: 'Update contact',
    description: 'Update a client contact. Only provided fields are changed.',
    input: { contactid: id('Contact ID'), ...contactFields, ...contactEmailPrefs },
  },
  {
    name: 'whmcs_delete_contact',
    action: 'DeleteContact',
    toolset: 'clients',
    title: 'Delete contact',
    description: 'Delete a client contact.',
    input: { contactid: id('Contact ID') },
  },

  // Users (WHMCS 8+ login identities, linked to one or more clients)
  {
    name: 'whmcs_get_users',
    action: 'GetUsers',
    toolset: 'clients',
    title: 'List users',
    description: 'List login users (WHMCS 8+) with the clients they can access.',
    input: { search: z.string().optional(), sorting: sortOrder.optional(), ...pagination },
  },
  {
    name: 'whmcs_add_user',
    action: 'AddUser',
    toolset: 'clients',
    title: 'Create user',
    description: 'Create a login user (not attached to any client until invited/associated).',
    input: {
      firstname: z.string(),
      lastname: z.string(),
      email: z.string().email(),
      password2: z.string(),
      language: z.string().optional(),
    },
  },
  {
    name: 'whmcs_update_user',
    action: 'UpdateUser',
    toolset: 'clients',
    title: 'Update user',
    description: 'Update a login user.',
    input: {
      user_id: id('User ID'),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      email: z.string().email().optional(),
      language: z.string().optional(),
    },
  },
  {
    name: 'whmcs_reset_user_password',
    action: 'ResetPassword',
    toolset: 'clients',
    title: 'Send password reset',
    description: 'Send the password-reset email to a user (by ID or email).',
    input: { id: id('User ID').optional(), email: z.string().email().optional() },
  },
  {
    name: 'whmcs_create_client_invite',
    action: 'CreateClientInvite',
    toolset: 'clients',
    title: 'Invite user to client',
    description: 'Invite an email address to access a client account with the given permissions.',
    input: {
      client_id: id('Client ID'),
      email: z.string().email(),
      permissions: z
        .string()
        .describe(
          'Comma-separated permissions (see whmcs_get_permissions_list), e.g. "profile,products,invoices"',
        ),
    },
  },
  {
    name: 'whmcs_get_permissions_list',
    action: 'GetPermissionsList',
    toolset: 'clients',
    title: 'List user permissions',
    description: 'List the permission keys that can be granted to users on a client account.',
    input: {},
  },
  {
    name: 'whmcs_get_user_permissions',
    action: 'GetUserPermissions',
    toolset: 'clients',
    title: 'Get user permissions',
    description: "Get a user's permissions on a client account.",
    input: { user_id: id('User ID'), client_id: id('Client ID') },
  },
  {
    name: 'whmcs_update_user_permissions',
    action: 'UpdateUserPermissions',
    toolset: 'clients',
    title: 'Update user permissions',
    description: "Replace a user's permissions on a client account.",
    input: {
      user_id: id('User ID'),
      client_id: id('Client ID'),
      permissions: z.string().describe('Comma-separated permission keys'),
    },
  },
  {
    name: 'whmcs_delete_user_client',
    action: 'DeleteUserClient',
    toolset: 'clients',
    title: 'Remove user from client',
    description: "Revoke a user's access to a client account (the user itself is kept).",
    input: { user_id: id('User ID'), client_id: id('Client ID') },
  },
];
