// cli.test.mjs - proves cli.mjs builds the RIGHT argv and hands it to
// whatever TASKMARKET_CLI points at, without ever touching the real binary
// or a real wallet.
//
// Positive control, same pattern as tools/lib/taskmarket_submit.test.mjs in
// this repo: the stub records its argv to a file and exits 0. A test that
// only checked "the function returned something" could not tell "we called
// the CLI with the right flags" from "we called it with the wrong flags and
// got lucky" - reading the recorded argv is what makes this a real assertion.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createTask, awardSubmissions, rejectSubmission, whoAmI, CliInvocationError } from "../src/cli.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "tm-cli-"));
const ARGV_LOG = path.join(dir, "argv.json");

const STUB = path.join(dir, "fake-taskmarket");
writeFileSync(
  STUB,
  `#!/usr/bin/env node\n` +
    `require("fs").writeFileSync(${JSON.stringify(ARGV_LOG)}, JSON.stringify(process.argv.slice(2)));\n` +
    `console.log(JSON.stringify({ok: true, data: {stub: true, argv: process.argv.slice(2)}}));\n`,
);
chmodSync(STUB, 0o755);

const FAILING_STUB = path.join(dir, "fake-taskmarket-fail");
writeFileSync(
  FAILING_STUB,
  `#!/usr/bin/env node\n` +
    `process.stderr.write("simulated on-chain revert\\n");\n` +
    `process.exit(1);\n`,
);
chmodSync(FAILING_STUB, 0o755);

function withStub(stubPath, fn) {
  const prev = process.env.TASKMARKET_CLI;
  if (existsSync(ARGV_LOG)) rmSync(ARGV_LOG);
  process.env.TASKMARKET_CLI = stubPath;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TASKMARKET_CLI;
    else process.env.TASKMARKET_CLI = prev;
  }
}

test("createTask: builds the documented CLI flags and the stub actually receives them", () => {
  const result = withStub(STUB, () =>
    createTask({ description: "test task, do not fund", rewardUsdc: 2.5, durationHours: 24, tags: ["a", "b"] }),
  );
  assert.equal(result.ok, true);
  const argv = JSON.parse(readFileSync(ARGV_LOG, "utf8"));
  assert.deepEqual(argv, [
    "task",
    "create",
    "--description",
    "test task, do not fund",
    "--reward",
    "2.5",
    "--duration",
    "24",
    "--mode",
    "bounty",
    "--tags",
    "a,b",
  ]);
});

test("createTask: rejects locally (never invokes the CLI at all) on missing required fields", () => {
  assert.throws(() => withStub(STUB, () => createTask({ description: "", rewardUsdc: 1, durationHours: 1 })), TypeError);
  assert.throws(() => withStub(STUB, () => createTask({ description: "x", rewardUsdc: 0, durationHours: 1 })), TypeError);
  // proof the stub was genuinely never reached, not just that it threw:
  assert.equal(existsSync(ARGV_LOG), false);
});

test("createTask: a CLI that fails (e.g. reverted tx) surfaces as CliInvocationError, not a false success", () => {
  assert.throws(
    () => withStub(FAILING_STUB, () => createTask({ description: "x", rewardUsdc: 1, durationHours: 1 })),
    CliInvocationError,
  );
});

test("awardSubmissions: shares must sum to exactly 10000, checked before the CLI ever runs", () => {
  assert.throws(
    () => withStub(STUB, () => awardSubmissions("0xtask", [{ worker: "0xA", shareBps: 5000 }])),
    /sum to 10000/,
  );
  assert.equal(existsSync(ARGV_LOG), false);
});

test("awardSubmissions: builds one --winner flag per winner, in order, with optional submissionId pinned", () => {
  withStub(STUB, () =>
    awardSubmissions("0xtask123", [
      { worker: "0xAlice", shareBps: 6000, submissionId: "sub_1" },
      { worker: "0xBob", shareBps: 4000 },
    ]),
  );
  const argv = JSON.parse(readFileSync(ARGV_LOG, "utf8"));
  assert.deepEqual(argv, [
    "task",
    "accept-submissions",
    "0xtask123",
    "--winner",
    "0xAlice:6000:sub_1",
    "--winner",
    "0xBob:4000",
  ]);
});

test("rejectSubmission: builds the documented flags", () => {
  withStub(STUB, () => rejectSubmission("0xtask9", "0xSpammer"));
  const argv = JSON.parse(readFileSync(ARGV_LOG, "utf8"));
  assert.deepEqual(argv, ["task", "reject-submission", "0xtask9", "--worker", "0xSpammer"]);
});

test("whoAmI: read-only identity call reaches the stub with no write flags", () => {
  const result = withStub(STUB, () => whoAmI());
  assert.equal(result.ok, true);
  const argv = JSON.parse(readFileSync(ARGV_LOG, "utf8"));
  assert.deepEqual(argv, ["address"]);
});

test.after(() => rmSync(dir, { recursive: true, force: true }));
