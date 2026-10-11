# Reference base — Circadian-like autonomous economic agent

Last verified: 11 October 2026.

## Purpose

This file is the evidence base for rebuilding One Euro Agent from zero.

The target is **not** to copy an unknown Circadian stack. The target is to reproduce the observable experiment:

> an autonomous agent discovers real paid work, decides what is worth attempting, executes, submits, verifies outcomes and payments, learns from results, and exposes enough state that a human operator can understand exactly what is happening.

This document separates four things that must never be mixed:

- **OBSERVED** — directly measured in a first-party dataset, API response or on-chain receipt.
- **IMPLEMENTED** — visible in executable source code.
- **DOCUMENTED** — claimed/described by the project's own documentation, but not necessarily proven end-to-end.
- **INFERRED** — an architecture requirement deduced for our future system.

No architecture choice below is mandatory merely because another project used it.

---

# 1. Evidence hierarchy

When sources disagree or have different levels of certainty, use this order:

1. **Executable source code + external receipt/state read-back**
2. **First-party raw dataset/API output**
3. **First-party technical documentation**
4. **First-party narrative write-up**
5. **Our inference**

A successful API call is not treated as proof that the intended economic action succeeded. Where possible, the result must be read back from a source capable of disproving success.

---

# 2. Primary reference: Circadian

## What is directly supported

### Identity and experiment

**OBSERVED — first-party repository and earnings dataset**

Circadian describes itself as an autonomous AI agent operating a business under human oversight.

Its published earnings dataset covering 19 days records:

- gross revenue: **11.729335 USD**
- revenue events: **5**
- TaskMarket revenue: **9.729335 USD**
- TaskMarket wins: **3**
- distinct TaskMarket tasks entered: **34**
- all three TaskMarket wins came from **one requester**
- Frantic revenue: **2.00 USD**
- Frantic wins: **2**
- both Frantic payments came from the **same recurring bounty**

The dataset explicitly says these are **gross revenues, not profit**, because operating/API/infrastructure costs are not included.

Each revenue line is reconciled against an append-only ledger and carries an on-chain transaction reference.

### How Circadian evaluates markets

**OBSERVED — public datasets, scanners and findings**

Circadian's public operating method repeatedly uses these principles:

1. **Registry/marketing claims are priors, not proof.**  
   Candidate venues are probed against first-party endpoints.

2. **Use a control that could expose a false positive.**  
   For API validation, Circadian probes an invented path beside the claimed endpoint. A documented path returning HTTP 200 is not considered proof if an invented path returns the same body.

3. **Accessibility is not economic viability.**  
   Circadian explicitly separates:
   - can the agent enter?
   - can the agent be paid?
   - is there live demand?
   - are the odds/economics worth entering?

4. **Demand can be the binding constraint.**  
   Circadian found venues with technically valid payment rails but little or no buyer activity.

5. **Counterparty history matters.**  
   On TaskMarket, Circadian measures requester completion records rather than judging an opportunity only by its advertised reward.

6. **Expiry is not settlement.**  
   Circadian documents TaskMarket tasks that remained awaiting settlement well after expiry. A posted deadline is therefore not treated as a payment timestamp.

7. **Transport success is not content success.**  
   Circadian documents its own failures where a wrapper reported success even though the intended state/content was wrong. Its corrective rule is to read back the resulting state/content, not trust the sender's success response.

8. **Uncertainty remains explicit.**  
   Its datasets preserve PRESENT / ABSENT / UNKNOWN distinctions and publish retractions when a measurement method was wrong.

### What Circadian does NOT publicly reveal

**UNKNOWN**

The public materials do not provide a complete end-to-end implementation of Circadian's private operating stack. They do not establish, from public evidence alone:

- exact runtime provider
- exact scheduler/orchestrator
- exact persistent operational database
- exact agent framework
- complete secret-management design
- complete wallet architecture
- complete internal planning prompt
- complete human-approval policy
- complete operator dashboard implementation

Therefore none of those should be reverse-engineered from guesswork.

## What Circadian contributes to our design

**INFERRED**

Circadian is the primary reference for:

- economic experimentation
- opportunity verification
- counterparty verification
- proof-based accounting
- market exploration
- distinguishing access from demand
- distinguishing deadline from settlement
- validating the actual effect of an action
- learning from observed outcomes rather than activity

It is **not** the primary reference for our infrastructure stack, because that stack is not fully public.

---

# 3. x402 Bounty Hunter / DeskCrew

## What is implemented

**IMPLEMENTED — executable source code**

The hunter implements a narrow real-money loop:

1. read a wallet-specific public worklist
2. reject work the wallet cannot be paid for
3. inspect reward, entrants and economic metadata
4. optionally buy task context over x402
5. draft with a configured LLM
6. pay to submit the draft
7. wait for approval/rejection
8. read earnings from the wallet record
9. receive USDC if the entry wins

The code contains concrete economic controls:

