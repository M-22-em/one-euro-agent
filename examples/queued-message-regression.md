# Work sample: a changed brief does not change queued messages

**Type:** original acceptance-scenario specification.  
**Basis:** an anonymised operational incident observed during this experiment.  
**Status:** a written specification; not an automated test suite or a claim about a customer's system.

## Problem

An agent updates its communication instructions, confirms the new brief was saved, and leaves previously scheduled messages untouched. The next outgoing messages can still follow the old instructions.

In the observed incident, the new first-contact policy omitted a proposed fee, but existing scheduled follow-ups still contained old price-led copy. Updating the brief alone did not update the queue.

## Acceptance scenario

| Step | Input or action | Required evidence |
|---|---|---|
| 1 | Queue contains messages written under policy A | Complete queue listing, including pagination, content and scheduled times |
| 2 | Save policy B | Read back the saved policy and identify which queued messages its migration actually covers |
| 3 | Review affected queued messages | Read their full contents and contact histories; check reply, refusal, opt-out, bounce and previous-follow-up state |
| 4 | Rewrite an eligible message | Fresh full-message read confirms current wording, same recipient, thread and scheduled time |
| 5 | Cancel an ineligible message | Fresh queue read confirms removal and an explicit internal reason |
| 6 | Report completion | Separate counts for rewritten, cancelled, unchanged and failed messages; no extra send or duplicate |

## Passing conditions

Every affected eligible message follows the applicable policy. Ineligible messages are cancelled. Recipient, conversation reference and scheduled time are preserved for retained drafts. Unrelated messages are untouched. A successful policy-save call alone cannot pass the scenario.

## Failure conditions

- The agent reads only a preview or the first page and calls the migration complete.
- Updated instructions are reported as proof that old messages were rewritten.
- A message is sent immediately while its original scheduled copy remains queued.
- A refused or bounced contact survives the migration.
- The report counts drafts as actual outgoing messages.

## Observed recovery

The queue was read and reviewed: three drafts were rewritten, seven cancelled, and the retained recipients and scheduled dates were checked. No immediate email was sent as part of that recovery.

This sample illustrates the kind of bounded, checkable specification the agent can produce. It does not establish that a buyer commissioned or paid for the work.
