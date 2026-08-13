# BodyGate — AI Security & Architecture Baseline Audit

Date: 2026-08-13

Status: **static GitHub audit — no production changes performed**

Branch: `ai/bodygate-governance-audit-20260813`

## Executive summary

This first-pass audit confirms that BodyGate has several solid foundations (server-side sessions, service-role server routes, fail-closed access decisions, atomic/idempotent renewal hardening and dedicated machine authentication support), but it also identifies security boundaries that should be hardened before granting any AI agent broader autonomous write access.

The most urgent risks are concentrated around physical access control and credential exposure. No hardware endpoint, production database mutation, secret rotation, deployment or merge was executed during this audit.

## Scope reviewed

Static inspection of the current `main` branch included:

- repository structure and package scripts;
- `AGENTS.md`;
- authentication/session middleware;
- server auth/permission helpers;
- login route;
- `/api/access/check`;
- `/api/access/log`;
- `/api/dnake/event`;
- `/api/bridge/status`;
- manual gate/turnstile open routes;
- BodyGate Bridge C# source and local HTTP listener;
- BodyGate/Bridge Windows startup scripts;
- security hotfix documentation;
- repository hygiene, tests and documentation structure.

## Explicitly not performed

- No live Supabase inspection.
- No SQL execution or RPC invocation.
- No live Windows host inspection.
- No process/service/task changes.
- No request to DNake, KT02.3 or Bridge `/open*` endpoints.
- No turnstile opening.
- No badge/Mobile Pass smoke test.
- No secret rotation.
- No build/typecheck/lint execution because this GitHub connector does not provide a repository shell and no repository CI workflow was available to execute these checks.

---

# Findings

## P0 / CRITICAL — Static hardware credentials tracked in a public repository

**Evidence**

- Repository visibility is `public` at audit time.
- `bridge/bridge-v2/Program.cs` contains static controller/DNake authentication material in tracked source.

**Impact**

Credentials embedded in public tracked source must be treated as exposed. If they are still valid, they increase the risk of unauthorized interaction with the physical access devices by anyone who can reach the relevant network.

**Recommendation**

1. Do not print or copy the values into tickets/reports.
2. Coordinate a controlled rotation of device credentials.
3. Move credentials to protected runtime configuration/environment/secret storage.
4. Verify no other tracked files or Git history contain active credentials.
5. Consider making the repository private before further sensitive operational work.

**Production risk of remediation:** HIGH. Device credential rotation can interrupt access if Bridge/device configuration is not changed in a coordinated sequence.

**Required verification:** controlled local test of DNake read path and KT02 opening after rotation, with rollback credentials available securely.

---

## P0 / CRITICAL — Public DNake event route can reach the physical-open flow without authenticating the inbound DNake event

**Evidence**

- `middleware.ts` declares `/api/dnake/event` public.
- `/api/dnake/event/route.ts` does not authenticate the inbound request.
- It extracts a credential code supplied by the caller.
- It then calls `/api/access/check` from the server and supplies `BODYGATE_MACHINE_KEY` when configured.
- If the access result is allowed, it calls the local Bridge `/open0` endpoint.

**Impact**

The internal machine key protects the second hop, but not the first hop. A caller that can reach `/api/dnake/event` and submit a currently valid credential value may cause BodyGate to execute the legitimate access decision and subsequently request a physical turnstile opening.

**Recommendation**

Treat `/api/dnake/event` as a machine endpoint and authenticate/validate its origin before any access check or open action. The exact migration must preserve compatibility with the real DNake integration. Do not enforce a new header blindly if the DNake device cannot send it; acceptable designs include a trusted local-only ingestion path, network allow-list/reverse-proxy boundary, signed gateway, or removal of the route if the production Bridge SQL polling path has superseded it.

**Production risk of remediation:** CRITICAL. A wrong fix can stop legitimate access.

**Required verification:** first determine whether the production DNake actually calls this route. If unused, decommission safely. If used, design a compatibility-preserving trust boundary and test without changing the official Bridge polling path.

---