- dry-run by default
- per-charge max price
- max-spend value
- per-pass task limit
- wallet/network payout compatibility checks
- competition-aware ranking inputs
- refusal to spend when payment requirements fail

The README additionally documents push events for:
- new eligible work
- decision events
- payout events

This makes DeskCrew useful as a reference for an event-driven economic loop.

## Important limitation

**IMPLEMENTED**

The CLI initializes:

`let spent = 0`

inside the running process.

Therefore `--max-spend` is a **process-local guardrail**, not a durable experiment-wide ledger. Restarting the process resets that counter.

## What this contributes

**INFERRED**

Use Bounty Hunter as the reference for:

- a real executable earn loop
- wallet compatibility checks before spending
- pre-spend economics
- bounded autonomous spending
- external submission/payment receipts
- event-driven follow-up where available

Do **not** copy its process-local spending counter as the global accounting system.

---

# 4. Forge402

## What is actually present

**IMPLEMENTED / DOCUMENTED**

Forge402 contains:

- Node/Express backend
- Next.js dashboard
- an agent daemon
- scheduled agent runs
- credit checks before a run
- auto-pause when credits are depleted
- per-mission budget guardrails
- reports persisted per agent
- payment feed
- transaction hashes
- webhook notifications
- pause/resume controls
- server-side wallet secrets

Its architecture document describes a single orchestrator that plans tool usage, performs x402 payments, applies budget limits and synthesizes a result.

Its dashboard exposes agents, run counts, spend, credits, missions and payment receipts.

## Critical limitation

**OBSERVED / DOCUMENTED**

Forge402 is explicitly a hackathon-style system operating on **Stellar Testnet** with test USDC.

Its architecture document stores key operational data in JSON files, including:

- agent state/reports
- payment events
- mission history
- attestations

That is useful as a visible working pattern, but it is **not evidence of production-grade durable state**.

## What this contributes

**INFERRED**

Use Forge402 only as a reference for the shape of an observable autonomous system:

- runtime + scheduler
- autonomous run lifecycle
- budget visible in the UI
- pause/resume
- report history
- transaction/payment feed
- operator dashboard

Do not inherit its blockchain, model provider, JSON persistence, or testnet assumptions.

---

# 5. Agent Marketplace (Juwebien)

## What is documented

**DOCUMENTED**

The architecture describes:

- a Coordinator service
- Redis state machine
- PostgreSQL audit storage
- workflow transitions
- timeouts
- write-ahead logging/recovery
- separation between orchestration, state, audit and payment

## Critical limitation

**DOCUMENTED**

The repository labels itself **early stage / not production-ready**.

Its own status table says the Coordinator service and several core contracts are still **in progress**.

Therefore Redis FSM, PostgreSQL audit and WAL are architecture proposals/reference patterns here, not proof of a complete running production system.

## What this contributes

**INFERRED**

Use this repository only for the principles:

- explicit state transitions
- operational state separate from audit history
- durable recovery concept
- payment state separate from work state

Do not copy its smart contracts, Arbitrum design, escrow system, Redis choice or distributed architecture unless our own requirements later justify them.

---

# 6. Cross-source synthesis

The four references answer different questions.

| Question | Best reference | Evidence type |
|---|---|---|
| What economic experiment are we reproducing? | Circadian | OBSERVED |
| How should opportunities be verified? | Circadian | OBSERVED |
| How should success/payment be verified? | Circadian + Bounty Hunter | OBSERVED / IMPLEMENTED |
| What does a real paid execution loop look like? | Bounty Hunter | IMPLEMENTED |
| How can autonomous spending be bounded? | Bounty Hunter + Forge402 | IMPLEMENTED |
| What should an operator be able to see? | Forge402 | IMPLEMENTED / DOCUMENTED |
| How should long-lived work have explicit states? | Agent Marketplace | DOCUMENTED |
| Which exact runtime/database/framework should we use? | None yet | UNDECIDED |

---

# 7. Architecture-neutral requirements for our agent

These are **INFERRED requirements** from the evidence above.

They are the only conclusions this research base currently authorizes.

## A. Economic loop

The system must be capable of:

`discover → verify → qualify → execute → submit → observe outcome → reconcile payment → learn`

## B. Source-of-truth state

The LLM must not be the source of truth for:

- opportunity status
- prior attempts
- submission IDs
- wallet balance
- cumulative spend
- received revenue
- payment state

Those must come from deterministic state or external read-back.

## C. Explicit accounting

The system must keep these separate:

- advertised reward
- expected value
- attempted/submitted work
- accepted/won work
- payment pending
- payment actually received
- operating costs
- real profit

## D. Proof of action

A tool call is not sufficient proof of completion.

For economically meaningful actions, store/read back the strongest available evidence, for example:

- marketplace submission ID
- updated task state
- transaction hash
- wallet balance change
- external receipt
- actual published content

## E. Durable budget control

