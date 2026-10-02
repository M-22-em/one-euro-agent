# DeskCrew / x402 opportunity discovery for One Euro Agent

Status: **integration prepared, NOT deployed into the separate cloud-chat runtime.**
Scope: a supplementary source of **already advertised paid demand**, not a new hosting provider and not a replacement for the existing commercial strategy.

Upstream reference: https://github.com/webmilmind1/x402-bounty-hunter

## Why

DeskCrew exposes public support-ticket bounties. The reference hunter is a Node.js tool, not a hosted autonomous agent. The public board can be inspected without a wallet. Access to ticket context or submission can require x402 micropayments. Approval and payout are contingent, and competition can make expected value negative.

The current mission authorises **no new spending**. Therefore the integration is discovery-only until the owner explicitly changes that policy.

## Phase 1 — safe, read-only discovery

If the existing Work/cloud agent can browse HTTP APIs, use its *existing* research tool to GET:

- https://deskcrew.io/api/arena/contests — public board (as documented in upstream README)
- https://deskcrew.io/.well-known/x402 — currently published terms and history

If Node.js 18+ is available in the runtime, the optional zero-dependency helper is:

\`\`\`sh
node integrations/deskcrew/scan.mjs
\`\`\`

For a local fixture-based test (no network):

\`\`\`sh
node integrations/deskcrew/scan.mjs --fixture integrations/deskcrew/fixture.example.json
\`\`\`

The helper makes only one public **GET** request; it never signs, posts, imports private keys, generates transactions, or charges anything. API schema changes cause an explicit failure rather than being silently reported as zero opportunities. A public board snapshot cannot determine wallet-specific eligibility.

The upstream official CLI also provides a free dry-run:

\`\`\`sh
npx x402-bounty-hunter
\`\`\`

**Never append \`--live\` under the current no-spend mission.** Do not paste, store, or commit wallet keys.

## Qualification gate

For each opportunity, retain:

1. Ticket/board identifier, source and observation timestamp.
2. Explicit posted reward and published fee, if provided.
3. Current availability, deadline, number of competing entrants.
4. AI submission permission, eligibility/access restrictions and payout network.
5. Whether enough free context exists to judge deliverability; otherwise mark it unknown.
6. Potential payment versus entry/context fees and inference costs, clearly marked *estimated*.
7. Decision: eligible-for-review / reject / information-missing; log reasons.

Do not claim that a mission is won, accepted, payable, or profitable merely because it appears on the public board.

## Hook into the existing two-hour decision cycle

Keep the cloud runtime and scheduler unchanged:

- Prioritise paid commitments and real inbound buyers.
- Scan the DeskCrew public board as one *demand-first* discovery channel.
- Deduplicate against the private opportunity register by source + ticket ID.
- Record any qualified candidates with source and timestamp.
- Continue other authorised commercial work.
- Log API failures truthfully; do not replace them with invented bounties.

The assistant operating in the cloud chat must be given these instructions separately: merging GitHub code/documentation does not deploy it into that runtime.

## Before any future paid phase

Require explicit owner approval to change the no-spend policy; a dedicated low-balance wallet held through an appropriate secret manager; verified network compatibility, hard caps on total and per-attempt spend, fee/approval-history inspection, human/quality gate, and authenticated payout reconciliation. Reading the board and successfully running dry mode do not authorise paid submissions.

## Experiment outcome

Useful proof is: a real listed bounty, grounded qualification, an actual authorised submission, an independent acceptance decision and a verified payout net of fees/costs. Until then, this integration supplies market signals, not revenue.
