// client.mjs - READ-ONLY wrapper around the public TaskMarket REST API
// (https://api.taskmarket.dev/api/*, documented at https://docs.taskmarket.dev/
// and https://api.taskmarket.dev/openapi.json).
//
// Every function here is a GET. It never signs anything, never sends USDC,
// and never needs a wallet - discovery reads work with no auth, verified live:
//   curl -s https://api.taskmarket.dev/api/tasks?limit=2
//   curl -s https://api.taskmarket.dev/api/wallet/balance?address=0x...
// both return 200 with no Authorization header (checked 2026-08-10).
//
// Writes (create task, accept/reject a submission) are deliberately NOT here.
// They live in cli.mjs and go through the `taskmarket` CLI binary instead of
// a hand-built HTTP POST, for two reasons:
//   1. Creating or settling a task is an X402-gated write. The CLI already
//      holds a vetted, working implementation of that signing flow inside its
//      own keystore; reimplementing EIP-3009 signing here would be a second,
//      untested path to the same money-moving action.
//   2. The REST schema for POST /tasks documents `duration` only as
//      `{type: number}` with no unit in the OpenAPI description, while the
//      CLI's own --help is explicit ("Task duration in hours"). Rather than
//      guess the wire unit and risk creating a task with a duration 3600x
//      off from what was intended, every duration-bearing write goes through
//      the CLI, which already gets this right.

const DEFAULT_BASE = "https://api.taskmarket.dev/api";

export class TaskMarketApiError extends Error {
  constructor(status, body, url) {
    super(`TaskMarket API ${status} on ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    this.name = "TaskMarketApiError";
    this.status = status;
    this.body = body;
  }
}

export class TaskMarketClient {
  constructor({ baseUrl = process.env.TASKMARKET_API_BASE || DEFAULT_BASE, fetchImpl = fetch } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this._fetch = fetchImpl;
  }

  async _get(pathname, query = {}) {
    const url = new URL(this.baseUrl + pathname);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    const res = await this._fetch(url.toString(), { headers: { accept: "application/json" } });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) throw new TaskMarketApiError(res.status, body, url.toString());
    return body;
  }

  /** GET /tasks - browse/search the open board. */
  async searchTasks({
    status = "open",
    phase,
    mode,
    tags,
    minReward,
    maxReward,
    requester,
    worker,
    deadlineHours,
    sort = "newest",
    limit = 20,
    cursor,
  } = {}) {
    return this._get("/tasks", {
      status,
      phase,
      mode,
      tags,
      minReward,
      maxReward,
      requester,
      worker,
      deadlineHours,
      sort,
      limit,
      cursor,
    });
  }

  /** GET /tasks/{taskId} - the canonical live row for one task. Always
   * re-fetch this immediately before deciding to act on a task; the board
   * scan can be stale by the time a decision is made.
   *
   * VERIFIED LIVE BEHAVIOR (2026-08-10), and it is not standard REST: an
   * unknown task id does NOT 404, it returns HTTP 200 with a literal JSON
   * `null` body (`curl -s .../api/tasks/0x00...00` -> `null`, status 200).
   * A naive client would hand callers `null` and let them crash on
   * `task.status`. This one turns that into the same TaskMarketApiError(404)
   * a normal REST API would give, so every caller in this package (and any
   * MCP client using this tool) can handle "not found" one way. */
  async getTask(taskId) {
    if (!taskId) throw new TypeError("getTask requires taskId");
    const path = `/tasks/${encodeURIComponent(taskId)}`;
    const body = await this._get(path);
    if (body === null) {
      throw new TaskMarketApiError(404, { error: "task not found" }, this.baseUrl + path);
    }
    return body;
  }

  /** GET /tasks/{taskId}/submissions - what has been submitted so far, for
   * the review/track flow. */
  async listSubmissions(taskId, { includePreviewUrls = "none" } = {}) {
    if (!taskId) throw new TypeError("listSubmissions requires taskId");
    return this._get(`/tasks/${encodeURIComponent(taskId)}/submissions`, { includePreviewUrls });
  }

  /** GET /wallet/balance?address= - USDC balance for any address, most often
   * the operator's own wallet, checked before quoting a spend. */
  async getWalletBalance(address) {
    if (!address) throw new TypeError("getWalletBalance requires address");
    return this._get("/wallet/balance", { address });
  }

  /** GET /requester/{address}/stats - reputation of a requester (created vs
   * awarded counts). Used to sanity-check who is being trusted with escrow
   * before creating a task, and to decide which board tasks are worth a
   * submission before entering one. */
  async getRequesterStats(address) {
    if (!address) throw new TypeError("getRequesterStats requires address");
    return this._get(`/requester/${encodeURIComponent(address)}/stats`);
  }

  /** GET /health - liveness of the API itself. */
  async health() {
    return this._get("/health");
  }
}
