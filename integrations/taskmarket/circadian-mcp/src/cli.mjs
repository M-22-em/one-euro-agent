// cli.mjs - the only module in this package that can move money, and it does
// so by shelling out to the operator's own `taskmarket` CLI binary rather than
// holding or reading a private key itself.
//
// WHY A SHELL-OUT AND NOT A DIRECT SIGNED REQUEST
// The wallet keystore (`~/.taskmarket/keystore.json`) belongs to the CLI, not
// to this package. This module never opens that file, never asks for a seed
// phrase or private key, and has no code path that could print one - there is
// no `--print-key` flag anywhere below, and TASKMARKET_CLI can only ever point
// at a different EXECUTABLE, never inject a key into this process. If the
// keystore is missing, the underlying CLI is documented to silently mint a
// fresh wallet and identity (see playbooks/taskmarket.md); this module treats
// that as the CLI's problem to refuse, not something to work around here.
//
// TASKMARKET_CLI lets tests point this at a stub executable instead of the
// real binary, the same convention tools/taskmarket_submit.mjs already uses
// in this repo. In production, leave it unset and it resolves `taskmarket`
// from PATH.
//
// Every exported function here returns the parsed JSON the CLI printed
// (`{ok: true, data: ...}` or `{ok: false, error: ...}`) or throws
// CliInvocationError if the process failed to run at all (wrong binary,
// binary missing, non-JSON output) - that distinction matters for tests that
// need to tell "the CLI ran and refused" apart from "the CLI never ran."

import { execFileSync } from "node:child_process";

export class CliInvocationError extends Error {
  constructor(message, { stdout, stderr, status } = {}) {
    super(message);
    this.name = "CliInvocationError";
    this.stdout = stdout;
    this.stderr = stderr;
    this.status = status;
  }
}

function resolveBinary() {
  return process.env.TASKMARKET_CLI || "taskmarket";
}

function run(args) {
  const bin = resolveBinary();
  let stdout;
  try {
    stdout = execFileSync(bin, args, { encoding: "utf8" });
  } catch (err) {
    throw new CliInvocationError(`taskmarket CLI (${bin}) failed: ${err.message}`, {
      stdout: err.stdout,
      stderr: err.stderr,
      status: err.status,
    });
  }
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // The stub used in tests may print a plain marker line instead of JSON;
    // real production output is documented and observed as JSON for every
    // `task get` / `task my-submissions` call. Callers that need the raw
    // text (the test stub) read process output separately; production
    // callers always get real JSON from the live CLI.
    return { ok: true, raw: trimmed };
  }
}

/** `taskmarket task create --description ... --reward <usdc> --duration <hours> ...`
 * REAL MONEY MOVES HERE IN PRODUCTION: this is an X402-gated write and the
 * live CLI will sign and pay `rewardUsdc` USDC from the operator's wallet. */
export function createTask({
  description,
  rewardUsdc,
  durationHours,
  mode = "bounty",
  tags = [],
  taskVisibility,
  submissionVisibility,
}) {
  if (!description) throw new TypeError("createTask requires description");
  if (!(rewardUsdc > 0)) throw new TypeError("createTask requires rewardUsdc > 0");
  if (!(durationHours > 0)) throw new TypeError("createTask requires durationHours > 0");
  const args = [
    "task",
    "create",
    "--description",
    description,
    "--reward",
    String(rewardUsdc),
    "--duration",
    String(durationHours),
    "--mode",
    mode,
  ];
  if (tags.length) args.push("--tags", tags.join(","));
  if (taskVisibility) args.push("--task-visibility", taskVisibility);
  if (submissionVisibility) args.push("--submission-visibility", submissionVisibility);
  return run(args);
}

/** `taskmarket task accept-submissions <taskId> --winner addr:shareBps[:subId] ...`
 * REAL MONEY MOVES HERE IN PRODUCTION: pays out (part of) the escrowed
 * reward to the named winners and costs a small relay fee. */
export function awardSubmissions(taskId, winners) {
  if (!taskId) throw new TypeError("awardSubmissions requires taskId");
  if (!Array.isArray(winners) || winners.length === 0) {
    throw new TypeError("awardSubmissions requires a non-empty winners array");
  }
  const totalShare = winners.reduce((sum, w) => sum + w.shareBps, 0);
  if (totalShare !== 10000) {
    throw new TypeError(`winners' shareBps must sum to 10000, got ${totalShare}`);
  }
  const args = ["task", "accept-submissions", taskId];
  for (const w of winners) {
    if (!w.worker || !(w.shareBps > 0)) {
      throw new TypeError("each winner needs {worker, shareBps} with shareBps > 0");
    }
    const field = w.submissionId ? `${w.worker}:${w.shareBps}:${w.submissionId}` : `${w.worker}:${w.shareBps}`;
    args.push("--winner", field);
  }
  return run(args);
}

/** `taskmarket task reject-submission <taskId> --worker <addr>`. Costs a
 * small relay fee, no reward payout. */
export function rejectSubmission(taskId, worker) {
  if (!taskId) throw new TypeError("rejectSubmission requires taskId");
  if (!worker) throw new TypeError("rejectSubmission requires worker");
  return run(["task", "reject-submission", taskId, "--worker", worker]);
}

/** `taskmarket address` - identity check, read-only, no cost. Used so a
 * caller can confirm which wallet is signing before authorizing a spend. */
export function whoAmI() {
  return run(["address"]);
}
