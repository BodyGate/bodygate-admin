<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BodyGate AI Engineering Rules

## Mission

BodyGate is a production fitness operating system connected to real customer data, payments, access-control hardware and a physical turnstile. AI agents working in this repository must prioritize safety, continuity of service, data integrity and reversibility over speed.

The default agent role is **auditor/reviewer**, not autonomous production operator.

## Default operating mode

Unless a human explicitly authorizes a specific implementation task:

- read and analyze freely;
- run non-destructive local checks and tests when an execution environment is available;
- propose changes and create isolated branches/draft pull requests;
- do not merge to `main`;
- do not deploy;
- do not execute production database writes;
- do not call hardware-opening endpoints;
- do not rotate or replace production secrets;
- do not change Windows services, scheduled tasks or startup configuration on a live host.

If the requested work can affect physical access, financial records, receipt numbering, authentication, authorization or production startup, stop at a reviewed proposal unless the human approval clearly names that risk domain.

## Production-critical access chain

Treat the following access path as a protected system boundary:

```text
DNake AC02C/S
  -> unlock_sql.db / unlock_info
  -> BodyGate Bridge .NET 8
  -> /api/access/check
  -> KT02.3 controller
  -> TK-01 turnstile
  -> /api/access/log
  -> Supabase
```

The authoritative subscription access rule is:

```text
customer_subscriptions
starts_at <= current_date
ends_at >= current_date
is_active = true
```

Do not change this chain or its access semantics as collateral work.

## Protected paths

Changes to these paths require explicit human authorization for that exact risk domain and must be isolated in their own PR:

- `bridge/**`
- `app/api/access/check/**`
- `app/api/access/log/**`
- `app/api/dnake/**`
- `app/api/gate/**`
- `app/api/turnstile/**`
- access credential/badge normalization code used by the production gate
- `scripts/start-bodygate*.ps1`
- `scripts/install-bodygate*.ps1`
- bridge build/promote/switch/startup scripts
- `supabase/migrations/**`
- mutation SQL under `scripts/sql/**`

Reading and auditing these files is always allowed. Modifying them is not.

## Financial and receipt invariants

Treat subscription renewals, membership fees, payments and receipts as transaction-critical.

- Preserve database-backed atomicity and idempotency.
- Never manually consume a receipt sequence/RPC during testing.
- Never repair production financial history as part of unrelated work.
- Never create or restore `cash_movements` / first-note behavior unless explicitly requested.
- Preserve receipt numbering, historical receipts and A4 receipt layout unless the task explicitly targets them.
- A retry must not create duplicate subscriptions, payments or receipts.

## Authentication and authorization

- Authentication is not authorization.
- Sensitive server routes must derive the current user from the verified server session.
- Never authorize an operation from a client-provided role, email or permission flag.
- Never use a hard-coded user identity for permission decisions.
- Physical-open, financial-write, staff-management and security-management operations require server-side authorization.
- Public/machine endpoints must fail safely when machine authentication is required.

## Secrets

Never print, copy into reports, commit or expose secret values.

This includes, without limitation:

- `SUPABASE_SERVICE_ROLE_KEY`
- `BODYGATE_MACHINE_KEY`
- `BODYGATE_SESSION_SECRET`
- controller/DNake credentials
- passwords, API tokens and private URLs containing credentials.

If a secret is discovered in tracked source or Git history, report the file/path and classify it as a credential-exposure incident. Do not repeat the secret value. Rotation must be coordinated with the live system so access control is not interrupted.

## Hardware safety

Never use an audit, smoke test, browser test or automated test to physically open the turnstile unless a human explicitly requests a live hardware test.

Do not automatically invoke:

- Bridge `/open*` endpoints;
- controller open-door commands;
- BodyGate routes whose purpose is opening a gate/turnstile;
- DNake event routes with a real credential.

Prefer mocks, fixtures and read-only health/status checks that do not trigger access hardware.

## Database safety

Unless explicitly authorized:

- Supabase inspection must be read-only;
- do not apply migrations;
- do not change RLS, grants, policies, functions, triggers or production rows;
- do not call mutating RPCs;
- never use production customer/payment records as destructive test fixtures.

For database security work, produce backup/read-only verification steps before any mutation script.

## Required workflow for AI changes

1. Read the relevant architecture/security documentation.
2. Map the affected request/data flow before editing.
3. Identify authentication, authorization, transaction and hardware boundaries.
4. State invariants that must remain unchanged.
5. Make the smallest viable change on a non-`main` branch.
6. Run available non-destructive QA.
7. Report any QA that could not be executed.
8. Create a draft PR with risk, rollback and verification notes.
9. Do not merge automatically.

## Mandatory QA for application-code PRs

When the environment supports execution, run at least:

```bash
npm run typecheck
npm run lint
npm run build
```

Run targeted unit/Playwright tests when relevant. Never substitute a successful build for authorization/security review.

For protected access-control changes, add targeted tests that do not contact real hardware.

## Audit format

Security/architecture audits must classify findings as:

- `P0 / CRITICAL` — immediate compromise, unauthorized physical/financial action, exposed production credential, or severe data exposure;
- `P1 / HIGH` — strong security, authorization, integrity or availability risk;
- `P2 / MEDIUM` — meaningful weakness or reliability problem;
- `P3 / LOW` — limited-impact issue;
- `TECHNICAL DEBT` — maintainability/testability/documentation issue.

Each finding must include:

- evidence (file/path and behavior);
- impact;
- recommended remediation;
- whether remediation can affect production access, data or startup;
- verification and rollback requirements.

Do not report secret values in audit documents.

## Pull-request policy

- One risk domain per PR where practical.
- Security fixes to access control must not be mixed with UI refactors.
- Financial fixes must not be mixed with access-control changes.
- Startup/Bridge changes must not be mixed with unrelated Next.js changes.
- Keep PRs reviewable and reversible.
- Never enable auto-merge for production-critical BodyGate changes.

## UI rules

BodyGate UI uses the existing premium dark design language (black/red/white). Preserve the established component system and visual language. Do not introduce Bootstrap, Material UI, browser-default controls or unrelated visual frameworks without explicit approval.

## Repository hygiene

- Do not create new duplicate tables, business flows, design systems or access pipelines when an official one already exists.
- Prefer deleting obsolete backups/dead code only in dedicated cleanup PRs after confirming they are unused.
- Keep architecture/security documentation synchronized with production behavior.
- Add tests around bugs before or with the fix when practical.

## Stop conditions

Stop modifying and escalate to human review if any proposed change could unexpectedly:

- open or block the turnstile;
- invalidate existing badges/Mobile Passes;
- alter payment/receipt history;
- consume receipt numbers;
- change production RLS/ACLs;
- expose or rotate a secret;
- change the official Bridge executable or startup path;
- make BodyGate unavailable after Windows reboot.
