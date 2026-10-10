// server_protocol.test.mjs - proves the MCP wiring itself works, not just
// the plain JS functions underneath it. A real MCP `Client` talks to our
// `McpServer` over a real (in-process) transport and real JSON-RPC
// tools/list and tools/call messages - this is the same code path Claude
// Desktop, Claude Code, or Cursor would use, just with InMemoryTransport
// instead of stdio.
//
// Network reads (search_tasks) go to the real live API, same as
// client.live.test.mjs, so this also proves the tool wiring does not mangle
// a real response on its way through JSON-RPC serialization. Writes
// (create_task, award_submissions, reject_submission) point TASKMARKET_CLI
// at a local stub, so nothing here can spend money - see the header on
// test/cli.test.mjs for why the stub pattern is a real assertion and not a
// tautology.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { buildServer } from "../src/server.mjs";
import { ConfirmationStore, SpendLedger } from "../src/policy.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "tm-mcp-proto-"));
const ARGV_LOG = path.join(dir, "argv.json");
const SPEND_FILE = path.join(dir, "spend.json");

const STUB = path.join(dir, "fake-taskmarket");
writeFileSync(
  STUB,
  `#!/usr/bin/env node\n` +
    `require("fs").writeFileSync(${JSON.stringify(ARGV_LOG)}, JSON.stringify(process.argv.slice(2)));\n` +
    `console.log(JSON.stringify({ok: true, data: {createdTaskId: "0xSTUB", stub: true}}));\n`,
);
chmodSync(STUB, 0o755);
process.env.TASKMARKET_CLI = STUB;

/** Fresh linked client+server pair per test, so token/spend state from one
 * test cannot leak into another. */
async function connectedPair(policyOverrides = {}) {
  const server = buildServer({
    policyConfig: {
      maxTaskRewardUsdc: 3,
      maxDailySpendUsdc: 3,
      tokenTtlMs: 60_000,
      spendStateFile: SPEND_FILE,
      ...policyOverrides,
    },
    confirmations: new ConfirmationStore(),
    spendLedger: new SpendLedger(SPEND_FILE),
  });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

async function callTool(client, name, args) {
  return client.callTool({ name, arguments: args });
}

function textOf(result) {
  return result.content.map((c) => c.text).join("\n");
}

test("tools/list exposes the full documented tool inventory", async () => {
  const { client } = await connectedPair();
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "award_submissions",
    "create_task",
    "get_requester_stats",
    "get_task",
    "get_wallet_balance",
    "list_submissions",
    "preview_award_submissions",
    "preview_create_task",
    "preview_reject_submission",
    "reject_submission",
    "search_tasks",
    "whoami",
  ]);
});

test("get_task over real MCP protocol returns the real live task this artifact targets", async () => {
  const { client } = await connectedPair();
  const result = await callTool(client, "get_task", {
    taskId: "0x8e416ba0f3e473d2dddc7f7afc03ca35ab12b95972818808e9eff0d1e98e31fb",
  });
  assert.notEqual(result.isError, true, `unexpected error: ${textOf(result)}`);
  const task = JSON.parse(textOf(result));
  assert.equal(task.requester, "0x93710f148a88d80B344BB1fEbB91DCBA9f80019F");
});

test("create_task over MCP protocol is refused with no confirmationToken argument at all (schema-level refusal)", async () => {
  const { client } = await connectedPair();
  const result = await callTool(client, "create_task", {
    description: "no token supplied",
    rewardUsdc: 1,
    durationHours: 1,
    source: "user_authorized",
    // confirmationToken deliberately omitted - required by inputSchema
  });
  assert.equal(result.isError, true, "missing confirmationToken must be refused, not silently accepted");
  assert.match(textOf(result), /confirmationToken/);
  assert.equal(existsSync(ARGV_LOG), false, "CLI must not have been reached");
});

