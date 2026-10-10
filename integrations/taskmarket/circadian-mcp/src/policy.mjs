// policy.mjs - the gate. Every write tool in server.mjs goes through this
// before it is allowed to touch cli.mjs (which is the only module that can
// move money or reject/award work). Nothing else in this package enforces
// spending limits or authorization; if this file is bypassed, the guardrails
// the task asked for do not exist.
//
// DESIGN, so a reviewer does not have to reverse-engineer it:
//
// 1. TWO-STEP COMMIT. Every spend-shaped tool (create_task, award_submissions,
//    reject_submission) has a matching preview_* tool. preview_* does the math,
//    checks the per-task cap, and mints a single-use CONFIRMATION TOKEN bound
//    to the exact canonicalized parameters. The write tool will only proceed
//    if it is called again with that token AND the same parameters - if the
//    caller (an LLM, possibly steered by something it read) tries to change
//    the reward, the worker, or the description between preview and execute,
//    the hash will not match and the write is refused before any network call
//    or CLI invocation happens.
//
//    This does not by itself prove a human saw the preview - no MCP server can
//    prove that from inside the process. What it proves, and what the tests in
//    test/policy.test.mjs check, is that a write CANNOT happen without a token
//    that was minted by a prior read-only preview call carrying the identical
//    parameters. That closes the specific hole named in the task text: "create
//    tasks from untrusted prompt content" cannot walk straight to create_task,
//    it has to go through preview_create_task first, and preview_create_task
//    itself refuses anything not marked source:"user_authorized" (see #3).
//
// 2. SPENDING LIMITS are enforced twice: once per-task (maxTaskRewardUsdc) at
//    preview time, and once as a rolling daily total (maxDailySpendUsdc) at
//    execute time, immediately before the CLI is invoked. The daily total is
//    read from and written to a small JSON file so it survives a server
//    restart; a stale token from yesterday cannot be replayed to dodge today's
//    cap because tokens expire (default 15 minutes) long before "today" changes.
//
// 3. SOURCE GUARD. create_task requires an explicit `source` field and only
//    "user_authorized" is accepted. Any other value - "task_description",
//    "web_content", "inferred", or simply omitting it - is refused outright,
//    every time, with no override. This is the literal implementation of the
//    task text's "never create tasks from untrusted prompt content": the
//    calling agent must assert, in a field that is logged, that the content
//    came from the user and not from something it read.
//
// 4. NO PRIVATE KEY ANYWHERE IN THIS FILE OR THIS PACKAGE. Every write bottoms
//    out in cli.mjs, which shells out to the `taskmarket` CLI binary. Signing
//    happens inside that binary's own keystore, which this package never
//    reads, prints, or touches. See cli.mjs's header for the same point made
//    about that module.

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
  }
}

/** Deterministic JSON: same object, same string, key order does not matter. */
export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
}

export function loadPolicyConfig(env = process.env) {
  const num = (name, fallback) => {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) {
      throw new PolicyError("BAD_CONFIG", `${name} must be a positive number, got ${JSON.stringify(raw)}`);
    }
    return v;
  };
  return {
    // Per-task ceiling. A single create_task call may never exceed this.
    maxTaskRewardUsdc: num("TASKMARKET_MCP_MAX_TASK_REWARD_USDC", 5),
    // Rolling UTC-day ceiling across all successful create_task calls.
    maxDailySpendUsdc: num("TASKMARKET_MCP_MAX_DAILY_SPEND_USDC", 5),
    // How long a preview's confirmation token stays redeemable.
    tokenTtlMs: num("TASKMARKET_MCP_TOKEN_TTL_MS", 15 * 60 * 1000),
    // Where the rolling daily spend total is persisted.
    spendStateFile:
      env.TASKMARKET_MCP_SPEND_STATE_FILE ||
      path.join(process.cwd(), ".taskmarket-mcp-spend.json"),
  };
}

/** Single-use, expiring, parameter-bound confirmation tokens. In-memory only:
 * a server restart invalidates every outstanding preview, which is the safe
 * failure direction (re-preview, do not silently resurrect an old quote). */
export class ConfirmationStore {
  constructor(now = () => Date.now()) {
    this._now = now;
    this._tokens = new Map(); // token -> { action, hash, expiresAt }
  }

  mint(action, params, ttlMs) {
    const token = randomUUID();
    this._tokens.set(token, {
      action,
      hash: canonicalize(params),
      expiresAt: this._now() + ttlMs,
    });
    return token;
  }

