/**
 * Every action of the WHMCS External API (https://developers.whmcs.com/api/api-index/),
 * classified so the generic `whmcs_call_api` tool can apply the same guards as
 * the curated tools.
 */

export type Kind = 'read' | 'write' | 'destructive';

export interface ActionInfo {
  category: string;
  kind: Kind;
  /** Exposes secrets or system configuration; needs WHMCS_ALLOW_SENSITIVE. */
  sensitive: boolean;
}

const CATALOG = {
  Addons: ['UpdateClientAddon'],
  Affiliates: ['AffiliateActivate', 'GetAffiliates'],
  Authentication: [
    'CreateOAuthCredential',
    'CreateSsoToken',
    'DeleteOAuthCredential',
    'ListOAuthCredentials',
    'UpdateOAuthCredential',
    'ValidateLogin',
  ],
  Billing: [
    'AcceptQuote',
    'AddBillableItem',
    'AddCredit',
    'AddInvoicePayment',
    'AddPayMethod',
    'AddTransaction',
    'ApplyCredit',
    'CapturePayment',
    'CreateInvoice',
    'CreateQuote',
    'DeletePayMethod',
    'DeleteQuote',
    'GenInvoices',
    'GetCredits',
    'GetInvoice',
    'GetInvoices',
    'GetPayMethods',
    'GetQuotes',
    'GetTransactions',
    'SendQuote',
    'UpdateInvoice',
    'UpdatePayMethod',
    'UpdateQuote',
    'UpdateTransaction',
  ],
  Client: [
    'AddClient',
    'AddContact',
    'CloseClient',
    'DeleteClient',
    'DeleteContact',
    'GetCancelledPackages',
    'GetClientGroups',
    'GetClientPassword',
    'GetClients',
    'GetClientsAddons',
    'GetClientsDetails',
    'GetClientsDomains',
    'GetClientsProducts',
    'GetContacts',
    'GetEmails',
    'UpdateClient',
    'UpdateContact',
  ],
  Domains: [
    'CreateOrUpdateTLD',
    'DomainGetLockingStatus',
    'DomainGetNameservers',
    'DomainGetWhoisInfo',
    'DomainRegister',
    'DomainRelease',
    'DomainRenew',
    'DomainRequestEPP',
    'DomainToggleIdProtect',
    'DomainTransfer',
    'DomainUpdateLockingStatus',
    'DomainUpdateNameservers',
    'DomainUpdateWhoisInfo',
    'DomainWhois',
    'GetRegistrars',
    'GetTLDPricing',
    'UpdateClientDomain',
  ],
  Module: [
    'ActivateModule',
    'DeactivateModule',
    'GetModuleConfigurationParameters',
    'GetModuleQueue',
    'UpdateModuleConfiguration',
  ],
  Orders: [
    'AcceptOrder',
    'AddOrder',
    'CancelOrder',
    'DeleteOrder',
    'FraudOrder',
    'GetOrders',
    'GetOrderStatuses',
    'GetProducts',
    'GetPromotions',
    'OrderFraudCheck',
    'PendingOrder',
  ],
  Products: ['AddProduct'],
  'Project Management': [
    'AddProjectMessage',
    'AddProjectTask',
    'CreateProject',
    'DeleteProjectTask',
    'EndTaskTimer',
    'GetProject',
    'GetProjects',
    'StartTaskTimer',
    'UpdateProject',
    'UpdateProjectTask',
  ],
  Servers: ['GetHealthStatus', 'GetServers'],
  Service: [
    'ModuleChangePackage',
    'ModuleChangePw',
    'ModuleCreate',
    'ModuleCustom',
    'ModuleSuspend',
    'ModuleTerminate',
    'ModuleUnsuspend',
    'UpdateClientProduct',
    'UpgradeProduct',
  ],
  Support: [
    'AddAnnouncement',
    'AddCancelRequest',
    'AddClientNote',
    'AddTicketNote',
    'AddTicketReply',
    'BlockTicketSender',
    'DeleteAnnouncement',
    'DeleteTicket',
    'DeleteTicketNote',
    'DeleteTicketReply',
    'GetAnnouncements',
    'MergeTicket',
    'OpenTicket',
    'UpdateTicket',
    'UpdateTicketReply',
  ],
  System: [
    'AddBannedIp',
    'DecryptPassword',
    'EncryptPassword',
    'GetActivityLog',
    'GetAdminDetails',
    'GetAdminUsers',
    'GetAutomationLog',
    'GetConfigurationValue',
    'GetCurrencies',
    'GetEmailTemplates',
    'GetPaymentMethods',
    'GetStaffOnline',
    'GetStats',
    'GetToDoItems',
    'GetToDoItemStatuses',
    'LogActivity',
    'SendAdminEmail',
    'SendEmail',
    'SetConfigurationValue',
    'TriggerNotificationEvent',
    'UpdateAdminNotes',
    'UpdateAnnouncement',
    'UpdateToDoItem',
    'WhmcsDetails',
  ],
  Tickets: [
    'GetSupportDepartments',
    'GetSupportStatuses',
    'GetTicket',
    'GetTicketAttachment',
    'GetTicketCounts',
    'GetTicketNotes',
    'GetTicketPredefinedCats',
    'GetTicketPredefinedReplies',
    'GetTickets',
  ],
  Users: [
    'AddUser',
    'CreateClientInvite',
    'DeleteUserClient',
    'GetPermissionsList',
    'GetUserPermissions',
    'GetUsers',
    'ResetPassword',
    'UpdateUser',
    'UpdateUserPermissions',
  ],
} satisfies Record<string, string[]>;

const READ_EXTRA = new Set(['DomainWhois', 'WhmcsDetails', 'ListOAuthCredentials']);

const DESTRUCTIVE = new Set([
  'CloseClient',
  'CancelOrder',
  'FraudOrder',
  'ModuleTerminate',
  'DomainRelease',
  'AddCancelRequest',
  'BlockTicketSender',
  'MergeTicket',
  'DeactivateModule',
]);

const SENSITIVE = new Set([
  'DecryptPassword',
  'EncryptPassword',
  'GetClientPassword',
  'CreateSsoToken',
  'ValidateLogin',
  'GetConfigurationValue',
  'SetConfigurationValue',
  'CreateOAuthCredential',
  'UpdateOAuthCredential',
  'DeleteOAuthCredential',
  'ListOAuthCredentials',
  'GetModuleConfigurationParameters',
  'UpdateModuleConfiguration',
  'ActivateModule',
  'DeactivateModule',
]);

function classify(action: string): Kind {
  if (action.startsWith('Get') || action.startsWith('DomainGet') || READ_EXTRA.has(action)) {
    return 'read';
  }

  if (action.startsWith('Delete') || DESTRUCTIVE.has(action)) return 'destructive';

  return 'write';
}

export const ACTIONS: ReadonlyMap<string, ActionInfo> = new Map(
  Object.entries(CATALOG).flatMap(([category, names]) =>
    names.map((name) => [name, { category, kind: classify(name), sensitive: SENSITIVE.has(name) }]),
  ),
);

/** Case-insensitive lookup; returns the canonical action name. */
export function findAction(name: string): [string, ActionInfo] | undefined {
  const lower = name.toLowerCase();

  for (const [canonical, info] of ACTIONS) {
    if (canonical.toLowerCase() === lower) return [canonical, info];
  }

  return undefined;
}

export function docsUrl(action: string): string {
  return `https://developers.whmcs.com/api-reference/${action.toLowerCase()}/`;
}