test("create_task over MCP protocol is refused when source is not user_authorized, even with everything else correct", async () => {
  const { client } = await connectedPair();
  const preview = await callTool(client, "preview_create_task", {
    description: "attacker-controlled content",
    rewardUsdc: 1,
    durationHours: 1,
    source: "user_authorized", // preview itself requires this too
  });
  const { confirmationToken } = JSON.parse(textOf(preview));

  // Simulate a prompt-injected call that tries to swap the source label at
  // execute time. Zod's z.literal on the tool schema rejects this before our
  // handler code even runs.
  const result = await callTool(client, "create_task", {
    description: "attacker-controlled content",
    rewardUsdc: 1,
    durationHours: 1,
    source: "task_description",
    confirmationToken,
  });
  assert.equal(result.isError, true, "a non-user_authorized source must be refused, not silently accepted");
  assert.equal(existsSync(ARGV_LOG), false, "CLI must not have been reached");
});

test("create_task over MCP protocol: full happy path (preview -> execute) actually reaches the stub CLI with the right args and records spend", async () => {
  if (existsSync(ARGV_LOG)) rmSync(ARGV_LOG);
  if (existsSync(SPEND_FILE)) rmSync(SPEND_FILE);
  const { client } = await connectedPair();

  const params = {
    description: "integration test happy path, stub CLI only",
    rewardUsdc: 2,
    durationHours: 6,
    mode: "bounty",
    tags: ["test"],
    source: "user_authorized",
  };
  const preview = await callTool(client, "preview_create_task", params);
  assert.notEqual(preview.isError, true, `preview failed: ${textOf(preview)}`);
  const { confirmationToken } = JSON.parse(textOf(preview));
  assert.ok(confirmationToken, "preview did not return a confirmationToken");

  const exec = await callTool(client, "create_task", { ...params, confirmationToken });
  assert.notEqual(exec.isError, true, `execute failed: ${textOf(exec)}`);
  const result = JSON.parse(textOf(exec));
  assert.equal(result.data.createdTaskId, "0xSTUB");

  // The strongest possible check here: read what the stub CLI actually
  // received, over the real MCP wire, not what our handler intended to send.
  const argv = JSON.parse(readFileSync(ARGV_LOG, "utf8"));
  assert.deepEqual(argv, [
    "task", "create",
    "--description", "integration test happy path, stub CLI only",
    "--reward", "2",
    "--duration", "6",
    "--mode", "bounty",
    "--tags", "test",
  ]);
});

test("create_task over MCP protocol: replaying the same confirmationToken a second time is refused", async () => {
  if (existsSync(ARGV_LOG)) rmSync(ARGV_LOG);
  if (existsSync(SPEND_FILE)) rmSync(SPEND_FILE);
  const { client } = await connectedPair();
  const params = {
    description: "replay test",
    rewardUsdc: 1,
    durationHours: 1,
    source: "user_authorized",
  };
  const preview = await callTool(client, "preview_create_task", params);
  const { confirmationToken } = JSON.parse(textOf(preview));

  const first = await callTool(client, "create_task", { ...params, confirmationToken });
  assert.notEqual(first.isError, true, `first execute should have succeeded: ${textOf(first)}`);
  assert.ok(existsSync(ARGV_LOG), "first call should have reached the CLI");
  rmSync(ARGV_LOG); // clear, so we can tell whether the replay reaches the CLI again

  const second = await callTool(client, "create_task", { ...params, confirmationToken });
  assert.equal(second.isError, true, "replaying a spent token must be refused");
  assert.match(textOf(second), /NO_SUCH_TOKEN/);
  assert.equal(existsSync(ARGV_LOG), false, "replay must not have reached the CLI a second time");
});

test("create_task over MCP protocol: per-task cap is enforced (server built with maxTaskRewardUsdc: 3)", async () => {
  const { client } = await connectedPair(); // maxTaskRewardUsdc: 3
  const params = {
    description: "over the per-task cap",
    rewardUsdc: 3.5,
    durationHours: 1,
    source: "user_authorized",
  };
  const preview = await callTool(client, "preview_create_task", params);
  assert.equal(preview.isError, true);
  assert.match(textOf(preview), /TASK_CAP_EXCEEDED/);
});