  /** Throws PolicyError on any mismatch. Always consumes the token (one-time
   * use) so a failed attempt cannot be retried against the same token. */
  consume(token, action, params) {
    const entry = this._tokens.get(token);
    this._tokens.delete(token);
    if (!entry) {
      throw new PolicyError(
        "NO_SUCH_TOKEN",
        "No confirmation token found. Call the matching preview_* tool first and pass the token it returns.",
      );
    }
    if (entry.action !== action) {
      throw new PolicyError(
        "WRONG_ACTION",
        `Token was minted for "${entry.action}", not "${action}". Preview and execute must be the same action.`,
      );
    }
    if (this._now() > entry.expiresAt) {
      throw new PolicyError("TOKEN_EXPIRED", "Confirmation token expired. Re-run the preview.");
    }
    if (entry.hash !== canonicalize(params)) {
      throw new PolicyError(
        "PARAMS_CHANGED",
        "Parameters do not match what was previewed. Nothing was sent. Re-run the preview with the parameters you actually intend to execute.",
      );
    }
    return true;
  }

  /** Test/ops helper: how many unexpired tokens are outstanding. */
  size() {
    const now = this._now();
    let n = 0;
    for (const v of this._tokens.values()) if (v.expiresAt > now) n++;
    return n;
  }
}

/** Refuses anything that is not explicitly attributed to the user. This is
 * the whole enforcement of "never create tasks from untrusted prompt content" -
 * it is a closed allow-list of one value, not a blocklist of bad ones. */
export function requireUserAuthorizedSource(source) {
  if (source !== "user_authorized") {
    throw new PolicyError(
      "UNAUTHORIZED_SOURCE",
      'Refusing: "source" must be exactly "user_authorized". This tool never creates a task from ' +
        "content sourced from a task description, a web page, or anything other than the human user " +
        'directly approving these exact parameters. Got source=' + JSON.stringify(source),
    );
  }
}

function todayUtc(now) {
  return new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Rolling daily spend total, persisted to a small JSON file so it survives a
 * server restart. Single-process safe (read-modify-write on the event loop);
 * NOT safe against two server processes sharing the same file concurrently -
 * documented in the README as a known limitation, not hidden. */
export class SpendLedger {
  constructor(filePath, now = () => Date.now()) {
    this._file = filePath;
    this._now = now;
  }

  _read() {
    if (!existsSync(this._file)) return { date: todayUtc(this._now()), spentUsdc: 0 };
    try {
      const raw = JSON.parse(readFileSync(this._file, "utf8"));
      if (raw.date !== todayUtc(this._now())) return { date: todayUtc(this._now()), spentUsdc: 0 };
      return raw;
    } catch {
      // A corrupt state file must not silently permit unlimited spend.
      throw new PolicyError("SPEND_STATE_UNREADABLE", `${this._file} exists but is not valid JSON.`);
    }
  }

  _write(state) {
    mkdirSync(path.dirname(this._file), { recursive: true });
    writeFileSync(this._file, JSON.stringify(state, null, 2));
  }

  spentTodayUsdc() {
    return this._read().spentUsdc;
  }

  /** Throws if adding amountUsdc would exceed maxDailyUsdc. Does not record
   * anything - call commit() only after the CLI reports real success. */
  assertWithinDailyCap(amountUsdc, maxDailyUsdc) {
    const spent = this.spentTodayUsdc();
    if (spent + amountUsdc > maxDailyUsdc + 1e-9) {
      throw new PolicyError(
        "DAILY_CAP_EXCEEDED",
        `Refusing: ${amountUsdc} USDC would bring today's spend to ${(spent + amountUsdc).toFixed(6)} ` +
          `USDC, over the ${maxDailyUsdc} USDC daily cap. Already spent today: ${spent} USDC.`,
      );
    }
  }

  commit(amountUsdc) {
    const state = this._read();
    state.spentUsdc = Number((state.spentUsdc + amountUsdc).toFixed(6));
    this._write(state);
    return state.spentUsdc;
  }
}

export function assertWithinTaskCap(rewardUsdc, maxTaskRewardUsdc) {
  if (rewardUsdc > maxTaskRewardUsdc) {
    throw new PolicyError(
      "TASK_CAP_EXCEEDED",
      `Refusing: ${rewardUsdc} USDC exceeds the per-task cap of ${maxTaskRewardUsdc} USDC ` +
        "(TASKMARKET_MCP_MAX_TASK_REWARD_USDC). Lower the reward or raise the configured cap out of band.",
    );
  }
}