Spending limits must survive process restarts.

A per-process variable is not enough.

## F. Recovery without duplicate side effects

After crash/retry, the system must be able to determine whether an external action already happened before repeating:

- payment
- claim
- submission
- message
- purchase

## G. Observable autonomy

The operator must be able to inspect, at minimum:

- current agent status
- current/last run
- opportunities discovered
- decisions and concise reasons
- actions/tool calls
- external IDs/receipts
- spend
- revenue states
- errors/blockers
- next scheduled/event-driven action

This is a product requirement, not cosmetic UI.

## H. Market exploration

The finished system must support multiple earning venues.

However the implementation sequence is:

1. prove one full economic loop end-to-end on one venue
2. make the venue interface reusable
3. add more venues without duplicating the core agent/runtime/state/accounting system

This preserves Circadian-style exploration without prematurely building a multi-market architecture.

## I. Demand-aware decision making

A venue or opportunity must not be valued only because:

- it exists
- it exposes an API
- it advertises a reward
- it accepts agents

Where data exists, the agent should consider:

- recent real payouts
- buyer/requester settlement history
- competition
- cost to enter
- ability to receive payout
- deadline/settlement behavior
- evidence of current demand

---

# 8. Explicitly NOT selected yet

The evidence does **not** currently justify choosing any of the following:

- Trigger.dev
- Temporal
- LangGraph
- OpenAI Agents SDK
- CrewAI
- n8n
- Cloud Run
- Render
- Railway
- Vercel
- PostgreSQL
- Redis
- SQLite
- Next.js
- a specific blockchain
- a specific wallet provider
- a specific LLM provider
- mono-agent vs multi-agent

Those are implementation candidates, not findings.

They will be evaluated only against the requirements above.

---

# 9. Information deliberately excluded

The following details exist in the reference projects but are not currently useful to our objective and are therefore excluded from the design basis:

- Forge402's Venice AI choice
- Forge402's Stellar/Soroban choices
- Forge402's recursive sub-agent feature
- Agent Marketplace's quality tiers
- Agent Marketplace's smart-contract design
- Agent Marketplace's Arbitrum choice
- its DeFi threat-model specifics
- hackathon-specific deployment instructions
- UI styling choices
- tokenomics/platform fee designs unrelated to our experiment

This prevents cargo-cult architecture.

---

# 10. Open unknowns to resolve later

Only questions that materially affect implementation belong here.

1. Which earning venue gives the cleanest first end-to-end executable loop today?
2. Which external actions can be performed through stable API/CLI/MCP interfaces?
3. Which actions require human setup/approval?
4. What durable state is minimally required for a first live loop?
5. What runtime/orchestrator gives that durability and observability with the least complexity?
6. What interface is sufficient for the operator to audit the system without becoming its manual worker?
7. What wallet/secret design permits bounded autonomous spending without exposing signing material?
8. What is the smallest test proving discovery → submission → outcome → payment reconciliation works?

No further architecture should be added until it answers one of these questions.

---

# 11. Primary sources

## Circadian

- Public measurement repository: https://github.com/Circadian-agent/agent-economy-data
- Earnings dataset: https://github.com/Circadian-agent/agent-economy-data/blob/main/data/agent-economy-earnings-2026-08-11.json
- Venue sweep: https://github.com/Circadian-agent/agent-economy-data/blob/main/findings/2026-08-18-agent-earning-venue-sweep.md
- TaskMarket settlement analysis: https://github.com/Circadian-agent/agent-economy-data/blob/main/findings/2026-08-19-taskmarket-settlement.md
- Opportunity economics example: https://github.com/Circadian-agent/agent-economy-data/blob/main/findings/unblocked-but-not-worth-entering-2026-08-20.md
- Tool verification failure analysis: https://github.com/Circadian-agent/agent-economy-data/blob/main/findings/2026-08-19-transport-not-content.md
- Self-audit / demand-vs-plumbing test: https://github.com/Circadian-agent/agent-economy-data/blob/main/services/self-audit-2026-08-22.md
- Public earnings narrative: https://circadian-agent.com/research/agent-economy-earnings

## x402 Bounty Hunter

- Repository: https://github.com/webmilmind1/x402-bounty-hunter
- Main earn loop: https://github.com/webmilmind1/x402-bounty-hunter/blob/main/hunt.mjs
- README/economics: https://github.com/webmilmind1/x402-bounty-hunter/blob/main/README.md

## Forge402

- Repository: https://github.com/AswinWebDev/Forge402
- Architecture: https://github.com/AswinWebDev/Forge402/blob/main/AgentHub_Architecture.md
- Core orchestrator: https://github.com/AswinWebDev/Forge402/blob/main/packages/core/orchestrator.js

## Agent Marketplace

- Repository: https://github.com/Juwebien/agent-marketplace
- Architecture: https://github.com/Juwebien/agent-marketplace/blob/master/ARCHITECTURE.md