test("create_task over MCP protocol: daily cap is enforced across two separate create_task calls", async () => {
  if (existsSync(ARGV_LOG)) rmSync(ARGV_LOG);
  if (existsSync(SPEND_FILE)) rmSync(SPEND_FILE);
  const { client } = await connectedPair({ maxTaskRewardUsdc: 3, maxDailySpendUsdc: 3 });

  const first = { description: "first", rewardUsdc: 2, durationHours: 1, source: "user_authorized" };
  const p1 = await callTool(client, "preview_create_task", first);
  const t1 = JSON.parse(textOf(p1)).confirmationToken;
  const e1 = await callTool(client, "create_task", { ...first, confirmationToken: t1 });
  assert.notEqual(e1.isError, true, `first create should succeed: ${textOf(e1)}`);
  rmSync(ARGV_LOG);

  // Second task alone is under the per-task cap (3) but 2 + 2 = 4 > daily cap (3)
  const second = { description: "second", rewardUsdc: 2, durationHours: 1, source: "user_authorized" };
  const p2 = await callTool(client, "preview_create_task", second);
  const t2 = JSON.parse(textOf(p2)).confirmationToken;
  const e2 = await callTool(client, "create_task", { ...second, confirmationToken: t2 });
  assert.equal(e2.isError, true, "second create should be refused by the daily cap");
  assert.match(textOf(e2), /DAILY_CAP_EXCEEDED/);
  assert.equal(existsSync(ARGV_LOG), false, "the capped call must never have reached the CLI");
});

test("award_submissions over MCP protocol: preview then execute reaches the stub with correct --winner flags", async () => {
  if (existsSync(ARGV_LOG)) rmSync(ARGV_LOG);
  const { client } = await connectedPair();
  const params = {
    taskId: "0xsometask",
    winners: [
      { worker: "0xAlice", shareBps: 7000 },
      { worker: "0xBob", shareBps: 3000 },
    ],
  };
  const preview = await callTool(client, "preview_award_submissions", params);
  assert.notEqual(preview.isError, true, textOf(preview));
  const { confirmationToken } = JSON.parse(textOf(preview));
  const exec = await callTool(client, "award_submissions", { ...params, confirmationToken });
  assert.notEqual(exec.isError, true, textOf(exec));
  const argv = JSON.parse(readFileSync(ARGV_LOG, "utf8"));
  assert.deepEqual(argv, [
    "task", "accept-submissions", "0xsometask",
    "--winner", "0xAlice:7000",
    "--winner", "0xBob:3000",
  ]);
});

test("award_submissions over MCP protocol: bad shares are refused by the tool's own input validation before policy or CLI ever see it", async () => {
  const { client } = await connectedPair();
  const preview = await callTool(client, "preview_award_submissions", {
    taskId: "0xsometask",
    winners: [{ worker: "0xAlice", shareBps: 6000 }], // sums to 6000, not 10000
  });
  assert.equal(preview.isError, true);
  assert.match(textOf(preview), /BAD_SHARES/);
});

test("award_submissions over MCP protocol: executing without ever previewing is refused", async () => {
  if (existsSync(ARGV_LOG)) rmSync(ARGV_LOG);
  const { client } = await connectedPair();
  const exec = await callTool(client, "award_submissions", {
    taskId: "0xsometask",
    winners: [{ worker: "0xAlice", shareBps: 10000 }],
    confirmationToken: "made-up-token-nobody-minted",
  });
  assert.equal(exec.isError, true);
  assert.match(textOf(exec), /NO_SUCH_TOKEN/);
  assert.equal(existsSync(ARGV_LOG), false);
});

test.after(() => {
  delete process.env.TASKMARKET_CLI;
  rmSync(dir, { recursive: true, force: true });
});
