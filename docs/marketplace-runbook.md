# Marketplace execution playbook — 3 October 2026

**Goal:** replace unverified cold-demand creation with tasks for which an independent buyer has already published a reward. This is the operational companion to [MISSION.md](../MISSION.md); it does not independently authorise spending or access.

## Source routing

| Channel | Free discovery | Potential free submission | Current action |
| --- | --- | --- | --- |
| [DeskCrew](https://deskcrew.io/.well-known/x402) | Free board and dry-run | Official x402-bounty-hunter paid submission once lifetime cap and wallet set | **Secondary execution pilot after wallet funding** |
| [Frantic](https://gofrantic.com/) | Public board and MCP | Official remote MCP claim and delivery when connected | **Priority free execution** |
| [TaskMarket](https://taskmarket.dev/tasks) | Official CLI `npm install -g @lucid-agents/taskmarket`; `taskmarket task list --status open --phase active` | `taskmarket init` + securely persisted wallet/identity, owner-reviewed legal acceptance, free eligible claim/submit work | **FIRST operational priority** |
| [NEAR AI Market](https://market.near.ai/) | Inspect live market and docs | Depends on current authentication, market status and task mode | **Secondary execution candidate** |

Don't rank a channel higher simply because it exposes a higher nominal reward. Re-evaluate actual accessible tasks on every cycle. DeskCrew needs the original Node CLI with actual LLM API and dedicated wallet; --max-spend alone resets on restart, so allow one bounded run until a persistent lifetime ledger exists.

## Cycle: demand to verified settlement

1. Reconcile outstanding commitments and open platform decisions; use AgentMail only for historic buyer replies or client aftercare.
2. Consult primary official sources (not search snippets alone). Inspect timestamp, access, eligibility, AI policy, task mode, budget, funding/escrow, submission deadline, limits, reward/currency, criteria and fees.
3. Record source + task ID, deduplicate in existing private Notion records. Prefer bounded text, sourced research, QA acceptance specs and other tasks the cloud tools can genuinely execute.
4. If submission is free and permitted, follow the actual platform workflow and read back its submission/claim ID. A task proposal saved locally is not a marketplace submission.
5. For open contest/bounty formats, allow bounded work before reward; for exclusive claim/contract formats, obtain attribution before undertaking the commissioned work as required.
6. Track acceptance/rejection and any revision request, then verify **actual** platform/on-chain payment. Keep potential/escrow/accepted/paid/withdrawn/net separate.
7. At the end of each hourly cycle, report consulted, qualified, excluded, actually submitted, decided, paid, costs, exact blockers and the next decision. If one market is inaccessible, continue to another.

## Qualification and hard stops

Reject or mark blocked when: no real buyer; expired task; AI prohibited; deadline unrealistic; unknown executable inputs; finance/access gate; wallet-network incompatibility; excessive unverified claims; unauthorised access; duplicate application; reward too small for justified risk; or no demonstrable payout mechanism.

Never invent win probabilities. A posted amount and platform's historic approval percentage are not evidence that One Euro Agent will earn that amount.

## DeskCrew financial viability

Inspect current public machine-readable terms before assessing any bounty. The reference x402-bounty-hunter README reports paid entry/context operations and an 85% worker share on approved work, but terms, availability, entrant counts, historic approvals and fees can change. A posted $1 reward does not imply $1 of revenue, nor positive profit after fees and inference. DeskCrew is an execution pilot subject to an owner-approved total loss ceiling and securely funded wallet. The public GET scanner is preflight only.

## Runtime and accounting evidence

Private Notion register is the existing durable record; if unavailable, keep a dated textual log and reconcile later. GitHub public status should display only publication-authorised aggregate evidence, never private leads, correspondence or keys.

Keep direct currency and withdrawal state. USDC received in a platform wallet is not automatically realised EUR net. The current €10 objective requires verified net EUR (or a clearly justified conversion with real cash availability), not potential rewards.

**No Hostinger, new server, new CRM or unsolicited email campaign is needed for this experiment.**

## Today: TaskMarket go-live dependency

1. Official first-party CLI: `npm install -g @lucid-agents/taskmarket`.
2. Read live opportunities free: `taskmarket task list --status open --phase active --limit 40` and `taskmarket task list --status open --phase active --mode claim --limit 40`.
3. Persistently enrol agent: `taskmarket init`. Protect its keystore; do not regenerate identity per ephemeral GitHub Actions job. If the legal-policy bundle requires acceptance, show its actual contents to the owner and obtain approval. Do not silently run `legal accept --yes`.
4. Check `taskmarket inbox`, `taskmarket actions`, choose only an actually active funded and AI-eligible task, read `taskmarket task get <taskId>`.
5. For claim tasks follow the official claim prerequisites; for bounty tasks, prepare an original quality-assured file and use `taskmarket task submit <taskId> --file <path>`. Record platform-returned submission ID, feedback and payout using `taskmarket stats`.
6. The `taskmarket-scan.yml` GitHub action is PUBLIC DISCOVERY ONLY. It cannot create a persistent agent wallet by itself. Never put its private key in repository files, Actions logs or chat.

### DeskCrew paid pilot

Use original `x402-bounty-hunter` CLI, not our free scan helper, for actual submission. A concrete numeric experiment-wide USDC loss limit, low-balance dedicated signer securely configured and an LLM API key/model are still prerequisites. Owner may fund only the dedicated low-balance wallet, not expose private keys. The CLI's `--max-spend` resets between runs: single attempt unless a cumulative persistent cost ledger is enforced.
