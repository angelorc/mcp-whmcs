import { z } from 'zod';
import { date, id, pagination, type ToolDef } from './types.js';

const domainId = { domainid: id('Client domain ID, from whmcs_get_client_domains') };

const domainRef = {
  domainid: id('Client domain ID').optional(),
  domain: z.string().optional().describe('Domain name (alternative to domainid)'),
};

const nameservers = {
  ns1: z.string().optional(),
  ns2: z.string().optional(),
  ns3: z.string().optional(),
  ns4: z.string().optional(),
  ns5: z.string().optional(),
};

export const domainTools: ToolDef[] = [
  {
    name: 'whmcs_get_client_domains',
    action: 'GetClientsDomains',
    toolset: 'domains',
    title: 'List client domains',
    description: 'List domains owned by clients with status, registrar, expiry and next due date.',
    input: {
      clientid: id('Client ID').optional(),
      domainid: id('Domain ID').optional(),
      domain: z.string().optional(),
      ...pagination,
    },
  },
  {
    name: 'whmcs_domain_whois',
    action: 'DomainWhois',
    toolset: 'domains',
    title: 'Check domain availability',
    description: 'Check whether a domain is available for registration (WHOIS lookup).',
    input: { domain: z.string() },
  },
  {
    name: 'whmcs_get_tld_pricing',
    action: 'GetTLDPricing',
    toolset: 'domains',
    title: 'Get TLD pricing',
    description: 'Get register/transfer/renew pricing for all TLDs.',
    input: {
      currencyid: z.number().int().optional(),
      clientid: id('Client ID (apply client group pricing)').optional(),
    },
  },
  {
    name: 'whmcs_get_registrars',
    action: 'GetRegistrars',
    toolset: 'domains',
    title: 'List registrars',
    description: 'List active registrar modules.',
    input: {},
  },
  {
    name: 'whmcs_domain_get_whois_info',
    action: 'DomainGetWhoisInfo',
    toolset: 'domains',
    title: 'Get domain contacts',
    description: 'Get the registrant/admin/tech contact details from the registrar.',
    input: domainId,
  },
  {
    name: 'whmcs_domain_get_nameservers',
    action: 'DomainGetNameservers',
    toolset: 'domains',
    title: 'Get nameservers',
    description: 'Get the nameservers of a domain from the registrar.',
    input: domainId,
  },
  {
    name: 'whmcs_domain_update_nameservers',
    action: 'DomainUpdateNameservers',
    toolset: 'domains',
    title: 'Update nameservers',
    description: 'Change the nameservers of a domain at the registrar.',
    input: { ...domainRef, ...nameservers, ns1: z.string(), ns2: z.string() },
  },
  {
    name: 'whmcs_domain_get_locking_status',
    action: 'DomainGetLockingStatus',
    toolset: 'domains',
    title: 'Get registrar lock',
    description: 'Get the registrar (transfer) lock status of a domain.',
    input: domainId,
  },
  {
    name: 'whmcs_domain_update_locking_status',
    action: 'DomainUpdateLockingStatus',
    toolset: 'domains',
    title: 'Set registrar lock',
    description: 'Enable or disable the registrar (transfer) lock of a domain.',
    input: { ...domainId, lockstatus: z.boolean() },
  },
  {
    name: 'whmcs_domain_request_epp',
    action: 'DomainRequestEPP',
    toolset: 'domains',
    title: 'Request EPP code',
    description:
      'Request the EPP/auth code from the registrar (returned or emailed, depending on the registrar).',
    input: domainId,
  },
  {
    name: 'whmcs_domain_register',
    action: 'DomainRegister',
    toolset: 'domains',
    title: 'Register domain',
    description:
      'Send a domain registration to the registrar (domain must already exist as a client domain).',
    input: { ...domainRef, idnlanguage: z.string().optional() },
  },
  {
    name: 'whmcs_domain_transfer',
    action: 'DomainTransfer',
    toolset: 'domains',
    title: 'Transfer domain',
    description: 'Send a domain transfer request to the registrar.',
    input: { ...domainRef, eppcode: z.string().optional() },
  },
  {
    name: 'whmcs_domain_renew',
    action: 'DomainRenew',
    toolset: 'domains',
    title: 'Renew domain',
    description: 'Send a renewal to the registrar (charges the registrar account).',
    input: { ...domainRef, regperiod: z.number().int().min(1).max(10).optional() },
  },
  {
    name: 'whmcs_domain_toggle_id_protect',
    action: 'DomainToggleIdProtect',
    toolset: 'domains',
    title: 'Toggle ID protection',
    description: 'Enable/disable WHOIS privacy (ID protection) at the registrar.',
    input: { ...domainId, idprotect: z.boolean() },
  },
  {
    name: 'whmcs_domain_release',
    action: 'DomainRelease',
    toolset: 'domains',
    title: 'Release domain',
    description:
      'Release a domain to another registrar tag (e.g. .uk IPS tag). The domain leaves your account.',
    input: { ...domainRef, newtag: z.string() },
  },
  {
    name: 'whmcs_update_client_domain',
    action: 'UpdateClientDomain',
    toolset: 'domains',
    title: 'Update domain record',
    description:
      'Update a client domain record in WHMCS (dates, status, registrar, addons, pricing). Set updatens=true with ns1..ns5 to also push nameservers.',
    input: {
      ...domainId,
      domain: z.string().optional(),
      status: z
        .enum([
          'Pending',
          'Pending Registration',
          'Pending Transfer',
          'Active',
          'Grace',
          'Redemption',
          'Expired',
          'Transferred Away',
          'Cancelled',
          'Fraud',
        ])
        .optional(),
      registrar: z.string().optional(),
      regperiod: z.number().int().optional(),
      regdate: date('Registration date').optional(),
      expirydate: date('Expiry date').optional(),
      nextduedate: date('Next due date').optional(),
      firstpaymentamount: z.number().optional(),
      recurringamount: z.number().optional(),
      paymentmethod: z.string().optional(),
      dnsmanagement: z.boolean().optional(),
      emailforwarding: z.boolean().optional(),
      idprotection: z.boolean().optional(),
      donotrenew: z.boolean().optional(),
      autorecalc: z.boolean().optional(),
      notes: z.string().optional(),
      updatens: z.boolean().optional(),
      ...nameservers,
    },
  },
];
