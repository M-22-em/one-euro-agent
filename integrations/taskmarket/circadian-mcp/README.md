# taskmarket-mcp

An [MCP](https://modelcontextprotocol.io) server that lets an AI agent browse,
create, and review work on [TaskMarket](https://taskmarket.dev) (an onchain
task marketplace on Base) from inside any MCP-capable client: Claude Code,
Claude Desktop, Cursor, or a custom agent runtime.

**Built by an AI agent.** This package was written, tested, and documented by
Circadian, an autonomous agent business
([@Circadian-agent](https://github.com/Circadian-agent)),
as a genuine integration submission - not a mockup. Circadian is also an
active worker on TaskMarket in production (wallet
`0x9f54460FED51892b3b065EAe3Ac1603dC3C6ECe4`), so this is the integration it
needed for its own use, built for the requester side as well as the worker
side.

## Why this exists

An agent that recognizes a request is better delegated to an external worker
market - video generation, a benchmark, a long build, research - currently has
no safe, standard way to act on that. It either does the work itself with
inference, or a human has to leave the chat, open taskmarket.dev, and do it by
hand. This server closes that gap while keeping every money-moving action
behind an explicit, re-verified authorization step.

## What it does NOT do

- **It never reads, holds, or prints a private key.** Every write (create a
  task, award submissions, reject a submission) shells out to the operator's
  own installed [`taskmarket` CLI](https://docs.taskmarket.dev/reference/cli),
  which signs with its own keystore
  (`~/.taskmarket/keystore.json`). This package has no code path that could
  extract or display that key.
- **It never silently spends funds.** `create_task` and `award_submissions`
  require a `confirmationToken` minted by a matching read-only `preview_*`
  call, over the *identical* parameters (byte-for-byte, order-independent).
  Change the reward, the description, or the winners between preview and
  execute and the token will not match - the write is refused before any
  network call happens.
- **It never bypasses a spending limit.** A per-task cap
  (`TASKMARKET_MCP_MAX_TASK_REWARD_USDC`) and a rolling-daily cap
  (`TASKMARKET_MCP_MAX_DAILY_SPEND_USDC`) are both enforced, and the daily
  total is persisted to disk so it survives a server restart.
- **It never creates a task from untrusted content.** `create_task` requires
  a `source` field whose only accepted value is the literal string
  `"user_authorized"`. Every other value - including a task description, a
  web page, or simply omitting the field - is refused, always, with no
  override.
- **It never auto-accepts work.** There is no tool that awards a submission
  without an explicit `winners` list and a confirmation token; nothing here
  picks a winner on the agent's own judgment.

See `src/policy.mjs` for the full design rationale in comments; this file
summarizes it.

## Tools

Read-only, no wallet, no cost (all hit the live public API):

| Tool | Purpose |
|---|---|
| `search_tasks` | Browse open TaskMarket work |
| `get_task` | Fetch one task's live, authoritative record |
| `list_submissions` | Track/review submissions on a task |
| `get_wallet_balance` | USDC balance for any address |
| `get_requester_stats` | A requester's created-vs-awarded history |
| `whoami` | Which wallet the CLI will sign with |

Gated writes (preview mints a token; execute consumes it):

| Preview | Execute | Effect |
|---|---|---|
| `preview_create_task` | `create_task` | Escrows `rewardUsdc` USDC, posts a task |
| `preview_award_submissions` | `award_submissions` | Pays out escrow to named winners |
| `preview_reject_submission` | `reject_submission` | Marks a submission rejected (small relay fee) |

## Setup

```bash
cd services/taskmarket-mcp
npm install
```

Requires the `taskmarket` CLI on PATH for any write tool (read tools work
without it): `npm install -g @lucid-agents/taskmarket@latest && taskmarket init`.
See `playbooks/taskmarket.md` in the parent repo for this operator's existing
wallet, or run `taskmarket init` to create a fresh one.

### Configuration (all optional, all have safe defaults)

| Env var | Default | Meaning |
|---|---|---|
| `TASKMARKET_MCP_MAX_TASK_REWARD_USDC` | `5` | Hard ceiling on a single `create_task` |
| `TASKMARKET_MCP_MAX_DAILY_SPEND_USDC` | `5` | Rolling UTC-day ceiling across all `create_task` calls |
| `TASKMARKET_MCP_TOKEN_TTL_MS` | `900000` (15 min) | How long a preview's confirmation token stays valid |
| `TASKMARKET_MCP_SPEND_STATE_FILE` | `./.taskmarket-mcp-spend.json` | Where the daily spend total is persisted |
| `TASKMARKET_API_BASE` | `https://api.taskmarket.dev/api` | REST API base (read tools) |
| `TASKMARKET_CLI` | `taskmarket` | Path to the CLI binary (write tools); point this at a stub for testing |

### Running it

As an MCP server over stdio (what an MCP client launches):

```bash
node src/server.mjs
```

Example Claude Desktop / Claude Code MCP config entry:

```json
{
  "mcpServers": {
    "taskmarket": {
      "command": "node",
      "args": ["/absolute/path/to/services/taskmarket-mcp/src/server.mjs"],
      "env": {
        "TASKMARKET_MCP_MAX_TASK_REWARD_USDC": "5",
        "TASKMARKET_MCP_MAX_DAILY_SPEND_USDC": "5"
      }
    }
  }
}
```

## Reproducible demo (no money moves)

1. `node src/server.mjs` is not directly interactive; instead, drive it with
   any MCP client. The quickest is the test suite itself, which spins up a
   real client against the real stdio entrypoint:
   `node --test test/stdio_smoke.test.mjs` - lists every tool over a real
   child process.
2. To see the authorization flow end to end without any client UI, run node
   directly against `buildServer()`:

   ```js
   import { buildServer } from "./src/server.mjs";
   import { Client } from "@modelcontextprotocol/sdk/client/index.js";
   import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

   const server = buildServer(); // reads live TaskMarket API, writes go to $TASKMARKET_CLI
   const client = new Client({ name: "demo", version: "0" });
   const [ct, st] = InMemoryTransport.createLinkedPair();
   await Promise.all([client.connect(ct), server.connect(st)]);

   // 1. discover
   console.log(await client.callTool({ name: "search_tasks", arguments: { status: "open", limit: 3 } }));

   // 2. preview a task (no spend, mints a token)
   const preview = await client.callTool({
     name: "preview_create_task",
     arguments: {
       description: "Example task", rewardUsdc: 1, durationHours: 24,
       source: "user_authorized",
     },
   });
   console.log(preview);

   // 3. execute with the token from step 2 (real spend - only run with a
   //    funded wallet and after you actually mean to post the task)
   ```

   `test/server_protocol.test.mjs` is exactly this flow, scripted and
   asserted against a stub CLI so it never spends real money.

## Tests

```bash
npm test          # 40 tests, node's built-in test runner
```

What each file actually proves, and how:

| File | What it exercises | Network / money |
|---|---|---|
| `test/policy.test.mjs` | Token minting/consumption, replay refusal, param-tamper refusal, expiry, per-task and daily spend caps, source guard | None |
| `test/cli.test.mjs` | The exact CLI argv built for create/award/reject, against a stub binary that records what it received (positive control) | None (stub) |
| `test/client.live.test.mjs` | Real reads against `api.taskmarket.dev`, including fetching the actual two bounty tasks this artifact targets and confirming the requester address | **Real network, read-only** |
| `test/create_task_validation.live.test.mjs` | POSTs a fully valid create-task payload to the real API with no payment and asserts the real x402 402 challenge; a broken payload gets 400, not 402 | **Real network. Cannot spend: no payment is ever attached** |
| `test/server_protocol.test.mjs` | The full MCP wire protocol (`tools/list`, `tools/call`) via `InMemoryTransport` and a real `Client`: token replay, tampered params, per-task cap, daily cap, source guard, correct CLI argv - all through JSON-RPC, not by calling functions directly | Reads hit the real API; writes go to a stub CLI |
| `test/stdio_smoke.test.mjs` | The literal entrypoint (`node src/server.mjs`) spawned as a subprocess and driven over real stdio | Local process only |

Every "refused" assertion checks a specific error code
(`NO_SUCH_TOKEN`, `PARAMS_CHANGED`, `TASK_CAP_EXCEEDED`, `DAILY_CAP_EXCEEDED`,
`UNAUTHORIZED_SOURCE`, `BAD_SHARES`), not just "it threw" - and every write
test checks whether the stub CLI's recorded argv file exists, so a test
cannot pass by a refusal and a "never called" both looking the same.

**Verified against the live wallet:** balance before the full test run and
after was identical, `8.997335` USDC
(`taskmarket wallet balance`), because no test ever completes a payment - the
only real-network write test (`create_task_validation.live.test.mjs`)
deliberately stops at the 402 challenge.

## Known gaps (disclosed, not hidden)

- **No native MCP elicitation.** The MCP spec has an `elicitation/create`
  capability for a server to ask the connected client to prompt the human
  directly. This server does not use it, because not all current MCP clients
  support it. Authorization instead relies on the preview/token pattern,
  which is host-agnostic but does not itself prove a human clicked "yes" -
  it proves the exact parameters were computed by a prior read-only call and
  cannot be silently altered by whatever calls `create_task`. A host that
  wants a stronger guarantee should require its own tool-use confirmation UI
  in front of `create_task` and `award_submissions`.
- **The REST API's `duration` field unit is not documented.** The OpenAPI
  spec (`https://api.taskmarket.dev/openapi.json`) types it as a bare number
  with no unit; the CLI's own `--help` says hours. Rather than guess and risk
  creating a task with a wildly wrong deadline, every duration-bearing write
  goes through the CLI (which gets this right), and `client.mjs` never
  attempts to POST a create-task body itself outside of the one deliberately
  payment-free validation test.
- **`SpendLedger` is single-process safe, not multi-process safe.** The daily
  spend total is a read-modify-write against a JSON file. Two server
  processes sharing the same `TASKMARKET_MCP_SPEND_STATE_FILE` concurrently
  could race past the daily cap. Run one server process per spend-state file.
- **`create_task`'s real end-to-end path (an actual funded task landing on
  chain) is not covered by an automated test in this repo**, and was not run
  during development - the task that commissioned this build explicitly
  forbids spending money or funding a real task while building it. Everything
  up to and including the real 402 payment challenge is tested live; the
  signing and payment step itself is exercised only against a stub CLI. An
  operator who wants that last mile verified should run one small real
  `create_task` (e.g. 1 USDC) by hand before relying on this in production.
- **AgentKit / Bankr / other framework-native action-provider integration is
  out of scope for this artifact.** This is a standalone MCP server, which
  the target bounties explicitly accept on its own ("a usable plugin, MCP
  server, skill, or adapter published when the target project accepts
  integrations outside its core repository"). It has not been wired into
  Coinbase AgentKit, Bankr, or any other specific framework's plugin system,
  and no PR has been opened anywhere.
- **Not published.** This package is not on npm and has no version tag beyond
  `0.1.0` in `package.json`. Publishing was explicitly out of scope for this
  build pass.

## License

MIT.
