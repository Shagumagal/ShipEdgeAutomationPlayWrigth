# Product defect candidates

A red test is not a bug report. Most E2E failures come from the automation (a stale selector),
the environment (QA down, no email sent) or a third party (a carrier). The suite separates the
failures that point at the product, gathers their evidence, and leaves the decision to a person:

| Step | Automatic? |
|---|---|
| Detect that a **product contract** failed, with its evidence | Yes — `contract()` |
| Count whether it reproduced across attempts | Yes — the reporter |
| Write `defect-candidates/latest.json` | Yes — every run with `xenvio-v2` tests, local only (other runs, e.g. unit tests or the purge, keep the last file; it is outside `test-results/`, which Playwright empties on every run) |
| Prepare a bug report draft | Only when asked |
| Decide it is a bug and send it to the team | Never: a person confirms |

## Product contracts

A contract is a requirement checked against **data the product produced**: a backend answer, an
email, a link. Not against a selector. The catalog is `v2/domain/contracts/product-contracts.ts`;
each entry has a stable id (`invitation.link.sso-path-normalized`), the feature and the expected
behavior, written so it can go into a report as is. Ids never carry run data (emails, ids).

```ts
import { contract } from '../diagnostics/product-contract';

await contract('invitation.link.sso-path-normalized',
    () => expect(link.pathNormalized, 'the SSO rejects "//" paths').toBe(true),
    { link: link.url });                     // evidence, redacted before it is stored
```

- The attempt is marked as having **reached** the contract. A separate **passed** mark is recorded
  only after the check completes successfully; starting a check is not evidence that it passed.
- If the check fails with an `expect` (also `expect.poll`) or a `ProductOutcomeError` (an email that
  never arrived, an email without its link), the attempt is marked as **violating** it, the evidence
  is attached as `product-defect-candidate.json`, and the error starts with
  `[PRODUCT DEFECT CANDIDATE] <id>: <requirement>`. Allure files it under **Product defect candidate**.
- Any other error (a selector timeout, a 5xx, a provider outage) fails the test as usual but is
  **not enough on its own** to make a candidate.
- Evidence, the candidate's assertion message and the rethrown error's message/stack go through
  redaction: credentials, `*token=`, `code=` and `state=` values are masked; the rest (e.g. the
  broken link's path) is kept as proof.
- If the mailbox provider is still timing out or rate-limiting at the deadline, delivery is
  inconclusive. A missing-email candidate requires a completed, healthy query at the end of the
  wait. Transient provider failures may recover while waiting.

UI checks stay plain `expect`s. Add a contract to the catalog before using its id in a spec.

## Reproduction

`v2/diagnostics/defect-candidate-reporter.ts` runs in the runner process, sees every attempt of
every worker and writes the file in `onEnd`. Rules (`v2/domain/contracts/defect-candidates.ts`):

| Reproduction | When |
|---|---|
| `reproduced` | At least 2 attempts violated the contract, and none passed it |
| `pending-reproduction` | One attempt violated it, with no confirmed pass (e.g. `--retries=0`) |
| `intermittent` | It failed in some attempts and passed in others: kept, with less weight |

Only completed checks decide reproduction. An attempt that fails earlier (login, email), or
cannot complete the check (e.g. its backend request throws HTTP 502), neither confirms nor clears
the contract. Occurrences include `reached`, `violated`, `passed`, and `inconclusive` counts;
errors outside the contract verdict are retained in `otherFailures`. A check that passed before
a later test step failed still counts as a pass. `--repeat-each` copies
of a test count as attempts of the same test. Every candidate keeps `status: "candidate"`.

The file also records the run: status, whether it was **complete** (not interrupted, no errors
outside the tests), the effective `retries` and `repeatEach` per project (the CLI overrides the
config: `test:smoke-v2` and `test:sanity-v2` use `--retries=0`, the manual workflow uses its
input), totals by outcome, and `knownIssues` / `expectedToFail` for tests marked `test.fail()`
with an `issue` annotation. An empty list reads "No product defect candidates were detected in
this run", never "no bugs".

Passing `--reporter` on the command line replaces the configured reporters; add it back if needed:
`--reporter=list,./v2/diagnostics/defect-candidate-reporter.ts`.

## From candidate to report (on request)

Ask for it, e.g. *"run the smoke and, if there are candidates, prepare the reports"*. Then:

1. Run the suite and read `defect-candidates/latest.json`.
2. Re-run only the tests with `pending-reproduction` candidates, e.g.
   `npx playwright test <file> --project=xenvio-v2 --repeat-each=3`.
3. For each candidate, record separately: the observed behavior, the evidence, the cause
   (confirmed or a hypothesis) and its age (introduced now, pre-existing, or **unknown** when the
   previous release cannot be checked). A clear reproduction against the requirement is enough;
   a root cause helps but is not required.
4. The age picks the skill: pre-existing → `/internal-bugs`; introduced by the ticket under test →
   `bug-report-observation`; unknown → say so instead of forcing one.
5. A person confirms before the report is written or sent.

Once a bug has a ticket, mark the test as an expected failure so the suite stays readable and
tells you when the fix lands:

```ts
test.fail(true, 'Known bug: invitation link has "//realms"');
test.info().annotations.push({ type: 'issue', description: '<ticket URL>' });
```

## Pilot

`v2/tests/xenvio-user-invitation.spec.ts` is the first spec with contracts (8 of them). Extend
spec by spec. Unit tests: `v2/unit/defect-candidates.unit.spec.ts`.