## P1 / HIGH — Machine authentication defaults to `off`

**Evidence**

`middleware.ts` supports `off`, `observe`, and `enforce` for `/api/access/check` and `/api/access/log`; an unset/unknown value resolves to `off`.

**Impact**

A missing or mistyped production environment variable can silently disable machine authentication for access-control endpoints.

**Recommendation**

Move toward fail-safe production behavior. At minimum, production startup/health checks should refuse or prominently alarm when the expected machine-auth mode/key is missing. Changing the middleware default itself should only happen after confirming every official caller sends the machine key.

**Production risk of remediation:** HIGH.

---

## P1 / HIGH — Manual gate/turnstile open routes do not enforce a route-level permission

**Evidence**

- `/api/gate/open` and `/api/turnstile/open` are protected by general session middleware because they are not public paths.
- Their route handlers do not call a server-side authorization check before sending the physical-open request.

**Impact**

An active authenticated BodyGate account may pass the server boundary even if its role should not have permission to open the gate.

**Recommendation**

Introduce one authoritative server-side permission check for physical-open actions, backed by the verified current session. Do not rely only on hidden UI buttons.

**Production risk of remediation:** MEDIUM/HIGH depending current staff role mapping.

---

## P1 / HIGH — Existing `requirePermission()` is not session-authoritative

**Evidence**

`app/lib/server/permissions.ts` resolves permissions using a hard-coded staff email rather than the current verified session and uses the general Supabase client.

**Impact**

This helper cannot safely represent the authorization of the requesting user and must not be reused to secure sensitive operations in its current form.

**Recommendation**

Consolidate authorization around `requireSession()` / `getCurrentAuthContext()` (or a successor) and have route-level permission checks derive identity exclusively from the verified server session.

**Production risk of remediation:** MEDIUM. Migrate callers incrementally and test role matrices.

---

## P1 / HIGH — Public Bridge status leaks operational access-control details

**Evidence**

`/api/bridge/status` is public and returns Bridge status payload, last badge information, local Bridge URLs, process/watchdog information and error details.

**Impact**

Operational data useful for system fingerprinting, including recent credential activity and local architecture details, is exposed to unauthenticated callers that can reach BodyGate.

**Recommendation**

Split health from diagnostics. Keep only a minimal liveness response public if absolutely required; protect detailed diagnostics with server authentication/permission or machine trust.

**Production risk of remediation:** LOW/MEDIUM, but confirm dashboard/startup dependencies first.

---

## P1 / HIGH — Public access log integrity depends on machine-auth configuration

**Evidence**

`/api/access/log` uses the Supabase service role to insert caller-supplied technical access-log fields. The middleware protects it only when machine auth is in `observe/enforce`, with `off` being the default.

**Impact**

If machine auth is off, untrusted callers can pollute security/audit telemetry. This can undermine incident reconstruction even when it does not directly open the turnstile.

**Recommendation**

Require authenticated machine ingestion in production and validate/normalize payload fields server-side.

**Production risk of remediation:** HIGH if official Bridge headers are not synchronized; current Bridge source does support the machine key header.

---

## P1 / HIGH — Local Bridge `/open*` endpoints have no application-level authentication

**Evidence**

The C# Bridge listens only on `127.0.0.1` / `localhost`, which is a valuable boundary, but `/open`, `/open0`, `/open1`, and related paths directly execute the controller-open routine and perform no secret/authorization validation. The response also enables permissive CORS.

**Impact**

The endpoint is not remotely reachable through the Bridge listener under the current bind configuration, but any untrusted code/process/browser context capable of issuing requests to localhost on the BodyGate host may attempt to trigger it.

**Recommendation**

Preserve loopback binding and add defense-in-depth authentication for open commands, ideally reusing a separate Bridge-local secret or an equivalent authenticated IPC boundary. Do this only with coordinated changes to all local callers.

**Production risk of remediation:** CRITICAL if callers are not migrated atomically.

---

## P1 / HIGH — Login endpoint has no visible rate limiting/backoff

**Evidence**

