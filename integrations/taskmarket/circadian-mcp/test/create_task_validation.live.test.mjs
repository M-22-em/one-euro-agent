// create_task_validation.live.test.mjs - the ONLY test in this package that
// exercises the real POST /tasks write endpoint, and it is safe by
// construction: it never sends an X402 payment, so the server can never do
// more than ask for one.
//
// TaskMarket's own API makes this possible: POST /tasks with a schema-valid
// body and NO Authorization/payment returns HTTP 402 with an x402 payment
// challenge (verified live 2026-08-10 with curl, see README). It never
// creates the task, never touches escrow, never returns a task id or
// escrowTxHash - a 402 response has none of those fields. So "we got a 402
// whose accepts[0].amount equals the reward we sent" is proof our payload is
// well-formed enough to reach the payment stage, and simultaneously proof
// nothing was funded, because a 402 is by definition an unfulfilled request.
//
// The negative control matters as much as the positive one: a body missing a
// required field (no `tags`) must 400, not 402 - if it also 402'd, that would
// mean the endpoint accepts garbage and this "positive" test would not be
// telling us anything about payload correctness.
import test from "node:test";
import assert from "node:assert/strict";

const API_BASE = process.env.TASKMARKET_API_BASE || "https://api.taskmarket.dev/api";

let networkAvailable = true;
test.before(async () => {
  try {
    const r = await fetch(`${API_BASE}/health`);
    if (!r.ok) networkAvailable = false;
  } catch {
    networkAvailable = false;
  }
});

test("POST /tasks with a valid create-task payload and NO payment returns 402 (payment required), never a created task", async (t) => {
  if (!networkAvailable) return t.skip("no network");
  const body = {
    description: "taskmarket-mcp schema-validation probe (built by an AI agent, never intended to fund - see README). Not a real task.",
    reward: "1000", // 0.001 USDC in base units - smallest the schema allows in practice
    duration: 1,
    tags: ["taskmarket-mcp-test"],
  };
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();

  assert.equal(res.status, 402, `expected 402 Payment Required, got ${res.status}: ${JSON.stringify(json)}`);
  assert.equal(json.error, "Payment required");
  assert.ok(Array.isArray(json.accepts) && json.accepts.length > 0, "expected an x402 accepts[] array");
  assert.equal(json.accepts[0].amount, body.reward, "the payment challenge amount must equal the reward we sent");
  assert.equal(json.accepts[0].network, "eip155:8453", "expected Base mainnet");
  // The strongest negative proof available without a wallet: a 402 response
  // carries no task id and no escrow tx, because nothing was created.
  assert.equal(json.id, undefined);
  assert.equal(json.escrowTxHash, undefined);
});

test("POST /tasks with a payload missing a required field (tags) returns 400, proving the 402 above was validation-approved and not a blanket accept-anything response", async (t) => {
  if (!networkAvailable) return t.skip("no network");
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description: "missing tags on purpose", reward: "1000", duration: 1 }),
  });
  const json = await res.json();
  assert.equal(res.status, 400, `expected 400, got ${res.status}: ${JSON.stringify(json)}`);
  assert.notEqual(res.status, 402, "a broken/incomplete payload must not reach the payment stage");
});
