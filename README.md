# mcp-whmcs

MCP server for [WHMCS](https://www.whmcs.com/). It lets Claude (or any MCP client) manage clients, services,
orders, invoices, quotes, domains, tickets and system settings through the
[WHMCS External API](https://developers.whmcs.com/api/).

- **128 typed tools** for the common workflows, with validated parameters and WHMCS quirks handled for you:
  PHP bracket notation, `base64(serialize())` for custom fields, parallel arrays for `AddOrder`, numbered
  invoice lines, and booleans sent as `1`/`0`.
- **`whmcs_call_api`** runs any of the 162 WHMCS actions, and custom actions added by addon modules.
  **`whmcs_list_actions`** lists them with their kind and documentation link.
- **Safety:** read-only mode, `confirm: true` required on destructive tools, sensitive actions turned off by
  default, and MCP annotations (`readOnlyHint` / `destructiveHint`) on every tool.
- Responses are compact JSON. WHMCS list wrappers (`{"clients":{"client":[…]}}`) are collapsed into arrays, and
  very large payloads are truncated with a hint to paginate.

## Install

### API credentials (recommended)

Create them in WHMCS under **Configuration → System Settings → Manage API Credentials**. Assign an API role
that grants only the actions you need.

```bash
claude mcp add whmcs \
  -e WHMCS_API_URL=https://your-whmcs.com/includes/api.php \
  -e WHMCS_IDENTIFIER=your_identifier \
  -e WHMCS_SECRET=your_secret \
  -- npx -y mcp-whmcs
```

### Admin username and password (legacy)

The password is MD5-hashed before it is sent, which is what WHMCS expects.

```bash
claude mcp add whmcs \
  -e WHMCS_API_URL=https://your-whmcs.com/includes/api.php \
  -e WHMCS_USERNAME=your_admin_user \
  -e WHMCS_PASSWORD=your_admin_password \
  -- npx -y mcp-whmcs
```

`bunx mcp-whmcs` works in place of `npx -y mcp-whmcs`. For a read-only assistant, add
`-e WHMCS_READ_ONLY=true`.

### Allow the API caller's IP

By default WHMCS accepts API calls only from allowed IPs. You can do either of the following:

- Add the IP of the machine that runs the server under **Configuration → System Settings → General Settings →
  Security → API IP Access Restriction**.
- Or set `$api_access_key = '...';` in WHMCS `configuration.php` and pass the same value as `WHMCS_ACCESS_KEY`.

### Other MCP clients

```json
{
  "mcpServers": {
    "whmcs": {
      "command": "npx",
      "args": ["-y", "mcp-whmcs"],
      "env": {
        "WHMCS_API_URL": "https://your-whmcs.com/includes/api.php",
        "WHMCS_IDENTIFIER": "your_identifier",
        "WHMCS_SECRET": "your_secret"
      }
    }
  }
}
```

## Configuration

| Variable                            | Description                                                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WHMCS_API_URL`                     | **Required.** `https://host/includes/api.php`, or the WHMCS base URL (`/includes/api.php` is appended).                                                                                             |
| `WHMCS_IDENTIFIER` / `WHMCS_SECRET` | API credentials (recommended).                                                                                                                                                                      |
| `WHMCS_USERNAME` / `WHMCS_PASSWORD` | Legacy admin login, used when no API credentials are set. Set `WHMCS_PASSWORD_IS_MD5=true` if the password is already a hash.                                                                       |
| `WHMCS_ACCESS_KEY`                  | API access key that bypasses the IP allow list.                                                                                                                                                     |
| `WHMCS_READ_ONLY`                   | `true` registers read tools only. `whmcs_call_api` then refuses non-read actions.                                                                                                                   |
| `WHMCS_ALLOW_SENSITIVE`             | `true` enables secret-revealing or system-level actions: `DecryptPassword`, `GetClientPassword`, `CreateSsoToken`, `SetConfigurationValue`, OAuth credentials, and module activation/configuration. |
| `WHMCS_TOOLSETS`                    | Comma-separated subset of `clients,services,orders,billing,domains,support,system,projects`. Fewer tools mean a smaller prompt.                                                                     |
| `WHMCS_TIMEOUT_MS`                  | Request timeout in milliseconds (default `30000`).                                                                                                                                                  |
| `WHMCS_MAX_RESPONSE_CHARS`          | Truncate tool output after this many characters (default `100000`).                                                                                                                                 |

## Tools

✎ = write, ⚠ = destructive (requires `confirm: true`), 🔒 = requires `WHMCS_ALLOW_SENSITIVE`. All names have the
`whmcs_` prefix.

| Toolset      | Tools                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **clients**  | get_clients, get_client_details, add_client ✎, update_client ✎, close_client ⚠, delete_client ⚠, get_client_groups, add_client_note ✎, get_emails, get_cancelled_packages, get_contacts, add_contact ✎, update_contact ✎, delete_contact ⚠, get_users, add_user ✎, update_user ✎, reset_user_password ✎, create_client_invite ✎, get_permissions_list, get_user_permissions, update_user_permissions ✎, delete_user_client ⚠ |
| **services** | get_client_products, get_client_addons, update_client_product ✎, update_client_addon ✎, module_create ✎, module_suspend ✎, module_unsuspend ✎, module_terminate ⚠, module_change_password ✎, module_change_package ✎, module_custom ✎, upgrade_product ✎, add_cancel_request ⚠                                                                                                                                               |
| **orders**   | get_orders, get_order_statuses, add_order ✎, accept_order ✎, pending_order ✎, cancel_order ⚠, fraud_order ⚠, delete_order ⚠, order_fraud_check ✎, get_products, get_promotions, add_product ✎                                                                                                                                                                                                                                |
| **billing**  | get_invoices, get_invoice, create_invoice ✎, update_invoice ✎, add_invoice_payment ✎, capture_payment ✎, apply_credit ✎, gen_invoices ✎, add_billable_item ✎, get_transactions, add_transaction ✎, get_credits, add_credit ✎, get_pay_methods, delete_pay_method ⚠, get_quotes, create_quote ✎, update_quote ✎, send_quote ✎, accept_quote ✎, delete_quote ⚠                                                                 |
| **domains**  | get_client_domains, domain_whois, get_tld_pricing, get_registrars, domain_get_whois_info, domain_get_nameservers, domain_update_nameservers ✎, domain_get_locking_status, domain_update_locking_status ✎, domain_request_epp ✎, domain_register ✎, domain_transfer ✎, domain_renew ✎, domain_toggle_id_protect ✎, domain_release ⚠, update_client_domain ✎                                                                   |
| **support**  | get_tickets, get_ticket, get_ticket_notes, get_ticket_counts, open_ticket ✎, add_ticket_reply ✎, add_ticket_note ✎, update_ticket ✎, merge_ticket ⚠, delete_ticket ⚠, block_ticket_sender ⚠, get_support_departments, get_support_statuses, get_ticket_predefined_cats, get_ticket_predefined_replies, get_announcements, add_announcement ✎                                                                                 |
| **system**   | get_stats, whmcs_details, get_activity_log, log_activity ✎, get_automation_log, get_module_queue, get_admin_users, get_admin_details, get_staff_online, get_currencies, get_payment_methods, get_email_templates, send_email ✎, send_admin_email ✎, get_todo_items, update_todo_item ✎, add_banned_ip ✎, get_servers, get_health_status, get_affiliates, affiliate_activate ✎, create_sso_token ✎🔒                          |
| **projects** | get_projects, get_project, create_project ✎, add_project_task ✎, add_project_message ✎                                                                                                                                                                                                                                                                                                                                       |
| _always_     | list_actions, call_api                                                                                                                                                                                                                                                                                                                                                                                                       |

### Example prompts

- "Which clients have overdue invoices, and how much does each one owe?"
- "Open ticket #ABC-123456, summarize it, and draft a reply as admin `mario`."
- "Suspend service 812 for non-payment, then add a client note."
- "Is `example.it` available? If so, how much is a 2-year registration?"

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
```

```bash
bun run check
```

```bash
bun run build
```

`check` runs oxfmt, oxlint (including the vendored
[anti-slop](https://github.com/dmmulroy/anti-slop) plugin in `tools/oxlint/anti-slop`) and `tsc`.

`bun test` runs the live tests in `test/live.test.ts` against the WHMCS instance configured in `.env`. The test
server always runs with `WHMCS_READ_ONLY=true`, so it can't create, change or delete records.

`bun run inspect` opens the server in the MCP Inspector.

## License

MIT