`/api/auth/login` performs credential lookup and bcrypt verification but contains no route-level throttling, lockout or IP/account backoff.

**Impact**

If the login endpoint is internet/LAN reachable by untrusted clients, repeated password attempts are not explicitly constrained by the application.

**Recommendation**

Add an appropriate rate-limit/backoff design at reverse-proxy/platform and/or application level. Preserve generic login errors.

**Production risk of remediation:** LOW/MEDIUM.

---

## P1 / HIGH — Session signing secret falls back to Supabase service-role secret

**Evidence**

`app/lib/auth/session.ts` uses `BODYGATE_SESSION_SECRET`, but falls back to `SUPABASE_SERVICE_ROLE_KEY`.

**Impact**

This unnecessarily couples two high-value trust domains. A dedicated session secret should be mandatory rather than deriving session integrity from the database service credential.

**Recommendation**

Require a dedicated `BODYGATE_SESSION_SECRET` in production and add startup/config validation. Remove the fallback only after confirming the production variable is installed on every runtime.

**Production risk of remediation:** HIGH if deployed before the environment variable is present; existing sessions will also be invalidated when the signing key changes.

---

## P2 / MEDIUM — Access-check error/debug responses expose internal diagnostics

**Evidence**

The access-check route can return badge lookup path/debug information for unknown credentials and can return internal exception messages on HTTP 500.

**Impact**

When the endpoint is reachable by an untrusted caller, internal schema/query behavior can be disclosed and errors may reveal configuration/runtime details.

**Recommendation**

Keep detailed diagnostics server-side/log-only; return a minimal fail-closed response to machine clients.

**Production risk of remediation:** LOW if the Bridge does not depend on debug fields.

---

## P2 / MEDIUM — Middleware performs a live Supabase active-user lookup for protected requests

**Evidence**

After validating the signed session, `middleware.ts` calls Supabase REST with the service role to confirm `app_users.active=true`.

**Impact**

This provides immediate user deactivation (positive) but puts a database/network dependency on every protected request and can amplify latency or turn a Supabase/network incident into broad application unavailability.

**Recommendation**

Keep the security property while measuring latency/error rate. Consider bounded caching/revalidation or a centralized server auth strategy only after threat-model review.

**Production risk of remediation:** MEDIUM because it changes session revocation behavior.

---

## P2 / MEDIUM — Current access decision path performs multiple database operations per badge

**Evidence**

`/api/access/check` performs credential lookup, customer lookup, block/membership/subscription reads and synchronous logging/presence writes. Some independent reads/writes are already parallelized.

**Impact**

Correctness is currently prioritized, but the physical-opening latency remains sensitive to Supabase/network/database performance. A database write failure in the success persistence stage can also convert an otherwise valid decision into an API failure.

**Recommendation**

Profile with existing latency tooling before changing behavior. Any optimization must preserve fail-closed rules and audit/presence invariants. Consider an explicitly designed access-decision RPC only after schema/live-data review; do not refactor this hot path casually.

**Production risk of remediation:** CRITICAL. Protected path.

---

## P2 / MEDIUM — Incomplete automated quality gate

**Evidence**

The repository exposes scripts for typecheck, lint, build and Playwright responsive QA, but the current tree does not show a `.github/workflows` CI pipeline. Automated tests visible in the tree are limited relative to the size and criticality of the codebase.

**Impact**

Regressions can reach review/merge without an independent reproducible build/test gate, particularly in access, auth, payments and receipts.

**Recommendation**

Add non-production CI for typecheck/lint/build and targeted unit/integration tests. Hardware must be mocked; CI must never call live access devices or production Supabase writes.

**Production risk of remediation:** LOW if CI is read-only/non-deploying.

---

## TECHNICAL DEBT — Security/architecture documentation is only partially populated

**Evidence**

Several high-value documentation files exist but are empty (including access engine, database, hardware, roadmap/training-related placeholders), while security hotfix documents contain valuable operational knowledge.

**Impact**

AI agents and human maintainers may infer architecture from code rather than a canonical source, increasing drift and accidental changes.

**Recommendation**

