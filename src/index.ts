#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { createServer, selectTools, VERSION } from './server.js';

async function main(): Promise<void> {
  if (process.argv.includes('--version')) {
    console.log(VERSION);

    return;
  }

  const config = loadConfig();
  const server = createServer(config);
  await server.connect(new StdioServerTransport());
  // stdout is the MCP channel: log to stderr only.
  console.error(
    `whmcs-mcp ${VERSION} → ${config.apiUrl} (${config.auth.mode} auth, ${selectTools(config).length} tools` +
      `${config.readOnly ? ', read-only' : ''})`,
  );
}

main().catch((err) => {
  console.error(`whmcs-mcp: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
