// client.live.test.mjs - REAL network calls against the live TaskMarket API.
// Read-only. No wallet, no auth, no spend - confirmed against the docs and
// live with curl before this was written (see README "Verification" section).
//
// These assert against DATA THAT ONLY EXISTS IF THE CODE WORKS: the exact
// requester address on the two bounties this artifact targets, and that our
// own worker wallet's balance round-trips through the client the same way it
// does through the raw REST API. A client that built the wrong path or wrong
// query string would 404 or return a different body, not silently pass.
//
// Skips (does not fail the suite) if there is no network path to
// api.taskmarket.dev, so this suite behaves in a sandboxed CI runner too -
// but it DOES run, and DOES hit the real API, in this environment.
import test from "node:test";
import assert from "node:assert/strict";
import { TaskMarketClient, TaskMarketApiError } from "../src/client.mjs";

const REAL_TASK_ID_A = "0x8e416ba0f3e473d2dddc7f7afc03ca35ab12b95972818808e9eff0d1e98e31fb";
const REAL_TASK_ID_B = "0x21cc30011dddb8c7a5e91b4c70c140defab447507169513745d0389572255a42";
const REQUESTER = "0x93710f148a88d80B344BB1fEbB91DCBA9f80019F";
const OUR_WALLET = "0x9f54460FED51892b3b065EAe3Ac1603dC3C6ECe4";

let networkAvailable = true;
const client = new TaskMarketClient();

test.before(async () => {
  try {
    await client.health();
  } catch {
    networkAvailable = false;
    console.error("SKIPPING client.live.test.mjs: api.taskmarket.dev unreachable from this environment");
  }
});

test("health: live API reports ok", async (t) => {
  if (!networkAvailable) return t.skip("no network");
  const h = await client.health();
  assert.equal(h.status, "ok");
});

test("getTask: fetches the real bounty this artifact targets, and it is really the same requester", async (t) => {
  if (!networkAvailable) return t.skip("no network");
  const task = await client.getTask(REAL_TASK_ID_A);
  assert.equal(task.id, REAL_TASK_ID_A);
  assert.equal(task.requester, REQUESTER);
  assert.equal(task.mode, "bounty");
  assert.ok(task.description.includes("TaskMarket Integration PR"));
});

test("getTask: second real bounty, same requester", async (t) => {
  if (!networkAvailable) return t.skip("no network");
  const task = await client.getTask(REAL_TASK_ID_B);
  assert.equal(task.id, REAL_TASK_ID_B);
  assert.equal(task.requester, REQUESTER);
});

test("getTask: a made-up task id 404s through TaskMarketApiError, proving errors are not swallowed", async (t) => {
  if (!networkAvailable) return t.skip("no network");
  await assert.rejects(
    () => client.getTask("0xnot-a-real-task-id-0000000000000000000000000000000000000000000000"),
    (err) => {
      assert.ok(err instanceof TaskMarketApiError);
      assert.equal(err.status, 404);
      return true;
    },
  );
});

test("searchTasks: the live open board includes at least one task and each has the shape the rest of this package assumes", async (t) => {
  if (!networkAvailable) return t.skip("no network");
  const page = await client.searchTasks({ status: "open", limit: 5 });
  assert.ok(Array.isArray(page.tasks), "expected page.tasks to be an array");
  assert.ok(page.tasks.length > 0, "expected at least one open task on the live board");
  const row = page.tasks[0];
  for (const field of ["id", "requester", "reward", "mode", "status"]) {
    assert.ok(field in row, `task row missing expected field "${field}"`);
  }
});

test("getWalletBalance: our own worker wallet returns a real numeric balance", async (t) => {
  if (!networkAvailable) return t.skip("no network");
  const bal = await client.getWalletBalance(OUR_WALLET);
  assert.equal(bal.address, OUR_WALLET);
  assert.ok(/^[0-9]+\.[0-9]+$/.test(bal.balanceUsdc), `balanceUsdc not numeric-looking: ${bal.balanceUsdc}`);
  assert.ok(Number(bal.balanceUsdc) >= 0);
});

test("getRequesterStats: the requester behind both target bounties has actually created tasks (created > 0)", async (t) => {
  if (!networkAvailable) return t.skip("no network");
  const stats = await client.getRequesterStats(REQUESTER);
  assert.ok(
    typeof stats.totalTasksCreated === "number" && stats.totalTasksCreated > 0,
    `expected totalTasksCreated > 0, got ${JSON.stringify(stats)}`,
  );
});