Create a canonical architecture/security map and keep it synchronized with code and production runtime.

---

## TECHNICAL DEBT — Large/duplicate UI and backup artifacts

**Evidence**

The repository contains very large UI modules (for example the customer details client), backup source files and multiple overlapping UI component directories.

**Impact**

Higher cognitive load, harder review, duplicated behavior and increased AI-edit risk.

**Recommendation**

Handle as a dedicated, non-functional cleanup/refactor program after security boundaries are stabilized. Do not mix it into security or access-control fixes.

---

# Positive controls already present

The audit also confirms several good patterns that should be preserved:

- HMAC-signed HttpOnly application sessions with expiration validation.
- Server-side reload of active application users.
- Generic invalid-credential login response.
- Dedicated machine-key mechanism already supported by middleware and the production Bridge code.
- BodyGate access decision is fail-closed when the API call fails.
- Official subscription access rule checks active status plus start/end date.
- Independent access reads and success persistence operations are partially parallelized for latency without changing business rules.
- Security Hotfix 0.1 documents database privilege hardening and explicit rollback/verification.
- Security Hotfix 0.2 documents atomic/idempotent subscription renewal with database transaction protection.
- `.env*`, logs, .NET build output and local runtime artifacts are ignored by Git.
- Bridge HTTP listener is constrained to loopback in the reviewed source.

---

# Recommended remediation order

## Phase 0 — Governance (safe now)

- Adopt the expanded `AGENTS.md` AI guardrails.
- Keep AI changes on branches/draft PRs; no autonomous merge/deploy.

## Phase 1 — Credential containment

- Make repository private or otherwise remove public exposure of operational source.
- Inventory tracked/history secrets without printing them.
- Plan coordinated controller/DNake credential rotation and externalization.

## Phase 2 — Physical-access trust boundaries

- Determine whether `/api/dnake/event` is used in current production now that Bridge SQL polling is the official path.
- Protect/decommission that route accordingly.
- Enforce safe machine authentication for `/api/access/check` and `/api/access/log` after verifying all production callers.
- Protect detailed Bridge diagnostics.
- Add authoritative permission checks to manual-open routes.
- Replace the hard-coded permission helper with session-derived authorization.

## Phase 3 — Authentication hardening

- Require dedicated session secret.
- Add login rate limiting/backoff.
- Minimize public error/debug payloads.

## Phase 4 — Live Supabase audit

Read-only first:

- schemas/tables/views/functions/triggers;
- RLS enabled state;
- policies;
- grants for `anon`, `authenticated`, `service_role`;
- SECURITY DEFINER functions and search paths;
- indexes/FKs/unique constraints;
- orphan/duplicate-risk checks;
- access/payment/receipt transaction boundaries.

Only after a reviewed report should SQL remediation be proposed.

## Phase 5 — Runtime/Windows audit

On the BodyGate host, read-only first:

- `.env.local` presence/required-variable names (never print values);
- running Node/Bridge processes;
- Task Scheduler definitions;
- startup paths and working directories;
- health checks and restart behavior;
- log rotation/disk growth;
- port bindings/firewall exposure;
- reboot/cold-boot recovery.

## Phase 6 — Quality gate

- CI: typecheck + lint + build.
- Unit tests for auth/permissions/access decisions.
- Integration tests with mock Supabase/hardware.
- Playwright UI tests without production writes.
- Branch protection/review policy before merge.

---

# AI autonomy boundary after this audit

Until P0/P1 access-control findings are resolved, an AI agent may autonomously:

- read/analyze the repository;
- produce reports/docs;
- create isolated branches;
- propose non-destructive tests;
- create draft PRs;
- refactor only low-risk areas explicitly assigned by a human.

It must not autonomously:

- merge/deploy;
- alter production Supabase;
- rotate secrets;
- change Bridge/DNake/KT02 behavior;
- change machine-auth enforcement;
- invoke a physical-open path;
- change financial/receipt invariants;
- change Windows startup/tasks on the live host.

This boundary should be relaxed only after the relevant security controls and automated QA are in place.
