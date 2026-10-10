// stdio_smoke.test.mjs - the one test that boots the REAL entrypoint
// (`node src/server.mjs`) as a subprocess over real stdio, exactly the way
// Claude Desktop, Claude Code, or Cursor would launch it from their MCP
// config. Every other test in this package talks to buildServer() directly
// or over InMemoryTransport, which never exercises `main()` or
// StdioServerTransport at all - this is the test that would fail if the
// entrypoint had a syntax error, a bad shebang, or crashed on startup.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "server.mjs");

test("the real stdio entrypoint boots and answers tools/list over a real child process", async () => {
  const transport = new StdioClientTransport({ command: "node", args: [SERVER_PATH] });
  const client = new Client({ name: "stdio-smoke-test", version: "0.0.0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.ok(tools.length >= 10, `expected at least 10 tools, got ${tools.length}`);
    assert.ok(tools.some((t) => t.name === "search_tasks"));
    assert.ok(tools.some((t) => t.name === "create_task"));
  } finally {
    await client.close();
  }
});
