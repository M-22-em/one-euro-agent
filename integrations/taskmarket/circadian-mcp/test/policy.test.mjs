// policy.test.mjs - unit tests on the gate itself, no network, no CLI.
//
// Every "refused" assertion here checks the SPECIFIC PolicyError.code, not
// just "it threw" - a wrong exception thrown for the wrong reason would pass
// a bare try/catch test and still be a broken gate.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  canonicalize,
  ConfirmationStore,
  SpendLedger,
  PolicyError,
  requireUserAuthorizedSource,
  assertWithinTaskCap,
  loadPolicyConfig,
} from "../src/policy.mjs";

function throwsCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof PolicyError, `expected PolicyError, got ${err}`);
    assert.equal(err.code, code, `expected code ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}

test("canonicalize: key order does not matter, values do", () => {
  assert.equal(canonicalize({ a: 1, b: 2 }), canonicalize({ b: 2, a: 1 }));
  assert.notEqual(canonicalize({ a: 1 }), canonicalize({ a: 2 }));
});

test("ConfirmationStore: mint then consume with identical params succeeds", () => {
  const store = new ConfirmationStore();
  const params = { rewardUsdc: 2, description: "x" };
  const token = store.mint("create_task", params, 60000);
  assert.doesNotThrow(() => store.consume(token, "create_task", { ...params }));
});

test("ConfirmationStore: token is single-use (replay is refused)", () => {
  const store = new ConfirmationStore();
  const params = { rewardUsdc: 2 };
  const token = store.mint("create_task", params, 60000);
  store.consume(token, "create_task", params); // first use: fine
  throwsCode(() => store.consume(token, "create_task", params), "NO_SUCH_TOKEN");
});

test("ConfirmationStore: changed parameters between preview and execute are refused, and prove they never reached the store as a match", () => {
  const store = new ConfirmationStore();
  const previewed = { rewardUsdc: 2, worker: "0xAlice" };
  const token = store.mint("create_task", previewed, 60000);
  const tampered = { rewardUsdc: 200, worker: "0xAlice" }; // reward bumped 100x after preview
  throwsCode(() => store.consume(token, "create_task", tampered), "PARAMS_CHANGED");
  // and the token is now burned - a second attempt with the ORIGINAL correct
  // params must also fail, proving this is not a "try again" loophole.
  throwsCode(() => store.consume(token, "create_task", previewed), "NO_SUCH_TOKEN");
});

test("ConfirmationStore: wrong action name is refused even with matching params", () => {
  const store = new ConfirmationStore();
  const params = { taskId: "0xabc" };
  const token = store.mint("award_submissions", params, 60000);
  throwsCode(() => store.consume(token, "reject_submission", params), "WRONG_ACTION");
});

test("ConfirmationStore: expired token is refused", () => {
  let now = 1_000_000;
  const store = new ConfirmationStore(() => now);
  const params = { rewardUsdc: 1 };
  const token = store.mint("create_task", params, 1000);
  now += 1001; // past expiry
  throwsCode(() => store.consume(token, "create_task", params), "TOKEN_EXPIRED");
});

test("ConfirmationStore: unknown token is refused", () => {
  const store = new ConfirmationStore();
  throwsCode(() => store.consume("not-a-real-token", "create_task", {}), "NO_SUCH_TOKEN");
});

test("requireUserAuthorizedSource: only the literal value user_authorized passes", () => {
  assert.doesNotThrow(() => requireUserAuthorizedSource("user_authorized"));
  for (const bad of [undefined, "", "task_description", "web_content", "USER_AUTHORIZED", "user_authorized "]) {
    throwsCode(() => requireUserAuthorizedSource(bad), "UNAUTHORIZED_SOURCE");
  }
});

test("assertWithinTaskCap: over-cap reward is refused, at-cap and under-cap are not", () => {
  assert.doesNotThrow(() => assertWithinTaskCap(5, 5));
  assert.doesNotThrow(() => assertWithinTaskCap(4.99, 5));
  throwsCode(() => assertWithinTaskCap(5.01, 5), "TASK_CAP_EXCEEDED");
});

test("loadPolicyConfig: rejects a non-positive env override rather than silently ignoring it", () => {
  assert.throws(() => loadPolicyConfig({ TASKMARKET_MCP_MAX_TASK_REWARD_USDC: "-1" }), PolicyError);
  assert.throws(() => loadPolicyConfig({ TASKMARKET_MCP_MAX_TASK_REWARD_USDC: "not-a-number" }), PolicyError);
  const cfg = loadPolicyConfig({ TASKMARKET_MCP_MAX_TASK_REWARD_USDC: "12.5" });
  assert.equal(cfg.maxTaskRewardUsdc, 12.5);
});

test("SpendLedger: fresh state allows spend within the daily cap and commits it", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tm-spend-"));
  const file = path.join(dir, "spend.json");
  try {
    const ledger = new SpendLedger(file);
    assert.equal(ledger.spentTodayUsdc(), 0);
    ledger.assertWithinDailyCap(3, 5); // does not throw
    ledger.commit(3);
    assert.equal(ledger.spentTodayUsdc(), 3);
    // a second commit that would cross the cap must be caught by the caller's
    // assertWithinDailyCap BEFORE committing - verify the check itself fires:
    throwsCode(() => ledger.assertWithinDailyCap(2.5, 5), "DAILY_CAP_EXCEEDED");
    // and confirm the earlier commit's 3 is really persisted (would fail if
    // commit() was a no-op that only looked like it worked)
    const ledger2 = new SpendLedger(file);
    assert.equal(ledger2.spentTodayUsdc(), 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SpendLedger: a corrupt state file refuses rather than silently allowing unlimited spend", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tm-spend-bad-"));
  const file = path.join(dir, "spend.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(file, "{ not valid json");
  const ledger = new SpendLedger(file);
  throwsCode(() => ledger.spentTodayUsdc(), "SPEND_STATE_UNREADABLE");
  rmSync(dir, { recursive: true, force: true });
});
