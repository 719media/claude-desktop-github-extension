/**
 * github-mcp-proxy
 *
 * A minimal stdio ↔ HTTP MCP proxy that bridges Claude Desktop to the
 * GitHub-hosted MCP endpoint (https://api.githubcopilot.com/mcp).
 *
 * Architecture:
 *   Claude Desktop
 *       │  stdio (JSON-RPC)
 *       ▼
 *   [this process]  ← reads GITHUB_TOKEN from env (injected by Claude Desktop)
 *       │  Streamable HTTP + Authorization: Bearer <token>
 *       ▼
 *   https://api.githubcopilot.com/mcp
 *
 * All MCP capability negotiation is forwarded transparently:
 *   tools/list, tools/call, resources/list, resources/read,
 *   resources/templates/list, prompts/list, prompts/get
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Config from environment (Claude Desktop injects GITHUB_TOKEN at launch)
// ---------------------------------------------------------------------------

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ENDPOINT =
  process.env.GITHUB_MCP_ENDPOINT ?? "https://api.githubcopilot.com/mcp";

function log(msg: string) {
  // MCP uses stdout for protocol; all diagnostic output goes to stderr.
  process.stderr.write(`[github-mcp-proxy] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!GITHUB_TOKEN) {
    log("ERROR: GITHUB_TOKEN is not set. Configure your PAT in the extension settings.");
    process.exit(1);
  }

  // ── 1. Connect upstream (GitHub MCP over HTTP) ───────────────────────────
  log(`Connecting to upstream: ${ENDPOINT}`);

  const upstreamClient = new Client(
    { name: "github-mcp-proxy-upstream", version: "1.0.0" },
    { capabilities: {} }
  );

  const upstreamTransport = new StreamableHTTPClientTransport(
    new URL(ENDPOINT),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "User-Agent": "github-mcp-proxy/1.0.0",
        },
      },
    }
  );

  try {
    await upstreamClient.connect(upstreamTransport);
  } catch (err) {
    log(`ERROR: Could not connect to GitHub MCP: ${(err as Error).message}`);
    log("Check that your PAT is valid and has the required scopes.");
    process.exit(1);
  }

  log("Connected to GitHub MCP.");

  // ── 2. Mirror upstream capabilities ─────────────────────────────────────
  // Only advertise what the remote actually supports so Claude Desktop
  // doesn't try to call capabilities that don't exist.
  const upstreamCaps = upstreamClient.getServerCapabilities() ?? {};
  const localCaps: ServerCapabilities = {};
  if (upstreamCaps.tools)     localCaps.tools     = {};
  if (upstreamCaps.resources) localCaps.resources = {};
  if (upstreamCaps.prompts)   localCaps.prompts   = {};

  log(`Upstream capabilities: ${Object.keys(localCaps).join(", ") || "none"}`);

  // ── 3. Create local stdio server ─────────────────────────────────────────
  const server = new Server(
    { name: "github-mcp-proxy", version: "1.0.0" },
    { capabilities: localCaps }
  );

  // ── 4. Wire proxy handlers ───────────────────────────────────────────────

  if (localCaps.tools) {
    server.setRequestHandler(ListToolsRequestSchema, async (req) => {
      log("→ tools/list");
      return upstreamClient.listTools(req.params);
    });

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      log(`→ tools/call [${req.params.name}]`);
      return upstreamClient.callTool(req.params);
    });
  }

  if (localCaps.resources) {
    server.setRequestHandler(ListResourcesRequestSchema, async (req) => {
      log("→ resources/list");
      return upstreamClient.listResources(req.params);
    });

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async (req) => {
      log("→ resources/templates/list");
      return upstreamClient.listResourceTemplates(req.params);
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
      log(`→ resources/read [${req.params.uri}]`);
      return upstreamClient.readResource(req.params);
    });
  }

  if (localCaps.prompts) {
    server.setRequestHandler(ListPromptsRequestSchema, async (req) => {
      log("→ prompts/list");
      return upstreamClient.listPrompts(req.params);
    });

    server.setRequestHandler(GetPromptRequestSchema, async (req) => {
      log(`→ prompts/get [${req.params.name}]`);
      return upstreamClient.getPrompt(req.params);
    });
  }

  // Surface upstream errors back through the local server
  server.onerror = (err) => {
    log(`Server error: ${err.message}`);
  };

  // ── 5. Connect stdio transport ───────────────────────────────────────────
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  log("Local stdio server ready. Proxying to GitHub MCP.");
}

main().catch((err) => {
  process.stderr.write(`[github-mcp-proxy] Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
