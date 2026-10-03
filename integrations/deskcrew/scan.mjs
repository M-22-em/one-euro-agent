#!/usr/bin/env node
/**
 * DeskCrew opportunity scan for One Euro Agent.
 *
 * READ-ONLY by construction: performs one public GET and prints a dated
 * snapshot to stdout. No wallet, credentials, transaction or paid API call.
 * Node.js 18+; no dependencies.
 *
 * This script is an optional local/cloud helper. It is NOT the ChatGPT Work
 * runtime, and its presence in GitHub does not mean it is deployed.
 */
import { readFile } from 'node:fs/promises'

const SOURCE = 'https://deskcrew.io/api/arena/contests'
const HELP = process.argv.includes('--help') || process.argv.includes('-h')
const fixtureAt = process.argv.indexOf('--fixture')

if (HELP) {
  console.log('Usage: node integrations/deskcrew/scan.mjs [--fixture path.json]')
  console.log('Public GET only; no wallet, no --live, no payment.')
  process.exit(0)
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') throw new Error('Invalid response: expected JSON object or array.')
  for (const key of ['rows', 'contests', 'bounties', 'items', 'results']) {
    if (Array.isArray(data[key])) return data[key]
  }
  if (data.data && data.data !== data) return rowsFrom(data.data)
  throw new Error('Unknown API response shape; cannot interpret this as an empty board.')
}

const numberOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function main() {
  let payload
  let origin = SOURCE
  if (fixtureAt >= 0) {
    const filename = process.argv[fixtureAt + 1]
    if (!filename) throw new Error('--fixture requires a local JSON file')
    payload = JSON.parse(await readFile(filename, 'utf8'))
    origin = 'local-test-fixture'
  } else {
    const res = await fetch(SOURCE, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error('Public board returned HTTP ' + res.status)
    payload = await res.json()
  }

  const rows = rowsFrom(payload)
  const opportunities = rows.map((item) => ({
    ticket_id: item.ticketId ?? item.ticket ?? item.id ?? null,
    subject: item.subject ?? item.title ?? null,
    bounty_usd: numberOrNull(item.bountyUsd ?? item.amountUsd ?? item.rewardUsd ?? item.reward),
    entry_fee_usd: numberOrNull(item.entryFeeUsd ?? item.feeUsd ?? item.entryFee),
    entrants: numberOrNull(item.entrants),
    payout_network: item.payoutNetwork ?? item.network ?? null,
    status: item.status ?? null,
    deadline: item.decidesAt ?? item.deadline ?? null,
    eligibility: item.eligible ?? null,
    original: item,
  }))

  process.stdout.write(JSON.stringify({
    source: origin,
    observed_at: new Date().toISOString(),
    read_only: true,
    money_spent_usd: 0,
    count: opportunities.length,
    opportunities,
    caveat: 'This is discovery, not wallet-specific eligibility or guaranteed income. Verify each bounty and the current terms before considering paid submission.',
  }, null, 2) + '\n')
}

main().catch((err) => {
  console.error('DESKCREW_SCAN_FAILED: ' + (err?.message ?? err))
  process.exitCode = 1
})
